"""app_settings: add company_name

Revision ID: 0007
Revises: 0006
Create Date: 2026-09-07
"""

from alembic import op
import sqlalchemy as sa

revision = "0007"
down_revision = "0006"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("app_settings", sa.Column("company_name", sa.String(200), nullable=True))


def downgrade() -> None:
    op.drop_column("app_settings", "company_name")
