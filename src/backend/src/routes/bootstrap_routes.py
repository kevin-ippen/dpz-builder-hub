"""Bootstrap routes — admin-only guided onboarding for new deployments.

Three-step flow:
  1. POST /api/bootstrap/scan   — enumerate UC objects via SQL warehouse
  2. POST /api/bootstrap/analyze — infer domains, capabilities, maturity
  3. POST /api/bootstrap/commit  — batch-create assets, domains, teams, capabilities
"""

import os
import re
import json
from collections import defaultdict
from typing import Any, Dict, List, Optional, Set
from uuid import uuid4

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field

from databricks.sdk import WorkspaceClient
from databricks.sdk.service.sql import StatementState

from src.common.authorization import PermissionChecker
from src.common.features import FeatureAccessLevel
from src.common.dependencies import DBSessionDep, CurrentUserDep
from src.common.logging import get_logger

import sqlalchemy as sa

logger = get_logger(__name__)

router = APIRouter(prefix="/api/bootstrap", tags=["Bootstrap"])

FEATURE_ID = "settings"  # Admin-only


# ---------------------------------------------------------------------------
# Request / Response models
# ---------------------------------------------------------------------------

class ScanRequest(BaseModel):
    catalogs: List[str] = Field(default_factory=lambda: ["*"])
    include_types: List[str] = Field(
        default_factory=lambda: ["TABLE", "VIEW", "MODEL", "FUNCTION", "VOLUME"]
    )
    exclude_patterns: List[str] = Field(default_factory=list)


class ObjectMeta(BaseModel):
    name: str
    object_type: str
    path: str  # catalog.schema.object
    description: Optional[str] = None
    owner: Optional[str] = None
    tags: List[str] = Field(default_factory=list)
    last_modified: Optional[str] = None
    row_count: Optional[int] = None
    has_quality_monitor: bool = False
    has_lineage: bool = False
    inferred_maturity: int = 1


class SchemaNode(BaseModel):
    name: str
    path: str  # catalog.schema
    children_count: int = 0
    children: List[ObjectMeta] = Field(default_factory=list)


class CatalogNode(BaseModel):
    name: str
    path: str
    children_count: int = 0
    schemas: List[SchemaNode] = Field(default_factory=list)


class ScanResponse(BaseModel):
    scan_id: str
    summary: Dict[str, Any]
    tree: List[CatalogNode]


class AnalyzeRequest(BaseModel):
    scan_id: str
    selected_paths: List[str]  # list of catalog.schema or catalog.schema.object


class ProposedDomain(BaseModel):
    name: str
    schemas: List[str]
    asset_count: int


class ProposedCapability(BaseModel):
    name: str
    matched_assets: int
    reason: str


class ProposedTeam(BaseModel):
    name: str
    source: str  # 'workspace_group' | 'owner_inferred'
    member_count: int = 0
    owned_assets: int = 0


class AnalyzeResponse(BaseModel):
    proposed_domains: List[ProposedDomain]
    proposed_capabilities: List[ProposedCapability]
    proposed_teams: List[ProposedTeam]
    maturity_distribution: Dict[str, int]
    quick_wins: List[Dict[str, Any]]


class CommitRequest(BaseModel):
    scan_id: str
    selected_paths: List[str]
    domains: List[Dict[str, Any]] = Field(default_factory=list)
    capabilities: List[Dict[str, Any]] = Field(default_factory=list)
    teams: List[Dict[str, Any]] = Field(default_factory=list)


class CommitResponse(BaseModel):
    created: Dict[str, int]
    duration_seconds: float


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _get_warehouse_id() -> str:
    """Resolve SQL warehouse ID from app resources or env."""
    wid = os.environ.get("DATABRICKS_WAREHOUSE_ID", "")
    if wid:
        return wid
    # Fallback: inspect app resources
    try:
        w = WorkspaceClient()
        for r in getattr(w.config, '_resources', None) or []:
            if hasattr(r, 'sql_warehouse'):
                return r.sql_warehouse.id
    except Exception:
        pass
    return ""


