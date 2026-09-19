import uuid
from datetime import datetime

from sqlalchemy import Boolean, CheckConstraint, DateTime, String
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column
from sqlalchemy.sql import func

from app.database import Base

ROLE_ADMIN = "admin"
ROLE_VENDEDOR = "vendedor"
VALID_ROLES = (ROLE_ADMIN, ROLE_VENDEDOR)


class User(Base):
    __tablename__ = "users"
    __table_args__ = (CheckConstraint("role IN ('admin', 'vendedor')", name="ck_users_role_valid"),)

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    username: Mapped[str] = mapped_column(String(50), unique=True, nullable=False, index=True)
    password_hash: Mapped[str] = mapped_column(String(255), nullable=False)
    full_name: Mapped[str] = mapped_column(String(200), nullable=False, default="")
    # Two roles today: 'admin' (sees and manages everything) and 'vendedor'
    # (sells, scans, sees products/prices — never product CRUD or other users).
    # Authorization always re-checks this column against the DB on every
    # request (see security/deps.py) rather than trusting a JWT claim, so
    # changing someone's role here takes effect immediately, not at their next
    # token refresh.
    role: Mapped[str] = mapped_column(String(20), nullable=False, default=ROLE_ADMIN)
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )
    last_login_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
