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
        "business_justification, target_date, estimated_effort, requested_by_team, budget_impact "
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
    return {"id": demand_id, "status": "created"}


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


@dpz_router.get("/marketplace/stats")
def get_marketplace_stats(db: DBSessionDep):
    """Aggregate marketplace stats for hero counters."""
    import sqlalchemy as sa
    total = db.execute(sa.text("SELECT count(*) FROM assets")).scalar() or 0
    versions = db.execute(sa.text("SELECT count(*) FROM asset_versions")).scalar() or 0
    installs = db.execute(sa.text("SELECT COALESCE(sum(install_count), 0) FROM assets")).scalar() or 0
    contributors = db.execute(sa.text("SELECT count(DISTINCT created_by) FROM assets WHERE created_by IS NOT NULL")).scalar() or 0
    return {"total_assets": total, "total_versions": versions, "total_installs": int(installs), "contributors": contributors}


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


def register_routes(app):
    app.include_router(asset_types_router)
    app.include_router(assets_router)
    app.include_router(dpz_router)
    logger.info("Asset routes registered with prefix /api/asset-types, /api/assets, /api/dpz")
