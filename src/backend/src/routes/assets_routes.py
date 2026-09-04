from typing import List, Optional, Dict, Any
from uuid import UUID
import uuid as _uuid
import json

from fastapi import APIRouter, Depends, HTTPException, status, Query, Request

from src.models.assets import (
    AssetTypeCreate, AssetTypeUpdate, AssetTypeRead, AssetTypeSummary,
    AssetCreate, AssetUpdate, AssetRead, AssetSummary,
    AssetRelationshipCreate, AssetRelationshipRead,
    PaginatedAssetSummary,
    DeletePreviewItem, CascadeDeleteRequest, CascadeDeleteResult,
)
from src.controller.assets_manager import assets_manager
from src.common.authorization import PermissionChecker
from src.common.features import FeatureAccessLevel
from src.common.dependencies import (
    DBSessionDep,
    CurrentUserDep,
    AuditManagerDep,
    AuditCurrentUserDep,
)
from src.common.errors import NotFoundError, ConflictError, ValidationError
from src.common.logging import get_logger

logger = get_logger(__name__)


def _emit_domain_event(db, aggregate_id: str, aggregate_type: str, event_type: str, payload: dict):
    """Insert a domain event into the outbox table. Fire-and-forget."""
    try:
        import sqlalchemy as sa
        idem_key = f"{event_type}-{aggregate_id}-{_uuid.uuid4().hex[:8]}"
        db.execute(sa.text("""
            INSERT INTO domain_events (id, aggregate_id, aggregate_type, event_type, payload, idempotency_key, emitted_at)
            VALUES (:id, :agg_id, :agg_type, :evt, :payload::jsonb, :idem, now())
            ON CONFLICT (idempotency_key) DO NOTHING
        """), {
            "id": str(_uuid.uuid4()), "agg_id": str(aggregate_id),
            "agg_type": aggregate_type, "evt": event_type,
            "payload": json.dumps(payload), "idem": idem_key,
        })
    except Exception as e:
        logger.warning(f"Failed to emit domain event {event_type}: {e}")


asset_types_router = APIRouter(prefix="/api/asset-types", tags=["Asset Types"])
assets_router = APIRouter(prefix="/api/assets", tags=["Assets"])
FEATURE_ID = "assets"


def get_assets_manager():
    return assets_manager


def _get_data_products_manager(request: Request):
    """Pull the DataProductsManager singleton from app.state.

    Returns None when not configured (e.g. early in tests); callers must
    handle that defensively rather than raising — scoping should fail closed
    (i.e. return empty for non-admins) rather than 500.
    """
    return getattr(request.app.state, "data_products_manager", None)


def _user_has_assets_feature(request: Request, current_user, level: FeatureAccessLevel) -> bool:
    """Check whether the current user has the ``assets`` feature at ``level``.

    Used for branching: when a Data Consumer lacks the feature, we still
    allow DP-scoped reads of linked assets (issue #347), but block writes.
    """
    try:
        auth_manager = getattr(request.app.state, "authorization_manager", None)
        settings_manager = getattr(request.app.state, "settings_manager", None)
        if not auth_manager or not current_user:
            return False
        applied_role_id = None
        if settings_manager:
            try:
                applied_role_id = settings_manager.get_applied_role_override_for_user(
                    current_user.email
                )
            except Exception:
                applied_role_id = None
        if applied_role_id and settings_manager:
            effective = settings_manager.get_feature_permissions_for_role_id(applied_role_id)
        else:
            effective = auth_manager.get_user_effective_permissions(
                current_user.groups or [], None
            )
        return auth_manager.has_permission(effective, FEATURE_ID, level)
    except Exception:
        logger.exception("Failed to check assets feature for user")
        return False


# ===================== Asset Types =====================

@asset_types_router.post(
    "",
    response_model=AssetTypeRead,
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(PermissionChecker(FEATURE_ID, FeatureAccessLevel.READ_WRITE))],
)
def create_asset_type(
    request: Request,
    type_in: AssetTypeCreate,
    db: DBSessionDep,
    audit_manager: AuditManagerDep,
    current_user: AuditCurrentUserDep,
    manager=Depends(get_assets_manager),
):
    """Creates a new asset type."""
    success = False
    details = {"params": {"name": type_in.name}}
    created_id = None
    try:
        result = manager.create_asset_type(db=db, type_in=type_in, current_user_id=current_user.email)
        success = True
        created_id = str(result.id)
        return result
    except ConflictError as e:
        details["exception"] = {"type": "ConflictError", "message": str(e)}
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(e))
    except Exception as e:
        logger.exception("Failed to create asset type '%s'", type_in.name)
        details["exception"] = {"type": type(e).__name__, "message": str(e)}
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Failed to create asset type")
    finally:
        if created_id:
            details["created_resource_id"] = created_id
        audit_manager.log_action(
            db=db, username=current_user.username,
            ip_address=request.client.host if request.client else None,
            feature=FEATURE_ID, action="CREATE_ASSET_TYPE", success=success, details=details,
        )


@asset_types_router.get(
    "",
    response_model=List[AssetTypeRead],
    dependencies=[Depends(PermissionChecker(FEATURE_ID, FeatureAccessLevel.READ_ONLY))],
)
def get_all_asset_types(
    db: DBSessionDep,
    manager=Depends(get_assets_manager),
    skip: int = 0,
    limit: int = 100,
    category: Optional[str] = Query(None),
    type_status: Optional[str] = Query(None, alias="status"),
):
    """Lists all asset types."""
    return manager.get_all_asset_types(db=db, skip=skip, limit=limit, category=category, status=type_status)


@asset_types_router.get(
    "/summary",
    response_model=List[AssetTypeSummary],
    dependencies=[Depends(PermissionChecker(FEATURE_ID, FeatureAccessLevel.READ_ONLY))],
)
def get_asset_types_summary(
    db: DBSessionDep,
    manager=Depends(get_assets_manager),
):
    """Gets a summary list of asset types for dropdowns."""
    return manager.get_asset_types_summary(db=db)


@asset_types_router.get(
    "/{type_id}",
    response_model=AssetTypeRead,
    dependencies=[Depends(PermissionChecker(FEATURE_ID, FeatureAccessLevel.READ_ONLY))],
)
def get_asset_type(
    type_id: UUID,
    db: DBSessionDep,
    manager=Depends(get_assets_manager),
):
    """Gets a specific asset type by ID."""
    result = manager.get_asset_type(db=db, type_id=type_id)
    if not result:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Asset type '{type_id}' not found")
    return result


@asset_types_router.put(
    "/{type_id}",
    response_model=AssetTypeRead,
    dependencies=[Depends(PermissionChecker(FEATURE_ID, FeatureAccessLevel.READ_WRITE))],
)
def update_asset_type(
    type_id: UUID,
    request: Request,
    type_in: AssetTypeUpdate,
    db: DBSessionDep,
    audit_manager: AuditManagerDep,
    current_user: AuditCurrentUserDep,
    manager=Depends(get_assets_manager),
):
    """Updates an existing asset type."""
    success = False
    details = {"params": {"type_id": str(type_id)}}
    try:
        result = manager.update_asset_type(db=db, type_id=type_id, type_in=type_in, current_user_id=current_user.email)
        success = True
        return result
    except NotFoundError as e:
        details["exception"] = {"type": "NotFoundError", "message": str(e)}
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
    except ConflictError as e:
        details["exception"] = {"type": "ConflictError", "message": str(e)}
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(e))
    except Exception as e:
        logger.exception("Failed to update asset type %s", type_id)
        details["exception"] = {"type": type(e).__name__, "message": str(e)}
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Failed to update asset type")
    finally:
        if success:
            details["updated_resource_id"] = str(type_id)
        audit_manager.log_action(
            db=db, username=current_user.username,
            ip_address=request.client.host if request.client else None,
            feature=FEATURE_ID, action="UPDATE_ASSET_TYPE", success=success, details=details,
        )


@asset_types_router.delete(
    "/{type_id}",
    response_model=AssetTypeRead,
    dependencies=[Depends(PermissionChecker(FEATURE_ID, FeatureAccessLevel.ADMIN))],
)
def delete_asset_type(
    type_id: UUID,
    request: Request,
    db: DBSessionDep,
    audit_manager: AuditManagerDep,
    current_user: AuditCurrentUserDep,
    manager=Depends(get_assets_manager),
):
    """Deletes an asset type. Requires Admin. Fails if assets still reference it."""
    success = False
    details = {"params": {"type_id": str(type_id)}}
    try:
        result = manager.delete_asset_type(db=db, type_id=type_id)
        success = True
        return result
    except NotFoundError as e:
        details["exception"] = {"type": "NotFoundError", "message": str(e)}
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
    except ConflictError as e:
        details["exception"] = {"type": "ConflictError", "message": str(e)}
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(e))
    except Exception as e:
        logger.exception("Failed to delete asset type %s", type_id)
        details["exception"] = {"type": type(e).__name__, "message": str(e)}
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Failed to delete asset type")
    finally:
        if success:
            details["deleted_resource_id"] = str(type_id)
        audit_manager.log_action(
            db=db, username=current_user.username,
            ip_address=request.client.host if request.client else None,
            feature=FEATURE_ID, action="DELETE_ASSET_TYPE", success=success, details=details,
        )


# ===================== Assets =====================

@assets_router.post(
    "",
    response_model=AssetRead,
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(PermissionChecker(FEATURE_ID, FeatureAccessLevel.READ_WRITE))],
)
def create_asset(
    request: Request,
    asset_in: AssetCreate,
    db: DBSessionDep,
    audit_manager: AuditManagerDep,
    current_user: AuditCurrentUserDep,
    manager=Depends(get_assets_manager),
):
    """Creates a new asset."""
    success = False
    details = {"params": {"name": asset_in.name, "type_id": str(asset_in.asset_type_id)}}
    created_id = None
    try:
        result = manager.create_asset(db=db, asset_in=asset_in, current_user_id=current_user.email)
        success = True
        created_id = str(result.id)
        return result
    except NotFoundError as e:
        details["exception"] = {"type": "NotFoundError", "message": str(e)}
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
    except ValidationError as e:
        details["exception"] = {"type": "ValidationError", "message": str(e)}
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=str(e))
    except ConflictError as e:
        details["exception"] = {"type": "ConflictError", "message": str(e)}
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(e))
    except Exception as e:
        logger.exception("Failed to create asset '%s'", asset_in.name)
        details["exception"] = {"type": type(e).__name__, "message": str(e)}
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Failed to create asset")
    finally:
        if created_id:
            details["created_resource_id"] = created_id
        audit_manager.log_action(
            db=db, username=current_user.username,
            ip_address=request.client.host if request.client else None,
            feature=FEATURE_ID, action="CREATE_ASSET", success=success, details=details,
        )


@assets_router.get(
    "",
    response_model=PaginatedAssetSummary,
)
def get_all_assets(
    request: Request,
    db: DBSessionDep,
    current_user: CurrentUserDep,
    manager=Depends(get_assets_manager),
    skip: int = 0,
    limit: int = 100,
    asset_type_id: Optional[UUID] = Query(None),
    asset_type_names: Optional[str] = Query(None, description="Comma-separated asset type names"),
    platform: Optional[str] = Query(None),
    domain_id: Optional[str] = Query(None, description="Filter by a single domain ID (any-of)"),
    domain_ids: Optional[str] = Query(None, description="Filter by multiple domain IDs, comma-separated (any-of)"),
    asset_status: Optional[str] = Query(None, alias="status"),
    name: Optional[str] = Query(None),
    created_by: Optional[str] = Query(None, description="Filter by creator. Use 'me' for current user."),
    maturity: Optional[str] = Query(None, description="Filter by maturity stage (e.g. idea, poc, validating, production)."),
):
    """Lists all assets with optional filters. Returns paginated results.

    Authorization (issue #347):
    - Users with ``assets:READ_WRITE`` or higher (Producers, Admins): see
      all assets, unscoped — preserves existing behaviour.
    - Users below ``READ_WRITE`` (typically Data Consumers): scoped to
      assets linked to Data Products they can access (least-privilege).
      This branch also handles users with no ``assets`` feature at all —
      they still see DP-linked assets so the DP detail view's Linked
      Assets surface keeps working without granting the broader feature.
    """
    if current_user is None:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Authentication required.",
        )

    # Producers + Admins (READ_WRITE+) keep full visibility.
    is_unscoped = _user_has_assets_feature(request, current_user, FeatureAccessLevel.READ_WRITE)

    if not is_unscoped:
        dpm = _get_data_products_manager(request)
        if dpm is None:
            # Fail closed: no DP context available, scoped users see nothing.
            logger.warning("DataProductsManager unavailable; returning empty asset list for scoped user")
            return PaginatedAssetSummary(items=[], total=0, skip=skip, limit=limit)
        # Pass is_admin=False to force scoping logic; the manager itself doesn't
        # check group membership — it only branches on the boolean we pass in.
        restrict_ids = manager.resolve_accessible_asset_ids(
            db, data_products_manager=dpm, is_admin=False,
        )
    else:
        restrict_ids = None  # unrestricted

    type_names_list = [t.strip() for t in asset_type_names.split(",")] if asset_type_names else None
    domain_ids_list = [d.strip() for d in domain_ids.split(",") if d.strip()] if domain_ids else None
    # DPZ: resolve 'me' to current user email for portfolio filtering
    resolved_created_by = None
    if created_by == 'me' and current_user:
        resolved_created_by = getattr(current_user, 'email', None) or getattr(current_user, 'user_name', None) or str(current_user)
    elif created_by:
        resolved_created_by = created_by
    return manager.get_all_assets(
        db=db, skip=skip, limit=limit,
        asset_type_id=asset_type_id, asset_type_names=type_names_list,
        platform=platform, domain_id=domain_id, domain_ids=domain_ids_list, status=asset_status, name=name,
        restrict_to_ids=restrict_ids, created_by=resolved_created_by, maturity=maturity,
    )


@assets_router.get(
    "/{asset_id}",
    response_model=AssetRead,
)
def get_asset(
    asset_id: UUID,
    request: Request,
    db: DBSessionDep,
    current_user: CurrentUserDep,
    manager=Depends(get_assets_manager),
):
    """Gets a specific asset by ID with relationships.

    Authorization (issue #347):
    - Users with ``assets:READ_WRITE`` or higher (Producers, Admins): always
      allowed — preserves existing behaviour.
    - Users below that (Consumers, no-``assets``-feature): allowed iff the
      asset is linked (directly or via an OutputPort) to a Data Product
      the user can access. This enables Linked Assets navigation from a
      DP detail view even without the broader ``assets`` feature granted.
    """
    if current_user is None:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Authentication required.",
        )

    is_unscoped = _user_has_assets_feature(request, current_user, FeatureAccessLevel.READ_WRITE)

    if not is_unscoped:
        dpm = _get_data_products_manager(request)
        if dpm is None or not manager.is_asset_accessible(
            db, asset_id=asset_id, data_products_manager=dpm, is_admin=False,
        ):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Asset is not linked to a Data Product accessible to this user.",
            )

    result = manager.get_asset(db=db, asset_id=asset_id)
    if not result:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Asset '{asset_id}' not found")
    return result


@assets_router.get(
    "/{asset_id}/references",
    tags=["Assets"],
)
def get_asset_references(
    asset_id: UUID,
    db: DBSessionDep,
):
    """Get external references (UC links, git URLs, app URLs) for an asset."""
    import sqlalchemy as sa
    result = db.execute(
        sa.text("SELECT id, ref_type, ref_value, alias, metadata, created_at "
                "FROM external_references WHERE asset_id = :aid ORDER BY created_at"),
        {"aid": str(asset_id)}
    )
    refs = []
    for row in result:
        refs.append({
            "id": str(row[0]),
            "ref_type": row[1],
            "ref_value": row[2],
            "alias": row[3],
            "metadata": row[4],
            "created_at": row[5].isoformat() if row[5] else None,
        })
    return {"items": refs, "total": len(refs)}


