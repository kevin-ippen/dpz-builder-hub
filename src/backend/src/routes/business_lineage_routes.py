"""API routes for business lineage graph traversal and impact analysis."""

from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query, Request, status

from src.models.entity_relationships import LineageGraph
from src.controller.entity_relationships_manager import EntityRelationshipsManager
from src.common.authorization import PermissionChecker
from src.common.features import FeatureAccessLevel
from src.common.dependencies import DBSessionDep
from src.common.logging import get_logger

logger = get_logger(__name__)

router = APIRouter(prefix="/api/business-lineage", tags=["Business Lineage"])
FEATURE_ID = "entity_relationships"


def get_entity_relationships_manager(request: Request) -> EntityRelationshipsManager:
    mgr = getattr(request.app.state, "entity_relationships_manager", None)
    if not mgr:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Entity Relationships manager not configured.",
        )
    return mgr


@router.get(
    "/{entity_type}/{entity_id}",
    response_model=LineageGraph,
    dependencies=[Depends(PermissionChecker(FEATURE_ID, FeatureAccessLevel.READ_ONLY))],
)
def get_business_lineage(
    entity_type: str,
    entity_id: str,
    db: DBSessionDep,
    max_depth: int = Query(3, ge=1, le=10),
    direction: Optional[str] = Query(None, pattern="^(upstream|downstream)$"),
    manager: EntityRelationshipsManager = Depends(get_entity_relationships_manager),
):
    """Get lineage graph centered on an entity.

    Returns nodes and edges for rendering a lineage graph.
    Optionally filter by direction: 'upstream' or 'downstream'.
    """
    return manager.get_business_lineage(
        db=db,
        entity_type=entity_type,
        entity_id=entity_id,
        max_depth=max_depth,
        direction=direction,
    )


@router.get(
    "/{entity_type}/{entity_id}/impact",
    response_model=LineageGraph,
    dependencies=[Depends(PermissionChecker(FEATURE_ID, FeatureAccessLevel.READ_ONLY))],
)
def get_impact_analysis(
    entity_type: str,
    entity_id: str,
    db: DBSessionDep,
    max_depth: int = Query(4, ge=1, le=10),
    manager: EntityRelationshipsManager = Depends(get_entity_relationships_manager),
):
    """Get downstream impact graph from an entity (e.g. Policy or BusinessTerm).

    Traverses only downstream/outgoing relationships to find affected entities.
    """
    return manager.get_business_lineage(
        db=db,
        entity_type=entity_type,
        entity_id=entity_id,
        max_depth=max_depth,
        direction="downstream",
    )


def register_routes(app):
    app.include_router(router)
    logger.info("Business lineage routes registered with prefix /api/business-lineage")
