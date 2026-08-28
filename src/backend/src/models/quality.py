from __future__ import annotations
from typing import Optional, Dict
from uuid import UUID
from datetime import datetime

from pydantic import BaseModel, Field


QUALITY_DIMENSIONS = ("accuracy", "completeness", "conformity", "consistency", "coverage", "timeliness", "uniqueness", "other")
QUALITY_SOURCES = ("manual", "dbt", "dqx", "great_expectations", "soda", "external")

_DIM_PATTERN = r"^(" + "|".join(QUALITY_DIMENSIONS) + r")$"
_SRC_PATTERN = r"^(" + "|".join(QUALITY_SOURCES) + r")$"
_ENTITY_PATTERN = r"^(data_domain|data_product|data_contract|asset)$"


class QualityItemBase(BaseModel):
    entity_id: str
    entity_type: str = Field(..., pattern=_ENTITY_PATTERN)
    title: Optional[str] = Field(None, max_length=255)
    description: Optional[str] = Field(None, max_length=2000)
    dimension: str = Field(..., pattern=_DIM_PATTERN)
    source: str = Field("manual", pattern=_SRC_PATTERN)
    score_percent: float = Field(..., ge=0.0, le=100.0)
    checks_passed: Optional[int] = Field(None, ge=0)
    checks_total: Optional[int] = Field(None, ge=0)
    measured_at: Optional[datetime] = None


class QualityItemCreate(QualityItemBase):
    pass


class QualityItemUpdate(BaseModel):
    title: Optional[str] = Field(None, max_length=255)
    description: Optional[str] = Field(None, max_length=2000)
    dimension: Optional[str] = Field(None, pattern=_DIM_PATTERN)
    source: Optional[str] = Field(None, pattern=_SRC_PATTERN)
    score_percent: Optional[float] = Field(None, ge=0.0, le=100.0)
    checks_passed: Optional[int] = Field(None, ge=0)
    checks_total: Optional[int] = Field(None, ge=0)
    measured_at: Optional[datetime] = None


class QualityItem(QualityItemBase):
    id: UUID
    created_by: Optional[str] = None
    updated_by: Optional[str] = None
    created_at: datetime
    updated_at: datetime

    model_config = {
        "from_attributes": True
    }


class QualitySummary(BaseModel):
    overall_score_percent: float
    items_count: int
    by_dimension: Dict[str, float]
    by_source: Dict[str, float]
    measured_at: Optional[datetime] = None
