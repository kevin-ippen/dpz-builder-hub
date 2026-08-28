"""Fix delivery_method_id column type from varchar to uuid

Revision ID: a5_fix_dm_type
Revises: a4_delivery_methods
Create Date: 2026-03-15
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID as PG_UUID


revision: str = "a5_fix_dm_type"
down_revision: Union[str, None] = "a4_delivery_methods"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
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
    op.execute("""
        ALTER TABLE data_product_output_ports
            ALTER COLUMN delivery_method_id TYPE varchar
            USING delivery_method_id::varchar;
    """)
