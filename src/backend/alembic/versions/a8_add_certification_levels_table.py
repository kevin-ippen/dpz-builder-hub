"""Add certification_levels table with seed data

Revision ID: a8_cert_levels
Revises: a7_is_admin
Create Date: 2026-03-11
"""
from typing import Sequence, Union
from uuid import uuid4

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID as PG_UUID


revision: str = "a8_cert_levels"
down_revision: Union[str, None] = "a7_is_admin"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "certification_levels",
        sa.Column("id", PG_UUID(as_uuid=True), primary_key=True),
        sa.Column("level_order", sa.Integer(), nullable=False, unique=True),
        sa.Column("name", sa.String(255), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("icon", sa.String(100), nullable=True),
        sa.Column("color", sa.String(50), nullable=True),
        sa.Column("created_at", sa.TIMESTAMP(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.TIMESTAMP(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.UniqueConstraint("name", name="uq_certification_level_name"),
    )

    certification_levels = sa.table(
        "certification_levels",
        sa.column("id", PG_UUID(as_uuid=True)),
        sa.column("level_order", sa.Integer()),
        sa.column("name", sa.String()),
        sa.column("description", sa.Text()),
        sa.column("icon", sa.String()),
        sa.column("color", sa.String()),
    )
    op.bulk_insert(certification_levels, [
        {"id": uuid4(), "level_order": 1, "name": "Bronze", "description": "Basic certification", "icon": "shield", "color": "amber"},
        {"id": uuid4(), "level_order": 2, "name": "Silver", "description": "Intermediate certification", "icon": "shield-check", "color": "slate"},
        {"id": uuid4(), "level_order": 3, "name": "Gold", "description": "Highest certification", "icon": "shield-check", "color": "yellow"},
    ])


def downgrade() -> None:
    op.drop_table("certification_levels")
