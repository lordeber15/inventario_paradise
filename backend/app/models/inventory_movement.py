import uuid
from datetime import datetime

from sqlalchemy import CheckConstraint, DateTime, ForeignKey, Integer, String
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column
from sqlalchemy.sql import func

from app.database import Base

MOTIVO_VENTA = "venta"
MOTIVO_ANULACION = "anulacion"
MOTIVO_AJUSTE = "ajuste"
MOTIVO_ALTA = "alta"
VALID_MOVEMENT_REASONS = (MOTIVO_VENTA, MOTIVO_ANULACION, MOTIVO_AJUSTE, MOTIVO_ALTA)


class InventoryMovement(Base):
    """Append-only ledger of every stock change and why it happened — the
    answer to "why does this product have 3 units and not 5" instead of just
    the number 3. Never updated or deleted, only inserted."""

    __tablename__ = "inventory_movements"
    __table_args__ = (
        CheckConstraint(
            "motivo IN ('venta', 'anulacion', 'ajuste', 'alta')", name="ck_inventory_movements_motivo_valid"
        ),
    )

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    product_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("products.id"), nullable=False)
    # Negative for a sale, positive for a void (stock restored) or a manual
    # increase.
    delta: Mapped[int] = mapped_column(Integer, nullable=False)
    motivo: Mapped[str] = mapped_column(String(20), nullable=False)
    # Nullable: only 'venta'/'anulacion' movements are tied to a sale.
    sale_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("sales.id"), nullable=True)
    usuario_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
