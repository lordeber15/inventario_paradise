import uuid
from datetime import datetime
from decimal import Decimal

from sqlalchemy import CheckConstraint, DateTime, ForeignKey, Integer, Numeric, String, Text, UniqueConstraint
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.sql import func

from app.database import Base

ESTADO_COMPLETADA = "completada"
ESTADO_ANULADA = "anulada"
VALID_SALE_STATES = (ESTADO_COMPLETADA, ESTADO_ANULADA)

METODO_EFECTIVO = "efectivo"
METODO_YAPE_PLIN = "yape_plin"
METODO_TARJETA = "tarjeta"
METODO_TRANSFERENCIA = "transferencia"
VALID_PAYMENT_METHODS = (METODO_EFECTIVO, METODO_YAPE_PLIN, METODO_TARJETA, METODO_TRANSFERENCIA)


class Sale(Base):
    """The comprobante header. Money fields are `Numeric`/`Decimal` end to
    end (never `float`) — unlike `Product.price`, rounding errors here would
    compound across a chain of subtotal/discount/IGV arithmetic and could
    leave a receipt that doesn't add up. `subtotal`/`igv`/`total` are always
    computed server-side from the line items and never trusted from the
    client (see services/sales.py)."""

    __tablename__ = "sales"
    __table_args__ = (
        UniqueConstraint("serie", "correlativo", name="uq_sales_serie_correlativo"),
        CheckConstraint("estado IN ('completada', 'anulada')", name="ck_sales_estado_valid"),
        CheckConstraint("tipo_comprobante IN ('boleta', 'ticket')", name="ck_sales_tipo_valid"),
        CheckConstraint("subtotal >= 0 AND igv >= 0 AND total >= 0", name="ck_sales_amounts_non_negative"),
        CheckConstraint("descuento_monto >= 0", name="ck_sales_descuento_non_negative"),
    )

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    serie: Mapped[str] = mapped_column(String(10), nullable=False)
    correlativo: Mapped[int] = mapped_column(Integer, nullable=False)
    tipo_comprobante: Mapped[str] = mapped_column(String(20), nullable=False)
    estado: Mapped[str] = mapped_column(String(20), nullable=False, default=ESTADO_COMPLETADA)

    subtotal: Mapped[Decimal] = mapped_column(Numeric(12, 2), nullable=False)
    igv: Mapped[Decimal] = mapped_column(Numeric(12, 2), nullable=False)
    descuento_monto: Mapped[Decimal] = mapped_column(Numeric(12, 2), nullable=False, default=Decimal("0"))
    descuento_motivo: Mapped[str | None] = mapped_column(Text, nullable=True)
    total: Mapped[Decimal] = mapped_column(Numeric(12, 2), nullable=False)

    # Required by SUNAT once `total` exceeds settings.client_data_required_above.
    cliente_nombre: Mapped[str | None] = mapped_column(String(200), nullable=True)
    cliente_doc_tipo: Mapped[str | None] = mapped_column(String(10), nullable=True)
    cliente_doc_num: Mapped[str | None] = mapped_column(String(20), nullable=True)

    vendedor_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    cash_session_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("cash_sessions.id"), nullable=False
    )

    # A sale is never deleted — anulación just flips these fields, leaving the
    # original comprobante fully intact for audit purposes.
    anulada_por: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True)
    anulada_en: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    motivo_anulacion: Mapped[str | None] = mapped_column(Text, nullable=True)

    # One POST per checkout attempt: the frontend generates this UUID once per
    # attempt, so a double-tap or a retried request after a network blip
    # returns the already-created sale instead of charging twice.
    idempotency_key: Mapped[str | None] = mapped_column(String(100), unique=True, nullable=True)

    # Placeholder for a future real SUNAT integration — never transmitted today.
    estado_sunat: Mapped[str] = mapped_column(String(20), nullable=False, default="no_emitido")

    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    items: Mapped[list["SaleItem"]] = relationship(
        "SaleItem", cascade="all, delete-orphan", back_populates="sale", order_by="SaleItem.id"
    )
    payments: Mapped[list["SalePayment"]] = relationship(
        "SalePayment", cascade="all, delete-orphan", back_populates="sale", order_by="SalePayment.id"
    )


class SaleItem(Base):
    """An immutable snapshot of one line of the sale. `producto_nombre` and
    `unit_price` are copied at sale time and never re-read from `products` —
    if the product's price or name changes later, past sales must not change
    with it."""

    __tablename__ = "sale_items"
    __table_args__ = (
        CheckConstraint("cantidad > 0", name="ck_sale_items_cantidad_positive"),
        CheckConstraint("unit_price >= 0 AND subtotal_linea >= 0", name="ck_sale_items_amounts_non_negative"),
    )

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    sale_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("sales.id", ondelete="CASCADE"), nullable=False
    )
    # No ondelete: a product that was ever sold can't be hard-deleted (it
    # already can't be — products only ever get soft-deleted), so this stays
    # RESTRICT by default, matching the "a sale is forever" invariant above.
    product_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("products.id"), nullable=False)
    producto_nombre: Mapped[str] = mapped_column(String(200), nullable=False)
    unit_price: Mapped[Decimal] = mapped_column(Numeric(12, 2), nullable=False)
    cantidad: Mapped[int] = mapped_column(Integer, nullable=False)
    subtotal_linea: Mapped[Decimal] = mapped_column(Numeric(12, 2), nullable=False)

    sale: Mapped["Sale"] = relationship("Sale", back_populates="items")


class SalePayment(Base):
    """One row per payment method used on a sale — a mixed payment (part
    efectivo, part tarjeta) is just two rows instead of a special case."""

    __tablename__ = "sale_payments"
    __table_args__ = (
        CheckConstraint(
            "metodo IN ('efectivo', 'yape_plin', 'tarjeta', 'transferencia')", name="ck_sale_payments_metodo_valid"
        ),
        CheckConstraint("monto > 0", name="ck_sale_payments_monto_positive"),
    )

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    sale_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("sales.id", ondelete="CASCADE"), nullable=False
    )
    metodo: Mapped[str] = mapped_column(String(20), nullable=False)
    monto: Mapped[Decimal] = mapped_column(Numeric(12, 2), nullable=False)
    referencia: Mapped[str | None] = mapped_column(String(100), nullable=True)
    # Only meaningful for efectivo: how much cash the customer actually
    # handed over, so the frontend can show the change (vuelto = recibido -
    # monto) — never persisted as a separate "vuelto" column since it's fully
    # derived from these two.
    recibido: Mapped[Decimal | None] = mapped_column(Numeric(12, 2), nullable=True)

    sale: Mapped["Sale"] = relationship("Sale", back_populates="payments")