def _run_sql(warehouse_id: str, sql: str) -> List[List[Any]]:
    """Execute SQL via Statement Execution API. Returns list of row arrays."""
    w = WorkspaceClient()
    stmt = w.statement_execution.execute_statement(
        warehouse_id=warehouse_id,
        statement=sql,
        wait_timeout="50s",
    )
    if stmt.status.state != StatementState.SUCCEEDED:
        err = stmt.status.error.message if stmt.status.error else "unknown"
        raise HTTPException(status_code=500, detail=f"SQL failed: {err}")
    if not stmt.result or not stmt.result.data_array:
        return []
    return stmt.result.data_array


def _sql_columns(warehouse_id: str, sql: str) -> tuple:
    """Execute SQL, return (columns, rows)."""
    w = WorkspaceClient()
    stmt = w.statement_execution.execute_statement(
        warehouse_id=warehouse_id,
        statement=sql,
        wait_timeout="50s",
    )
    if stmt.status.state != StatementState.SUCCEEDED:
        err = stmt.status.error.message if stmt.status.error else "unknown"
        raise HTTPException(status_code=500, detail=f"SQL failed: {err}")
    cols = [c.name for c in stmt.manifest.schema.columns] if stmt.manifest else []
    rows = stmt.result.data_array if stmt.result and stmt.result.data_array else []
    return cols, rows


def _matches_exclude(name: str, patterns: List[str]) -> bool:
    """Check if a name matches any exclusion pattern (simple glob)."""
    for pat in patterns:
        regex = pat.replace("*", ".*").replace("?", ".")
        if re.fullmatch(regex, name, re.IGNORECASE):
            return True
    return False


# Asset type ID map (from app_ontos.asset_types)
_ASSET_TYPE_IDS = {
    "TABLE": "3def5072-6a10-499c-ba08-8876cb7181b6",
    "VIEW": "4dd6e976-d5bc-4719-a1be-afb18d5a37fc",
    "MODEL": "a54c00f4-0d71-4bbd-a23f-73b86aaa916d",
    "DASHBOARD": "772e4ad3-84bb-4471-bd72-d996f8f99be4",
    "SCHEMA": "a0a4edbb-51eb-4fc0-8903-6f835cddad5c",
}
_DEFAULT_ASSET_TYPE_ID = "3def5072-6a10-499c-ba08-8876cb7181b6"  # Table


# Capability keyword map — maps table/description keywords to capability names
_CAPABILITY_KEYWORDS = {
    "forecast": "demand-forecasting",
    "predict": "predictive-analytics",
    "customer": "customer-analytics",
    "segment": "customer-segmentation",
    "churn": "churn-prediction",
    "inventory": "inventory-management",
    "supply": "supply-chain",
    "fraud": "fraud-detection",
    "recommend": "recommendations",
    "price": "pricing-optimization",
    "sentiment": "sentiment-analysis",
    "revenue": "revenue-analytics",
    "marketing": "marketing-analytics",
    "risk": "risk-management",
    "compliance": "compliance-monitoring",
    "quality": "data-quality",
    "lineage": "data-lineage",
    "real.time": "real-time-analytics",
    "stream": "streaming-data",
    "geospatial": "geospatial-analytics",
}


def _infer_maturity(obj: dict) -> int:
    """Score 1-5 maturity from UC metadata signals."""
    level = 1  # Accessible (exists + owner known)
    if obj.get("description"):
        level = max(level, 2)  # Described
    if obj.get("has_lineage"):
        level = max(level, 3)  # Defined
    if obj.get("has_quality_monitor"):
        level = max(level, 4)  # Monitored
    # Level 5 (Trusted) requires explicit certification — never auto-assigned
    return level


def _infer_capabilities(name: str, description: str) -> List[str]:
    """Match keywords to capability names."""
    text = f"{name} {description}".lower()
    caps = []
    for keyword, cap_name in _CAPABILITY_KEYWORDS.items():
        if re.search(keyword, text):
            caps.append(cap_name)
    return caps


