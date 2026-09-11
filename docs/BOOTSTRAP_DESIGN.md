# Bootstrap & Initial Ingest Design

## The Problem

The current onboarding path is: deploy app → load demo preset → manually register assets one by one. That's fine for a demo, terrible for real adoption. A new client with 500 tables across 15 schemas, a GitHub org with 40 repos, JIRA boards with 200 open data tickets, and teams that already own things informally has no path from "empty Builder Hub" to "populated with our actual stuff" that doesn't involve weeks of manual data entry.

## What Exists Today

The codebase already has meaningful building blocks:

| Component | What It Does | Gap |
|-----------|-------------|-----|
| **Schema Importer** (`/schema-importer`) | Browse a connection → select paths → preview → import as assets | Requires a pre-configured Connection; no first-run wizard; no batch enrichment |
| **Databricks Connector** (`connectors/databricks.py`) | Lists catalogs, schemas, tables, functions, models, volumes, metrics via SDK | Solid — the browse/metadata layer works |
| **UC Bulk Import** (workflow) | Tag-driven import: scans UC objects with governed tags → creates contracts/products/domains | Requires tags already applied — chicken-and-egg for new clients |
| **Self-Service Bootstrap** (`/self-service/bootstrap`) | Creates personal team + project for a user | Too narrow — bootstraps one user's sandbox, not the org |
| **Demo Data Loader** (`/settings/demo-data/load`) | Loads a vertical preset SQL file | Fake data — useful for demos, not for populating with real assets |
| **Connector Registry** | Databricks, Snowflake, BigQuery, Kafka, PowerBI connectors registered | Only Databricks is needed for MVP; others are bonus |

## What's Missing: The Bootstrap Wizard

A guided, multi-step flow that takes a new deployment from empty to populated in a single sitting. The key UX insight: **it should feel like shopping, not data entry.** Scan everything, present it in a browsable tree, let the user select/deselect at whatever granularity they want.

### Step 1: Discovery Scan

**Backend**: `POST /api/bootstrap/scan`

Uses the existing Databricks connector to enumerate the workspace. Returns a hierarchical tree:

```
├── catalog_a (42 tables, 3 models, 2 volumes)
│   ├── bronze (18 tables)
│   ├── silver (15 tables)  
│   └── gold (9 tables, 3 models)
├── catalog_b (127 tables, 12 dashboards)
│   ├── marketing (45 tables)
│   └── finance (82 tables)
└── shared (5 models, 8 functions)
```

For each object, pull from `information_schema` and system tables:
- Description (from UC comments)
- Owner (from UC grants / creator)
- Tags (existing UC tags)
- Last modified (from system tables)
- Row count / size estimate (from table properties)
- Upstream/downstream lineage (from `system.access.table_lineage`)
- Quality monitor status (from `system.quality.monitors`)

**Frontend**: Full-height tree with checkboxes at every level. Select/deselect individual tables, entire schemas, or whole catalogs. Search/filter bar. Summary sidebar: "Selected: 127 tables, 3 models across 4 schemas."

**Key difference from existing Schema Importer**: No pre-configured Connection required. Uses the app's own SQL warehouse + SDK. One-click "Scan My Workspace" button on first boot.

### Step 2: Smart Grouping & Domain Inference

**Backend**: `POST /api/bootstrap/analyze`

Takes the selected objects and proposes organizational structure:

- **Domain inference**: Group by catalog or schema naming patterns. `marketing.*` → Marketing domain. `finance.*` → Finance domain. Let the user rename/merge/split.
- **Capability suggestion**: From descriptions + table names, suggest capabilities. Tables named `*forecast*` → `demand-forecasting` capability. `*customer*` + `*segment*` → `customer-segmentation`.
- **Maturity pre-scoring**: Auto-evaluate the 5-level gates against UC metadata:
  - Has owner? → L1 (Accessible)
  - Has description + tags? → L2 (Described)
  - Has lineage? → L3 (Defined)
  - Has quality monitor? → L4 (Monitored)
  - Has certification tag? → L5 (Trusted)
  
  Show the user: "Of your 127 selected tables, 89 are at Accessible, 31 at Described, 7 at Defined, 0 at Monitored or Trusted."

- **Team suggestion**: Pull Databricks workspace groups → suggest as teams. Map table owners to team ownership.

**Frontend**: Card-based review UI. Each proposed domain shows its tables, suggested capabilities, team. Drag-and-drop to reorganize. Inline rename. "Looks good" / "Let me adjust" flow.

### Step 3: External Source Import (opt-in panels)

Expandable accordion panels for optional external sources. Each is independently toggleable — you don't need all of them.

#### 3a. Git Repos

