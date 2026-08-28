"""Generic entity subscription table.

Replaces DatasetSubscriptionDb and DataProductSubscriptionDb with a
single polymorphic table that supports subscriptions on any entity type.
"""

import uuid
from sqlalchemy import Column, String, Text, Index, TIMESTAMP, UniqueConstraint
from sqlalchemy.dialects.postgresql import UUID as PG_UUID
from sqlalchemy.sql import func

from src.common.database import Base


class EntitySubscriptionDb(Base):
    """Subscription linking a user to any application entity."""
    __tablename__ = "entity_subscriptions"

    id = Column(PG_UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    entity_type = Column(String, nullable=False)
    entity_id = Column(String, nullable=False)
    subscriber_email = Column(String, nullable=False, index=True)
    subscription_reason = Column(Text, nullable=True)

    created_at = Column(TIMESTAMP(timezone=True), server_default=func.now(), nullable=False)

    __table_args__ = (
        UniqueConstraint(
            "entity_type", "entity_id", "subscriber_email",
            name="uq_entity_subscription",
        ),
        Index("ix_entity_sub_entity", "entity_type", "entity_id"),
    )

    def __repr__(self):
        return (
            f"<EntitySubscriptionDb(id={self.id}, "
            f"entity={self.entity_type}:{self.entity_id}, "
            f"subscriber='{self.subscriber_email}')>"
        )