# ---------------------------------------------------------------------------
# Scan cache (in-memory per deployment — acceptable for admin wizard)
# ---------------------------------------------------------------------------
_scan_cache: Dict[str, Dict[str, Any]] = {}


# ---------------------------------------------------------------------------
# Routes
# ---------------------------------------------------------------------------

@router.post("/scan", response_model=ScanResponse)
async def bootstrap_scan(
    body: ScanRequest,
    current_user: CurrentUserDep,
    _: bool = Depends(PermissionChecker(FEATURE_ID, FeatureAccessLevel.READ_WRITE)),
):
    """Step 1: Discover UC objects across catalogs via SQL warehouse."""
    warehouse_id = _get_warehouse_id()
    if not warehouse_id:
        raise HTTPException(status_code=400, detail="No SQL warehouse configured")

    scan_id = uuid4().hex[:16]
    tree: List[CatalogNode] = []
    total_by_type: Dict[str, int] = defaultdict(int)
    all_objects: List[dict] = []

    # 1. List catalogs
    if "*" in body.catalogs:
        rows = _run_sql(warehouse_id, "SHOW CATALOGS")
        catalog_names = [r[0] for r in rows if r[0] and not r[0].startswith("__")]
    else:
        catalog_names = body.catalogs

    for cat_name in catalog_names:
        cat_node = CatalogNode(name=cat_name, path=cat_name)

        # 2. List schemas in this catalog
        try:
            schema_rows = _run_sql(warehouse_id, f"SHOW SCHEMAS IN `{cat_name}`")
        except Exception as e:
            logger.warning(f"Cannot list schemas in {cat_name}: {e}")
            continue

        for sr in schema_rows:
            schema_name = sr[0]
            if schema_name in ("information_schema", "default"):
                continue
            if _matches_exclude(schema_name, body.exclude_patterns):
                continue

            schema_path = f"{cat_name}.{schema_name}"
            schema_node = SchemaNode(name=schema_name, path=schema_path)

            # 3. Query information_schema for objects in this schema
            type_filter = ", ".join(f"'{t}'" for t in body.include_types)
            try:
                cols, obj_rows = _sql_columns(warehouse_id, f"""
                    SELECT
                        table_name,
                        table_type,
                        comment,
                        table_owner,
                        last_altered
                    FROM `{cat_name}`.information_schema.tables
                    WHERE table_schema = '{schema_name}'
                      AND table_type IN ({type_filter}, 'MANAGED', 'EXTERNAL', 'VIEW')
                    ORDER BY table_name
                    LIMIT 500
                """)
            except Exception as e:
                logger.warning(f"Cannot query {schema_path}: {e}")
                continue

            for row in obj_rows:
                obj_name = row[0]
                obj_type = row[1] or "TABLE"
                description = row[2] or ""
                owner = row[3] or ""
                last_mod = row[4] or ""

                if _matches_exclude(obj_name, body.exclude_patterns):
                    continue

                # Normalize type
                normalized_type = "TABLE"
                if "VIEW" in str(obj_type).upper():
                    normalized_type = "VIEW"
                elif "MODEL" in str(obj_type).upper():
                    normalized_type = "MODEL"

                obj_path = f"{schema_path}.{obj_name}"
                obj_dict = {
                    "name": obj_name,
                    "object_type": normalized_type,
                    "path": obj_path,
                    "description": description,
                    "owner": owner,
                    "last_modified": str(last_mod) if last_mod else None,
                    "has_lineage": bool(description),  # proxy: if described, likely has lineage
                    "has_quality_monitor": False,
                }
                obj_dict["inferred_maturity"] = _infer_maturity(obj_dict)

                obj_meta = ObjectMeta(**obj_dict)
                schema_node.children.append(obj_meta)
                schema_node.children_count += 1
                total_by_type[normalized_type] += 1
                all_objects.append(obj_dict)

            if schema_node.children_count > 0:
                cat_node.schemas.append(schema_node)
                cat_node.children_count += schema_node.children_count

        if cat_node.children_count > 0:
            tree.append(cat_node)

    # Try to enrich with quality monitor info (best-effort)
    try:
        monitor_rows = _run_sql(warehouse_id,
            "SELECT table_name FROM system.quality.monitors LIMIT 1000"
        )
        monitored = {r[0] for r in monitor_rows if r[0]}
        for obj in all_objects:
            fqn_table = obj["path"].split(".")[-1]
            if fqn_table in monitored or obj["path"] in monitored:
                obj["has_quality_monitor"] = True
                obj["inferred_maturity"] = max(obj["inferred_maturity"], 4)
    except Exception:
        pass  # system.quality might not be available

    total_objects = sum(total_by_type.values())
    summary = {
        "catalogs": len(tree),
        "schemas": sum(len(c.schemas) for c in tree),
        "objects": total_objects,
        "by_type": dict(total_by_type),
    }

    # Cache for analyze/commit steps
    _scan_cache[scan_id] = {
        "tree": tree,
        "objects": all_objects,
        "summary": summary,
    }

    return ScanResponse(scan_id=scan_id, summary=summary, tree=tree)


