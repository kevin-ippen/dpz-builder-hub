"""Add certification columns to datasets and assets

Revision ID: b3_cert_ds_asset
Revises: b2_cert_pub_dc
Create Date: 2026-03-11
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "b3_cert_ds_asset"
down_revision: Union[str, None] = "b2_cert_pub_dc"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    for table_name in ("datasets", "assets"):
        op.add_column(table_name, sa.Column("certification_level", sa.Integer(), nullable=True, index=True))
        op.add_column(table_name, sa.Column("inherited_certification_level", sa.Integer(), nullable=True))
        op.add_column(table_name, sa.Column("certified_at", sa.TIMESTAMP(timezone=True), nullable=True))
        op.add_column(table_name, sa.Column("certified_by", sa.String(), nullable=True))
        op.add_column(table_name, sa.Column("certification_expires_at", sa.TIMESTAMP(timezone=True), nullable=True))
        op.add_column(table_name, sa.Column("certification_notes", sa.Text(), nullable=True))


def downgrade() -> None:
    for table_name in ("datasets", "assets"):
        for col in ("certification_notes", "certification_expires_at", "certified_by",
                     "certified_at", "inherited_certification_level", "certification_level"):
            op.drop_column(table_name, col)
