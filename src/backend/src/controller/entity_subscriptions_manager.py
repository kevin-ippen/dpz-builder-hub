"""Manager for generic entity subscriptions."""

from typing import List
from uuid import UUID

from sqlalchemy.orm import Session
from sqlalchemy.exc import IntegrityError

from src.db_models.entity_subscriptions import EntitySubscriptionDb
from src.repositories.entity_subscriptions_repository import entity_subscription_repo
from src.models.entity_subscriptions import (
    EntitySubscriptionCreate,
    EntitySubscriptionRead,
    EntitySubscriptionSummary,
)
from src.common.errors import ConflictError, NotFoundError
from src.common.logging import get_logger

logger = get_logger(__name__)


class EntitySubscriptionsManager:
    """Manages subscriptions for any entity type."""

    def __init__(self):
        logger.info("EntitySubscriptionsManager initialized")

    def subscribe(
        self, db: Session, sub_in: EntitySubscriptionCreate
    ) -> EntitySubscriptionRead:
        existing = entity_subscription_repo.find_existing(
            db,
            entity_type=sub_in.entity_type,
            entity_id=sub_in.entity_id,
            subscriber_email=sub_in.subscriber_email,
        )
        if existing:
            raise ConflictError(
                f"Already subscribed: {sub_in.subscriber_email} to "
                f"{sub_in.entity_type}:{sub_in.entity_id}"
            )

        db_obj = EntitySubscriptionDb(
            entity_type=sub_in.entity_type,
            entity_id=sub_in.entity_id,
            subscriber_email=sub_in.subscriber_email,
            subscription_reason=sub_in.subscription_reason,
        )

        try:
            db.add(db_obj)
            db.flush()
            db.refresh(db_obj)
        except IntegrityError as e:
            db.rollback()
            raise ConflictError(f"Subscription already exists: {e}")

        return EntitySubscriptionRead.model_validate(db_obj)

    def unsubscribe(self, db: Session, subscription_id: UUID) -> None:
        obj = entity_subscription_repo.get(db, subscription_id)
        if not obj:
            raise NotFoundError(f"Subscription not found: {subscription_id}")
        entity_subscription_repo.remove(db, id=subscription_id)

    def unsubscribe_by_email(
        self, db: Session, entity_type: str, entity_id: str, subscriber_email: str
    ) -> None:
        existing = entity_subscription_repo.find_existing(
            db, entity_type=entity_type, entity_id=entity_id,
            subscriber_email=subscriber_email,
        )
        if not existing:
            raise NotFoundError(
                f"Subscription not found: {subscriber_email} on "
                f"{entity_type}:{entity_id}"
            )
        entity_subscription_repo.remove(db, id=existing.id)

    def get_subscribers(
        self, db: Session, entity_type: str, entity_id: str
    ) -> EntitySubscriptionSummary:
        rows = entity_subscription_repo.get_by_entity(
            db, entity_type=entity_type, entity_id=entity_id,
        )
        subs = [EntitySubscriptionRead.model_validate(r) for r in rows]
        return EntitySubscriptionSummary(
            entity_type=entity_type,
            entity_id=entity_id,
            subscribers=subs,
            total=len(subs),
        )

    def get_user_subscriptions(
        self, db: Session, subscriber_email: str
    ) -> List[EntitySubscriptionRead]:
        rows = entity_subscription_repo.get_by_subscriber(
            db, subscriber_email=subscriber_email,
        )
        return [EntitySubscriptionRead.model_validate(r) for r in rows]

    def is_subscribed(
        self, db: Session, entity_type: str, entity_id: str, subscriber_email: str
    ) -> bool:
        existing = entity_subscription_repo.find_existing(
            db, entity_type=entity_type, entity_id=entity_id,
            subscriber_email=subscriber_email,
        )
        return existing is not None
