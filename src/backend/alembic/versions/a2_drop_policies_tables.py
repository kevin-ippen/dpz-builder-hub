"""drop_policies_tables

Drop the standalone policies and policy_attachments tables.
Policies are now stored as asset-tier entities in the assets table,
and policy attachments are modeled via entity_relationships.

Revision ID: a2_drop_policies
Revises: a1_dataset_asset
Create Date: 2026-02-22
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision: str = 'a2_drop_policies'
down_revision: Union[str, None] = 'a1_dataset_asset'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.drop_table('policy_attachments')
    op.drop_table('policies')


def downgrade() -> None:
    op.create_table(
        'policies',
        sa.Column('id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('name', sa.String(), nullable=False),
        sa.Column('description', sa.Text(), nullable=True),
        sa.Column('policy_type', sa.String(), nullable=False),
        sa.Column('status', sa.String(), nullable=False, server_default='draft'),
        sa.Column('content', sa.Text(), nullable=True),
        sa.Column('enforcement_level', sa.String(), nullable=False, server_default='advisory'),
        sa.Column('version', sa.String(), nullable=True),
        sa.Column('metadata', sa.JSON(), nullable=True),
        sa.Column('is_system', sa.Boolean(), nullable=False, server_default=sa.text('false')),
        sa.Column('created_by', sa.String(), nullable=True),
        sa.Column('created_at', sa.TIMESTAMP(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column('updated_at', sa.TIMESTAMP(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index('ix_policies_name', 'policies', ['name'], unique=True)
    op.create_index('ix_policies_policy_type', 'policies', ['policy_type'])
    op.create_index('ix_policies_status', 'policies', ['status'])

    op.create_table(
        'policy_attachments',
        sa.Column('id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('policy_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('target_type', sa.String(), nullable=False),
        sa.Column('target_id', sa.String(), nullable=False),
        sa.Column('target_name', sa.String(), nullable=True),
        sa.Column('notes', sa.Text(), nullable=True),
        sa.Column('created_by', sa.String(), nullable=True),
        sa.Column('created_at', sa.TIMESTAMP(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.PrimaryKeyConstraint('id'),
        sa.ForeignKeyConstraint(['policy_id'], ['policies.id']),
        sa.UniqueConstraint('policy_id', 'target_type', 'target_id', name='uq_policy_attachment'),
    )
    op.create_index('ix_policy_attachments_policy_id', 'policy_attachments', ['policy_id'])
    op.create_index('ix_policy_attachments_target_type', 'policy_attachments', ['target_type'])
    op.create_index('ix_policy_attachments_target_id', 'policy_attachments', ['target_id'])
