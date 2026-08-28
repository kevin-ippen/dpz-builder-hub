from __future__ import annotations
from typing import Dict, List, Optional, Tuple

from sqlalchemy.orm import Session
from sqlalchemy import func

from src.common.repository import CRUDBase
from src.db_models.quality import QualityItemDb
from src.models.quality import QualityItemCreate, QualityItemUpdate


class QualityItemsRepository(CRUDBase[QualityItemDb, QualityItemCreate, QualityItemUpdate]):

    def list_for_entity(
        self,
        db: Session,
        *,
        entity_type: str,
        entity_id: str,
        limit: Optional[int] = None,
    ) -> List[QualityItemDb]:
        q = (
            db.query(QualityItemDb)
            .filter(QualityItemDb.entity_type == entity_type, QualityItemDb.entity_id == entity_id)
            .order_by(QualityItemDb.measured_at.desc())
        )
        if limit is not None:
            q = q.limit(limit)
        return q.all()

    def list_for_entities(
        self,
        db: Session,
        *,
        entity_type: str,
        entity_ids: List[str],
    ) -> List[QualityItemDb]:
        """Batch fetch quality items for multiple entities of the same type."""
        if not entity_ids:
            return []
        return (
            db.query(QualityItemDb)
            .filter(QualityItemDb.entity_type == entity_type, QualityItemDb.entity_id.in_(entity_ids))
            .order_by(QualityItemDb.measured_at.desc())
            .all()
        )

    def summarize_for_entity(
        self,
        db: Session,
        *,
        entity_type: str,
        entity_id: str,
    ) -> Tuple[float, int, Dict[str, float], Dict[str, float], Optional[object]]:
        """Compute a summary from the latest measurement per dimension.

        Returns (overall_score, items_count, by_dimension, by_source, latest_measured_at).
        """
        # Subquery: latest measured_at per dimension for this entity
        latest_sub = (
            db.query(
                QualityItemDb.dimension,
                func.max(QualityItemDb.measured_at).label("max_measured"),
            )
            .filter(QualityItemDb.entity_type == entity_type, QualityItemDb.entity_id == entity_id)
            .group_by(QualityItemDb.dimension)
            .subquery()
        )

        latest_items = (
            db.query(QualityItemDb)
            .join(
                latest_sub,
                (QualityItemDb.dimension == latest_sub.c.dimension)
                & (QualityItemDb.measured_at == latest_sub.c.max_measured)
                & (QualityItemDb.entity_type == entity_type)
                & (QualityItemDb.entity_id == entity_id),
            )
            .all()
        )

        if not latest_items:
            return 0.0, 0, {}, {}, None

        by_dimension: Dict[str, float] = {}
        by_source: Dict[str, float] = {}
        source_counts: Dict[str, int] = {}
        latest_ts = None

        for item in latest_items:
            by_dimension[item.dimension] = item.score_percent
            by_source.setdefault(item.source, 0.0)
            by_source[item.source] += item.score_percent
            source_counts[item.source] = source_counts.get(item.source, 0) + 1
            if latest_ts is None or item.measured_at > latest_ts:
                latest_ts = item.measured_at

        for src in by_source:
            by_source[src] = round(by_source[src] / source_counts[src], 2)

        overall = round(sum(by_dimension.values()) / len(by_dimension), 2) if by_dimension else 0.0
        total_count = db.query(func.count(QualityItemDb.id)).filter(
            QualityItemDb.entity_type == entity_type, QualityItemDb.entity_id == entity_id
        ).scalar() or 0

        return overall, int(total_count), by_dimension, by_source, latest_ts


quality_items_repo = QualityItemsRepository(QualityItemDb)
