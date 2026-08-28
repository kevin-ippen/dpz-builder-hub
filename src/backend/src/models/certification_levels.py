"""Pydantic models for certification levels API."""
from datetime import datetime
from typing import Optional
from uuid import UUID

from pydantic import BaseModel, Field


class CertificationLevelBase(BaseModel):
    name: str = Field(..., min_length=1, max_length=255)
    description: Optional[str] = None
    icon: Optional[str] = Field(None, max_length=100)
    color: Optional[str] = Field(None, max_length=50)


class CertificationLevelCreate(CertificationLevelBase):
    level_order: int = Field(..., ge=1)


class CertificationLevelUpdate(BaseModel):
    name: Optional[str] = Field(None, min_length=1, max_length=255)
    description: Optional[str] = None
    icon: Optional[str] = Field(None, max_length=100)
    color: Optional[str] = Field(None, max_length=50)
    level_order: Optional[int] = Field(None, ge=1)


class CertificationLevelRead(CertificationLevelBase):
    id: UUID
    level_order: int
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None

    model_config = {"from_attributes": True}


class CertificationLevelReorder(BaseModel):
    """Bulk reorder: list of id -> new level_order mappings."""
    levels: list[dict] = Field(
        ...,
        description="List of {id, level_order} dicts",
        examples=[[{"id": "...", "level_order": 1}, {"id": "...", "level_order": 2}]],
    )
