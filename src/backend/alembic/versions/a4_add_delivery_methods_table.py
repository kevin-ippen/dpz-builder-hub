"""Add delivery_methods table and delivery_method_id to output ports

Revision ID: a4_delivery_methods
Revises: a3_quality_items
Create Date: 2026-03-15
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID as PG_UUID


revision: str = "a4_delivery_methods"
down_revision: Union[str, None] = "a3_quality_items"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "delivery_methods",
        sa.Column("id", PG_UUID(as_uuid=True), primary_key=True),
        sa.Column("name", sa.String(), nullable=False, unique=True, index=True),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("category", sa.String(), nullable=True, index=True),
        sa.Column("is_system", sa.Boolean(), nullable=False, server_default=sa.text("false")),
        sa.Column("status", sa.String(), nullable=False, server_default="active", index=True),
        sa.Column("created_by", sa.String(), nullable=True),
        sa.Column("created_at", sa.TIMESTAMP(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.TIMESTAMP(timezone=True), server_default=sa.func.now(), nullable=False),
    )

    op.add_column(
        "data_product_output_ports",
        sa.Column("delivery_method_id", PG_UUID(as_uuid=True), nullable=True),
    )
    op.create_index(
        "ix_data_product_output_ports_delivery_method_id",
        "data_product_output_ports",
        ["delivery_method_id"],
    )

    # If column was previously created as varchar, fix the type
    op.execute("""
        DO $$
        BEGIN
            IF EXISTS (
                SELECT 1 FROM information_schema.columns
                WHERE table_name = 'data_product_output_ports'
                  AND column_name = 'delivery_method_id'
                  AND data_type = 'character varying'
            ) THEN
                ALTER TABLE data_product_output_ports
                    ALTER COLUMN delivery_method_id TYPE uuid
                    USING delivery_method_id::uuid;
            END IF;
        END $$;
    """)


def downgrade() -> None:
    op.drop_index("ix_data_product_output_ports_delivery_method_id", table_name="data_product_output_ports")
    op.drop_column("data_product_output_ports", "delivery_method_id")
    op.drop_table("delivery_methods")
