"""API routes for generic entity subscriptions."""

from typing import List
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Request, status

from src.models.entity_subscriptions import (
    EntitySubscriptionCreate,
    EntitySubscriptionRead,
    EntitySubscriptionSummary,
)
from src.controller.entity_subscriptions_manager import EntitySubscriptionsManager
from src.common.authorization import PermissionChecker
from src.common.features import FeatureAccessLevel
from src.common.dependencies import (
    DBSessionDep,
    AuditManagerDep,
    AuditCurrentUserDep,
)
from src.common.errors import ConflictError, NotFoundError
from src.common.logging import get_logger

logger = get_logger(__name__)

router = APIRouter(prefix="/api/subscriptions", tags=["Entity Subscriptions"])
FEATURE_ID = "entity_subscriptions"


def get_entity_subscriptions_manager(request: Request) -> EntitySubscriptionsManager:
    mgr = getattr(request.app.state, "entity_subscriptions_manager", None)
    if not mgr:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Entity Subscriptions manager not configured.",
        )
    return mgr


@router.post(
    "",
    response_model=EntitySubscriptionRead,
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(PermissionChecker(FEATURE_ID, FeatureAccessLevel.READ_WRITE))],
)
def subscribe(
    request: Request,
    sub_in: EntitySubscriptionCreate,
    db: DBSessionDep,
    audit_manager: AuditManagerDep,
    current_user: AuditCurrentUserDep,
    manager: EntitySubscriptionsManager = Depends(get_entity_subscriptions_manager),
):
    """Subscribe to an entity."""
    success = False
    details = {
        "params": {
            "entity": f"{sub_in.entity_type}:{sub_in.entity_id}",
            "subscriber": sub_in.subscriber_email,
        }
    }
    try:
        result = manager.subscribe(db=db, sub_in=sub_in)
        success = True
        details["created_resource_id"] = str(result.id)
        return result
    except ConflictError as e:
        details["exception"] = {"type": "ConflictError", "message": str(e)}
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(e))
    except Exception as e:
        logger.exception("Failed to create subscription")
        details["exception"] = {"type": type(e).__name__, "message": str(e)}
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Failed to subscribe")
    finally:
        audit_manager.log_action(
            db=db, username=current_user.username,
            ip_address=request.client.host if request.client else None,
            feature=FEATURE_ID, action="SUBSCRIBE", success=success, details=details,
        )


@router.delete(
    "/{subscription_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    dependencies=[Depends(PermissionChecker(FEATURE_ID, FeatureAccessLevel.READ_WRITE))],
)
def unsubscribe(
    request: Request,
    subscription_id: UUID,
    db: DBSessionDep,
    audit_manager: AuditManagerDep,
    current_user: AuditCurrentUserDep,
    manager: EntitySubscriptionsManager = Depends(get_entity_subscriptions_manager),
):
    """Unsubscribe by subscription ID."""
    success = False
    details = {"params": {"subscription_id": str(subscription_id)}}
    try:
        manager.unsubscribe(db=db, subscription_id=subscription_id)
        success = True
        details["deleted_resource_id"] = str(subscription_id)
    except NotFoundError as e:
        details["exception"] = {"type": "NotFoundError", "message": str(e)}
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
    except Exception as e:
        logger.exception("Failed to unsubscribe %s", subscription_id)
        details["exception"] = {"type": type(e).__name__, "message": str(e)}
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Failed to unsubscribe")
    finally:
        audit_manager.log_action(
            db=db, username=current_user.username,
            ip_address=request.client.host if request.client else None,
            feature=FEATURE_ID, action="UNSUBSCRIBE", success=success, details=details,
        )


@router.get(
    "/entity/{entity_type}/{entity_id}",
    response_model=EntitySubscriptionSummary,
)
def get_entity_subscribers(
    request: Request,
    entity_type: str,
    entity_id: str,
    db: DBSessionDep,
    audit_manager: AuditManagerDep,
    current_user: AuditCurrentUserDep,
    manager: EntitySubscriptionsManager = Depends(get_entity_subscriptions_manager),
):
    """Get all subscribers for a specific entity."""
    success = False
    details = {"params": {"entity_type": entity_type, "entity_id": entity_id}}
    try:
        result = manager.get_subscribers(db=db, entity_type=entity_type, entity_id=entity_id)
        success = True
        details["total"] = result.total
        return result
    except Exception as e:
        logger.exception("Failed to get subscribers for %s:%s", entity_type, entity_id)
        details["exception"] = {"type": type(e).__name__, "message": str(e)}
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Failed to get subscribers")
    finally:
        audit_manager.log_action(
            db=db, username=current_user.username,
            ip_address=request.client.host if request.client else None,
            feature=FEATURE_ID, action="GET_ENTITY_SUBSCRIBERS", success=success, details=details,
        )


@router.get(
    "/user/{subscriber_email}",
    response_model=List[EntitySubscriptionRead],
)
def get_user_subscriptions(
    request: Request,
    subscriber_email: str,
    db: DBSessionDep,
    audit_manager: AuditManagerDep,
    current_user: AuditCurrentUserDep,
    manager: EntitySubscriptionsManager = Depends(get_entity_subscriptions_manager),
):
    """Get all subscriptions for a specific user."""
    success = False
    details = {"params": {"subscriber_email": subscriber_email}}
    try:
        result = manager.get_user_subscriptions(db=db, subscriber_email=subscriber_email)
        success = True
        details["count"] = len(result)
        return result
    except Exception as e:
        logger.exception("Failed to get subscriptions for %s", subscriber_email)
        details["exception"] = {"type": type(e).__name__, "message": str(e)}
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Failed to get subscriptions")
    finally:
        audit_manager.log_action(
            db=db, username=current_user.username,
            ip_address=request.client.host if request.client else None,
            feature=FEATURE_ID, action="GET_USER_SUBSCRIPTIONS", success=success, details=details,
        )


def register_routes(app):
    app.include_router(router)
    logger.info("Entity subscription routes registered with prefix /api/subscriptions")
