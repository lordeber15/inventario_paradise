"""accent-insensitive product search (unaccent extension)

Revision ID: 0005
Revises: 0004
Create Date: 2026-09-07
"""

from alembic import op

revision = "0005"
down_revision = "0004"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Nobody types "café" into a search box — they type "cafe". Rather than
    # storing product names stripped of their accents (they're what the
    # customer reads on the catalogue and on the printed ticket), the search
    # normalises both sides at query time. unaccent ships with postgres-contrib
    # and is present in the pgvector image; it also folds ñ→n, which is what a
    # Spanish-language search wants.
    op.execute("CREATE EXTENSION IF NOT EXISTS unaccent")


def downgrade() -> None:
    op.execute("DROP EXTENSION IF EXISTS unaccent")
