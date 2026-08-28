"""Database model for admin-configurable certification levels."""
import uuid
from sqlalchemy import Column, String, Integer, Text, TIMESTAMP, UniqueConstraint
from sqlalchemy.dialects.postgresql import UUID as PG_UUID
from sqlalchemy.sql import func

from src.common.database import Base


class CertificationLevelDb(Base):
    """Ordered certification levels configurable by admins.

    Entities reference these by level_order (integer ordinal).
    Default seed: Bronze (1), Silver (2), Gold (3).
    """
    __tablename__ = "certification_levels"

    id = Column(PG_UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    level_order = Column(Integer, nullable=False, unique=True)
    name = Column(String(255), nullable=False)
    description = Column(Text, nullable=True)
    icon = Column(String(100), nullable=True)
    color = Column(String(50), nullable=True)
    created_at = Column(TIMESTAMP(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(TIMESTAMP(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)

    __table_args__ = (
        UniqueConstraint("name", name="uq_certification_level_name"),
    )

    def __repr__(self):
        return f"<CertificationLevelDb(order={self.level_order}, name='{self.name}')>"