@assets_router.post(
    "/{asset_id}/references",
    tags=["Assets"],
    dependencies=[Depends(PermissionChecker(FEATURE_ID, FeatureAccessLevel.READ_WRITE))],
)
def create_asset_reference(
    asset_id: UUID,
    ref_in: dict,
    db: DBSessionDep,
):
    """Create an external reference for an asset."""
    import sqlalchemy as sa
    import uuid as _uuid
    ref_id = str(_uuid.uuid4())
    db.execute(
        sa.text("INSERT INTO external_references (id, asset_id, ref_type, ref_value, alias, metadata) "
                "VALUES (:id, :aid, :rtype, :rval, :alias, :meta::jsonb) "
                "ON CONFLICT (asset_id, ref_type, ref_value) DO NOTHING"),
        {"id": ref_id, "aid": str(asset_id), "rtype": ref_in.get("ref_type"),
         "rval": ref_in.get("ref_value"), "alias": ref_in.get("alias"),
         "meta": ref_in.get("metadata")}
    )
    db.commit()
    return {"id": ref_id, "status": "created"}


@assets_router.put(
    "/{asset_id}",
    response_model=AssetRead,
    dependencies=[Depends(PermissionChecker(FEATURE_ID, FeatureAccessLevel.READ_WRITE))],
)
def update_asset(
    asset_id: UUID,
    request: Request,
    asset_in: AssetUpdate,
    db: DBSessionDep,
    audit_manager: AuditManagerDep,
    current_user: AuditCurrentUserDep,
    manager=Depends(get_assets_manager),
):
    """Updates an existing asset."""
    success = False
    details = {"params": {"asset_id": str(asset_id)}}
    try:
        result = manager.update_asset(db=db, asset_id=asset_id, asset_in=asset_in, current_user_id=current_user.email)
        success = True
        return result
    except NotFoundError as e:
        details["exception"] = {"type": "NotFoundError", "message": str(e)}
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
    except ValidationError as e:
        details["exception"] = {"type": "ValidationError", "message": str(e)}
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=str(e))
    except ConflictError as e:
        details["exception"] = {"type": "ConflictError", "message": str(e)}
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(e))
    except Exception as e:
        logger.exception("Failed to update asset %s", asset_id)
        details["exception"] = {"type": type(e).__name__, "message": str(e)}
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Failed to update asset")
    finally:
        if success:
            details["updated_resource_id"] = str(asset_id)
        audit_manager.log_action(
            db=db, username=current_user.username,
            ip_address=request.client.host if request.client else None,
            feature=FEATURE_ID, action="UPDATE_ASSET", success=success, details=details,
        )


@assets_router.get(
    "/{asset_id}/infer-schema",
    dependencies=[Depends(PermissionChecker(FEATURE_ID, FeatureAccessLevel.READ_ONLY))],
)
def infer_schema_from_asset(
    asset_id: UUID,
    db: DBSessionDep,
    manager=Depends(get_assets_manager),
):
    """Extract ODCS-compatible schema objects from an asset and its children."""
    try:
        return manager.infer_schema_from_asset(db=db, asset_id=asset_id)
    except NotFoundError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
    except Exception as e:
        logger.exception("Failed to infer schema from asset %s", asset_id)
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Failed to infer schema from asset")


@assets_router.get(
    "/{asset_id}/delete-preview",
    response_model=DeletePreviewItem,
    dependencies=[Depends(PermissionChecker(FEATURE_ID, FeatureAccessLevel.ADMIN))],
)
def get_delete_preview(
    asset_id: UUID,
    db: DBSessionDep,
    manager=Depends(get_assets_manager),
):
    """Returns a tree of the asset and all hierarchical descendants that would be cascade-deleted."""
    try:
        return manager.get_delete_preview(db=db, asset_id=asset_id)
    except NotFoundError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
    except Exception as e:
        logger.exception("Failed to build delete preview for asset %s", asset_id)
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Failed to build delete preview")


@assets_router.post(
    "/cascade-delete",
    response_model=CascadeDeleteResult,
    dependencies=[Depends(PermissionChecker(FEATURE_ID, FeatureAccessLevel.ADMIN))],
)
def cascade_delete_assets(
    body: CascadeDeleteRequest,
    request: Request,
    db: DBSessionDep,
    audit_manager: AuditManagerDep,
    current_user: AuditCurrentUserDep,
    manager=Depends(get_assets_manager),
):
    """Deletes multiple assets in leaf-first order. Requires Admin."""
    details = {"params": {"asset_ids": [str(aid) for aid in body.asset_ids]}}
    try:
        result = manager.cascade_delete_assets(
            db=db, asset_ids=body.asset_ids, current_user_id=current_user.email,
        )
        details["deleted_count"] = len(result.deleted)
        details["failed_count"] = len(result.failed)
        return result
    except Exception as e:
        logger.exception("Failed to cascade-delete assets")
        details["exception"] = {"type": type(e).__name__, "message": str(e)}
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Failed to cascade-delete assets")
    finally:
        audit_manager.log_action(
            db=db, username=current_user.username,
            ip_address=request.client.host if request.client else None,
            feature=FEATURE_ID, action="CASCADE_DELETE_ASSETS",
            success="exception" not in details, details=details,
        )


@assets_router.delete(
    "/{asset_id}",
    response_model=AssetRead,
    dependencies=[Depends(PermissionChecker(FEATURE_ID, FeatureAccessLevel.ADMIN))],
)
def delete_asset(
    asset_id: UUID,
    request: Request,
    db: DBSessionDep,
    audit_manager: AuditManagerDep,
    current_user: AuditCurrentUserDep,
    manager=Depends(get_assets_manager),
):
    """Deletes an asset. Requires Admin."""
    success = False
    details = {"params": {"asset_id": str(asset_id)}}
    try:
        result = manager.delete_asset(db=db, asset_id=asset_id, current_user_id=current_user.email)
        success = True
        return result
    except NotFoundError as e:
        details["exception"] = {"type": "NotFoundError", "message": str(e)}
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
    except Exception as e:
        logger.exception("Failed to delete asset %s", asset_id)
        details["exception"] = {"type": type(e).__name__, "message": str(e)}
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Failed to delete asset")
    finally:
        if success:
            details["deleted_resource_id"] = str(asset_id)
        audit_manager.log_action(
            db=db, username=current_user.username,
            ip_address=request.client.host if request.client else None,
            feature=FEATURE_ID, action="DELETE_ASSET", success=success, details=details,
        )


# ===================== Asset Relationships =====================

@assets_router.post(
    "/relationships",
    response_model=AssetRelationshipRead,
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(PermissionChecker(FEATURE_ID, FeatureAccessLevel.READ_WRITE))],
)
def add_asset_relationship(
    request: Request,
    rel_in: AssetRelationshipCreate,
    db: DBSessionDep,
    audit_manager: AuditManagerDep,
    current_user: AuditCurrentUserDep,
    manager=Depends(get_assets_manager),
):
    """Creates a relationship between two assets."""
    success = False
    details = {"params": {"source": str(rel_in.source_asset_id), "target": str(rel_in.target_asset_id), "type": rel_in.relationship_type}}
    try:
        result = manager.add_relationship(db=db, rel_in=rel_in, current_user_id=current_user.email)
        success = True
        return result
    except NotFoundError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
    except ConflictError as e:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(e))
    except Exception as e:
        logger.exception("Failed to add asset relationship")
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Failed to add relationship")
    finally:
        audit_manager.log_action(
            db=db, username=current_user.username,
            ip_address=request.client.host if request.client else None,
            feature=FEATURE_ID, action="ADD_RELATIONSHIP", success=success, details=details,
        )


@assets_router.delete(
    "/relationships/{relationship_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    dependencies=[Depends(PermissionChecker(FEATURE_ID, FeatureAccessLevel.READ_WRITE))],
)
def remove_asset_relationship(
    relationship_id: UUID,
    request: Request,
    db: DBSessionDep,
    audit_manager: AuditManagerDep,
    current_user: AuditCurrentUserDep,
    manager=Depends(get_assets_manager),
):
    """Removes a relationship between assets."""
    success = False
    details = {"params": {"relationship_id": str(relationship_id)}}
    try:
        manager.remove_relationship(db=db, relationship_id=relationship_id)
        success = True
        return None
    except NotFoundError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
    except Exception as e:
        logger.exception("Failed to remove asset relationship")
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Failed to remove relationship")
    finally:
        audit_manager.log_action(
            db=db, username=current_user.username,
            ip_address=request.client.host if request.client else None,
            feature=FEATURE_ID, action="REMOVE_RELATIONSHIP", success=success, details=details,
        )


# ─── DPZ: Demands + Portfolio + Adoption APIs ───────────────────────────────

dpz_router = APIRouter(prefix="/api/dpz", tags=["DPZ Hub"])

_VS_INDEX_NAME = "serverless_stable_h7wanf_catalog.dpz_builder_hub.asset_search_corpus_index"
_VS_ENDPOINT = "dpz_builder_hub_vs"


@dpz_router.post("/similar")
def find_similar_assets(body: dict, current_user: CurrentUserDep):
    """Find assets similar to the provided text using Vector Search."""
    text = body.get("text", "").strip()
    if not text or len(text) < 5:
        return {"matches": [], "status": "too_short"}
    try:
        from databricks.sdk import WorkspaceClient
        w = WorkspaceClient()
        idx = w.vector_search_indexes.query_index(
            index_name=_VS_INDEX_NAME,
            columns=["asset_id", "name", "type_name", "maturity", "search_text"],
            query_text=text,
            num_results=5,
        )
        matches = []
        if idx.result and idx.result.data_array:
            columns = [c.name for c in idx.manifest.columns]
            for row in idx.result.data_array:
                entry = dict(zip(columns, row))
                # score is the last column typically
                score = entry.get("score", 0)
                if float(score) > 0.5:  # relevance threshold
                    matches.append({
                        "asset_id": entry.get("asset_id"),
                        "name": entry.get("name"),
                        "type_name": entry.get("type_name"),
                        "maturity": entry.get("maturity"),
                        "score": round(float(score), 3),
                    })
        return {"matches": matches, "status": "ok"}
    except Exception as e:
        logger.warning("Vector search query failed: %s", str(e))
        return {"matches": [], "status": "error", "detail": str(e)}


@dpz_router.get("/wishlist")
def list_wishlist(db: DBSessionDep, current_user: CurrentUserDep):
    """List all wishlist items (need signals)."""
    import sqlalchemy as sa
    result = db.execute(sa.text(
        "SELECT id, title, description, created_by, status, priority, category, "
        "upvotes, signals_count, domain, linked_asset_id, created_at, "
        "business_justification, target_date, estimated_effort, requested_by_team, budget_impact, source, "
        "workaround, frequency, claimed_by, claimed_at, decline_reason, declined_by, linked_asset_name, updated_at "
        "FROM demands ORDER BY upvotes DESC, created_at DESC"
    ))
    items = []
    for row in result:
        items.append({
            "id": str(row[0]), "title": row[1], "description": row[2],
            "created_by": row[3], "status": row[4], "priority": row[5],
            "category": row[6], "upvotes": row[7], "signals_count": row[8],
            "domain": row[9],
            "linked_asset_id": str(row[10]) if row[10] else None,
            "created_at": row[11].isoformat() if row[11] else None,
            "business_justification": row[12],
            "target_date": row[13].isoformat() if row[13] else None,
            "estimated_effort": row[14],
            "requested_by_team": row[15],
            "budget_impact": row[16],
            "source": row[17] or "organic",
            "workaround": row[18],
            "frequency": row[19],
            "claimed_by": row[20],
            "claimed_at": row[21].isoformat() if row[21] else None,
            "decline_reason": row[22],
            "declined_by": row[23],
            "linked_asset_name": row[24],
            "updated_at": row[25].isoformat() if row[25] else None,
        })
    # Attach capability names to each item
    if items:
        all_caps = db.execute(sa.text(
            "SELECT dc.demand_id, c.name, c.slug, c.icon "
            "FROM demand_capabilities dc JOIN capabilities c ON dc.capability_id = c.id"
        ))
        cap_map: dict = {}
        for r in all_caps:
            did = str(r[0])
            if did not in cap_map:
                cap_map[did] = []
            cap_map[did].append({"name": r[1], "slug": r[2], "icon": r[3]})
        for item in items:
            item["capabilities"] = cap_map.get(item["id"], [])
    return {"items": items, "total": len(items)}


# Keep old route as alias
@dpz_router.get("/demands")
def list_demands(db: DBSessionDep, current_user: CurrentUserDep):
    return list_wishlist(db, current_user)


@dpz_router.post("/wishlist")
def create_wishlist_item(demand_in: dict, db: DBSessionDep, current_user: CurrentUserDep):
    """Submit a new wishlist item with enterprise fields."""
    import sqlalchemy as sa
    import json as _json
    demand_id = str(_uuid.uuid4())
    user_email = getattr(current_user, 'email', None) or getattr(current_user, 'user_name', 'unknown')
    db.execute(sa.text(
        "INSERT INTO demands (id, title, description, created_by, status, priority, category, domain, "
        "business_justification, target_date, estimated_effort, stakeholders, "
        "uc_catalog, uc_schema, jira_key, jira_url, requested_by_team, budget_impact) "
        "VALUES (:id, :title, :desc, :by, 'open', :pri, :cat, :cat, "
        ":biz_just, :target_date, :effort, :stakeholders::jsonb, "
        ":uc_cat, :uc_sch, :jira_key, :jira_url, :team, :budget)"
    ), {
        "id": demand_id,
        "title": demand_in.get("title", "Untitled"),
        "desc": demand_in.get("description"),
        "by": user_email,
        "pri": demand_in.get("priority", "medium"),
        "cat": demand_in.get("category"),
        "biz_just": demand_in.get("business_justification"),
        "target_date": demand_in.get("target_date"),
        "effort": demand_in.get("estimated_effort"),
        "stakeholders": _json.dumps(demand_in.get("stakeholders", [])),
        "uc_cat": demand_in.get("uc_catalog"),
        "uc_sch": demand_in.get("uc_schema"),
        "jira_key": demand_in.get("jira_key"),
        "jira_url": demand_in.get("jira_url"),
        "team": demand_in.get("requested_by_team"),
        "budget": demand_in.get("budget_impact"),
    })
    # Link capabilities if provided
    cap_ids = demand_in.get("capability_ids", [])
    for cid in cap_ids:
        db.execute(sa.text(
            "INSERT INTO demand_capabilities (demand_id, capability_id) "
            "VALUES (:did, :cid) ON CONFLICT DO NOTHING"
        ), {"did": demand_id, "cid": cid})
    db.commit()
    _emit_domain_event(db, demand_id, "demand", "wish.created", {
        "title": demand_in.get("title", "Untitled"), "actor": user_email,
        "category": demand_in.get("category"), "priority": demand_in.get("priority", "medium"),
    })
    db.commit()
    return {"id": demand_id, "status": "created"}


@dpz_router.post("/wishlist/seed")
def seed_wishlist_from_leadership(body: dict, db: DBSessionDep, current_user: CurrentUserDep):
    """Bulk-seed wishlist items from leadership priorities.

    Body: { items: [{ title, description, priority, category, capability_slugs?, business_justification? }] }
    Sets source='leadership' to distinguish from organic submissions.
    """
    import sqlalchemy as sa
    import json as _json
    user_email = getattr(current_user, 'email', None) or getattr(current_user, 'user_name', 'system')
    items = body.get("items", [])
    created = []
    for item in items:
        demand_id = str(_uuid.uuid4())
        db.execute(sa.text(
            "INSERT INTO demands (id, title, description, created_by, status, priority, category, domain, "
            "source, business_justification) "
            "VALUES (:id, :title, :desc, :by, 'open', :pri, :cat, :cat, 'leadership', :biz_just)"
        ), {
            "id": demand_id,
            "title": item.get("title", "Untitled"),
            "desc": item.get("description"),
            "by": user_email,
            "pri": item.get("priority", "high"),
            "cat": item.get("category"),
            "biz_just": item.get("business_justification"),
        })
        # Link capabilities by slug
        for slug in item.get("capability_slugs", []):
            db.execute(sa.text(
                "INSERT INTO demand_capabilities (demand_id, capability_id) "
                "SELECT :did, id FROM capabilities WHERE slug = :slug "
                "ON CONFLICT DO NOTHING"
            ), {"did": demand_id, "slug": slug})
        created.append({"id": demand_id, "title": item.get("title")})
    db.commit()
    return {"seeded": len(created), "items": created}


