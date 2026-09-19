import uuid
from datetime import datetime

from sqlalchemy import CheckConstraint, DateTime, ForeignKey, Integer, String
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column
from sqlalchemy.sql import func

from app.database import Base

APP_SETTINGS_ID = 1


class AppSettings(Base):
    """A single mutable row of app-wide configuration editable by an admin at
    runtime — everything else configurable lives in app/config.py (env vars,
    fixed at server start). The CHECK forces exactly one row to ever exist,
    same idea as this project's other "at most one" invariants
    (ux_cash_sessions_open_per_user, ux_product_images_primary) but for
    "exactly one" instead of "at most one per group", so it's a constraint on
    the PK itself rather than a partial unique index."""

    __tablename__ = "app_settings"
    __table_args__ = (CheckConstraint(f"id = {APP_SETTINGS_ID}", name="ck_app_settings_singleton"),)

    id: Mapped[int] = mapped_column(Integer, primary_key=True, default=APP_SETTINGS_ID)
    logo_object_key: Mapped[str | None] = mapped_column(String(500), nullable=True)
    company_name: Mapped[str | None] = mapped_column(String(200), nullable=True)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )
    updated_by: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id"), nullable=True
    )