**What it does**: User pastes a GitHub/GitLab org URL or selects repos. Scanner looks for:
- `dbt_project.yml` → parse `manifest.json` for model definitions, tests, docs
- `README.md` → import as Learn content (team knowledge)
- Repo metadata (languages, last commit, contributors) → enrich related assets

**Selection UX**: Repo list with checkboxes. For each repo, show what was found: "3 dbt models, 1 README, 12 contributors."

**Carryover**: Selected repo items become:
- dbt models → Assets (linked to their UC table if name matches)
- READMEs → Learn content (channel: team)
- Contributors → suggested team members

#### 3b. JIRA / Azure DevOps

**What it does**: Connect to project tracker. Import open issues tagged as data-related.

**Selection UX**: Board/project picker → filter by label/type → checkbox list of issues.

**Carryover**: Selected tickets become:
- Wishlist demands (with original requester as author, vote count from watchers)
- Status mapping: To Do → Open, In Progress → Claimed, Done → Shipped
- Labels → Capability tags

#### 3c. Confluence / SharePoint

**What it does**: Search for data documentation pages.

**Selection UX**: Space picker → search within space → checkbox list.

**Carryover**: Selected pages become:
- Learn content (channel: team, source: confluence)
- If page references a table name that matches a selected asset → auto-link

### Step 4: Review & Commit

**Frontend**: Full summary page showing everything that will be created:

```
Assets:          127 (89 tables, 15 views, 12 dashboards, 8 models, 3 functions)
Domains:         4 (Marketing, Finance, Operations, Shared)
Teams:           6 (mapped from workspace groups)
Capabilities:    11 (inferred from naming + descriptions)
Wishlist Demands: 23 (from JIRA import)
Learn Content:   8 (from git READMEs + Confluence pages)

Maturity Distribution:
  L1 Accessible:  89  ████████████████████░░░░░  70%
  L2 Described:    31  ███████░░░░░░░░░░░░░░░░░░  24%
  L3 Defined:       7  ██░░░░░░░░░░░░░░░░░░░░░░░   6%
  L4 Monitored:     0  ░░░░░░░░░░░░░░░░░░░░░░░░░   0%
  L5 Trusted:       0  ░░░░░░░░░░░░░░░░░░░░░░░░░   0%
```

**"Commit Bootstrap"** button runs the import. Progress bar with real-time counts.

**Backend**: `POST /api/bootstrap/commit`

Batch-creates all entities in a single transaction. Uses existing `SchemaImportManager.execute_import()` for assets, bulk INSERTs for demands/learn content, and the maturity snapshot engine for initial scoring.

### Step 5: What's Next (guided follow-up)

After commit, show a "What to do next" card:

1. **"Your maturity gap"**: "89 of 127 assets are stuck at L1 (Accessible). The biggest blocker: missing descriptions. Here's a quick-win list of 31 tables that have lineage and tags but no description — adding descriptions would promote them to L2." → Link to bulk-edit view.

2. **"Your capability gaps"**: "You have 11 capabilities but 3 have zero assets at L3+. These are your weakest areas: [list]." → Link to Wishlist filtered by those capabilities.

3. **"Invite your team"**: "6 teams were created but only 1 has members. Share this link to let people claim their team." → Team invite flow.

## Implementation Plan

### Phase 1: UC Discovery Wizard (highest impact, uses existing code)

**Backend changes:**
- New route file: `bootstrap_routes.py`
  - `POST /api/bootstrap/scan` — wraps `DatabricksConnector.list_assets()` with summary aggregation
  - `POST /api/bootstrap/analyze` — domain/capability/maturity inference engine
  - `POST /api/bootstrap/commit` — orchestrates `SchemaImportManager.execute_import()` + bulk inserts
- New controller: `bootstrap_manager.py`
  - `scan_workspace()` — enumerate UC objects via SQL warehouse
  - `analyze_selection()` — infer domains, capabilities, maturity pre-scores
  - `execute_bootstrap()` — batch import with transaction safety

**Frontend changes:**
- New view: `views/bootstrap-wizard.tsx` — multi-step wizard (Scan → Review → Commit → Next Steps)
- New component: `components/bootstrap/catalog-tree.tsx` — tree with checkboxes, search, counts
- New component: `components/bootstrap/domain-mapper.tsx` — drag-and-drop domain assignment
- New component: `components/bootstrap/maturity-preview.tsx` — distribution bar chart
- Home page: show "Bootstrap Your Workspace" CTA when asset count is 0

**Estimated effort**: 3-5 days for a senior dev who knows the codebase. The Databricks connector and Schema Import Manager do the heavy lifting.

### Phase 2: External Connectors (Git → JIRA → Confluence)

