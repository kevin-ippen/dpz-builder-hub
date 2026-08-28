"""Add allowed_personas to app_roles for persona-based UI

Revision ID: w5_personas
Revises: v4_wizard_completion_act
Create Date: 2026-02-12

Adds allowed_personas column (JSON array of persona IDs) to app_roles so that
each role can define which persona views users with that role can access.
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = 'w5_personas'
down_revision: Union[str, None] = 'v4_wizard_completion_act'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        'app_roles',
        sa.Column('allowed_personas', sa.Text(), nullable=False, server_default='[]',
                  comment='Persona IDs users with this role can select in the UI'),
    )


def downgrade() -> None:
    op.drop_column('app_roles', 'allowed_personas')
