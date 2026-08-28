from typing import List, Optional
from sqlalchemy.orm import Session
from sqlalchemy.exc import SQLAlchemyError

from src.common.repository import CRUDBase
from src.common.logging import get_logger
from src.db_models.connections import ConnectionDb
from src.models.connections import ConnectionCreate, ConnectionUpdate

logger = get_logger(__name__)


class ConnectionRepository(CRUDBase[ConnectionDb, ConnectionCreate, ConnectionUpdate]):

    def get_by_name(self, db: Session, name: str) -> Optional[ConnectionDb]:
        try:
            return db.query(self.model).filter(self.model.name == name).first()
        except SQLAlchemyError as e:
            logger.error(f"Error fetching connection by name '{name}': {e}", exc_info=True)
            db.rollback()
            raise

    def get_by_connector_type(self, db: Session, connector_type: str) -> List[ConnectionDb]:
        try:
            return (
                db.query(self.model)
                .filter(self.model.connector_type == connector_type)
                .order_by(self.model.name)
                .all()
            )
        except SQLAlchemyError as e:
            logger.error(f"Error fetching connections for type '{connector_type}': {e}", exc_info=True)
            db.rollback()
            raise

    def get_all(self, db: Session) -> List[ConnectionDb]:
        try:
            return db.query(self.model).order_by(self.model.connector_type, self.model.name).all()
        except SQLAlchemyError as e:
            logger.error(f"Error fetching all connections: {e}", exc_info=True)
            db.rollback()
            raise

    def get_defaults(self, db: Session) -> List[ConnectionDb]:
        try:
            return (
                db.query(self.model)
                .filter(self.model.is_default == True)  # noqa: E712
                .all()
            )
        except SQLAlchemyError as e:
            logger.error(f"Error fetching default connections: {e}", exc_info=True)
            db.rollback()
            raise

    def clear_default_for_type(self, db: Session, connector_type: str) -> None:
        """Clear is_default for all connections of a given type."""
        try:
            db.query(self.model).filter(
                self.model.connector_type == connector_type,
                self.model.is_default == True,  # noqa: E712
            ).update({"is_default": False})
            db.flush()
        except SQLAlchemyError as e:
            logger.error(f"Error clearing defaults for type '{connector_type}': {e}", exc_info=True)
            db.rollback()
            raise


connections_repo = ConnectionRepository(model=ConnectionDb)