@dpz_router.get("/wishlist/gap-analysis")
def wishlist_gap_analysis(db: DBSessionDep):
    """Capability gap analysis: which capabilities are most requested but least covered?

    Returns each capability with demand_count (wishes needing it) and asset_count
    (existing assets providing it), plus a gap_score = demand_count / max(asset_count, 1).
    """
    import sqlalchemy as sa
    rows = db.execute(sa.text("""
        SELECT
            c.id, c.name, c.slug, c.category,
            COUNT(DISTINCT dc.demand_id) AS demand_count,
            COUNT(DISTINCT ac.asset_id) AS asset_count
        FROM capabilities c
        LEFT JOIN demand_capabilities dc ON dc.capability_id = c.id
        LEFT JOIN asset_capabilities ac ON ac.capability_id = c.id
        GROUP BY c.id, c.name, c.slug, c.category
        ORDER BY COUNT(DISTINCT dc.demand_id) DESC, COUNT(DISTINCT ac.asset_id) ASC
    """))
    items = []
    for r in rows:
        demand = r[4] or 0
        supply = r[5] or 0
        gap = round(demand / max(supply, 1), 2)
        items.append({
            "id": str(r[0]), "name": r[1], "slug": r[2], "category": r[3],
            "demand_count": demand, "asset_count": supply, "gap_score": gap,
        })
    return {"items": items}


@dpz_router.get("/wishlist/{item_id}/match-score")
def get_wish_match_score(item_id: str, db: DBSessionDep):
    """How well do existing assets cover this wish's required capabilities?

    Returns a match_score (0-100) plus per-capability coverage.
    """
    import sqlalchemy as sa
    # Get wish's capabilities
    wish_caps = db.execute(sa.text(
        "SELECT c.id, c.name, c.slug FROM demand_capabilities dc "
        "JOIN capabilities c ON dc.capability_id = c.id WHERE dc.demand_id = :wid"
    ), {"wid": item_id}).fetchall()
    if not wish_caps:
        return {"match_score": 0, "capabilities": [], "best_matches": []}
    # For each capability, find assets providing it
    cap_results = []
    asset_scores: dict = {}  # asset_id -> count of matching caps
    for cap in wish_caps:
        assets = db.execute(sa.text(
            "SELECT a.id, a.name, a.maturity FROM asset_capabilities ac "
            "JOIN assets a ON ac.asset_id = a.id WHERE ac.capability_id = :cid"
        ), {"cid": str(cap[0])}).fetchall()
        cap_results.append({
            "slug": cap[2], "name": cap[1],
            "covered": len(assets) > 0,
            "asset_count": len(assets),
        })
        for a in assets:
            aid = str(a[0])
            if aid not in asset_scores:
                asset_scores[aid] = {"id": aid, "name": a[1], "maturity": a[2], "matched_caps": 0}
            asset_scores[aid]["matched_caps"] += 1
    covered = sum(1 for c in cap_results if c["covered"])
    score = round((covered / len(cap_results)) * 100) if cap_results else 0
    best = sorted(asset_scores.values(), key=lambda x: -x["matched_caps"])[:5]
    for b in best:
        b["coverage_pct"] = round((b["matched_caps"] / len(cap_results)) * 100)
    return {"match_score": score, "capabilities": cap_results, "best_matches": best}


@dpz_router.post("/wishlist/{item_id}/upvote")
def upvote_wishlist_item(item_id: str, db: DBSessionDep, current_user: CurrentUserDep):
    """Upvote a wishlist item."""
    import sqlalchemy as sa
    db.execute(sa.text(
        "UPDATE demands SET upvotes = upvotes + 1, signals_count = signals_count + 1 WHERE id = :id"
    ), {"id": item_id})
    db.commit()
    return {"status": "upvoted"}


@dpz_router.get("/wishlist/{item_id}")
def get_wishlist_item(item_id: str, db: DBSessionDep, current_user: CurrentUserDep):
    """Get a single wishlist item with its capabilities."""
    import sqlalchemy as sa
    row = db.execute(sa.text(
        "SELECT id, title, description, created_by, status, priority, category, "
        "upvotes, signals_count, domain, linked_asset_id, created_at, updated_at, "
        "business_justification, target_date, estimated_effort, stakeholders, "
        "uc_catalog, uc_schema, jira_key, jira_url, requested_by_team, budget_impact, reviewed_by, reviewed_at "
        "FROM demands WHERE id = :id"
    ), {"id": item_id}).fetchone()
    if not row:
        from fastapi import HTTPException
        raise HTTPException(status_code=404, detail="Wishlist item not found")
    item = {
        "id": str(row[0]), "title": row[1], "description": row[2],
        "created_by": row[3], "status": row[4], "priority": row[5],
        "category": row[6], "upvotes": row[7], "signals_count": row[8],
        "domain": row[9], "linked_asset_id": str(row[10]) if row[10] else None,
        "created_at": row[11].isoformat() if row[11] else None,
        "updated_at": row[12].isoformat() if row[12] else None,
        "business_justification": row[13],
        "target_date": row[14].isoformat() if row[14] else None,
        "estimated_effort": row[15],
        "stakeholders": row[16] if row[16] else [],
        "uc_catalog": row[17],
        "uc_schema": row[18],
        "jira_key": row[19],
        "jira_url": row[20],
        "requested_by_team": row[21],
        "budget_impact": row[22],
        "reviewed_by": row[23],
        "reviewed_at": row[24].isoformat() if row[24] else None,
    }
    # Fetch linked capabilities
    caps = db.execute(sa.text(
        "SELECT c.id, c.slug, c.name, c.description, c.category, c.platform_feature, c.icon "
        "FROM capabilities c JOIN demand_capabilities dc ON c.id = dc.capability_id "
        "WHERE dc.demand_id = :did ORDER BY c.sort_order"
    ), {"did": item_id})
    item["capabilities"] = [{
        "id": str(r[0]), "slug": r[1], "name": r[2], "description": r[3],
        "category": r[4], "platform_feature": r[5], "icon": r[6],
    } for r in caps]
    # Fetch linked asset if present
    if item["linked_asset_id"]:
        asset = db.execute(sa.text(
            "SELECT a.id, a.name, at.name as type_name FROM assets a "
            "JOIN asset_types at ON a.asset_type_id = at.id WHERE a.id = :aid"
        ), {"aid": item["linked_asset_id"]}).fetchone()
        if asset:
            item["linked_asset"] = {"id": str(asset[0]), "name": asset[1], "type_name": asset[2]}
    return item


@dpz_router.get("/capabilities")
def list_capabilities(db: DBSessionDep):
    """List all available capabilities."""
    import sqlalchemy as sa
    result = db.execute(sa.text(
        "SELECT id, slug, name, description, category, platform_feature, icon, sort_order "
        "FROM capabilities ORDER BY sort_order"
    ))
    return {"items": [{
        "id": str(r[0]), "slug": r[1], "name": r[2], "description": r[3],
        "category": r[4], "platform_feature": r[5], "icon": r[6], "sort_order": r[7],
    } for r in result]}


@dpz_router.post("/capabilities")
def create_capability(body: dict, db: DBSessionDep, current_user: CurrentUserDep):
    """Create a new capability."""
    import sqlalchemy as sa
    cap_id = str(_uuid.uuid4())
    # Get max sort_order
    max_order = db.execute(sa.text("SELECT COALESCE(MAX(sort_order), 0) FROM capabilities")).scalar() or 0
    db.execute(sa.text(
        "INSERT INTO capabilities (id, slug, name, description, category, platform_feature, icon, sort_order) "
        "VALUES (:id, :slug, :name, :desc, :cat, :pf, :icon, :order)"
    ), {
        "id": cap_id,
        "slug": body.get("slug", ""),
        "name": body.get("name", ""),
        "desc": body.get("description", ""),
        "cat": body.get("category", "platform"),
        "pf": body.get("platform_feature", ""),
        "icon": body.get("icon", ""),
        "order": max_order + 1,
    })
    db.commit()
    return {"id": cap_id, "status": "created"}


@dpz_router.put("/capabilities/{cap_id}")
def update_capability(cap_id: str, body: dict, db: DBSessionDep, current_user: CurrentUserDep):
    """Update a capability."""
    import sqlalchemy as sa
    allowed = ["name", "description", "category", "platform_feature", "icon", "sort_order"]
    sets = []
    params = {"id": cap_id}
    for field in allowed:
        if field in body:
            sets.append(f"{field} = :{field}")
            params[field] = body[field]
    if not sets:
        return {"status": "no_changes"}
    sql = f"UPDATE capabilities SET {', '.join(sets)} WHERE id = :id"
    db.execute(sa.text(sql), params)
    db.commit()
    return {"status": "updated"}


@dpz_router.put("/wishlist/{item_id}/capabilities")
def update_wish_capabilities(item_id: str, body: dict, db: DBSessionDep, current_user: CurrentUserDep):
    """Set capabilities for a wishlist item. body: {capability_ids: [...]}"""
    import sqlalchemy as sa
    cap_ids = body.get("capability_ids", [])
    db.execute(sa.text("DELETE FROM demand_capabilities WHERE demand_id = :did"), {"did": item_id})
    for cid in cap_ids:
        db.execute(sa.text(
            "INSERT INTO demand_capabilities (demand_id, capability_id) VALUES (:did, :cid) ON CONFLICT DO NOTHING"
        ), {"did": item_id, "cid": cid})
    db.commit()
    return {"status": "updated", "count": len(cap_ids)}


@dpz_router.put("/wishlist/{item_id}")
def update_wishlist_item(item_id: str, body: dict, db: DBSessionDep, current_user: CurrentUserDep):
    """Update a wishlist item (any writable field)."""
    import sqlalchemy as sa
    import json as _json
    allowed = [
        "title", "description", "priority", "category", "status",
        "business_justification", "target_date", "estimated_effort",
        "uc_catalog", "uc_schema", "jira_key", "jira_url",
        "requested_by_team", "budget_impact", "linked_asset_id",
    ]
    sets = []
    params = {"id": item_id}
    for field in allowed:
        if field in body:
            sets.append(f"{field} = :{field}")
            params[field] = body[field]
    if "stakeholders" in body:
        sets.append("stakeholders = :stakeholders::jsonb")
        params["stakeholders"] = _json.dumps(body["stakeholders"])
    if "reviewed_by" in body:
        sets.append("reviewed_by = :reviewed_by")
        sets.append("reviewed_at = now()")
        params["reviewed_by"] = body["reviewed_by"]
    if not sets:
        return {"status": "no_changes"}
    sets.append("updated_at = now()")
    sql = f"UPDATE demands SET {', '.join(sets)} WHERE id = :id"
    db.execute(sa.text(sql), params)
    db.commit()
    return {"status": "updated"}


@dpz_router.get("/assets/{asset_id}/capabilities")
def get_asset_capabilities(asset_id: str, db: DBSessionDep):
    """Get capabilities linked to an asset."""
    import sqlalchemy as sa
    result = db.execute(sa.text(
        "SELECT c.id, c.slug, c.name, c.description, c.category, c.platform_feature, c.icon "
        "FROM capabilities c JOIN asset_capabilities ac ON c.id = ac.capability_id "
        "WHERE ac.asset_id = :aid ORDER BY c.sort_order"
    ), {"aid": asset_id})
    return {"items": [{
        "id": str(r[0]), "slug": r[1], "name": r[2], "description": r[3],
        "category": r[4], "platform_feature": r[5], "icon": r[6],
    } for r in result]}


@dpz_router.put("/assets/{asset_id}/capabilities")
def update_asset_capabilities(asset_id: str, body: dict, db: DBSessionDep, current_user: CurrentUserDep):
    """Set capabilities for an asset. body: {capability_ids: [...]}"""
    import sqlalchemy as sa
    cap_ids = body.get("capability_ids", [])
    db.execute(sa.text("DELETE FROM asset_capabilities WHERE asset_id = :aid"), {"aid": asset_id})
    for cid in cap_ids:
        db.execute(sa.text(
            "INSERT INTO asset_capabilities (asset_id, capability_id) VALUES (:aid, :cid) ON CONFLICT DO NOTHING"
        ), {"aid": asset_id, "cid": cid})
    db.commit()
    return {"status": "updated", "count": len(cap_ids)}


@dpz_router.get("/assets/{asset_id}/detail")
def get_dpz_asset_detail(asset_id: str, db: DBSessionDep):
    """Get DPZ enterprise/governance fields for an asset."""
    import sqlalchemy as sa
    row = db.execute(sa.text(
        "SELECT owner_email, team, domain, uc_catalog, uc_schema, uc_table, "
        "jira_key, jira_url, business_impact, target_audience, "
        "slack_channel, sla_tier, cost_center, stakeholders, value_hypothesis, "
        "repo_url, demo_url "
        "FROM assets WHERE id = :id"
    ), {"id": asset_id}).fetchone()
    if not row:
        return {}
    return {
        "owner_email": row[0], "team": row[1], "domain": row[2],
        "uc_catalog": row[3], "uc_schema": row[4], "uc_table": row[5],
        "jira_key": row[6], "jira_url": row[7],
        "business_impact": row[8], "target_audience": row[9],
        "slack_channel": row[10], "sla_tier": row[11], "cost_center": row[12],
        "stakeholders": row[13] if row[13] else [],
        "value_hypothesis": row[14],
        "repo_url": row[15], "demo_url": row[16],
    }


@dpz_router.put("/assets/{asset_id}/governance")
def update_asset_governance(asset_id: str, body: dict, db: DBSessionDep, current_user: CurrentUserDep):
    """Update governance/enterprise fields on an asset (admin/SA use)."""
    import sqlalchemy as sa
    import json as _json
    allowed = [
        "owner_email", "team", "domain", "uc_catalog", "uc_schema", "uc_table",
        "jira_key", "jira_url", "business_impact", "target_audience",
        "slack_channel", "sla_tier", "cost_center", "value_hypothesis",
    ]
    sets = []
    params = {"id": asset_id}
    for field in allowed:
        if field in body:
            sets.append(f"{field} = :{field}")
            params[field] = body[field]
    if "stakeholders" in body:
        sets.append("stakeholders = :stakeholders::jsonb")
        params["stakeholders"] = _json.dumps(body["stakeholders"])
    if not sets:
        return {"status": "no_changes"}
    sets.append("updated_at = now()")
    sql = f"UPDATE assets SET {', '.join(sets)} WHERE id = :id"
    db.execute(sa.text(sql), params)
    db.commit()
    return {"status": "updated"}


# ════════════════════════════════════════════════════
# Bulk asset capabilities (for card grids)
# ════════════════════════════════════════════════════

@dpz_router.get("/asset-capabilities-bulk")
def bulk_asset_capabilities(db: DBSessionDep):
    """Return all asset-capability links grouped by asset_id."""
    import sqlalchemy as sa
    rows = db.execute(sa.text("""
        SELECT ac.asset_id, c.slug, c.name, c.category
        FROM asset_capabilities ac
        JOIN capabilities c ON ac.capability_id = c.id
        ORDER BY ac.asset_id, c.sort_order
    """))
    result: dict = {}
    for r in rows:
        aid = str(r[0])
        if aid not in result:
            result[aid] = []
        result[aid].append({"slug": r[1], "name": r[2], "category": r[3]})
    return {"by_asset": result}


