from uuid import uuid4
from sqlalchemy import Column, String, Text, Integer, Float, Index
from sqlalchemy.sql import func
from sqlalchemy import TIMESTAMP
from sqlalchemy.dialects.postgresql import UUID as PG_UUID

from src.common.database import Base


class QualityItemDb(Base):
    """Data quality measurements scoped to an entity (data_product, data_contract, asset, etc.).

    Multiple records per entity track quality over time. Each record captures a single
    measurement for a specific ODCS quality dimension from a given source system.
    """
    __tablename__ = "quality_items"

    id = Column(PG_UUID(as_uuid=True), primary_key=True, default=uuid4)

    # Generic entity scoping
    entity_type = Column(String, nullable=False, index=True)
    entity_id = Column(String, nullable=False, index=True)

    # Descriptive fields
    title = Column(String, nullable=True)
    description = Column(Text, nullable=True)

    # Quality classification
    dimension = Column(String, nullable=False)  # accuracy|completeness|conformity|consistency|coverage|timeliness|uniqueness|other
    source = Column(String, nullable=False, default="manual")  # manual|dbt|dqx|great_expectations|soda|external

    # Score
    score_percent = Column(Float, nullable=False)  # 0.0 – 100.0
    checks_passed = Column(Integer, nullable=True)
    checks_total = Column(Integer, nullable=True)

    # When the measurement was taken (distinct from created_at)
    measured_at = Column(TIMESTAMP(timezone=True), server_default=func.now(), nullable=False)

    # Audit
    created_by = Column(String, nullable=True)
    updated_by = Column(String, nullable=True)
    created_at = Column(TIMESTAMP(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(TIMESTAMP(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)

    __table_args__ = (
        Index("ix_quality_items_entity", "entity_type", "entity_id"),
        Index("ix_quality_items_entity_measured", "entity_type", "entity_id", "measured_at"),
    )
