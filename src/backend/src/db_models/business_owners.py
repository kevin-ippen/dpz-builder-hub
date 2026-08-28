import uuid
from sqlalchemy import Column, String, Text, Boolean, TIMESTAMP, ForeignKey
from sqlalchemy.dialects.postgresql import UUID as PG_UUID
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func

from src.common.database import Base


class BusinessOwnerDb(Base):
    """Polymorphic ownership assignment linking a user (with a role) to any object."""
    __tablename__ = "business_owners"

    id = Column(PG_UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    object_type = Column(String, nullable=False, index=True)  # data_product, data_contract, dataset, data_domain, business_term, asset, tag
    object_id = Column(String, nullable=False, index=True)  # The ID of the owned object
    user_email = Column(String, nullable=False, index=True)  # Owner's email / identifier
    user_name = Column(String, nullable=True)  # Cached display name
    role_id = Column(PG_UUID(as_uuid=True), ForeignKey("business_roles.id"), nullable=False, index=True)
    is_active = Column(Boolean, nullable=False, default=True, index=True)

    # Timestamps for assignment lifecycle
    assigned_at = Column(TIMESTAMP(timezone=True), server_default=func.now(), nullable=False)
    removed_at = Column(TIMESTAMP(timezone=True), nullable=True)
    removal_reason = Column(Text, nullable=True)

    created_by = Column(String, nullable=True)
    created_at = Column(TIMESTAMP(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(TIMESTAMP(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)

    # Relationships
    role = relationship("BusinessRoleDb")

    def __repr__(self):
        return f"<BusinessOwnerDb(id={self.id}, object='{self.object_type}:{self.object_id}', user='{self.user_email}', role_id='{self.role_id}')>"