@router.post("/analyze", response_model=AnalyzeResponse)
async def bootstrap_analyze(
    body: AnalyzeRequest,
    current_user: CurrentUserDep,
    _: bool = Depends(PermissionChecker(FEATURE_ID, FeatureAccessLevel.READ_WRITE)),
):
    """Step 2: Analyze selected objects — propose domains, capabilities, teams, maturity."""
    cached = _scan_cache.get(body.scan_id)
    if not cached:
        raise HTTPException(status_code=404, detail="Scan not found — run /scan first")

    selected_set = set(body.selected_paths)
    all_objects = cached["objects"]

    # Filter to selected objects (match by exact path or parent schema path)
    selected_objs = []
    for obj in all_objects:
        obj_path = obj["path"]
        schema_path = ".".join(obj_path.split(".")[:2])
        if obj_path in selected_set or schema_path in selected_set:
            selected_objs.append(obj)

    if not selected_objs:
        raise HTTPException(status_code=400, detail="No objects match the selected paths")

    # --- Domain inference ---
    schema_groups: Dict[str, List[dict]] = defaultdict(list)
    for obj in selected_objs:
        schema_path = ".".join(obj["path"].split(".")[:2])
        schema_groups[schema_path].append(obj)

    proposed_domains = []
    for schema_path, objs in schema_groups.items():
        # Use schema name as domain name, title-cased
        schema_name = schema_path.split(".")[-1]
        domain_name = schema_name.replace("_", " ").title()
        proposed_domains.append(ProposedDomain(
            name=domain_name,
            schemas=[schema_path],
            asset_count=len(objs),
        ))

    # --- Capability inference ---
    cap_counts: Dict[str, int] = defaultdict(int)
    cap_reasons: Dict[str, str] = {}
    for obj in selected_objs:
        caps = _infer_capabilities(obj["name"], obj.get("description") or "")
        for cap in caps:
            cap_counts[cap] += 1
            if cap not in cap_reasons:
                cap_reasons[cap] = f"name/description contains '{cap.split('-')[0]}'"

    proposed_capabilities = [
        ProposedCapability(name=cap, matched_assets=count, reason=cap_reasons.get(cap, ""))
        for cap, count in sorted(cap_counts.items(), key=lambda x: -x[1])
    ]

    # --- Team inference (from owners) ---
    owner_counts: Dict[str, int] = defaultdict(int)
    for obj in selected_objs:
        owner = obj.get("owner", "").strip()
        if owner:
            owner_counts[owner] += 1

    proposed_teams = []
    for owner, count in sorted(owner_counts.items(), key=lambda x: -x[1])[:20]:
        # Derive team name from email prefix or group name
        team_name = owner.split("@")[0].replace(".", "-") if "@" in owner else owner
        proposed_teams.append(ProposedTeam(
            name=f"team-{team_name}",
            source="owner_inferred",
            owned_assets=count,
        ))

    # --- Maturity distribution ---
    maturity_dist = {"L1_accessible": 0, "L2_described": 0, "L3_defined": 0,
                     "L4_monitored": 0, "L5_trusted": 0}
    for obj in selected_objs:
        level = obj.get("inferred_maturity", 1)
        key = f"L{level}_{['', 'accessible', 'described', 'defined', 'monitored', 'trusted'][level]}"
        maturity_dist[key] = maturity_dist.get(key, 0) + 1

    # --- Quick wins ---
    quick_wins = []
    no_desc = sum(1 for o in selected_objs if not o.get("description"))
    if no_desc > 0:
        quick_wins.append({
            "action": "add_description",
            "count": no_desc,
            "impact": f"Promotes {no_desc} assets from L1 → L2",
        })
    no_owner = sum(1 for o in selected_objs if not o.get("owner"))
    if no_owner > 0:
        quick_wins.append({
            "action": "assign_owner",
            "count": no_owner,
            "impact": f"{no_owner} assets have no owner in UC",
        })

    # Cache selected for commit
    _scan_cache[body.scan_id]["selected"] = selected_objs

    return AnalyzeResponse(
        proposed_domains=proposed_domains,
        proposed_capabilities=proposed_capabilities,
        proposed_teams=proposed_teams,
        maturity_distribution=maturity_dist,
        quick_wins=quick_wins,
    )


