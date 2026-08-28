"""Add certification columns to data_products and migrate certified status

Revision ID: a9_cert_dp
Revises: a8_cert_levels
Create Date: 2026-03-11
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "a9_cert_dp"
down_revision: Union[str, None] = "a8_cert_levels"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("data_products", sa.Column("certification_level", sa.Integer(), nullable=True, index=True))
    op.add_column("data_products", sa.Column("inherited_certification_level", sa.Integer(), nullable=True))
    op.add_column("data_products", sa.Column("certified_at", sa.TIMESTAMP(timezone=True), nullable=True))
    op.add_column("data_products", sa.Column("certified_by", sa.String(), nullable=True))
    op.add_column("data_products", sa.Column("certification_expires_at", sa.TIMESTAMP(timezone=True), nullable=True))
    op.add_column("data_products", sa.Column("certification_notes", sa.Text(), nullable=True))

    # Migrate existing status='certified' rows to status='active' + top certification level
    op.execute("""
        UPDATE data_products
        SET status = 'active',
            certification_level = (SELECT MAX(level_order) FROM certification_levels),
            certified_at = updated_at
        WHERE status = 'certified'
    """)


def downgrade() -> None:
    op.drop_column("data_products", "certification_notes")
    op.drop_column("data_products", "certification_expires_at")
    op.drop_column("data_products", "certified_by")
    op.drop_column("data_products", "certified_at")
    op.drop_column("data_products", "inherited_certification_level")
    op.drop_column("data_products", "certification_level")
