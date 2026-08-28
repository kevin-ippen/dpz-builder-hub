from __future__ import annotations
from typing import Dict, List, Optional, TYPE_CHECKING

from sqlalchemy.orm import Session

from src.common.logging import get_logger
from src.repositories.quality_repository import quality_items_repo, QualityItemsRepository
from src.models.quality import QualityItem, QualityItemCreate, QualityItemUpdate, QualitySummary
from src.repositories.change_log_repository import change_log_repo
from src.db_models.change_log import ChangeLogDb

if TYPE_CHECKING:
    from src.controller.data_products_manager import DataProductsManager

logger = get_logger(__name__)


class QualityManager:
    def __init__(self, repository: QualityItemsRepository = quality_items_repo):
        self._repo = repository

    # ── helpers ──────────────────────────────────────────────────────────

    def _log_change(self, db: Session, *, entity_type: str, entity_id: str, action: str, username: Optional[str]) -> None:
        entry = ChangeLogDb(
            entity_type=f"{entity_type}:quality_item",
            entity_id=entity_id,
            action=action,
            username=username,
        )
        db.add(entry)
        db.commit()

    # ── CRUD ─────────────────────────────────────────────────────────────

    def create(self, db: Session, *, data: QualityItemCreate, user_email: Optional[str]) -> QualityItem:
        obj = self._repo.create(db, obj_in=data)
        db.commit()
        db.refresh(obj)
        self._log_change(db, entity_type=data.entity_type, entity_id=data.entity_id, action="CREATE", username=user_email)
        return QualityItem.model_validate(obj, from_attributes=True)

    def list(self, db: Session, *, entity_type: str, entity_id: str, limit: Optional[int] = None) -> List[QualityItem]:
        rows = self._repo.list_for_entity(db, entity_type=entity_type, entity_id=entity_id, limit=limit)
        return [QualityItem.model_validate(r, from_attributes=True) for r in rows]

    def update(self, db: Session, *, id: str, data: QualityItemUpdate, user_email: Optional[str]) -> Optional[QualityItem]:
        db_obj = self._repo.get(db, id=id)
        if not db_obj:
            return None
        updated = self._repo.update(db, db_obj=db_obj, obj_in=data)
        db.commit()
        db.refresh(updated)
        self._log_change(db, entity_type=updated.entity_type, entity_id=updated.entity_id, action="UPDATE", username=user_email)
        return QualityItem.model_validate(updated, from_attributes=True)

    def delete(self, db: Session, *, id: str, user_email: Optional[str]) -> bool:
        db_obj = self._repo.get(db, id=id)
        if not db_obj:
            return False
        entity_type, entity_id = db_obj.entity_type, db_obj.entity_id
        removed = self._repo.remove(db, id=id)
        if removed:
            db.commit()
            self._log_change(db, entity_type=entity_type, entity_id=entity_id, action="DELETE", username=user_email)
            return True
        return False

    # ── summaries ────────────────────────────────────────────────────────

    def summarize(self, db: Session, *, entity_type: str, entity_id: str) -> QualitySummary:
        overall, count, by_dim, by_src, latest_ts = self._repo.summarize_for_entity(
            db, entity_type=entity_type, entity_id=entity_id
        )
        return QualitySummary(
            overall_score_percent=overall,
            items_count=count,
            by_dimension=by_dim,
            by_source=by_src,
            measured_at=latest_ts,
        )

    def aggregate_for_product(
        self,
        db: Session,
        *,
        product_id: str,
        data_products_manager: "DataProductsManager",
    ) -> QualitySummary:
        """Roll up quality from direct product items + child contract items."""
        contract_ids = data_products_manager.get_contracts_for_product(product_id)

        # Gather all relevant quality items
        direct_items = self._repo.list_for_entity(db, entity_type="data_product", entity_id=product_id)
        child_items = self._repo.list_for_entities(db, entity_type="data_contract", entity_ids=contract_ids) if contract_ids else []
        all_items = direct_items + child_items

        if not all_items:
            return QualitySummary(overall_score_percent=0.0, items_count=0, by_dimension={}, by_source={}, measured_at=None)

        # Deduplicate: keep latest per (entity_type, entity_id, dimension)
        latest_map: Dict[tuple, object] = {}
        for item in all_items:
            key = (item.entity_type, item.entity_id, item.dimension)
            existing = latest_map.get(key)
            if existing is None or item.measured_at > existing.measured_at:
                latest_map[key] = item

        latest = list(latest_map.values())

        by_dimension: Dict[str, float] = {}
        dim_counts: Dict[str, int] = {}
        by_source: Dict[str, float] = {}
        source_counts: Dict[str, int] = {}
        latest_ts = None

        for item in latest:
            by_dimension[item.dimension] = by_dimension.get(item.dimension, 0.0) + item.score_percent
            dim_counts[item.dimension] = dim_counts.get(item.dimension, 0) + 1
            by_source[item.source] = by_source.get(item.source, 0.0) + item.score_percent
            source_counts[item.source] = source_counts.get(item.source, 0) + 1
            if latest_ts is None or item.measured_at > latest_ts:
                latest_ts = item.measured_at

        for dim in by_dimension:
            by_dimension[dim] = round(by_dimension[dim] / dim_counts[dim], 2)
        for src in by_source:
            by_source[src] = round(by_source[src] / source_counts[src], 2)

        overall = round(sum(by_dimension.values()) / len(by_dimension), 2)

        return QualitySummary(
            overall_score_percent=overall,
            items_count=len(all_items),
            by_dimension=by_dimension,
            by_source=by_source,
            measured_at=latest_ts,
        )