# ════════════════════════════════════════════════════
# DPZ Search (cross-entity: assets, wishes, capabilities)
# ════════════════════════════════════════════════════

@dpz_router.get("/search")
def dpz_search(q: str, db: DBSessionDep, current_user: CurrentUserDep):
    """Search across assets, wishlist items, and capabilities."""
    import sqlalchemy as sa
    if not q or len(q.strip()) < 2:
        return {"results": []}
    term = f"%{q.strip().lower()}%"
    results = []

    # Search assets
    asset_rows = db.execute(sa.text(
        "SELECT a.id, a.name, at.name as type_name, a.maturity, a.description "
        "FROM assets a JOIN asset_types at ON a.asset_type_id = at.id "
        "WHERE LOWER(a.name) LIKE :q OR LOWER(COALESCE(a.description,'')) LIKE :q "
        "ORDER BY a.install_count DESC NULLS LAST LIMIT 8"
    ), {"q": term})
    for r in asset_rows:
        results.append({
            "id": str(r[0]), "type": "asset", "title": r[1],
            "description": f"{r[2]} · {r[3] or 'idea'}",
            "link": f"/assets/{r[0]}",
        })

    # Search wishlist
    wish_rows = db.execute(sa.text(
        "SELECT id, title, category, status, description "
        "FROM demands "
        "WHERE LOWER(title) LIKE :q OR LOWER(COALESCE(description,'')) LIKE :q "
        "ORDER BY upvotes DESC LIMIT 5"
    ), {"q": term})
    for r in wish_rows:
        results.append({
            "id": str(r[0]), "type": "wish", "title": r[1],
            "description": f"Wish · {r[3] or 'open'}",
            "link": f"/wishlist/{r[0]}",
        })

    # Search capabilities
    cap_rows = db.execute(sa.text(
        "SELECT id, name, category, description "
        "FROM capabilities "
        "WHERE LOWER(name) LIKE :q OR LOWER(COALESCE(description,'')) LIKE :q "
        "ORDER BY sort_order LIMIT 5"
    ), {"q": term})
    for r in cap_rows:
        results.append({
            "id": str(r[0]), "type": "capability", "title": r[1],
            "description": f"Capability · {r[2]}",
            "link": f"/settings/capabilities",
        })

    return {"results": results, "total": len(results)}


# ════════════════════════════════════════════════════
# Promotion Workflow
# ════════════════════════════════════════════════════

@dpz_router.post("/promotions")
def request_promotion(body: dict, db: DBSessionDep, current_user: CurrentUserDep):
    """Request a maturity promotion for an asset."""
    import sqlalchemy as sa
    user_email = getattr(current_user, 'email', None) or getattr(current_user, 'user_name', 'unknown')
    promo_id = str(_uuid.uuid4())
    db.execute(sa.text(
        "INSERT INTO promotion_requests (id, asset_id, from_maturity, to_maturity, requested_by, request_notes) "
        "VALUES (:id, :aid, :from_m, :to_m, :by, :notes)"
    ), {
        "id": promo_id,
        "aid": body.get("asset_id"),
        "from_m": body.get("from_maturity"),
        "to_m": body.get("to_maturity"),
        "by": user_email,
        "notes": body.get("notes", ""),
    })
    db.commit()
    _emit_domain_event(db, body.get("asset_id", ""), "asset", "promotion.requested", {
        "from_maturity": body.get("from_maturity"), "to_maturity": body.get("to_maturity"),
        "actor": user_email, "notes": body.get("notes", "")[:200],
    })
    db.commit()
    return {"id": promo_id, "status": "pending"}


@dpz_router.get("/promotions")
def list_promotions(db: DBSessionDep, current_user: CurrentUserDep, status_filter: str = None):
    """List promotion requests, optionally filtered by status."""
    import sqlalchemy as sa
    sql = (
        "SELECT pr.id, pr.asset_id, a.name as asset_name, pr.from_maturity, pr.to_maturity, "
        "pr.requested_by, pr.reviewed_by, pr.status, pr.request_notes, pr.review_notes, "
        "pr.requested_at, pr.reviewed_at "
        "FROM promotion_requests pr "
        "JOIN assets a ON pr.asset_id = a.id "
    )
    params = {}
    if status_filter:
        sql += " WHERE pr.status = :status"
        params["status"] = status_filter
    sql += " ORDER BY pr.requested_at DESC"
    rows = db.execute(sa.text(sql), params)
    return {"items": [{
        "id": str(r[0]), "asset_id": str(r[1]), "asset_name": r[2],
        "from_maturity": r[3], "to_maturity": r[4],
        "requested_by": r[5], "reviewed_by": r[6],
        "status": r[7], "request_notes": r[8], "review_notes": r[9],
        "requested_at": r[10].isoformat() if r[10] else None,
        "reviewed_at": r[11].isoformat() if r[11] else None,
    } for r in rows]}


@dpz_router.put("/promotions/{promo_id}/review")
def review_promotion(promo_id: str, body: dict, db: DBSessionDep, current_user: CurrentUserDep):
    """Approve or reject a promotion request. On approve, updates asset maturity."""
    import sqlalchemy as sa
    user_email = getattr(current_user, 'email', None) or getattr(current_user, 'user_name', 'unknown')
    decision = body.get("decision", "approved")  # approved | rejected
    review_notes = body.get("review_notes", "")

    # Update the request
    db.execute(sa.text(
        "UPDATE promotion_requests SET status = :status, reviewed_by = :by, "
        "review_notes = :notes, reviewed_at = now() WHERE id = :id"
    ), {"status": decision, "by": user_email, "notes": review_notes, "id": promo_id})

    # If approved, update the asset's maturity
    if decision == "approved":
        promo = db.execute(sa.text(
            "SELECT asset_id, to_maturity FROM promotion_requests WHERE id = :id"
        ), {"id": promo_id}).fetchone()
        if promo:
            db.execute(sa.text(
                "UPDATE assets SET maturity = :m, updated_at = now() WHERE id = :aid"
            ), {"m": promo[1], "aid": str(promo[0])})

    db.commit()
    # Emit domain event for promotion review
    _promo_info = db.execute(sa.text(
        "SELECT asset_id, from_maturity, to_maturity FROM promotion_requests WHERE id = :id"
    ), {"id": promo_id}).fetchone()
    if _promo_info:
        _emit_domain_event(db, str(_promo_info[0]), "asset", f"promotion.{decision}", {
            "from_maturity": _promo_info[1], "to_maturity": _promo_info[2],
            "reviewer": user_email, "notes": review_notes[:200],
        })
        db.commit()
    return {"status": decision, "promo_id": promo_id}


@dpz_router.get("/assets/{asset_id}/promotions")
def get_asset_promotions(asset_id: str, db: DBSessionDep):
    """Get promotion history for an asset."""
    import sqlalchemy as sa
    rows = db.execute(sa.text(
        "SELECT id, from_maturity, to_maturity, requested_by, reviewed_by, "
        "status, request_notes, review_notes, requested_at, reviewed_at "
        "FROM promotion_requests WHERE asset_id = :aid ORDER BY requested_at DESC"
    ), {"aid": asset_id})
    return {"items": [{
        "id": str(r[0]), "from_maturity": r[1], "to_maturity": r[2],
        "requested_by": r[3], "reviewed_by": r[4],
        "status": r[5], "request_notes": r[6], "review_notes": r[7],
        "requested_at": r[8].isoformat() if r[8] else None,
        "reviewed_at": r[9].isoformat() if r[9] else None,
    } for r in rows]}


# ════════════════════════════════════════════════════
# Wish-to-Asset Matching
# ════════════════════════════════════════════════════

@dpz_router.post("/wishlist/{wish_id}/match")
def match_wish_to_asset(wish_id: str, body: dict, db: DBSessionDep, current_user: CurrentUserDep):
    """Link a wish to an asset that addresses it. Updates wish status to matched."""
    import sqlalchemy as sa
    asset_id = body.get("asset_id")
    if not asset_id:
        from fastapi import HTTPException
        raise HTTPException(status_code=400, detail="asset_id required")

    # Link
    db.execute(sa.text(
        "UPDATE demands SET linked_asset_id = :aid, status = 'matched', updated_at = now() WHERE id = :wid"
    ), {"aid": asset_id, "wid": wish_id})

    # Also add to asset_demand_links
    db.execute(sa.text(
        "INSERT INTO asset_demand_links (asset_id, demand_id) VALUES (:aid, :did) ON CONFLICT DO NOTHING"
    ), {"aid": asset_id, "did": wish_id})

    db.commit()
    user_email = getattr(current_user, 'email', None) or getattr(current_user, 'user_name', 'unknown')
    _emit_domain_event(db, wish_id, "demand", "wish.matched", {
        "asset_id": asset_id, "actor": user_email,
    })
    db.commit()
    return {"status": "matched", "wish_id": wish_id, "asset_id": asset_id}


@dpz_router.delete("/wishlist/{wish_id}/match")
def unmatch_wish(wish_id: str, db: DBSessionDep, current_user: CurrentUserDep):
    """Remove the match, set wish back to open."""
    import sqlalchemy as sa
    # Get current linked asset
    row = db.execute(sa.text("SELECT linked_asset_id FROM demands WHERE id = :wid"), {"wid": wish_id}).fetchone()
    if row and row[0]:
        db.execute(sa.text(
            "DELETE FROM asset_demand_links WHERE asset_id = :aid AND demand_id = :did"
        ), {"aid": str(row[0]), "did": wish_id})
    db.execute(sa.text(
        "UPDATE demands SET linked_asset_id = NULL, status = 'open', updated_at = now() WHERE id = :wid"
    ), {"wid": wish_id})
    db.commit()
    return {"status": "unmatched"}


@dpz_router.get("/assets/{asset_id}/wishes")
def get_asset_wishes(asset_id: str, db: DBSessionDep):
    """Get wishes that this asset addresses."""
    import sqlalchemy as sa
    rows = db.execute(sa.text(
        "SELECT d.id, d.title, d.status, d.upvotes, d.category "
        "FROM demands d "
        "JOIN asset_demand_links adl ON d.id = adl.demand_id "
        "WHERE adl.asset_id = :aid "
        "ORDER BY d.upvotes DESC"
    ), {"aid": asset_id})
    return {"items": [{
        "id": str(r[0]), "title": r[1], "status": r[2], "upvotes": r[3], "category": r[4],
    } for r in rows]}


@dpz_router.get("/portfolio/my-assets")
def get_my_assets(db: DBSessionDep, current_user: CurrentUserDep):
    """Get all assets created by the current user."""
    import sqlalchemy as sa
    user_email = getattr(current_user, 'email', None) or getattr(current_user, 'user_name', 'unknown')
    result = db.execute(sa.text(
        "SELECT a.id, a.name, at.name as type_name, at.category, a.maturity, "
        "a.install_count, a.publication_scope, a.operational_health, a.created_at, a.updated_at, a.description "
        "FROM assets a JOIN asset_types at ON a.asset_type_id = at.id "
        "WHERE a.created_by = :email ORDER BY a.updated_at DESC"
    ), {"email": user_email})
    items = []
    for r in result:
        items.append({
            "id": str(r[0]), "name": r[1], "type_name": r[2], "category": r[3],
            "maturity": r[4], "install_count": r[5], "scope": r[6],
            "health": r[7] or "unknown",
            "created_at": r[8].isoformat() if r[8] else None,
            "updated_at": r[9].isoformat() if r[9] else None,
            "description": r[10],
        })
    return {"items": items, "total": len(items), "user": user_email}


@dpz_router.get("/portfolio")
def get_portfolio_summary(db: DBSessionDep):
    """Aggregate asset counts by maturity, type, scope, and health."""
    import sqlalchemy as sa
    by_maturity = db.execute(sa.text(
        "SELECT COALESCE(maturity, 'unset') as stage, count(*) as cnt "
        "FROM assets GROUP BY maturity ORDER BY cnt DESC"
    ))
    by_type = db.execute(sa.text(
        "SELECT at.name, count(*) as cnt FROM assets a "
        "JOIN asset_types at ON a.asset_type_id = at.id "
        "GROUP BY at.name ORDER BY cnt DESC"
    ))
    by_scope = db.execute(sa.text(
        "SELECT COALESCE(publication_scope, 'draft') as scope, count(*) as cnt "
        "FROM assets GROUP BY publication_scope ORDER BY cnt DESC"
    ))
    by_health = db.execute(sa.text(
        "SELECT COALESCE(operational_health, 'unknown') as health, count(*) as cnt "
        "FROM assets GROUP BY operational_health ORDER BY cnt DESC"
    ))
    total = db.execute(sa.text("SELECT count(*) FROM assets")).scalar() or 0
    return {
        "total": total,
        "by_maturity": [{"stage": r[0], "count": r[1]} for r in by_maturity],
        "by_type": [{"type": r[0], "count": r[1]} for r in by_type],
        "by_scope": [{"scope": r[0], "count": r[1]} for r in by_scope],
        "by_health": [{"health": r[0], "count": r[1]} for r in by_health],
    }


@dpz_router.get("/adoption")
def get_adoption_summary(db: DBSessionDep):
    """Recently updated assets + scope distribution as adoption proxy."""
    import sqlalchemy as sa
    recent = db.execute(sa.text(
        "SELECT a.id, a.name, at.name as type_name, a.maturity, a.publication_scope, a.updated_at "
        "FROM assets a JOIN asset_types at ON a.asset_type_id = at.id "
        "ORDER BY a.updated_at DESC LIMIT 15"
    ))
    items = []
    for r in recent:
        items.append({
            "id": str(r[0]), "name": r[1], "type_name": r[2],
            "maturity": r[3], "scope": r[4],
            "updated_at": r[5].isoformat() if r[5] else None,
        })
    # Scope spread as adoption indicator
    scope_counts = db.execute(sa.text(
        "SELECT COALESCE(publication_scope, 'draft'), count(*) FROM assets GROUP BY publication_scope"
    ))
    return {
        "recent_activity": items,
        "scope_distribution": [{"scope": r[0], "count": r[1]} for r in scope_counts],
    }


@dpz_router.get("/health")
def get_health_summary(db: DBSessionDep):
    """Assets grouped by operational health with cost placeholder."""
    import sqlalchemy as sa
    result = db.execute(sa.text(
        "SELECT a.id, a.name, at.name as type_name, a.operational_health, a.maturity "
        "FROM assets a JOIN asset_types at ON a.asset_type_id = at.id "
        "ORDER BY a.operational_health, a.name"
    ))
    items = []
    for r in result:
        items.append({
            "id": str(r[0]), "name": r[1], "type_name": r[2],
            "health": r[3] or "unknown", "maturity": r[4],
        })
    return {"items": items, "total": len(items)}


# ─── Marketplace routes ────────────────────────────────────────────────

