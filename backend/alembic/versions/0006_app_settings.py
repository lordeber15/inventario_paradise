"""app_settings: single-row runtime configuration (company logo)

Revision ID: 0006
Revises: 0005
Create Date: 2026-09-07
"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = "0006"
down_revision = "0005"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "app_settings",
        sa.Column("id", sa.Integer, primary_key=True),
        sa.Column("logo_object_key", sa.String(500), nullable=True),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_by", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id"), nullable=True),
        sa.CheckConstraint("id = 1", name="ck_app_settings_singleton"),
    )
    op.execute("INSERT INTO app_settings (id, logo_object_key) VALUES (1, NULL)")


def downgrade() -> None:
    op.drop_table("app_settings")
