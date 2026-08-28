"""dataset_to_asset_migration

Creates entity_relationships, entity_subscriptions tables, then
migrates DatasetDb → AssetDb, DatasetInstanceDb → AssetDb (PhysicalTable/View),
DatasetSubscriptionDb → EntitySubscriptionDb, DataProductSubscriptionDb → EntitySubscriptionDb,
DatasetCustomPropertyDb → AssetDb.properties JSON, and creates EntityRelationshipDb rows.

Revision ID: a1_dataset_asset
Revises: 62fb4dc55561
Create Date: 2026-02-21
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision: str = 'a1_dataset_asset'
down_revision: Union[str, None] = '62fb4dc55561'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # --- 1. Create entity_relationships table ---
    op.create_table(
        'entity_relationships',
        sa.Column('id', postgresql.UUID(as_uuid=True), nullable=False, server_default=sa.text('gen_random_uuid()')),
        sa.Column('source_type', sa.String(), nullable=False),
        sa.Column('source_id', sa.String(), nullable=False),
        sa.Column('target_type', sa.String(), nullable=False),
        sa.Column('target_id', sa.String(), nullable=False),
        sa.Column('relationship_type', sa.String(), nullable=False),
        sa.Column('properties', postgresql.JSON(), nullable=True),
        sa.Column('created_by', sa.String(), nullable=True),
        sa.Column('created_at', sa.TIMESTAMP(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('source_type', 'source_id', 'target_type', 'target_id', 'relationship_type',
                            name='uq_entity_relationship'),
    )
    op.create_index('ix_entity_rel_source', 'entity_relationships', ['source_type', 'source_id'])
    op.create_index('ix_entity_rel_target', 'entity_relationships', ['target_type', 'target_id'])
    op.create_index('ix_entity_rel_type', 'entity_relationships', ['relationship_type'])

    # --- 2. Create entity_subscriptions table ---
    op.create_table(
        'entity_subscriptions',
        sa.Column('id', postgresql.UUID(as_uuid=True), nullable=False, server_default=sa.text('gen_random_uuid()')),
        sa.Column('entity_type', sa.String(), nullable=False),
        sa.Column('entity_id', sa.String(), nullable=False),
        sa.Column('subscriber_email', sa.String(), nullable=False),
        sa.Column('subscription_reason', sa.Text(), nullable=True),
        sa.Column('created_at', sa.TIMESTAMP(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('entity_type', 'entity_id', 'subscriber_email',
                            name='uq_entity_subscription'),
    )
    op.create_index('ix_entity_sub_entity', 'entity_subscriptions', ['entity_type', 'entity_id'])
    op.create_index('ix_entity_sub_email', 'entity_subscriptions', ['subscriber_email'])

    # --- 3. Data migration: datasets → assets ---
    conn = op.get_bind()

    # 3a. Get asset_type IDs for Dataset, PhysicalTable, PhysicalView
    dataset_type_row = conn.execute(
        sa.text("SELECT id FROM asset_types WHERE name = 'Dataset' LIMIT 1")
    ).fetchone()
    table_type_row = conn.execute(
        sa.text("SELECT id FROM asset_types WHERE name = 'PhysicalTable' LIMIT 1")
    ).fetchone()
    view_type_row = conn.execute(
        sa.text("SELECT id FROM asset_types WHERE name = 'PhysicalView' LIMIT 1")
    ).fetchone()

    if not dataset_type_row or not table_type_row or not view_type_row:
        # Asset types not yet seeded; skip data migration (will be handled on next startup)
        return

    dataset_type_id = str(dataset_type_row[0])
    table_type_id = str(table_type_row[0])
    view_type_id = str(view_type_row[0])

    # 3b. Migrate DatasetDb → AssetDb
    datasets = conn.execute(sa.text("""
        SELECT id, name, description, status, version, contract_id,
               owner_team_id, project_id, created_by, created_at, updated_at
        FROM datasets
    """)).fetchall()

    for ds in datasets:
        ds_id = ds[0]
        # Collect custom properties for this dataset
        custom_props = conn.execute(
            sa.text("SELECT property, value FROM dataset_custom_properties WHERE dataset_id = :did"),
            {"did": ds_id}
        ).fetchall()

        properties = {
            "version": ds[4],
            "status": ds[3],
            "migrated_from": "datasets",
            "original_id": ds_id,
        }
        for cp in custom_props:
            properties[cp[0]] = cp[1]

        conn.execute(sa.text("""
            INSERT INTO assets (id, name, description, asset_type_id, status, properties, created_by, created_at, updated_at)
            VALUES (gen_random_uuid(), :name, :description, :type_id, :status, :props, :created_by, :created_at, :updated_at)
            ON CONFLICT DO NOTHING
        """), {
            "name": ds[1],
            "description": ds[2],
            "type_id": dataset_type_id,
            "status": ds[3] or "active",
            "props": sa.type_coerce(properties, postgresql.JSON),
            "created_by": ds[6] or "system@migration",
            "created_at": ds[8],
            "updated_at": ds[9],
        })

    # 3c. Migrate DatasetInstanceDb → AssetDb (PhysicalTable or PhysicalView)
    instances = conn.execute(sa.text("""
        SELECT di.id, di.dataset_id, di.physical_path, di.asset_type, di.role,
               di.display_name, di.environment, di.status, di.notes,
               di.created_by, di.created_at, di.updated_at,
               d.name as dataset_name
        FROM dataset_instances di
        JOIN datasets d ON d.id = di.dataset_id
    """)).fetchall()

    for inst in instances:
        inst_asset_type = inst[3]  # 'table', 'view', etc.
        if inst_asset_type and 'view' in inst_asset_type.lower():
            type_id = view_type_id
            target_entity_type = "PhysicalView"
            rel_type = "hasView"
        else:
            type_id = table_type_id
            target_entity_type = "PhysicalTable"
            rel_type = "hasTable"

        properties = {
            "physicalPath": inst[2],
            "environment": inst[6],
            "tableRole": inst[4],
            "migrated_from": "dataset_instances",
            "original_id": inst[0],
            "original_dataset_id": inst[1],
        }
        if inst[8]:  # notes
            properties["notes"] = inst[8]

        display_name = inst[5] or inst[2].rsplit(".", 1)[-1] if inst[2] else f"Instance {inst[0][:8]}"

        conn.execute(sa.text("""
            INSERT INTO assets (id, name, description, asset_type_id, location, status, properties, created_by, created_at, updated_at)
            VALUES (gen_random_uuid(), :name, :description, :type_id, :location, :status, :props, :created_by, :created_at, :updated_at)
            ON CONFLICT DO NOTHING
        """), {
            "name": display_name,
            "description": f"Migrated from {inst[12]} instance",
            "type_id": type_id,
            "location": inst[2],
            "status": inst[7] or "active",
            "props": sa.type_coerce(properties, postgresql.JSON),
            "created_by": inst[9] or "system@migration",
            "created_at": inst[10],
            "updated_at": inst[11],
        })

    # 3d. Create entity relationships: Dataset → PhysicalTable/View (hasTable/hasView)
    # We need to match by original IDs stored in properties
    migrated_datasets = conn.execute(sa.text("""
        SELECT id, properties->>'original_id' as orig_id
        FROM assets
        WHERE asset_type_id = :type_id AND properties->>'migrated_from' = 'datasets'
    """), {"type_id": dataset_type_id}).fetchall()

    for md in migrated_datasets:
        asset_id = str(md[0])
        orig_dataset_id = md[1]

        # Find migrated instances for this dataset
        migrated_instances = conn.execute(sa.text("""
            SELECT id, asset_type_id, properties->>'original_dataset_id' as orig_ds_id
            FROM assets
            WHERE properties->>'original_dataset_id' = :orig_ds_id
              AND properties->>'migrated_from' = 'dataset_instances'
        """), {"orig_ds_id": orig_dataset_id}).fetchall()

        for mi in migrated_instances:
            child_id = str(mi[0])
            child_type_id = str(mi[1])
            if child_type_id == view_type_id:
                rel_type = "hasView"
                child_entity_type = "PhysicalView"
            else:
                rel_type = "hasTable"
                child_entity_type = "PhysicalTable"

            conn.execute(sa.text("""
                INSERT INTO entity_relationships (id, source_type, source_id, target_type, target_id, relationship_type, created_by, created_at)
                VALUES (gen_random_uuid(), 'Dataset', :src_id, :tgt_type, :tgt_id, :rel_type, 'system@migration', NOW())
                ON CONFLICT DO NOTHING
            """), {
                "src_id": asset_id,
                "tgt_type": child_entity_type,
                "tgt_id": child_id,
                "rel_type": rel_type,
            })

    # 3e. Create entity relationships: Dataset → DataContract (governedBy)
    datasets_with_contracts = conn.execute(sa.text("""
        SELECT a.id as asset_id, d.contract_id
        FROM assets a
        JOIN datasets d ON d.id = (a.properties->>'original_id')
        WHERE a.asset_type_id = :type_id
          AND a.properties->>'migrated_from' = 'datasets'
          AND d.contract_id IS NOT NULL
    """), {"type_id": dataset_type_id}).fetchall()

    for dwc in datasets_with_contracts:
        conn.execute(sa.text("""
            INSERT INTO entity_relationships (id, source_type, source_id, target_type, target_id, relationship_type, created_by, created_at)
            VALUES (gen_random_uuid(), 'Dataset', :src_id, 'DataContract', :tgt_id, 'governedBy', 'system@migration', NOW())
            ON CONFLICT DO NOTHING
        """), {
            "src_id": str(dwc[0]),
            "tgt_id": dwc[1],
        })

    # 3f. Migrate DatasetSubscriptionDb → EntitySubscriptionDb
    conn.execute(sa.text("""
        INSERT INTO entity_subscriptions (id, entity_type, entity_id, subscriber_email, subscription_reason, created_at)
        SELECT gen_random_uuid(), 'Dataset', dataset_id, subscriber_email, subscription_reason, subscribed_at
        FROM dataset_subscriptions
        ON CONFLICT DO NOTHING
    """))

    # 3g. Migrate DataProductSubscriptionDb → EntitySubscriptionDb
    conn.execute(sa.text("""
        INSERT INTO entity_subscriptions (id, entity_type, entity_id, subscriber_email, subscription_reason, created_at)
        SELECT gen_random_uuid(), 'DataProduct', product_id, subscriber_email, subscription_reason, subscribed_at
        FROM data_product_subscriptions
        ON CONFLICT DO NOTHING
    """))

    # 3h. Migrate asset_relationships → entity_relationships
    conn.execute(sa.text("""
        INSERT INTO entity_relationships (id, source_type, source_id, target_type, target_id, relationship_type, created_by, created_at)
        SELECT gen_random_uuid(), 'Asset', source_asset_id::text, 'Asset', target_asset_id::text, relationship_type, created_by, created_at
        FROM asset_relationships
        ON CONFLICT DO NOTHING
    """))


def downgrade() -> None:
    op.drop_index('ix_entity_sub_email', table_name='entity_subscriptions')
    op.drop_index('ix_entity_sub_entity', table_name='entity_subscriptions')
    op.drop_table('entity_subscriptions')
    op.drop_index('ix_entity_rel_type', table_name='entity_relationships')
    op.drop_index('ix_entity_rel_target', table_name='entity_relationships')
    op.drop_index('ix_entity_rel_source', table_name='entity_relationships')
    op.drop_table('entity_relationships')