@dpz_router.get("/marketplace")
def get_marketplace(db: DBSessionDep, category: Optional[str] = Query(None)):
    """Curated marketplace view: featured, trending (by installs), recently released."""
    import sqlalchemy as sa
    cat_filter = "AND at.category = :cat" if category else ""
    params = {"cat": category} if category else {}

    # Featured assets
    featured = db.execute(sa.text(f"""
        SELECT a.id, a.name, a.description, at.name as type_name, at.category, at.icon,
               a.maturity, a.install_count, a.latest_version, a.featured,
               a.publication_scope, a.created_by
        FROM assets a JOIN asset_types at ON a.asset_type_id = at.id
        WHERE a.featured = true {cat_filter}
        ORDER BY a.install_count DESC NULLS LAST
        LIMIT 6
    """), params)

    # Trending (top installs, not featured)
    trending = db.execute(sa.text(f"""
        SELECT a.id, a.name, a.description, at.name as type_name, at.category, at.icon,
               a.maturity, a.install_count, a.latest_version, a.featured,
               a.publication_scope, a.created_by
        FROM assets a JOIN asset_types at ON a.asset_type_id = at.id
        WHERE (a.featured IS NULL OR a.featured = false)
          AND a.maturity IN ('production', 'production_candidate', 'validating')
          {cat_filter}
        ORDER BY a.install_count DESC NULLS LAST, a.updated_at DESC
        LIMIT 12
    """), params)

    # Recently released (has a version)
    recent = db.execute(sa.text(f"""
        SELECT a.id, a.name, a.description, at.name as type_name, at.category, at.icon,
               a.maturity, a.install_count, a.latest_version, a.featured,
               a.publication_scope, a.created_by
        FROM assets a JOIN asset_types at ON a.asset_type_id = at.id
        WHERE a.latest_version IS NOT NULL {cat_filter}
        ORDER BY a.updated_at DESC
        LIMIT 8
    """), params)

    def row_to_dict(r):
        return {
            "id": str(r[0]), "name": r[1], "description": r[2], "type_name": r[3],
            "category": r[4], "icon": r[5], "maturity": r[6],
            "install_count": r[7] or 0, "latest_version": r[8],
            "featured": r[9] or False, "publication_scope": r[10], "created_by": r[11],
        }

    return {
        "featured": [row_to_dict(r) for r in featured],
        "trending": [row_to_dict(r) for r in trending],
        "recent_releases": [row_to_dict(r) for r in recent],
    }


@dpz_router.get("/assets/{asset_id}/versions")
def list_asset_versions(asset_id: str, db: DBSessionDep):
    """List all versions for an asset, newest first."""
    import sqlalchemy as sa
    rows = db.execute(sa.text("""
        SELECT id, version, changelog, release_notes, artifact_url, artifact_type,
               released_by, is_latest, download_count, created_at
        FROM asset_versions WHERE asset_id = :aid
        ORDER BY created_at DESC
    """), {"aid": asset_id})
    return {"versions": [{
        "id": str(r[0]), "version": r[1], "changelog": r[2], "release_notes": r[3],
        "artifact_url": r[4], "artifact_type": r[5], "released_by": r[6],
        "is_latest": r[7], "download_count": r[8], "created_at": r[9].isoformat() if r[9] else None,
    } for r in rows]}


@dpz_router.post("/versions")
def create_version(body: dict, db: DBSessionDep, request: Request):
    """Publish a new version of an asset."""
    import sqlalchemy as sa
    import uuid as _uuid
    asset_id = body["asset_id"]
    version = body["version"]
    user = getattr(request.state, 'user_name', None) or 'anonymous'
    # Clear previous is_latest
    db.execute(sa.text("UPDATE asset_versions SET is_latest = false WHERE asset_id = :aid"), {"aid": asset_id})
    vid = str(_uuid.uuid4())
    db.execute(sa.text("""
        INSERT INTO asset_versions (id, asset_id, version, changelog, release_notes,
            artifact_url, artifact_type, released_by, is_latest)
        VALUES (:id, :aid, :ver, :cl, :rn, :url, :atype, :by, true)
    """), {
        "id": vid, "aid": asset_id, "ver": version,
        "cl": body.get("changelog"), "rn": body.get("release_notes"),
        "url": body.get("artifact_url"), "atype": body.get("artifact_type", "notebook"),
        "by": user,
    })
    # Update asset latest_version
    db.execute(sa.text("UPDATE assets SET latest_version = :ver WHERE id = :aid"), {"ver": version, "aid": asset_id})
    db.commit()
    return {"id": vid, "version": version}


@dpz_router.post("/install")
def record_install(body: dict, db: DBSessionDep, request: Request):
    """Record an asset install/adoption event and increment counter."""
    import sqlalchemy as sa
    user = getattr(request.state, 'user_name', None) or 'anonymous'
    asset_id = body["asset_id"]
    db.execute(sa.text("""
        INSERT INTO install_events (asset_id, version_id, installed_by, context)
        VALUES (:aid, :vid, :by, :ctx)
    """), {"aid": asset_id, "vid": body.get("version_id"), "by": user, "ctx": body.get("context")})
    db.execute(sa.text("UPDATE assets SET install_count = COALESCE(install_count, 0) + 1 WHERE id = :aid"), {"aid": asset_id})
    # Increment version download count if specified
    if body.get("version_id"):
        db.execute(sa.text("UPDATE asset_versions SET download_count = download_count + 1 WHERE id = :vid"), {"vid": body["version_id"]})
    db.commit()
    new_count = db.execute(sa.text("SELECT install_count FROM assets WHERE id = :aid"), {"aid": asset_id}).scalar()
    return {"install_count": new_count}


@dpz_router.post("/promote")
def request_promotion(body: dict, db: DBSessionDep, request: Request):
    """Request maturity promotion for an asset."""
    import sqlalchemy as sa
    import uuid as _uuid
    user = getattr(request.state, 'user_name', None) or 'anonymous'
    pid = str(_uuid.uuid4())
    db.execute(sa.text("""
        INSERT INTO promotion_requests (id, asset_id, from_maturity, to_maturity, requested_by, request_notes)
        VALUES (:id, :aid, :from_m, :to_m, :by, :notes)
    """), {
        "id": pid, "aid": body["asset_id"], "from_m": body["from_maturity"],
        "to_m": body["to_maturity"], "by": user, "notes": body.get("notes"),
    })
    db.commit()
    return {"id": pid, "status": "pending"}


@dpz_router.get("/promotions")
def list_promotions(db: DBSessionDep, status: Optional[str] = Query("pending")):
    """List promotion requests, filtered by status."""
    import sqlalchemy as sa
    rows = db.execute(sa.text("""
        SELECT pr.id, pr.asset_id, a.name as asset_name, pr.from_maturity, pr.to_maturity,
               pr.requested_by, pr.status, pr.request_notes, pr.review_notes,
               pr.requested_at, pr.reviewed_by, pr.reviewed_at
        FROM promotion_requests pr JOIN assets a ON pr.asset_id = a.id
        WHERE pr.status = :st
        ORDER BY pr.requested_at DESC
    """), {"st": status})
    return {"promotions": [{
        "id": str(r[0]), "asset_id": str(r[1]), "asset_name": r[2],
        "from_maturity": r[3], "to_maturity": r[4], "requested_by": r[5],
        "status": r[6], "request_notes": r[7], "review_notes": r[8],
        "requested_at": r[9].isoformat() if r[9] else None,
        "reviewed_by": r[10], "reviewed_at": r[11].isoformat() if r[11] else None,
    } for r in rows]}


@dpz_router.put("/promotions/{promotion_id}")
def review_promotion(promotion_id: str, body: dict, db: DBSessionDep, request: Request):
    """Approve or reject a promotion request. On approve, updates asset maturity."""
    import sqlalchemy as sa
    user = getattr(request.state, 'user_name', None) or 'anonymous'
    action = body["action"]  # 'approve' or 'reject'
    notes = body.get("notes", "")

    new_status = "approved" if action == "approve" else "rejected"
    db.execute(sa.text("""
        UPDATE promotion_requests
        SET status = :st, reviewed_by = :by, review_notes = :notes, reviewed_at = now()
        WHERE id = :pid
    """), {"st": new_status, "by": user, "notes": notes, "pid": promotion_id})

    if action == "approve":
        # Get the target maturity and update the asset
        row = db.execute(sa.text(
            "SELECT asset_id, to_maturity FROM promotion_requests WHERE id = :pid"
        ), {"pid": promotion_id}).fetchone()
        if row:
            db.execute(sa.text(
                "UPDATE assets SET maturity = :m WHERE id = :aid"
            ), {"m": row[1], "aid": str(row[0])})
    db.commit()
    return {"id": promotion_id, "status": new_status}


# ─── Activity Feed (domain events) ───────────────────────────────────

@dpz_router.get("/activity")
def list_activity(db: DBSessionDep, limit: int = Query(20, ge=1, le=100)):
    """Recent domain events for the activity feed."""
    import sqlalchemy as sa
    rows = db.execute(sa.text("""
        SELECT id, aggregate_id, aggregate_type, event_type, payload,
               emitted_at
        FROM domain_events
        ORDER BY emitted_at DESC
        LIMIT :lim
    """), {"lim": limit})
    return {"items": [{
        "id": str(r[0]), "aggregate_id": str(r[1]), "aggregate_type": r[2],
        "event_type": r[3], "payload": r[4] if isinstance(r[4], dict) else json.loads(r[4]) if r[4] else {},
        "emitted_at": r[5].isoformat() if r[5] else None,
    } for r in rows]}


# ─── Signals & Evidence routes ───────────────────────────────────────

@dpz_router.get("/signals")
def list_signals(db: DBSessionDep, signal_type: Optional[str] = Query(None), limit: int = Query(50, ge=1, le=200)):
    """Latest observed signals across all assets."""
    import sqlalchemy as sa
    where = "WHERE s.signal_type = :stype" if signal_type else ""
    params = {"stype": signal_type, "lim": limit} if signal_type else {"lim": limit}
    rows = db.execute(sa.text(f"""
        SELECT s.id, s.asset_id, a.name as asset_name, at.name as type_name,
               s.signal_type, s.signal_source, s.value_numeric, s.value_text,
               s.observed_at, a.maturity, a.operational_health
        FROM asset_signals s
        JOIN assets a ON s.asset_id = a.id
        JOIN asset_types at ON a.asset_type_id = at.id
        {where}
        ORDER BY s.observed_at DESC
        LIMIT :lim
    """), params)
    return {"items": [{
        "id": str(r[0]), "asset_id": str(r[1]), "asset_name": r[2], "type_name": r[3],
        "signal_type": r[4], "signal_source": r[5], "value_numeric": r[6], "value_text": r[7],
        "observed_at": r[8].isoformat() if r[8] else None, "maturity": r[9], "health": r[10],
    } for r in rows]}


@dpz_router.get("/assets/{asset_id}/signals")
def get_asset_signals(asset_id: str, db: DBSessionDep):
    """Signal timeline and grouped latest values for one asset."""
    import sqlalchemy as sa
    rows = db.execute(sa.text("""
        SELECT id, signal_type, signal_source, value_numeric, value_text, value_json,
               observed_at, period_start, period_end, metadata
        FROM asset_signals
        WHERE asset_id = :aid
        ORDER BY observed_at DESC
        LIMIT 100
    """), {"aid": asset_id})
    items = [{
        "id": str(r[0]), "signal_type": r[1], "signal_source": r[2],
        "value_numeric": r[3], "value_text": r[4], "value_json": r[5],
        "observed_at": r[6].isoformat() if r[6] else None,
        "period_start": r[7].isoformat() if r[7] else None,
        "period_end": r[8].isoformat() if r[8] else None,
        "metadata": r[9],
    } for r in rows]
    latest_by_type = {}
    for item in items:
        latest_by_type.setdefault(item["signal_type"], item)
    return {"items": items, "latest_by_type": latest_by_type}


@dpz_router.post("/signals")
def create_signal(body: dict, db: DBSessionDep):
    """Manual signal ingestion endpoint for adapters or testing."""
    import sqlalchemy as sa
    import uuid as _uuid
    sid = str(_uuid.uuid4())
    db.execute(sa.text("""
        INSERT INTO asset_signals (
            id, asset_id, signal_type, signal_source, value_numeric, value_text,
            value_json, observed_at, period_start, period_end, metadata)
        VALUES (
            :id, :asset_id, :signal_type, :signal_source, :value_numeric, :value_text,
            CAST(:value_json AS JSONB), COALESCE(CAST(:observed_at AS TIMESTAMPTZ), now()),
            CAST(:period_start AS TIMESTAMPTZ), CAST(:period_end AS TIMESTAMPTZ), CAST(:metadata AS JSONB))
    """), {
        "id": sid,
        "asset_id": body["asset_id"],
        "signal_type": body["signal_type"],
        "signal_source": body["signal_source"],
        "value_numeric": body.get("value_numeric"),
        "value_text": body.get("value_text"),
        "value_json": json.dumps(body.get("value_json")) if body.get("value_json") is not None else None,
        "observed_at": body.get("observed_at"),
        "period_start": body.get("period_start"),
        "period_end": body.get("period_end"),
        "metadata": json.dumps(body.get("metadata")) if body.get("metadata") is not None else None,
    })
    db.commit()
    return {"id": sid}


@dpz_router.get("/evidence")
def get_evidence_summary(db: DBSessionDep):
    """Rank assets by evidence completeness and freshness."""
    import sqlalchemy as sa
    rows = db.execute(sa.text("""
        WITH signal_counts AS (
            SELECT asset_id,
                   count(*) as total_signals,
                   count(DISTINCT signal_type) as signal_types,
                   max(observed_at) as last_signal_at
            FROM asset_signals
            GROUP BY asset_id
        )
        SELECT a.id, a.name, at.name as type_name, a.maturity, a.operational_health,
               COALESCE(sc.total_signals, 0) as total_signals,
               COALESCE(sc.signal_types, 0) as signal_types,
               sc.last_signal_at,
               CASE
                 WHEN a.description IS NOT NULL THEN 1 ELSE 0 END +
               CASE WHEN a.value_hypothesis IS NOT NULL THEN 1 ELSE 0 END +
               CASE WHEN a.repo_url IS NOT NULL OR a.demo_url IS NOT NULL THEN 1 ELSE 0 END +
               CASE WHEN COALESCE(sc.signal_types, 0) >= 3 THEN 1 ELSE 0 END +
               CASE WHEN sc.last_signal_at > now() - interval '30 days' THEN 1 ELSE 0 END
               AS evidence_score
        FROM assets a
        JOIN asset_types at ON a.asset_type_id = at.id
        LEFT JOIN signal_counts sc ON a.id = sc.asset_id
        ORDER BY evidence_score DESC, total_signals DESC, a.name
    """))
    return {"items": [{
        "id": str(r[0]), "name": r[1], "type_name": r[2], "maturity": r[3], "health": r[4],
        "total_signals": r[5], "signal_types": r[6],
        "last_signal_at": r[7].isoformat() if r[7] else None,
        "evidence_score": r[8],
    } for r in rows]}


@dpz_router.get("/health-evidence")
def get_health_evidence_dashboard(db: DBSessionDep):
    """Aggregates for evidence freshness, quality, and cost posture."""
    import sqlalchemy as sa
    freshness = db.execute(sa.text("""
        WITH latest AS (
          SELECT a.id,
                 max(s.observed_at) as last_signal_at
          FROM assets a
          LEFT JOIN asset_signals s ON a.id = s.asset_id
          GROUP BY a.id
        )
        SELECT
          CASE
            WHEN last_signal_at > now() - interval '7 days' THEN 'fresh'
            WHEN last_signal_at > now() - interval '30 days' THEN 'stale'
            WHEN last_signal_at IS NULL THEN 'missing'
            ELSE 'aging'
          END as bucket,
          count(*)
        FROM latest
        GROUP BY 1
    """))
    quality = db.execute(sa.text("""
        WITH latest_quality AS (
          SELECT DISTINCT ON (asset_id)
                 asset_id,
                 value_numeric as quality_score
          FROM asset_signals
          WHERE signal_type = 'quality_score'
          ORDER BY asset_id, observed_at DESC
        ), scored AS (
          SELECT a.id, lq.quality_score
          FROM assets a
          LEFT JOIN latest_quality lq ON a.id = lq.asset_id
        )
        SELECT
          CASE
            WHEN quality_score >= 0.9 THEN 'excellent'
            WHEN quality_score >= 0.75 THEN 'good'
            WHEN quality_score IS NULL THEN 'unknown'
            ELSE 'needs_attention'
          END as bucket,
          count(*)
        FROM scored
        GROUP BY 1
    """))
    cost = db.execute(sa.text("""
        WITH latest_cost AS (
          SELECT DISTINCT ON (asset_id)
                 asset_id,
                 value_numeric as monthly_cost_usd
          FROM asset_signals
          WHERE signal_type = 'monthly_cost_usd'
          ORDER BY asset_id, observed_at DESC
        ), costed AS (
          SELECT a.id, lc.monthly_cost_usd
          FROM assets a
          LEFT JOIN latest_cost lc ON a.id = lc.asset_id
        )
        SELECT
          CASE
            WHEN monthly_cost_usd >= 1000 THEN 'high'
            WHEN monthly_cost_usd >= 250 THEN 'medium'
            WHEN monthly_cost_usd IS NULL THEN 'unknown'
            ELSE 'low'
          END as bucket,
          count(*)
        FROM costed
        GROUP BY 1
    """))
    return {
        "freshness": [{"bucket": r[0], "count": r[1]} for r in freshness],
        "quality": [{"bucket": r[0], "count": r[1]} for r in quality],
        "cost": [{"bucket": r[0], "count": r[1]} for r in cost],
    }


