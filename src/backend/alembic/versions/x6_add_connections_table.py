"""add connections table

Revision ID: x6_connections
Revises: a2_drop_policies
Create Date: 2026-02-23 22:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision: str = 'x6_connections'
down_revision: Union[str, None] = 'a2_drop_policies'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table('connections',
        sa.Column('id', sa.UUID(), nullable=False),
        sa.Column('name', sa.String(), nullable=False),
        sa.Column('connector_type', sa.String(), nullable=False),
        sa.Column('description', sa.Text(), nullable=True),
        sa.Column('config', sa.JSON(), nullable=False, server_default='{}'),
        sa.Column('enabled', sa.Boolean(), nullable=False, server_default='true'),
        sa.Column('is_default', sa.Boolean(), nullable=False, server_default='false'),
        sa.Column('created_by', sa.String(), nullable=True),
        sa.Column('created_at', sa.TIMESTAMP(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('updated_at', sa.TIMESTAMP(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('name', name='uq_connections_name'),
    )
    op.create_index('ix_connections_name', 'connections', ['name'], unique=True)
    op.create_index('ix_connections_connector_type', 'connections', ['connector_type'])


def downgrade() -> None:
    op.drop_index('ix_connections_connector_type', table_name='connections')
    op.drop_index('ix_connections_name', table_name='connections')
    op.drop_table('connections')