@router.post("/commit", response_model=CommitResponse)
async def bootstrap_commit(
    body: CommitRequest,
    db: DBSessionDep,
    current_user: CurrentUserDep,
    _: bool = Depends(PermissionChecker(FEATURE_ID, FeatureAccessLevel.READ_WRITE)),
):
    """Step 3: Batch-create assets, domains, teams, capabilities from analyzed scan."""
    import time
    start = time.monotonic()

    cached = _scan_cache.get(body.scan_id)
    if not cached:
        raise HTTPException(status_code=404, detail="Scan not found — run /scan first")

    selected_objs = cached.get("selected", [])
    if not selected_objs:
        # Resolve from selected_paths if analyze wasn't called
        selected_set = set(body.selected_paths)
        selected_objs = [
            o for o in cached["objects"]
            if o["path"] in selected_set
            or ".".join(o["path"].split(".")[:2]) in selected_set
        ]

    user_email = current_user.email if current_user else "admin@example.com"
    counts = {"assets": 0, "domains": 0, "teams": 0, "capabilities": 0}

    # --- Create domains ---
    domain_id_map: Dict[str, str] = {}  # domain_name -> id
    for d in body.domains:
        domain_name = d.get("name", "")
        if not domain_name:
            continue
        did = str(uuid4())
        try:
            db.execute(sa.text("""
                INSERT INTO data_domains (id, name, description, created_by)
                VALUES (:id, :name, :desc, :user)
                ON CONFLICT (name) DO NOTHING
            """), {
                "id": did,
                "name": domain_name,
                "desc": "Auto-created during bootstrap",
                "user": user_email,
            })
            domain_id_map[domain_name] = did
            counts["domains"] += 1
        except Exception as e:
            logger.warning(f"Domain create failed for {domain_name}: {e}")

    # --- Create teams ---
    for t in body.teams:
        team_name = t.get("name", "")
        if not team_name:
            continue
        try:
            db.execute(sa.text("""
                INSERT INTO teams (id, name, title, description, created_by, updated_by)
                VALUES (:id, :name, :title, :desc, :user, :user)
                ON CONFLICT (name) DO NOTHING
            """), {
                "id": str(uuid4()),
                "name": team_name,
                "title": team_name.replace("-", " ").title(),
                "desc": f"Inferred from UC object ownership",
                "user": user_email,
            })
            counts["teams"] += 1
        except Exception as e:
            logger.warning(f"Team create failed for {team_name}: {e}")

    # --- Create capabilities ---
    cap_id_map: Dict[str, str] = {}
    for c in body.capabilities:
        cap_name = c.get("name", "")
        if not cap_name:
            continue
        cid = str(uuid4())
        slug = cap_name.lower().replace(" ", "-")
        try:
            db.execute(sa.text("""
                INSERT INTO capabilities (id, slug, name, description)
                VALUES (:id, :slug, :name, :desc)
                ON CONFLICT (slug) DO NOTHING
            """), {
                "id": cid,
                "slug": slug,
                "name": cap_name,
                "desc": c.get("reason", "Inferred from asset naming patterns"),
            })
            cap_id_map[cap_name] = cid
            counts["capabilities"] += 1
        except Exception as e:
            logger.warning(f"Capability create failed for {cap_name}: {e}")

    # --- Create assets ---
    for obj in selected_objs:
        aid = str(uuid4())
        obj_type = obj.get("object_type", "TABLE")
        asset_type_id = _ASSET_TYPE_IDS.get(obj_type, _DEFAULT_ASSET_TYPE_ID)

        # Split path into catalog.schema.table
        parts = obj["path"].split(".")
        uc_catalog = parts[0] if len(parts) > 0 else ""
        uc_schema = parts[1] if len(parts) > 1 else ""
        uc_table = parts[2] if len(parts) > 2 else ""

        # Determine domain from schema grouping
        schema_path = f"{uc_catalog}.{uc_schema}"
        domain_name = None
        for d in body.domains:
            if schema_path in d.get("schemas", []):
                domain_name = d.get("name")
                break

        maturity_label = ["idea", "accessible", "described", "defined", "monitored", "trusted"][
            min(obj.get("inferred_maturity", 1), 5)
        ]

        try:
            db.execute(sa.text("""
                INSERT INTO assets (
                    id, name, description, asset_type_id,
                    uc_catalog, uc_schema, uc_table,
                    owner_email, domain, maturity, status,
                    created_by
                ) VALUES (
                    :id, :name, :desc, :type_id,
                    :cat, :sch, :tbl,
                    :owner, :domain, :maturity, 'active',
                    :user
                )
            """), {
                "id": aid,
                "name": obj["name"],
                "desc": obj.get("description") or "",
                "type_id": asset_type_id,
                "cat": uc_catalog,
                "sch": uc_schema,
                "tbl": uc_table,
                "owner": obj.get("owner") or user_email,
                "domain": domain_name,
                "maturity": maturity_label,
                "user": user_email,
            })
            counts["assets"] += 1
        except Exception as e:
            logger.warning(f"Asset create failed for {obj['path']}: {e}")
            continue  # Skip capability linking if asset failed

        # Link to inferred capabilities
        caps = _infer_capabilities(obj["name"], obj.get("description") or "")
        for cap_name in caps:
            cid = cap_id_map.get(cap_name)
            if cid:
                try:
                    db.execute(sa.text("""
                        INSERT INTO asset_capabilities (asset_id, capability_id)
                        VALUES (:aid, :cid)
                        ON CONFLICT DO NOTHING
                    """), {"aid": aid, "cid": cid})
                except Exception:
                    pass

    db.commit()

    duration = round(time.monotonic() - start, 2)

    # Cleanup cache
    _scan_cache.pop(body.scan_id, None)

    return CommitResponse(created=counts, duration_seconds=duration)


@router.get("/status")
async def bootstrap_status(
    db: DBSessionDep,
    current_user: CurrentUserDep,
    _: bool = Depends(PermissionChecker(FEATURE_ID, FeatureAccessLevel.READ_WRITE)),
):
    """Check if bootstrap has been run (are there assets from bootstrap?)."""
    result = db.execute(sa.text(
        "SELECT COUNT(*) FROM assets WHERE lifecycle_stage = 'registered'"
    )).scalar()
    return {
        "bootstrapped": (result or 0) > 0,
        "registered_assets": result or 0,
    }


# ---------------------------------------------------------------------------
# Registration
# ---------------------------------------------------------------------------

def register_routes(app):
    app.include_router(router)