# ─── Asset Images routes ─────────────────────────────────────────────────────

@dpz_router.get("/assets/{asset_id}/images")
def get_asset_images(asset_id: str, db: DBSessionDep):
    """Get all images for an asset (hero + screenshots)."""
    import sqlalchemy as sa
    rows = db.execute(sa.text("""
        SELECT id, image_url, image_type, sort_order, caption, alt_text, source, created_at
        FROM asset_images
        WHERE asset_id = :aid
        ORDER BY sort_order ASC, created_at ASC
    """), {"aid": asset_id})
    items = [{
        "id": str(r[0]), "image_url": r[1], "image_type": r[2], "sort_order": r[3],
        "caption": r[4], "alt_text": r[5], "source": r[6],
        "created_at": r[7].isoformat() if r[7] else None,
    } for r in rows]
    hero = next((i for i in items if i["image_type"] == "hero"), None)
    return {"items": items, "hero": hero}


@dpz_router.get("/images/heroes")
def get_hero_images(db: DBSessionDep):
    """Batch fetch hero images for all assets (used by card grid)."""
    import sqlalchemy as sa
    rows = db.execute(sa.text("""
        SELECT DISTINCT ON (asset_id) asset_id, image_url, caption
        FROM asset_images
        WHERE image_type = 'hero'
        ORDER BY asset_id, sort_order ASC
    """))
    return {"heroes": {str(r[0]): {"image_url": r[1], "caption": r[2]} for r in rows}}


@dpz_router.post("/assets/{asset_id}/images/harvest")
def harvest_images_from_repo(asset_id: str, db: DBSessionDep):
    """Harvest images from the asset's repo_url README."""
    import sqlalchemy as sa
    import uuid as _uuid
    import re
    import requests as _requests

    row = db.execute(sa.text("SELECT repo_url FROM assets WHERE id = :aid"), {"aid": asset_id}).fetchone()
    if not row or not row[0]:
        return {"harvested": 0, "message": "No repo_url set on asset"}

    repo_url = row[0]
    # Convert GitHub URL to raw README
    # Handle: https://github.com/owner/repo or https://github.com/owner/repo/tree/branch
    match = re.match(r'https?://github\.com/([^/]+/[^/]+)', repo_url)
    if not match:
        return {"harvested": 0, "message": "Not a GitHub URL"}

    repo_path = match.group(1).rstrip('/')
    readme_urls = [
        f"https://raw.githubusercontent.com/{repo_path}/main/README.md",
        f"https://raw.githubusercontent.com/{repo_path}/master/README.md",
    ]

    readme_content = None
    for url in readme_urls:
        try:
            resp = _requests.get(url, timeout=10)
            if resp.status_code == 200:
                readme_content = resp.text
                break
        except Exception:
            continue

    if not readme_content:
        return {"harvested": 0, "message": "Could not fetch README"}

    # Extract markdown image references
    img_pattern = re.compile(r'!\[[^\]]*\]\(([^)]+)\)')
    found_urls = []
    for img_match in img_pattern.finditer(readme_content):
        img_url = img_match.group(1)
        # Make relative URLs absolute
        if img_url.startswith('http'):
            found_urls.append(img_url)
        elif not img_url.startswith('data:'):
            found_urls.append(f"https://raw.githubusercontent.com/{repo_path}/main/{img_url}")

    if not found_urls:
        return {"harvested": 0, "message": "No images found in README"}

    # Insert new images (first as hero, rest as screenshots)
    inserted = 0
    for idx, url in enumerate(found_urls[:6]):  # Max 6 images
        img_type = "hero" if idx == 0 else "screenshot"
        db.execute(sa.text("""
            INSERT INTO asset_images (id, asset_id, image_url, image_type, sort_order, source)
            VALUES (:id, :aid, :url, :type, :order, 'git_harvest')
            ON CONFLICT DO NOTHING
        """), {
            "id": str(_uuid.uuid4()), "aid": asset_id,
            "url": url, "type": img_type, "order": idx,
        })
        inserted += 1
    db.commit()
    return {"harvested": inserted, "images": found_urls[:6]}


@dpz_router.post("/assets/{asset_id}/images")
def add_asset_image(asset_id: str, body: dict, db: DBSessionDep):
    """Add an image to an asset."""
    import sqlalchemy as sa
    import uuid as _uuid
    img_id = str(_uuid.uuid4())
    db.execute(sa.text("""
        INSERT INTO asset_images (id, asset_id, image_url, image_type, sort_order, caption, alt_text, source)
        VALUES (:id, :aid, :url, :type, :order, :caption, :alt, :source)
    """), {
        "id": img_id, "aid": asset_id,
        "url": body["image_url"],
        "type": body.get("image_type", "screenshot"),
        "order": body.get("sort_order", 0),
        "caption": body.get("caption"),
        "alt": body.get("alt_text"),
        "source": body.get("source", "manual"),
    })
    db.commit()
    return {"id": img_id}


# ─── Learn / Content Hub (Three-Channel) ────────────────────────────────────

# Capability keyword map for auto-tagging platform content
_CAPABILITY_KEYWORDS = {
    "agent-framework":    ["agent", "agents", "agentic", "tool calling", "function calling", "mcp", "openai agents"],
    "batch-inference":    ["batch inference", "batch scoring", "batch prediction"],
    "llm-orchestration":  ["llm", "foundation model", "prompt", "chat completion", "rag", "retrieval augmented", "ai gateway"],
    "model-training":     ["training", "fine-tuning", "finetuning", "hyperparameter", "automl"],
    "realtime-inference": ["real-time inference", "realtime", "model serving", "serving endpoint", "online inference"],
    "batch-etl":          ["etl", "batch processing", "medallion", "bronze", "silver", "gold", "declarative pipeline", "dlt"],
    "feature-store":      ["feature store", "feature engineering", "feature table"],
    "data-warehouse":     ["warehouse", "sql warehouse", "dbsql", "lakehouse", "delta lake"],
    "streaming-ingest":   ["streaming", "structured streaming", "kafka", "kinesis", "auto loader", "cloudfiles"],
    "vector-store":       ["vector search", "vector index", "embedding", "semantic search", "similarity"],
    "geospatial":         ["geospatial", "h3", "st_", "spatial", "geo"],
    "governed-catalog":   ["unity catalog", "governance", "lineage", "access control", "data governance", "tagging"],
    "interactive-app":    ["app", "apps", "streamlit", "dash", "gradio", "databricks app", "lakebase"],
    "nlq":                ["genie", "natural language", "text-to-sql", "ai/bi"],
    "observability":      ["mlflow", "tracing", "evaluation", "monitoring", "scorer", "observability"],
    "operational-db":     ["lakebase", "postgres", "operational database", "oltp"],
    "semantic-layer":     ["metric view", "semantic layer", "metric", "kpi", "measure"],
    "workflow-orchestration": ["job", "workflow", "orchestration", "schedule", "task"],
}


def _auto_tag_capabilities(title: str, description: str) -> list:
    """Match content text against capability keywords. Returns list of matching slugs."""
    text = f"{title} {description}".lower()
    matched = []
    for slug, keywords in _CAPABILITY_KEYWORDS.items():
        if any(kw in text for kw in keywords):
            matched.append(slug)
    return matched


def _parse_learn_row(r, col_offset=0):
    """Parse a learn_content row into a dict. Handles JSONB tags."""
    tags_val = r[5 + col_offset]
    if isinstance(tags_val, str):
        try:
            tags_val = json.loads(tags_val)
        except Exception:
            tags_val = []
    rel_caps = r[9 + col_offset] if len(r) > (9 + col_offset) else []
    if isinstance(rel_caps, str):
        try:
            rel_caps = json.loads(rel_caps)
        except Exception:
            rel_caps = []
    return {
        "id": str(r[0 + col_offset]), "title": r[1 + col_offset], "description": r[2 + col_offset],
        "source": r[3 + col_offset], "url": r[4 + col_offset],
        "tags": tags_val or [],
        "author": r[6 + col_offset],
        "date": r[7 + col_offset].isoformat() if r[7 + col_offset] else None,
        "channel": r[8 + col_offset] if len(r) > (8 + col_offset) else "team",
        "relevance_capabilities": rel_caps or [],
        "track_slug": r[10 + col_offset] if len(r) > (10 + col_offset) else None,
        "track_order": r[11 + col_offset] if len(r) > (11 + col_offset) else None,
    }


@dpz_router.get("/learn")
def list_learn_content(
    db: DBSessionDep,
    source: Optional[str] = Query(None),
    channel: Optional[str] = Query(None),
):
    """List content for the Learn hub.

    - ?channel=team (default if omitted) — team-authored content + auto-generated release entries
    - ?channel=platform — Databricks platform updates
    - ?channel=track — all track items (use /learn/tracks for grouped view)
    - ?source=blog|howto|... — further filter by source type
    """
    import sqlalchemy as sa
    clauses = []
    params: dict = {}
    if channel:
        clauses.append("channel = :ch")
        params["ch"] = channel
    if source:
        clauses.append("source = :src")
        params["src"] = source
    where = ("WHERE " + " AND ".join(clauses)) if clauses else ""
    rows = db.execute(sa.text(f"""
        SELECT id, title, description, source, url, tags, author, published_at,
               channel, relevance_capabilities, track_slug, track_order
        FROM learn_content {where}
        ORDER BY COALESCE(track_order, 999), published_at DESC
    """), params)
    items = [_parse_learn_row(r) for r in rows]

    # For 'team' channel (or unfiltered), also inject auto-generated release entries
    if not channel or channel == 'team':
        versions = db.execute(sa.text("""
            SELECT av.id, a.name, av.version, av.release_notes, av.released_by, av.created_at
            FROM asset_versions av JOIN assets a ON av.asset_id = a.id
            WHERE av.release_notes IS NOT NULL AND av.release_notes != ''
            ORDER BY av.created_at DESC LIMIT 5
        """))
        for v in versions:
            items.append({
                "id": str(v[0]), "title": f"{v[1]} {v[2]} Released",
                "description": v[3][:200] if v[3] else '',
                "source": "release", "url": "#",
                "tags": ["release"], "author": v[4],
                "date": v[5].isoformat() if v[5] else None,
                "channel": "team", "relevance_capabilities": [],
                "track_slug": None, "track_order": None,
            })
    items.sort(key=lambda x: x.get("date") or '', reverse=True)
    return {"items": items}


@dpz_router.get("/learn/tracks")
def list_learn_tracks(db: DBSessionDep):
    """List all skill tracks with their items."""
    import sqlalchemy as sa
    tracks = db.execute(sa.text("""
        SELECT slug, title, description, icon, category FROM learn_tracks ORDER BY title
    """))
    result = []
    for t in tracks:
        track_items = db.execute(sa.text("""
            SELECT id, title, description, source, url, tags, author, published_at,
                   channel, relevance_capabilities, track_slug, track_order
            FROM learn_content WHERE track_slug = :slug ORDER BY track_order ASC
        """), {"slug": t[0]})
        result.append({
            "slug": t[0], "title": t[1], "description": t[2],
            "icon": t[3], "category": t[4],
            "items": [_parse_learn_row(r) for r in track_items],
        })
    return {"tracks": result}


@dpz_router.get("/learn/stats")
def learn_stats(db: DBSessionDep):
    """Counts by channel for the Learn hub header."""
    import sqlalchemy as sa
    rows = db.execute(sa.text("""
        SELECT channel, COUNT(*) FROM learn_content GROUP BY channel
    """))
    counts = {r[0]: r[1] for r in rows}
    return {"team": counts.get("team", 0), "platform": counts.get("platform", 0),
            "track": counts.get("track", 0), "total": sum(counts.values())}


@dpz_router.post("/learn")
def create_learn_content(body: dict, db: DBSessionDep, current_user: CurrentUserDep):
    """Add a new content item to the Learn hub."""
    import sqlalchemy as sa
    cid = str(_uuid.uuid4())
    tags = body.get("tags", [])
    title = body.get("title", "Untitled")
    desc = body.get("description", "")
    caps = body.get("relevance_capabilities") or _auto_tag_capabilities(title, desc)
    db.execute(sa.text("""
        INSERT INTO learn_content
          (id, title, description, source, url, tags, author, published_at,
           channel, relevance_capabilities, track_slug, track_order)
        VALUES (:id, :title, :desc, :source, :url, :tags::jsonb, :author,
                COALESCE(:pub::timestamptz, now()),
                :channel, :caps::jsonb, :track_slug, :track_order)
    """), {
        "id": cid, "title": title, "desc": desc,
        "source": body.get("source", "blog"),
        "url": body.get("url", "#"),
        "tags": json.dumps(tags),
        "author": body.get("author"),
        "pub": body.get("published_at"),
        "channel": body.get("channel", "team"),
        "caps": json.dumps(caps),
        "track_slug": body.get("track_slug"),
        "track_order": body.get("track_order"),
    })
    db.commit()
    return {"id": cid, "status": "created"}


@dpz_router.post("/learn/ingest-platform")
def ingest_platform_content(body: dict, db: DBSessionDep, current_user: CurrentUserDep):
    """Bulk-ingest platform content (Databricks release notes, blog posts, etc.).

    Body: { items: [{ title, description, source, url, published_at?, tags? }] }
    Each item is auto-tagged with relevant capabilities and a relevance score
    computed as the count of org-active capabilities it touches.
    """
    import sqlalchemy as sa
    raw_items = body.get("items", [])
    # Get capabilities currently in use by our assets
    active_caps = set()
    rows = db.execute(sa.text("""
        SELECT DISTINCT c.slug FROM asset_capabilities ac
        JOIN capabilities c ON ac.capability_id = c.id
    """))
    for r in rows:
        active_caps.add(r[0])

    inserted = 0
    for item in raw_items:
        title = item.get("title", "")
        desc = item.get("description", "")
        caps = _auto_tag_capabilities(title, desc)
        # Relevance = how many of our active capabilities this touches
        relevance = len([c for c in caps if c in active_caps])
        cid = str(_uuid.uuid4())
        db.execute(sa.text("""
            INSERT INTO learn_content
              (id, title, description, source, url, tags, author, published_at,
               channel, relevance_capabilities)
            VALUES (:id, :title, :desc, :source, :url, :tags::jsonb, :author,
                    COALESCE(:pub::timestamptz, now()), 'platform', :caps::jsonb)
            ON CONFLICT DO NOTHING
        """), {
            "id": cid, "title": title, "desc": desc,
            "source": item.get("source", "release"),
            "url": item.get("url", "#"),
            "tags": json.dumps(item.get("tags", []) + (["relevant"] if relevance > 0 else [])),
            "author": item.get("author"),
            "pub": item.get("published_at"),
            "caps": json.dumps(caps),
        })
        inserted += 1
    db.commit()
    return {"ingested": inserted, "active_capabilities": list(active_caps)}


# ─── Staleness / Freshness scoring ────────────────────────────────────

