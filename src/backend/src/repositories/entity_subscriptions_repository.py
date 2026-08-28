"""Repository for the generic entity subscription table."""

from typing import List, Optional

from sqlalchemy.orm import Session
from sqlalchemy.exc import SQLAlchemyError

from src.common.repository import CRUDBase
from src.db_models.entity_subscriptions import EntitySubscriptionDb
from src.models.entity_subscriptions import EntitySubscriptionCreate
from src.common.logging import get_logger

logger = get_logger(__name__)


class EntitySubscriptionRepository(CRUDBase[EntitySubscriptionDb, EntitySubscriptionCreate, EntitySubscriptionCreate]):
    def __init__(self):
        super().__init__(EntitySubscriptionDb)
        logger.info("EntitySubscriptionRepository initialized.")

    def get_by_entity(
        self, db: Session, *, entity_type: str, entity_id: str
    ) -> List[EntitySubscriptionDb]:
        try:
            return (
                db.query(self.model)
                .filter(
                    self.model.entity_type == entity_type,
                    self.model.entity_id == entity_id,
                )
                .order_by(self.model.created_at)
                .all()
            )
        except SQLAlchemyError as e:
            logger.error(f"DB error fetching subscriptions for {entity_type}:{entity_id}: {e}", exc_info=True)
            db.rollback()
            raise

    def get_by_subscriber(
        self, db: Session, *, subscriber_email: str
    ) -> List[EntitySubscriptionDb]:
        try:
            return (
                db.query(self.model)
                .filter(self.model.subscriber_email == subscriber_email)
                .order_by(self.model.created_at)
                .all()
            )
        except SQLAlchemyError as e:
            logger.error(f"DB error fetching subscriptions for {subscriber_email}: {e}", exc_info=True)
            db.rollback()
            raise

    def find_existing(
        self, db: Session, *,
        entity_type: str, entity_id: str, subscriber_email: str,
    ) -> Optional[EntitySubscriptionDb]:
        try:
            return (
                db.query(self.model)
                .filter(
                    self.model.entity_type == entity_type,
                    self.model.entity_id == entity_id,
                    self.model.subscriber_email == subscriber_email,
                )
                .first()
            )
        except SQLAlchemyError as e:
            logger.error(f"DB error checking existing subscription: {e}", exc_info=True)
            db.rollback()
            raise


entity_subscription_repo = EntitySubscriptionRepository()
