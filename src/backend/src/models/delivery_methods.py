from enum import Enum
from typing import Optional
from uuid import UUID
from datetime import datetime

from pydantic import BaseModel, Field


class DeliveryMethodStatus(str, Enum):
    ACTIVE = "active"
    DEPRECATED = "deprecated"


class DeliveryMethodCategory(str, Enum):
    ACCESS = "access"
    ENDPOINT = "endpoint"
    EXPORT = "export"
    STREAMING = "streaming"


class DeliveryMethodBase(BaseModel):
    name: str = Field(..., min_length=1, max_length=255, description="Unique delivery method name (e.g., Table Access, Serving Endpoint)")
    description: Optional[str] = Field(None, description="Human-readable description")
    category: Optional[DeliveryMethodCategory] = Field(None, description="Delivery method category")
    is_system: bool = Field(False, description="Whether this is a built-in delivery method")
    status: DeliveryMethodStatus = Field(DeliveryMethodStatus.ACTIVE, description="Lifecycle status")


class DeliveryMethodCreate(DeliveryMethodBase):
    pass


class DeliveryMethodUpdate(BaseModel):
    name: Optional[str] = Field(None, min_length=1, max_length=255)
    description: Optional[str] = None
    category: Optional[DeliveryMethodCategory] = None
    is_system: Optional[bool] = None
    status: Optional[DeliveryMethodStatus] = None


class DeliveryMethodRead(DeliveryMethodBase):
    id: UUID
    created_by: Optional[str] = None
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}