@dpz_router.get("/staleness")
def get_staleness_scores(db: DBSessionDep):
    """Compute staleness risk for every asset based on signals, versions, and engagement.

    Returns a dict keyed by asset_id so the frontend can merge it into any view.
    Score 0-1 where higher = more stale.  Label: active / cooling / stale.
    """
    import sqlalchemy as sa
    rows = db.execute(sa.text("""
        WITH signal_stats AS (
            SELECT
                asset_id,
                MAX(observed_at) AS last_signal_at,
                COUNT(*) FILTER (WHERE observed_at > NOW() - INTERVAL '90 days') AS signals_90d
            FROM asset_signals
            GROUP BY asset_id
        ),
        version_stats AS (
            SELECT asset_id, MAX(created_at) AS last_version_at
            FROM asset_versions
            GROUP BY asset_id
        ),
        raw AS (
            SELECT
                a.id,
                -- Signal recency: 0 = signal today, 1 = no signal in 90+ days
                LEAST(EXTRACT(EPOCH FROM (NOW() - COALESCE(ss.last_signal_at, a.created_at)))
                      / (90 * 86400), 1.0) AS sig_stale,
                -- Version recency: 0 = released today, 1 = no release in 180+ days
                LEAST(EXTRACT(EPOCH FROM (NOW() - COALESCE(vs.last_version_at, a.created_at)))
                      / (180 * 86400), 1.0) AS ver_stale,
                -- Engagement: 0/3 signals in 90d → 1.0, <5 → 0.5, >=5 → 0
                CASE WHEN COALESCE(ss.signals_90d, 0) = 0 THEN 1.0
                     WHEN COALESCE(ss.signals_90d, 0) < 5  THEN 0.5
                     ELSE 0.0 END AS eng_stale,
                -- Aging early-stage penalty
                CASE WHEN a.maturity IN ('idea', 'triaged')
                      AND EXTRACT(EPOCH FROM (NOW() - a.created_at)) > 90 * 86400
                     THEN 0.5 ELSE 0.0 END AS age_penalty,
                -- Asset updated_at recency
                LEAST(EXTRACT(EPOCH FROM (NOW() - a.updated_at)) / (60 * 86400), 1.0) AS update_stale
            FROM assets a
            LEFT JOIN signal_stats  ss ON ss.asset_id = a.id
            LEFT JOIN version_stats vs ON vs.asset_id = a.id
        )
        SELECT
            id,
            ROUND((0.25 * sig_stale + 0.20 * ver_stale + 0.20 * eng_stale
                   + 0.15 * age_penalty + 0.20 * update_stale)::numeric, 3) AS score
        FROM raw
    """))
    result = {}
    for r in rows:
        score = float(r[1])
        label = 'stale' if score > 0.7 else ('cooling' if score > 0.4 else 'active')
        result[str(r[0])] = {"score": score, "label": label}
    return {"by_asset": result}


@dpz_router.get("/marketplace/stats")
def get_marketplace_stats_v2(db: DBSessionDep):
    """Aggregate marketplace stats for hero counters (enhanced with staleness summary)."""
    import sqlalchemy as sa
    total = db.execute(sa.text("SELECT count(*) FROM assets")).scalar() or 0
    featured = db.execute(sa.text("SELECT count(*) FROM assets WHERE featured = true")).scalar() or 0
    production = db.execute(sa.text("SELECT count(*) FROM assets WHERE maturity = 'production'")).scalar() or 0
    lab_count = db.execute(sa.text(
        "SELECT count(*) FROM assets WHERE maturity IN ('idea','triaged','poc','validating')"
    )).scalar() or 0
    return {
        "total": total, "featured": featured, "production": production, "lab": lab_count,
        # Legacy compat
        "total_assets": total, "total_versions": db.execute(sa.text("SELECT count(*) FROM asset_versions")).scalar() or 0,
        "total_installs": int(db.execute(sa.text("SELECT COALESCE(sum(install_count),0) FROM assets")).scalar() or 0),
        "contributors": db.execute(sa.text("SELECT count(DISTINCT created_by) FROM assets WHERE created_by IS NOT NULL")).scalar() or 0,
    }


# ─── Auto-Discover from Repo / Workspace (Evidence-Based) ────────────────

def _make_evidence(value, source: str, confidence: str, reason: str = "") -> dict:
    """Create an evidence-annotated field: {value, source, confidence, reason}.
    confidence: 'high' | 'medium' | 'low'
    """
    return {"value": value, "source": source, "confidence": confidence, "reason": reason}


def _detect_type_from_files(file_list: list[str], readme_text: str = "") -> tuple[str, str, str]:
    """Detect asset type from file tree structure.
    Returns (type_slug, confidence, reason).
    """
    names_lower = [f.lower() for f in file_list]
    joined = " ".join(names_lower)

    # Strong structural signals (high confidence)
    has_app_yaml = any("app.yaml" in f or "app.yml" in f for f in names_lower)
    has_streamlit = any("streamlit" in f for f in names_lower)
    has_gradio = any("gradio" in f for f in names_lower)
    has_dash = any("dash" in f and "dashboard" not in f for f in names_lower)
    has_fastapi = any("fastapi" in f or "main.py" in f or "app.py" in f for f in names_lower)
    has_pipeline = any(d in joined for d in ["dags/", "pipeline", "bronze", "silver", "gold", "etl"])
    has_dlt = any("dlt" in f or "expectations" in f for f in names_lower)
    has_model = any(d in joined for d in ["mlflow", "model", "training", "train.py", "mlproject"])
    has_agent = any(d in joined for d in ["agent", "langchain", "langgraph", "tools.py", "supervisor"])
    has_dashboard = any(d in joined for d in [".lvdash.json", "dashboard"])
    has_notebook = any(f.endswith(".ipynb") for f in names_lower)

    if has_app_yaml or has_streamlit or has_gradio:
        return ("application", "high", f"Found {'app.yaml' if has_app_yaml else 'framework files'} in repo structure")
    if has_fastapi and not has_pipeline:
        return ("application", "medium", "Found app.py/main.py (could be API or app)")
    if has_agent:
        return ("model", "high", "Found agent framework files (agent.py, tools.py, langchain)")
    if has_dlt or has_pipeline:
        return ("pipeline", "high", f"Found pipeline artifacts: {', '.join(d for d in ['dags/', 'dlt', 'bronze/silver/gold'] if d in joined)[:60]}")
    if has_model:
        return ("model", "high", "Found ML artifacts (mlflow, training scripts, MLproject)")
    if has_dashboard:
        return ("dashboard", "medium", "Found dashboard file(s)")
    if has_notebook and len(file_list) < 5:
        return ("notebook", "medium", "Repo is primarily notebooks")

    # Weak signals from README (low confidence)
    readme_lower = readme_text.lower()[:2000]
    if any(w in readme_lower for w in ["pipeline", "etl", "ingestion", "medallion"]):
        return ("pipeline", "low", "README mentions pipeline/ETL concepts but no structural evidence")
    if any(w in readme_lower for w in ["model", "training", "inference"]):
        return ("model", "low", "README mentions ML concepts but no structural evidence")
    if any(w in readme_lower for w in ["app", "ui", "frontend"]):
        return ("application", "low", "README mentions app/UI concepts but no structural evidence")

    return ("accelerator", "low", "No strong type signals detected in file structure or README")


def _extract_uc_refs(code_text: str) -> list[dict]:
    """Extract Unity Catalog table references from code.
    Returns [{catalog, schema, table, context}].
    """
    import re as _re
    refs = []
    seen = set()
    # Match 3-part names: catalog.schema.table
    for m in _re.finditer(r'\b([a-z][a-z0-9_]*)\.([a-z][a-z0-9_]*)\.([a-z][a-z0-9_]*)\b', code_text.lower()):
        cat, sch, tbl = m.group(1), m.group(2), m.group(3)
        # Filter common false positives
        if cat in ("self", "os", "sys", "np", "pd", "spark", "sc", "df", "col", "this"):
            continue
        key = f"{cat}.{sch}.{tbl}"
        if key not in seen:
            seen.add(key)
            # Try to determine if read or write
            ctx_start = max(0, m.start() - 60)
            context_text = code_text[ctx_start:m.end() + 20].lower()
            direction = "read"
            if any(w in context_text for w in ["insert into", "merge into", "write", "save", "create table", "create or replace"]):
                direction = "write"
            refs.append({"catalog": cat, "schema": sch, "table": tbl, "direction": direction})
    return refs[:20]


def _propose_maturity(evidence: dict) -> tuple[str, str, list[str]]:
    """Propose maturity from gathered evidence.
    Returns (maturity, confidence, [reasons]).
    """
    score = 0
    reasons = []

    commits = evidence.get("commit_count", 0)
    committers = evidence.get("committer_count", 0)
    has_readme = evidence.get("has_readme", False)
    has_tests = evidence.get("has_tests", False)
    has_ci = evidence.get("has_ci", False)
    has_app_yaml = evidence.get("has_app_yaml", False)
    recent_activity = evidence.get("recent_activity", False)
    file_count = evidence.get("file_count", 0)

    if commits > 50:
        score += 3; reasons.append(f"{commits} commits")
    elif commits > 10:
        score += 2; reasons.append(f"{commits} commits")
    elif commits > 0:
        score += 1; reasons.append(f"{commits} commits")

    if committers > 2:
        score += 2; reasons.append(f"{committers} contributors")
    elif committers > 1:
        score += 1; reasons.append(f"{committers} contributors")

    if has_tests:
        score += 2; reasons.append("has tests")
    if has_ci:
        score += 1; reasons.append("has CI/CD")
    if has_app_yaml:
        score += 1; reasons.append("has app.yaml (deployable)")
    if has_readme:
        score += 1; reasons.append("has README")
    if recent_activity:
        score += 1; reasons.append("active in last 90 days")
    if file_count > 10:
        score += 1; reasons.append(f"{file_count} files")

    if score >= 8:
        return ("production", "medium", reasons)
    if score >= 5:
        return ("validating", "medium", reasons)
    if score >= 2:
        return ("poc", "medium", reasons)
    return ("idea", "low", reasons or ["minimal evidence found"])


