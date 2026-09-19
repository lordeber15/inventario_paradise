import uuid
from datetime import datetime
from decimal import Decimal

from sqlalchemy import DateTime, ForeignKey, Index, Numeric, String, Text, text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column
from sqlalchemy.sql import func

from app.database import Base


class CashSession(Base):
    """A cash register shift: opened with a starting amount, closed with a
    physical cash count. The point isn't the day's total (that's the sales
    table) — it's catching a mismatch between expected and counted cash per
    person, per shift."""

    __tablename__ = "cash_sessions"
    __table_args__ = (
        # DB-level guarantee that nobody has two open registers at once — the
        # same pattern as ux_products_barcode_active and
        # ux_product_images_primary (a partial unique index, not an
        # application-level check that a race could slip past).
        Index(
            "ux_cash_sessions_open_per_user",
            "usuario_id",
            unique=True,
            postgresql_where=text("cerrada_en IS NULL"),
        ),
    )

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    usuario_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    abierta_en: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    cerrada_en: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    monto_inicial: Mapped[Decimal] = mapped_column(Numeric(12, 2), nullable=False)
    # Both null while the session is open; filled in together at close time.
    contado_efectivo: Mapped[Decimal | None] = mapped_column(Numeric(12, 2), nullable=True)
    diferencia: Mapped[Decimal | None] = mapped_column(Numeric(12, 2), nullable=True)
    notas: Mapped[str] = mapped_column(Text, nullable=False, default="")
