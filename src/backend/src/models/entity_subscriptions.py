"""Pydantic models for the generic entity subscription system."""

from typing import List, Optional
from uuid import UUID
from datetime import datetime
from pydantic import BaseModel, Field


class EntitySubscriptionCreate(BaseModel):
    entity_type: str = Field(..., description="Entity type (e.g. 'Dataset', 'DataProduct')")
    entity_id: str = Field(..., description="Entity UUID")
    subscriber_email: str = Field(..., description="Email of the subscriber")
    subscription_reason: Optional[str] = Field(None, description="Why the user subscribed")


class EntitySubscriptionRead(BaseModel):
    id: UUID
    entity_type: str
    entity_id: str
    subscriber_email: str
    subscription_reason: Optional[str] = None
    created_at: datetime

    model_config = {"from_attributes": True}


class EntitySubscriptionSummary(BaseModel):
    entity_type: str
    entity_id: str
    subscribers: List[EntitySubscriptionRead] = Field(default_factory=list)
    total: int = 0
