"""Add certification and publication scope columns to data_contracts

Revision ID: b2_cert_pub_dc
Revises: b1_pub_scope_dp
Create Date: 2026-03-11
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "b2_cert_pub_dc"
down_revision: Union[str, None] = "b1_pub_scope_dp"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Publication scope
    op.add_column("data_contracts", sa.Column("publication_scope", sa.String(), nullable=False, server_default="none", index=True))
    op.add_column("data_contracts", sa.Column("published_at", sa.TIMESTAMP(timezone=True), nullable=True))
    op.add_column("data_contracts", sa.Column("published_by", sa.String(), nullable=True))

    # Certification
    op.add_column("data_contracts", sa.Column("certification_level", sa.Integer(), nullable=True, index=True))
    op.add_column("data_contracts", sa.Column("inherited_certification_level", sa.Integer(), nullable=True))
    op.add_column("data_contracts", sa.Column("certified_at", sa.TIMESTAMP(timezone=True), nullable=True))
    op.add_column("data_contracts", sa.Column("certified_by", sa.String(), nullable=True))
    op.add_column("data_contracts", sa.Column("certification_expires_at", sa.TIMESTAMP(timezone=True), nullable=True))
    op.add_column("data_contracts", sa.Column("certification_notes", sa.Text(), nullable=True))

    # Migrate existing data
    op.execute("""
        UPDATE data_contracts
        SET publication_scope = 'organization',
            published_at = updated_at
        WHERE published = true
    """)
    op.execute("""
        UPDATE data_contracts
        SET status = 'active',
            certification_level = (SELECT MAX(level_order) FROM certification_levels),
            certified_at = updated_at
        WHERE status = 'certified'
    """)


def downgrade() -> None:
    op.drop_column("data_contracts", "certification_notes")
    op.drop_column("data_contracts", "certification_expires_at")
    op.drop_column("data_contracts", "certified_by")
    op.drop_column("data_contracts", "certified_at")
    op.drop_column("data_contracts", "inherited_certification_level")
    op.drop_column("data_contracts", "certification_level")
    op.drop_column("data_contracts", "published_by")
    op.drop_column("data_contracts", "published_at")
    op.drop_column("data_contracts", "publication_scope")
