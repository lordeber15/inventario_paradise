import uuid
from datetime import datetime
from typing import TYPE_CHECKING

from sqlalchemy import (
    Boolean,
    CheckConstraint,
    DateTime,
    ForeignKey,
    Index,
    Integer,
    Numeric,
    String,
    Text,
    text,
)
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.sql import func

from app.database import Base

if TYPE_CHECKING:
    from app.models.product_image import ProductImage


class Product(Base):
    __tablename__ = "products"
    __table_args__ = (
        CheckConstraint("price >= 0", name="ck_products_price_non_negative"),
        CheckConstraint("stock >= 0", name="ck_products_stock_non_negative"),
        Index(
            "ux_products_barcode_active",
            "barcode",
            unique=True,
            postgresql_where=text("barcode IS NOT NULL AND is_active = true"),
        ),
        Index("ix_products_is_active", "is_active"),
    )

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name: Mapped[str] = mapped_column(String(200), nullable=False)
    description: Mapped[str] = mapped_column(Text, nullable=False, default="")
    price: Mapped[float] = mapped_column(Numeric(12, 2), nullable=False)
    stock: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    barcode: Mapped[str | None] = mapped_column(String(64), nullable=True)
    # Free text, not a foreign key to a categories table: a single boutique
    # doesn't need a managed taxonomy, and the public catalog derives its
    # filter chips from whatever distinct values already exist on its
    # products rather than from a separate endpoint.
    category: Mapped[str | None] = mapped_column(String(100), nullable=True)
    # Denormalized pointer to the cover photo (the ProductImage row with
    # is_primary=true) — kept so the public catalog, admin list and
    # RecognitionMatch don't need a JOIN just to render a thumbnail. The
    # invariant "cover == the is_primary row" is maintained by a single
    # helper (_sync_cover in products_admin.py), never set ad hoc elsewhere.
    image_object_key: Mapped[str] = mapped_column(String(500), nullable=False)
    thumbnail_object_key: Mapped[str | None] = mapped_column(String(500), nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    deleted_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )
    created_by: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id"), nullable=True
    )

    images: Mapped[list["ProductImage"]] = relationship(
        "ProductImage", cascade="all, delete-orphan", back_populates="product"
    )
