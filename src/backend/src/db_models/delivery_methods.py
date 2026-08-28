import uuid
from sqlalchemy import Column, String, Text, Boolean, TIMESTAMP
from sqlalchemy.dialects.postgresql import UUID as PG_UUID
from sqlalchemy.sql import func

from src.common.database import Base


class DeliveryMethodDb(Base):
    """Delivery Method: defines how an output port delivers data to consumers."""
    __tablename__ = "delivery_methods"

    id = Column(PG_UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name = Column(String, nullable=False, unique=True, index=True)
    description = Column(Text, nullable=True)
    category = Column(String, nullable=True, index=True)  # access, endpoint, export, streaming
    is_system = Column(Boolean, nullable=False, default=False)
    status = Column(String, nullable=False, default="active", index=True)  # active, deprecated

    created_by = Column(String, nullable=True)
    created_at = Column(TIMESTAMP(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(TIMESTAMP(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)

    def __repr__(self):
        return f"<DeliveryMethodDb(id={self.id}, name='{self.name}')>"