@dpz_router.post("/discover")
def discover_asset(body: dict, db: DBSessionDep, current_user: CurrentUserDep):
    """Evidence-based asset discovery from a GitHub repo URL or workspace path.

    Returns structured evidence for every field: {value, source, confidence, reason}.
    Includes: overlap check, maturity proposal, UC table refs, capability tagging.
    Confidence gates behavior: high=accept, medium=review, low=blank+question.
    """
    import sqlalchemy as sa
    import re as _re
    import requests as _req

    repo_url = body.get("repo_url", "").strip()
    workspace_path = body.get("workspace_path", "").strip()

    # ── Result envelope ──
    result: dict = {
        "source": "unknown",
        "evidence": {},  # field_name -> {value, source, confidence, reason}
        "capabilities": [],  # [{slug, source, confidence, reason}]
        "uc_refs": [],  # [{catalog, schema, table, direction}]
        "overlaps": [],  # [{asset_id, name, type_name, maturity, score}]
        "maturity_proposal": {},  # {value, confidence, reasons}
        "interview_questions": [],  # targeted questions for human-only knowledge
        "limits": [],  # auto-drafted limitations
        "suggested_backers": [],  # table owners who might sponsor
        "raw": {"repo_url": repo_url, "workspace_path": workspace_path},
    }

    if not repo_url and not workspace_path:
        return {"error": "Provide repo_url or workspace_path", **result}

    # Gather raw evidence
    repo_data = {}  # GitHub API response
    readme_text = ""
    code_text = ""  # Combined code for analysis
    file_list = []  # Repo file tree
    maturity_evidence = {}

    if repo_url:
        match = _re.match(r'https?://github\.com/([^/]+)/([^/]+)', repo_url)
        if not match:
            return {"error": "Not a recognized GitHub URL", **result}

        owner, repo_slug = match.group(1), match.group(2).rstrip('.git')
        result["source"] = "github"
        result["raw"]["owner"] = owner
        result["raw"]["repo"] = repo_slug

        # 1) GitHub API — repo metadata
        api_ok = False
        try:
            api_resp = _req.get(
                f"https://api.github.com/repos/{owner}/{repo_slug}",
                headers={"Accept": "application/vnd.github.v3+json"},
                timeout=10,
            )
            if api_resp.status_code == 200:
                repo_data = api_resp.json()
                api_ok = True
        except Exception:
            pass

        # Name
        if api_ok and repo_data.get("description"):
            result["evidence"]["name"] = _make_evidence(
                repo_data.get("name", repo_slug).replace("-", " ").replace("_", " ").title(),
                f"GitHub API repo name (slug: {repo_slug})",
                "medium",
                "Title-cased from repo slug — likely needs a human name"
            )
        else:
            result["evidence"]["name"] = _make_evidence(
                repo_slug.replace("-", " ").replace("_", " ").title(),
                "URL slug",
                "low",
                "Derived from URL slug only — please provide a proper name"
            )

        # Description
        api_desc = repo_data.get("description", "") if api_ok else ""
        if api_desc and len(api_desc) > 20:
            result["evidence"]["description"] = _make_evidence(
                api_desc, "GitHub API repo description", "medium",
                "Repo description — may be outdated or too brief"
            )

        # 2) Fetch file tree for structural analysis
        branch = repo_data.get("default_branch", "main") if api_ok else "main"
        try:
            tree_resp = _req.get(
                f"https://api.github.com/repos/{owner}/{repo_slug}/git/trees/{branch}?recursive=1",
                headers={"Accept": "application/vnd.github.v3+json"},
                timeout=10,
            )
            if tree_resp.status_code == 200:
                tree_data = tree_resp.json()
                file_list = [item["path"] for item in tree_data.get("tree", []) if item.get("type") == "blob"]
        except Exception:
            pass

        # 3) Fetch README
        for readme_path in (f"https://raw.githubusercontent.com/{owner}/{repo_slug}/{branch}/README.md",
                            f"https://raw.githubusercontent.com/{owner}/{repo_slug}/master/README.md"):
            try:
                r = _req.get(readme_path, timeout=10)
                if r.status_code == 200:
                    readme_text = r.text
                    break
            except Exception:
                continue

        # Fill description from README if API desc was empty/short
        if readme_text and not api_desc:
            # Strip markdown images/links/HTML, take first real paragraph
            clean_lines = []
            for line in readme_text.split('\n'):
                stripped = line.strip()
                if not stripped:
                    if clean_lines:
                        break  # End of first paragraph
                    continue
                if stripped.startswith('#') or stripped.startswith('!') or stripped.startswith('<'):
                    continue
                if stripped.startswith('[') and '](' in stripped:
                    continue  # Skip badge lines
                clean_lines.append(stripped)
            if clean_lines:
                desc_text = " ".join(clean_lines)[:500]
                result["evidence"]["description"] = _make_evidence(
                    desc_text, f"README.md first paragraph", "medium",
                    "Extracted from README — may contain formatting artifacts"
                )

        # 4) Fetch a few key code files for UC ref extraction
        code_files_to_check = [f for f in file_list
                               if f.endswith(('.py', '.sql', '.scala'))
                               and 'test' not in f.lower()
                               and 'vendor' not in f.lower()][:8]
        for cf in code_files_to_check:
            try:
                cr = _req.get(
                    f"https://raw.githubusercontent.com/{owner}/{repo_slug}/{branch}/{cf}",
                    timeout=8,
                )
                if cr.status_code == 200:
                    code_text += f"\n# === {cf} ===\n" + cr.text[:3000]
            except Exception:
                continue

        # 5) Type detection from file structure (NOT keyword grep)
        type_slug, type_conf, type_reason = _detect_type_from_files(file_list, readme_text)
        result["evidence"]["type"] = _make_evidence(type_slug, "file structure analysis", type_conf, type_reason)

        # 6) Extract UC table references from code
        if code_text:
            result["uc_refs"] = _extract_uc_refs(code_text)

        # 7) Maturity evidence
        maturity_evidence = {
            "commit_count": repo_data.get("size", 0) // 10 if api_ok else 0,  # rough proxy
            "committer_count": 1,  # would need commits API for real count
            "has_readme": bool(readme_text),
            "has_tests": any("test" in f.lower() for f in file_list),
            "has_ci": any(f.startswith(".github/workflows") or "ci" in f.lower() for f in file_list),
            "has_app_yaml": any("app.yaml" in f or "app.yml" in f for f in file_list),
            "recent_activity": bool(repo_data.get("updated_at", "")),
            "file_count": len(file_list),
        }
        # Try contributors count
        if api_ok:
            try:
                contrib_resp = _req.get(
                    f"https://api.github.com/repos/{owner}/{repo_slug}/contributors?per_page=5",
                    headers={"Accept": "application/vnd.github.v3+json"},
                    timeout=5,
                )
                if contrib_resp.status_code == 200:
                    maturity_evidence["committer_count"] = len(contrib_resp.json())
            except Exception:
                pass

        # 8) Capabilities — from code analysis, not just README keywords
        all_text = f"{code_text}\n{readme_text[:2000]}"
        raw_caps = _auto_tag_capabilities(
            result["evidence"].get("name", {}).get("value", ""),
            all_text
        )
        # Annotate each with source
        for slug in raw_caps:
            # Determine if from code or readme
            cap_kws = _CAPABILITY_KEYWORDS.get(slug, [])
            in_code = any(kw in code_text.lower() for kw in cap_kws) if code_text else False
            in_readme = any(kw in readme_text.lower()[:2000] for kw in cap_kws)
            if in_code:
                result["capabilities"].append({
                    "slug": slug, "source": "code analysis",
                    "confidence": "high", "reason": f"Found in source code imports/usage"
                })
            elif in_readme:
                result["capabilities"].append({
                    "slug": slug, "source": "README keywords",
                    "confidence": "low", "reason": f"Mentioned in README but not confirmed in code"
                })

        # Store raw data
        result["raw"]["repo_url"] = repo_url
        result["raw"]["file_count"] = len(file_list)
        result["raw"]["readme_excerpt"] = readme_text[:1500]
        result["raw"]["language"] = repo_data.get("language") if api_ok else None
        result["raw"]["topics"] = repo_data.get("topics", []) if api_ok else []
        result["raw"]["stars"] = repo_data.get("stargazers_count", 0) if api_ok else 0

    elif workspace_path:
        result["source"] = "workspace"
        try:
            from databricks.sdk import WorkspaceClient
            w = WorkspaceClient()
            obj = w.workspace.get_status(workspace_path)
            raw_name = (obj.path or workspace_path).split('/')[-1]
            for ext in ('.py', '.sql', '.ipynb', '.scala', '.r'):
                if raw_name.lower().endswith(ext):
                    raw_name = raw_name[:-len(ext)]

            result["evidence"]["name"] = _make_evidence(
                raw_name.replace("-", " ").replace("_", " ").title(),
                "workspace filename", "low",
                "Derived from file/folder name — please provide a proper name"
            )

            otype = str(obj.object_type).lower() if obj.object_type else ""
            if "notebook" in otype:
                result["evidence"]["type"] = _make_evidence("notebook", "workspace object type", "high", "Workspace object is a notebook")
            elif "directory" in otype:
                result["evidence"]["type"] = _make_evidence("accelerator", "workspace directory", "low", "Directory — could be any asset type")
            else:
                result["evidence"]["type"] = _make_evidence("accelerator", "workspace object", "low", "Could not determine type from object metadata")

            # Try to read content for description + UC refs
            try:
                content = w.workspace.export(workspace_path).content
                if content:
                    import base64
                    decoded = base64.b64decode(content).decode('utf-8', errors='ignore')[:4000]
                    code_text = decoded
                    # Extract description from comments/docstrings
                    desc_lines = []
                    for line in decoded.split('\n'):
                        stripped = line.strip()
                        if stripped.startswith('#') and not stripped.startswith('#!'):
                            desc_lines.append(stripped.lstrip('#').strip())
                        elif stripped.startswith('"""') or stripped.startswith("'''"):
                            desc_lines.append(stripped.strip("\"'").strip())
                        if len(desc_lines) >= 3:
                            break
                    if desc_lines:
                        result["evidence"]["description"] = _make_evidence(
                            " ".join(desc_lines)[:500],
                            "code comments/docstrings", "medium",
                            "Extracted from file header comments"
                        )
                    result["uc_refs"] = _extract_uc_refs(decoded)
                    raw_caps = _auto_tag_capabilities(raw_name, decoded[:2000])
                    for slug in raw_caps:
                        result["capabilities"].append({
                            "slug": slug, "source": "code analysis",
                            "confidence": "medium", "reason": "Found in notebook/file content"
                        })
            except Exception:
                pass

            maturity_evidence = {"has_readme": False, "file_count": 1, "commit_count": 0,
                                 "committer_count": 1, "has_tests": False, "has_ci": False,
                                 "has_app_yaml": False, "recent_activity": True}
        except Exception as e:
            return {"error": f"Could not inspect path: {str(e)[:200]}", **result}

    # ── Cross-cutting: maturity proposal ──
    mat_value, mat_conf, mat_reasons = _propose_maturity(maturity_evidence)
    result["maturity_proposal"] = {
        "value": mat_value, "confidence": mat_conf, "reasons": mat_reasons
    }

    # ── Cross-cutting: overlap check ──
    name_val = result["evidence"].get("name", {}).get("value", "")
    desc_val = result["evidence"].get("description", {}).get("value", "")
    search_text = f"{name_val} {desc_val}".strip()
    if search_text and len(search_text) > 8:
        try:
            from databricks.sdk import WorkspaceClient
            w = WorkspaceClient()
            # Use the vector search similar endpoint (internal)
            # For now, do a simple SQL search against assets
            rows = db.execute(sa.text("""
                SELECT a.id, a.name, t.name AS type_name, a.maturity,
                       similarity(a.name, :q) AS score
                FROM assets a LEFT JOIN asset_types t ON a.asset_type_id = t.id
                WHERE a.name % :q OR a.description % :q
                ORDER BY score DESC LIMIT 5
            """), {"q": name_val}).fetchall()
            result["overlaps"] = [
                {"asset_id": str(r[0]), "name": r[1], "type_name": r[2] or "",
                 "maturity": r[3] or "", "score": round(float(r[4] or 0), 2)}
                for r in rows if float(r[4] or 0) > 0.2
            ]
        except Exception:
            # pg_trgm not available or other error — fall back to ILIKE
            try:
                rows = db.execute(sa.text("""
                    SELECT a.id, a.name, t.name AS type_name, a.maturity
                    FROM assets a LEFT JOIN asset_types t ON a.asset_type_id = t.id
                    WHERE LOWER(a.name) LIKE :q OR LOWER(a.description) LIKE :q
                    LIMIT 5
                """), {"q": f"%{name_val.lower()[:30]}%"}).fetchall()
                result["overlaps"] = [
                    {"asset_id": str(r[0]), "name": r[1], "type_name": r[2] or "",
                     "maturity": r[3] or "", "score": 0.5}
                    for r in rows
                ]
            except Exception:
                pass

    # ── Cross-cutting: interview questions (human-only knowledge) ──
    questions = []
    uc_refs = result.get("uc_refs", [])
    if uc_refs:
        tables_read = [f"{r['catalog']}.{r['schema']}.{r['table']}" for r in uc_refs if r['direction'] == 'read'][:3]
        if tables_read:
            questions.append({
                "field": "value_hypothesis",
                "question": f"This reads {', '.join(tables_read)}. What question were you trying to answer, and what were people doing before this existed?",
                "why": "Only you know the problem this solves"
            })
    if not uc_refs:
        questions.append({
            "field": "value_hypothesis",
            "question": "In one sentence, what problem does this solve that nothing else here does?",
            "why": "Only you know the problem this solves"
        })
    questions.append({
        "field": "target_audience",
        "question": "Who would install or use this — what role, what team?",
        "why": "Audience determines discoverability and prioritization"
    })
    result["interview_questions"] = questions

    # ── Cross-cutting: auto-drafted limits ──
    limits = []
    if not maturity_evidence.get("has_tests"):
        limits.append("No automated tests detected")
    if maturity_evidence.get("committer_count", 0) <= 1:
        limits.append("Single contributor — no peer review evidence")
    if not maturity_evidence.get("has_ci"):
        limits.append("No CI/CD pipeline detected")
    if maturity_evidence.get("file_count", 0) < 3:
        limits.append("Minimal codebase")
    result["limits"] = limits

    # ── Cross-cutting: suggest backers (owners of tables this reads) ──
    if uc_refs:
        result["suggested_backers"] = [
            f"Owner of {r['catalog']}.{r['schema']}.{r['table']}"
            for r in uc_refs if r["direction"] == "read"
        ][:5]

    # Auto-derive ownership from current user
    user_email = ""
    try:
        user_email = current_user.get("email", "") or current_user.get("user_name", "")
    except Exception:
        pass
    if user_email:
        result["evidence"]["owner_email"] = _make_evidence(
            user_email, "authenticated user", "high", "Your workspace identity"
        )

    return result


# ─── Feeds Gold → Platform Pulse Sync ────────────────────────────────

@dpz_router.post("/learn/sync-feeds")
def sync_feeds_to_platform_pulse(body: dict, db: DBSessionDep, current_user: CurrentUserDep):
    """Sync Databricks content into the Learn platform channel.

    Body: {
      source?: "gold" | "bronze" (default "gold"),
      max_age_days?: int (default 90),
      limit?: int (default 200)
    }

    source="gold": reads from feeds_gold.content_search_source (enriched pipeline)
    source="bronze": reads from dpz_feeds_bronze.content_raw (our crawler)

    Deduplicates on title.
    """
    import sqlalchemy as sa
    from databricks.sdk import WorkspaceClient

    feed_source = body.get("source", "gold")
    max_age_days = body.get("max_age_days", 90)
    limit = min(body.get("limit", 200), 500)

    # Configurable table locations — override via env vars:
    #   DPZ_FEEDS_CATALOG, DPZ_FEEDS_GOLD_SCHEMA, DPZ_FEEDS_GOLD_TABLE,
    #   DPZ_FEEDS_BRONZE_SCHEMA, DPZ_FEEDS_BRONZE_TABLE
    import os
    _cat = os.environ.get("DPZ_FEEDS_CATALOG", "serverless_stable_h7wanf_catalog")
    _gold_fqn = f"{_cat}.{os.environ.get('DPZ_FEEDS_GOLD_SCHEMA', 'feeds_gold')}.{os.environ.get('DPZ_FEEDS_GOLD_TABLE', 'content_search_source')}"
    _bronze_fqn = f"{_cat}.{os.environ.get('DPZ_FEEDS_BRONZE_SCHEMA', 'feeds_bronze')}.{os.environ.get('DPZ_FEEDS_BRONZE_TABLE', 'content_raw')}"

    # Query feeds via SQL warehouse
    w = WorkspaceClient()
    warehouse_id = None
    for r in (getattr(w.config, '_resources', None) or []):
        if hasattr(r, 'sql_warehouse'):
            warehouse_id = r.sql_warehouse.id
            break
    if not warehouse_id:
        warehouse_id = os.environ.get("DATABRICKS_WAREHOUSE_ID", "4047b28d66a51bdc")

    if feed_source == "bronze":
        # Read from crawler's bronze table
        query = f"""
        SELECT
            item_id,
            COALESCE(canonical_title, rss_title) AS title,
            COALESCE(raw_text, rss_description) AS summary,
            COALESCE(canonical_url, rss_link) AS url,
            COALESCE(rss_pub_date, ingested_at) AS published_at,
            source_name, source_type AS content_type,
            NULL AS product_area, NULL AS impact_level,
            rss_categories AS topics,
            image_url, NULL AS action_summary
        FROM {_bronze_fqn}
        WHERE COALESCE(rss_pub_date, ingested_at) >= current_date() - INTERVAL {max_age_days} DAYS
          AND COALESCE(canonical_title, rss_title) IS NOT NULL
          AND COALESCE(canonical_title, rss_title) != ''
        ORDER BY COALESCE(rss_pub_date, ingested_at) DESC
        LIMIT {limit}
        """
    else:
        # Read from enriched gold pipeline (default)
        query = f"""
        SELECT
            item_id, title, COALESCE(enriched_summary, summary) AS summary,
            url, published_at, source_name, content_type,
            product_area, impact_level, topics,
            image_url, action_summary
        FROM {_gold_fqn}
        WHERE published_at >= current_date() - INTERVAL {max_age_days} DAYS
          AND title IS NOT NULL AND title != ''
        ORDER BY published_at DESC
        LIMIT {limit}
        """

    try:
        from databricks.sdk.service.sql import StatementState
        stmt = w.statement_execution.execute_statement(
            warehouse_id=warehouse_id,
            statement=query,
            wait_timeout="50s",
        )
        if stmt.status.state != StatementState.SUCCEEDED:
            return {"error": f"Query failed: {stmt.status.error}", "synced": 0}

        columns = [c.name for c in stmt.manifest.schema.columns]
        rows = []
        if stmt.result and stmt.result.data_array:
            rows = stmt.result.data_array
    except Exception as e:
        return {"error": f"Feeds query failed: {str(e)[:300]}", "synced": 0}

    # Get existing titles to deduplicate
    existing = set()
    for r in db.execute(sa.text("SELECT title FROM learn_content WHERE channel = 'platform'")):
        existing.add(r[0].lower().strip() if r[0] else "")

    # Map content_type to our source taxonomy
    source_map = {
        "release_notes": "release", "announcement": "release",
        "blog": "blog", "customer_story": "blog", "case_study": "blog",
        "reference_architecture": "blog",
        "tutorial": "howto", "training": "howto",
        "repository": "repo",
    }

    inserted = 0
    skipped = 0
    for row in rows:
        rec = dict(zip(columns, row))
        title = (rec.get("title") or "").strip()
        if not title or title.lower() in existing:
            skipped += 1
            continue

        desc = (rec.get("summary") or rec.get("action_summary") or "")[:500]
        content_type = rec.get("content_type") or ""
        source = source_map.get(content_type, "blog")
        caps = _auto_tag_capabilities(title, desc)

        # Build tags from topics
        topics = rec.get("topics")
        tags = []
        if isinstance(topics, str):
            try:
                tags = json.loads(topics)
            except Exception:
                tags = [t.strip() for t in topics.split(",") if t.strip()]
        elif isinstance(topics, list):
            tags = topics
        tags = [str(t) for t in (tags or [])][:5]
        if rec.get("product_area"):
            tags.append(rec["product_area"])

        cid = str(_uuid.uuid4())
        try:
            db.execute(sa.text("""
                INSERT INTO learn_content
                  (id, title, description, source, url, tags, author, published_at,
                   channel, relevance_capabilities)
                VALUES (:id, :title, :desc, :source, :url, :tags::jsonb, :author,
                        COALESCE(:pub::timestamptz, now()), 'platform', :caps::jsonb)
            """), {
                "id": cid, "title": title, "desc": desc,
                "source": source,
                "url": rec.get("url") or "#",
                "tags": json.dumps(tags[:6]),
                "author": rec.get("source_name"),
                "pub": rec.get("published_at"),
                "caps": json.dumps(caps),
            })
            existing.add(title.lower())
            inserted += 1
        except Exception:
            skipped += 1
            continue

    db.commit()
    return {"synced": inserted, "skipped": skipped, "total_feed_rows": len(rows)}


def register_routes(app):
    app.include_router(asset_types_router)
    app.include_router(assets_router)
    app.include_router(dpz_router)
    logger.info("Asset routes registered with prefix /api/asset-types, /api/assets, /api/dpz")
