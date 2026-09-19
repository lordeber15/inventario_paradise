"""rename admin_users to users, add role and full_name

Revision ID: 0003
Revises: 0002
Create Date: 2026-09-06
"""

from alembic import op
import sqlalchemy as sa

revision = "0003"
down_revision = "0002"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Renaming a table doesn't rename its indexes/constraints in Postgres —
    # foreign keys (products.created_by) keep working since they reference the
    # table by OID internally, but the index name is worth renaming too so it
    # doesn't keep pointing at a table that no longer exists by that name.
    op.rename_table("admin_users", "users")
    op.execute("ALTER INDEX ix_admin_users_username RENAME TO ix_users_username")

    op.add_column("users", sa.Column("full_name", sa.String(200), nullable=False, server_default=""))
    op.add_column("users", sa.Column("role", sa.String(20), nullable=False, server_default="admin"))
    op.create_check_constraint("ck_users_role_valid", "users", "role IN ('admin', 'vendedor')")

    # server_default did its job for existing rows; drop it so future inserts
    # via the ORM are required to state a role explicitly (the model still
    # carries its own Python-side default for tests that don't set one).
    op.alter_column("users", "role", server_default=None)
    op.alter_column("users", "full_name", server_default=None)


def downgrade() -> None:
    op.drop_constraint("ck_users_role_valid", "users", type_="check")
    op.drop_column("users", "role")
    op.drop_column("users", "full_name")
    op.execute("ALTER INDEX ix_users_username RENAME TO ix_admin_users_username")
    op.rename_table("users", "admin_users")