Each is an independent module behind the module flag system:

| Connector | Module Flag | Effort | Dependency |
|-----------|-------------|--------|------------|
| Git (GitHub API) | `MODULE_CONNECTOR_GIT` | 2-3 days | GitHub PAT or OAuth App |
| JIRA (REST API) | `MODULE_CONNECTOR_JIRA` | 2-3 days | JIRA API token |
| Confluence (REST API) | `MODULE_CONNECTOR_CONFLUENCE` | 2 days | Atlassian API token |
| Azure DevOps | `MODULE_CONNECTOR_ADO` | 2-3 days | ADO PAT |

### Phase 3: Incremental Re-scan

After initial bootstrap, the scan should be re-runnable:
- "What's new since last scan" — diff against existing assets
- "What changed" — description/tag/owner updates in UC since last sync
- Scheduled option: daily/weekly re-scan as a background job

## API Contract (Phase 1)

### `POST /api/bootstrap/scan`

**Request:**
```json
{
  "catalogs": ["*"],           // or specific catalog names
  "include_types": ["TABLE", "VIEW", "MODEL", "FUNCTION", "VOLUME", "DASHBOARD"],
  "exclude_patterns": ["*_temp", "*_staging"]
}
```

**Response:**
```json
{
  "scan_id": "uuid",
  "timestamp": "2026-09-10T...",
  "summary": {
    "catalogs": 3,
    "schemas": 15,
    "objects": 847,
    "by_type": { "TABLE": 612, "VIEW": 98, "MODEL": 23, ... }
  },
  "tree": [
    {
      "name": "catalog_a",
      "type": "CATALOG",
      "path": "catalog_a",
      "children_count": 42,
      "children": [
        {
          "name": "bronze",
          "type": "SCHEMA",
          "path": "catalog_a.bronze",
          "children_count": 18,
          "children": [
            {
              "name": "orders",
              "type": "TABLE",
              "path": "catalog_a.bronze.orders",
              "metadata": {
                "description": "Raw order events",
                "owner": "data-eng@company.com",
                "tags": ["pii", "bronze"],
                "last_modified": "2026-09-08",
                "row_count": 12400000,
                "has_quality_monitor": false,
                "has_lineage": true,
                "inferred_maturity": 3
              }
            }
          ]
        }
      ]
    }
  ]
}
```

### `POST /api/bootstrap/analyze`

**Request:**
```json
{
  "scan_id": "uuid",
  "selected_paths": ["catalog_a.bronze", "catalog_a.silver", "catalog_b.marketing.customers"]
}
```

**Response:**
```json
{
  "proposed_domains": [
    { "name": "Data Engineering", "schemas": ["catalog_a.bronze", "catalog_a.silver"], "asset_count": 33 }
  ],
  "proposed_capabilities": [
    { "name": "customer-analytics", "matched_assets": 12, "reason": "name/description contains 'customer'" }
  ],
  "proposed_teams": [
    { "name": "data-eng", "source": "workspace_group", "member_count": 8, "owned_assets": 24 }
  ],
  "maturity_distribution": {
    "L1_accessible": 89,
    "L2_described": 31,
    "L3_defined": 7,
    "L4_monitored": 0,
    "L5_trusted": 0
  },
  "quick_wins": [
    { "action": "add_description", "count": 31, "impact": "Promotes 31 assets from L1 → L2" }
  ]
}
```

### `POST /api/bootstrap/commit`

**Request:**
```json
{
  "scan_id": "uuid",
  "selected_paths": [...],
  "domains": [...],
  "capabilities": [...],
  "teams": [...],
  "external_sources": {
    "git_repos": [...],
    "jira_tickets": [...]
  }
}
```

**Response:**
```json
{
  "created": {
    "assets": 127,
    "domains": 4,
    "teams": 6,
    "capabilities": 11,
    "demands": 23,
    "learn_content": 8
  },
  "maturity_snapshots": 127,
  "duration_seconds": 4.2
}
```

## Why This Matters for Adoption

The #1 reason data governance tools fail isn't feature gaps — it's the cold-start problem. Nobody wants to manually register 500 tables. The bootstrap wizard turns a multi-week onboarding into a single afternoon:

1. **10 minutes**: Scan workspace, select what matters
2. **5 minutes**: Review domain/capability/team suggestions, adjust
3. **2 minutes**: Optionally connect Git/JIRA
4. **1 minute**: Commit
5. **Done**: 127 assets registered, maturity scored, capabilities mapped, teams assigned

The alternative is: each team lead manually creates their assets over 3-6 weeks, during which enthusiasm dies and the tool gets abandoned. The bootstrap wizard is the difference between "we tried it" and "we use it."
