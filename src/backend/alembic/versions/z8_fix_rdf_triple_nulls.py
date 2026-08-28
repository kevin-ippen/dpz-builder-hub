"""Fix NULL handling in rdf_triples unique constraint

Revision ID: z8_fix_nulls
Revises: y7_drop_personas
Create Date: 2026-03-05

PostgreSQL treats NULL != NULL in unique constraints, so the existing
uq_rdf_triple constraint never prevented duplicate triples when
object_language and/or object_datatype were NULL (the common case for
URI objects and plain literals). This caused ~2,353 taxonomy triples
to be re-inserted on every server restart.

Fix: replace NULL with '' (empty string) for these columns, deduplicate
accumulated rows, and make the columns NOT NULL with default ''.
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = 'z8_fix_nulls'
down_revision: Union[str, None] = 'y7_drop_personas'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Coalesce NULLs, deduplicate, and make columns NOT NULL."""
    conn = op.get_bind()

    # Disable statement timeout — the dedup DELETE on 214k+ rows needs time
    conn.execute(sa.text("SET LOCAL statement_timeout = 0"))

    # Step 1: Drop the unique constraint so the UPDATE doesn't trigger
    # violations when NULL rows become '' and collide with existing '' rows.
    conn.execute(sa.text("""
        DO $$
        BEGIN
          IF EXISTS (
            SELECT 1 FROM pg_constraint c
            JOIN pg_class t ON c.conrelid = t.oid
            WHERE c.conname = 'uq_rdf_triple' AND t.relname = 'rdf_triples'
          ) THEN
            ALTER TABLE rdf_triples DROP CONSTRAINT uq_rdf_triple;
          END IF;
        END $$;
    """))

    # Step 2: Replace NULLs with empty string
    conn.execute(sa.text(
        "UPDATE rdf_triples SET object_language = '' WHERE object_language IS NULL"
    ))
    conn.execute(sa.text(
        "UPDATE rdf_triples SET object_datatype = '' WHERE object_datatype IS NULL"
    ))

    # Step 3: Deduplicate — keep only the earliest row per unique combination.
    # Uses a CTE with window function for efficiency on large tables.
    conn.execute(sa.text("""
        DELETE FROM rdf_triples
        WHERE id IN (
            SELECT id FROM (
                SELECT id, ROW_NUMBER() OVER (
                    PARTITION BY subject_uri, predicate_uri, object_value,
                                 object_language, object_datatype, context_name
                    ORDER BY created_at
                ) AS rn
                FROM rdf_triples
            ) dupes
            WHERE rn > 1
        )
    """))

    # Step 4: Alter columns to NOT NULL with default ''
    op.alter_column('rdf_triples', 'object_language',
                    existing_type=sa.String(10),
                    nullable=False,
                    server_default='')
    op.alter_column('rdf_triples', 'object_datatype',
                    existing_type=sa.Text(),
                    nullable=False,
                    server_default='')

    # Step 5: Re-add the unique constraint (now works correctly with '' instead of NULL)
    op.create_unique_constraint(
        'uq_rdf_triple',
        'rdf_triples',
        ['subject_uri', 'predicate_uri', 'object_value',
         'object_language', 'object_datatype', 'context_name']
    )


def downgrade() -> None:
    """Revert columns to nullable, convert empty strings back to NULL."""
    op.drop_constraint('uq_rdf_triple', 'rdf_triples', type_='unique')

    op.alter_column('rdf_triples', 'object_language',
                    existing_type=sa.String(10),
                    nullable=True,
                    server_default=None)
    op.alter_column('rdf_triples', 'object_datatype',
                    existing_type=sa.Text(),
                    nullable=True,
                    server_default=None)

    conn = op.get_bind()
    conn.execute(sa.text(
        "UPDATE rdf_triples SET object_language = NULL WHERE object_language = ''"
    ))
    conn.execute(sa.text(
        "UPDATE rdf_triples SET object_datatype = NULL WHERE object_datatype = ''"
    ))

    op.create_unique_constraint(
        'uq_rdf_triple',
        'rdf_triples',
        ['subject_uri', 'predicate_uri', 'object_value',
         'object_language', 'object_datatype', 'context_name']
    )
