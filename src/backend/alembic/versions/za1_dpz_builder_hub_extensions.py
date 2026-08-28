"""DPZ Builder Hub Extensions.

Extends Ontos schema for Domino's Internal Enablement & Asset Hub:
1. New asset types (skill, agent, mcp_server, cookbook, template, etc.)
2. Early-stage / initiative fields on assets (value_hypothesis, demo_url, originator)
3. Independent lifecycle dimensions (maturity, delivery, operational_health)
4. Demand table + asset-demand links
5. Domain events outbox table

Revision ID: za1_dpz_hub
Revises: z8_fix_rdf_triple_nulls
Create Date: 2026-08-27
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID as PG_UUID, JSONB
import uuid

# revision identifiers
revision = 'za1_dpz_hub'
down_revision = ('l1_entity_domain_associations', 'z8_fix_nulls')
branch_labels = None
depends_on = None


# New asset type definitions for DPZ Builder Hub
NEW_ASSET_TYPES = [
    {
        "name": "Skill",
        "description": "Reusable Databricks workspace skill or Genie Code skill",
        "category": "application",
        "icon": "brain",
        "is_system": True,
    },
    {
        "name": "Agent",
        "description": "AI agent (ResponsesAgent, LangGraph, CrewAI, etc.)",
        "category": "application",
        "icon": "bot",
        "is_system": True,
    },
    {
        "name": "MCP Server",
        "description": "Model Context Protocol server (tool provider)",
        "category": "application",
        "icon": "plug",
        "is_system": True,
    },
    {
        "name": "Cookbook",
        "description": "Reference implementation or best-practice guide",
        "category": "application",
        "icon": "book-open",
        "is_system": True,
    },
    {
        "name": "Template",
        "description": "Project template or starter kit",
        "category": "application",
        "icon": "copy",
        "is_system": True,
    },
    {
        "name": "Library",
        "description": "Shared Python/JS library or package",
        "category": "application",
        "icon": "package",
        "is_system": True,
    },
    {
        "name": "App",
        "description": "Databricks App (deployed web application)",
        "category": "application",
        "icon": "layout",
        "is_system": True,
    },
    {
        "name": "Genie Space",
        "description": "Databricks Genie Space (natural language SQL exploration)",
        "category": "analytics",
        "icon": "message-circle",
        "is_system": True,
    },
    {
        "name": "Repository",
        "description": "Git repository containing reusable code",
        "category": "infrastructure",
        "icon": "git-branch",
        "is_system": True,
    },
]


def upgrade() -> None:
    # 1. Add early-stage / initiative fields to assets table
    op.add_column('assets', sa.Column('value_hypothesis', sa.Text(), nullable=True))
    op.add_column('assets', sa.Column('demo_url', sa.String(), nullable=True))
    op.add_column('assets', sa.Column('repo_url', sa.String(), nullable=True))
    op.add_column('assets', sa.Column('originator', sa.String(), nullable=True))

    # 2. Add independent lifecycle dimension columns
    # (These supplement Ontos's existing 'status' column from EntityStatus)
    op.add_column('assets', sa.Column(
        'maturity', sa.String(), nullable=True, server_default='idea',
        comment='idea, triaged, poc, validating, production_candidate, production'
    ))
    op.add_column('assets', sa.Column(
        'delivery_status', sa.String(), nullable=True, server_default='unfunded',
        comment='unfunded, proposed, funded, in_delivery, delivered, cancelled'
    ))
    op.add_column('assets', sa.Column(
        'operational_health', sa.String(), nullable=True, server_default='unknown',
        comment='unknown, healthy, degraded, unsupported, retired'
    ))
    op.add_column('assets', sa.Column(
        'publication_scope', sa.String(), nullable=True, server_default='draft',
        comment='draft, private, team, enterprise, withdrawn'
    ))

    # 3. Create demand table (evidence of need)
    op.create_table(
        'demands',
        sa.Column('id', PG_UUID(as_uuid=True), primary_key=True, default=uuid.uuid4),
        sa.Column('title', sa.String(), nullable=False),
        sa.Column('description', sa.Text(), nullable=True),
        sa.Column('source', sa.String(), nullable=True),  # customer_feedback, usage_signal, etc.
        sa.Column('signals_count', sa.Integer(), nullable=False, server_default='1'),
        sa.Column('domain', sa.String(), nullable=True),
        sa.Column('created_by', sa.String(), nullable=True),
        sa.Column('created_at', sa.TIMESTAMP(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column('updated_at', sa.TIMESTAMP(timezone=True), server_default=sa.func.now(), nullable=False),
    )
    op.create_index('idx_demands_domain', 'demands', ['domain'])
    op.create_index('idx_demands_source', 'demands', ['source'])

    # 4. Create asset-demand link table
    op.create_table(
        'asset_demand_links',
        sa.Column('asset_id', PG_UUID(as_uuid=True), sa.ForeignKey('assets.id'), nullable=False),
        sa.Column('demand_id', PG_UUID(as_uuid=True), sa.ForeignKey('demands.id'), nullable=False),
        sa.Column('relationship', sa.String(), nullable=False, server_default='responds_to'),
        sa.Column('created_at', sa.TIMESTAMP(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.PrimaryKeyConstraint('asset_id', 'demand_id'),
    )

    # 5. Create domain events outbox table
    op.create_table(
        'domain_events',
        sa.Column('id', PG_UUID(as_uuid=True), primary_key=True, default=uuid.uuid4),
        sa.Column('aggregate_id', sa.String(), nullable=False),
        sa.Column('aggregate_type', sa.String(), nullable=False),
        sa.Column('event_type', sa.String(), nullable=False),
        sa.Column('payload', JSONB(), nullable=False),
        sa.Column('idempotency_key', sa.String(), nullable=False, unique=True),
        sa.Column('emitted_at', sa.TIMESTAMP(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column('consumed_at', sa.TIMESTAMP(timezone=True), nullable=True),
    )
    op.create_index('idx_domain_events_aggregate', 'domain_events', ['aggregate_id', 'aggregate_type'])
    op.create_index('idx_domain_events_type', 'domain_events', ['event_type'])
    op.create_index('idx_domain_events_unconsumed', 'domain_events', ['consumed_at'],
                    postgresql_where=sa.text('consumed_at IS NULL'))

    # 6. Insert new asset types
    asset_types = sa.table(
        'asset_types',
        sa.column('id', PG_UUID(as_uuid=True)),
        sa.column('name', sa.String),
        sa.column('description', sa.Text),
        sa.column('category', sa.String),
        sa.column('icon', sa.String),
        sa.column('is_system', sa.Boolean),
        sa.column('status', sa.String),
    )
    for at in NEW_ASSET_TYPES:
        op.execute(
            asset_types.insert().values(
                id=uuid.uuid4(),
                name=at['name'],
                description=at['description'],
                category=at['category'],
                icon=at['icon'],
                is_system=True,
                status='active',
            )
        )


def downgrade() -> None:
    # Remove new asset types
    for at in NEW_ASSET_TYPES:
        op.execute(
            sa.text(f"DELETE FROM asset_types WHERE name = :name AND is_system = true"),
            {"name": at["name"]},
        )

    # Drop new tables
    op.drop_table('domain_events')
    op.drop_table('asset_demand_links')
    op.drop_table('demands')

    # Remove lifecycle dimension columns
    op.drop_column('assets', 'publication_scope')
    op.drop_column('assets', 'operational_health')
    op.drop_column('assets', 'delivery_status')
    op.drop_column('assets', 'maturity')

    # Remove early-stage fields
    op.drop_column('assets', 'originator')
    op.drop_column('assets', 'repo_url')
    op.drop_column('assets', 'demo_url')
    op.drop_column('assets', 'value_hypothesis')
