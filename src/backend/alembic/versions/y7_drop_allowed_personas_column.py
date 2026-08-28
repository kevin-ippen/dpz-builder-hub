"""Drop allowed_personas column from app_roles

Revision ID: y7_drop_personas
Revises: x6_connections
Create Date: 2026-03-02

Removes the allowed_personas column that was added for the persona-based UI
(w5_personas migration). The persona system has been removed.
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = 'y7_drop_personas'
down_revision: Union[str, None] = 'x6_connections'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.drop_column('app_roles', 'allowed_personas')


def downgrade() -> None:
    op.add_column(
        'app_roles',
        sa.Column('allowed_personas', sa.Text(), nullable=False, server_default='[]',
                  comment='Persona IDs users with this role can select in the UI'),
    )
