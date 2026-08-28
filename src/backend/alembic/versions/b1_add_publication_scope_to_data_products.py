"""Add publication_scope columns to data_products, migrate published boolean

Revision ID: b1_pub_scope_dp
Revises: a9_cert_dp
Create Date: 2026-03-11
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "b1_pub_scope_dp"
down_revision: Union[str, None] = "a9_cert_dp"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("data_products", sa.Column("publication_scope", sa.String(), nullable=False, server_default="none", index=True))
    op.add_column("data_products", sa.Column("published_at", sa.TIMESTAMP(timezone=True), nullable=True))
    op.add_column("data_products", sa.Column("published_by", sa.String(), nullable=True))

    # Migrate: published=true -> publication_scope='organization', published_at=updated_at
    op.execute("""
        UPDATE data_products
        SET publication_scope = 'organization',
            published_at = updated_at
        WHERE published = true
    """)


def downgrade() -> None:
    op.drop_column("data_products", "published_by")
    op.drop_column("data_products", "published_at")
    op.drop_column("data_products", "publication_scope")
