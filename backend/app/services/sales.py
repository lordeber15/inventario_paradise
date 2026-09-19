import uuid
from datetime import datetime, timezone
from decimal import ROUND_HALF_UP, Decimal

from sqlalchemy import select, update
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.config import get_settings
from app.models.document_series import DocumentSeries
from app.models.inventory_movement import MOTIVO_ANULACION, MOTIVO_VENTA, InventoryMovement
from app.models.product import Product
from app.models.sale import ESTADO_ANULADA, ESTADO_COMPLETADA, Sale, SaleItem, SalePayment
from app.models.user import ROLE_ADMIN, User
from app.schemas.sale import SaleCreate
from app.services.cash_sessions import get_open_session

TWO_PLACES = Decimal("0.01")


class SaleError(Exception):
    """Raised for any business-rule violation while creating/voiding a sale
    or managing a cash session. Framework-agnostic on purpose — the router
    is the only place that knows about HTTPException — so this layer stays
    directly callable (and testable, including concurrently) without going
    through FastAPI."""

    def __init__(self, status_code: int, detail: str) -> None:
        self.status_code = status_code
        self.detail = detail
        super().__init__(detail)


def _money(value: float | Decimal) -> Decimal:
    """Converts an incoming amount to Decimal via its string form — never
    `Decimal(float)` directly, which would carry the float's binary rounding
    artifacts (e.g. `Decimal(0.1)` is not exactly 0.1) into money math."""
    return Decimal(str(value))


async def _sale_with_relations(db: AsyncSession, sale_id: uuid.UUID) -> Sale | None:
    stmt = (
        select(Sale)
        .options(selectinload(Sale.items), selectinload(Sale.payments))
        .where(Sale.id == sale_id)
    )
    return (await db.execute(stmt)).scalar_one_or_none()


async def get_sale_or_404(db: AsyncSession, sale_id: uuid.UUID) -> Sale:
    sale = await _sale_with_relations(db, sale_id)
    if sale is None:
        raise SaleError(404, "Venta no encontrada.")
    return sale


async def _find_by_idempotency_key(db: AsyncSession, key: str) -> Sale | None:
    stmt = (
        select(Sale)
        .options(selectinload(Sale.items), selectinload(Sale.payments))
        .where(Sale.idempotency_key == key)
    )
    return (await db.execute(stmt)).scalar_one_or_none()


async def create_sale(db: AsyncSession, actor: User, payload: SaleCreate) -> Sale:
    settings = get_settings()

    if payload.idempotency_key:
        existing = await _find_by_idempotency_key(db, payload.idempotency_key)
        if existing is not None:
            return existing

    if not payload.items:
        raise SaleError(400, "La venta debe tener al menos un producto.")
    if not payload.payments:
        raise SaleError(400, "Debe registrarse al menos un método de pago.")

    cash_session = await get_open_session(db, actor.id)
    if cash_session is None:
        raise SaleError(409, "No hay una caja abierta para este usuario.")

    # Resolve products and compute the subtotal from *current* prices — the
    # request never carries a price, so a stale/tampered client value can't
    # under- or over-charge.
    subtotal = Decimal("0")
    resolved_items: list[tuple[Product, int, Decimal, Decimal]] = []
    for line in payload.items:
        product = await db.get(Product, line.product_id)
        if product is None or not product.is_active:
            raise SaleError(404, f"Producto no encontrado: {line.product_id}")
        unit_price = _money(product.price)
        line_subtotal = (unit_price * line.cantidad).quantize(TWO_PLACES)
        subtotal += line_subtotal
        resolved_items.append((product, line.cantidad, unit_price, line_subtotal))

    descuento_monto = _money(payload.descuento_monto)
    if descuento_monto > subtotal:
        raise SaleError(400, "El descuento no puede superar el subtotal.")
    if descuento_monto > 0:
        if not payload.descuento_motivo:
            raise SaleError(400, "Todo descuento requiere un motivo.")
        if actor.role != ROLE_ADMIN:
            max_allowed = (subtotal * _money(settings.discount_max_pct_vendedor)).quantize(TWO_PLACES)
            if descuento_monto > max_allowed:
                raise SaleError(
                    403,
                    f"El descuento supera el tope permitido para vendedores "
                    f"({settings.discount_max_pct_vendedor:.0%} del subtotal).",
                )

    total = (subtotal - descuento_monto).quantize(TWO_PLACES)

    if total > _money(settings.client_data_required_above) and not payload.cliente_nombre:
        raise SaleError(
            400, f"Se requieren los datos del cliente para ventas mayores a S/ {settings.client_data_required_above:.2f}."
        )

    payments_total = sum((_money(p.monto) for p in payload.payments), Decimal("0"))
    if payments_total != total:
        raise SaleError(400, f"Los pagos (S/ {payments_total}) no cubren el total (S/ {total}).")
    for p in payload.payments:
        if p.recibido is not None and _money(p.recibido) < _money(p.monto):
            raise SaleError(400, "El monto recibido no puede ser menor al monto del pago.")

    # Stock, decremented atomically per line: the WHERE clause re-evaluates
    # under Postgres's read-committed lock-then-recheck semantics, so this is
    # safe under real concurrency without needing an explicit SELECT ... FOR
    # UPDATE — see docs/PLAN-POS.md §3.
    for product, cantidad, _unit_price, _line_subtotal in resolved_items:
        result = await db.execute(
            update(Product)
            .where(Product.id == product.id, Product.is_active.is_(True), Product.stock >= cantidad)
            .values(stock=Product.stock - cantidad)
        )
        if result.rowcount == 0:
            # Captured before rollback: rolling back expires every instance
            # tied to this session, and AsyncSession can't transparently
            # refresh an expired attribute from a plain sync attribute access.
            product_name = product.name
            await db.rollback()
            raise SaleError(409, f"Stock insuficiente para '{product_name}'.")

    # Correlativo: locks the series row so two concurrent sales can never be
    # assigned the same number — the second transaction blocks here until the
    # first commits or rolls back, then sees the updated value.
    series_stmt = (
        select(DocumentSeries).where(DocumentSeries.serie == settings.default_document_series).with_for_update()
    )
    series_row = (await db.execute(series_stmt)).scalar_one_or_none()
    if series_row is None:
        await db.rollback()
        raise SaleError(500, "La serie de comprobante configurada no existe.")
    series_row.ultimo_correlativo += 1
    correlativo = series_row.ultimo_correlativo

    base = (total / (Decimal("1") + _money(settings.igv_rate))).quantize(TWO_PLACES, rounding=ROUND_HALF_UP)
    igv = total - base

    sale = Sale(
        serie=settings.default_document_series,
        correlativo=correlativo,
        tipo_comprobante=settings.default_document_type,
        estado=ESTADO_COMPLETADA,
        subtotal=subtotal,
        igv=igv,
        descuento_monto=descuento_monto,
        descuento_motivo=payload.descuento_motivo,
        total=total,
        cliente_nombre=payload.cliente_nombre,
        cliente_doc_tipo=payload.cliente_doc_tipo,
        cliente_doc_num=payload.cliente_doc_num,
        vendedor_id=actor.id,
        cash_session_id=cash_session.id,
        idempotency_key=payload.idempotency_key,
    )
    sale.items = [
        SaleItem(
            product_id=product.id,
            producto_nombre=product.name,
            unit_price=unit_price,
            cantidad=cantidad,
            subtotal_linea=line_subtotal,
        )
        for product, cantidad, unit_price, line_subtotal in resolved_items
    ]
    sale.payments = [
        SalePayment(
            metodo=p.metodo,
            monto=_money(p.monto),
            referencia=p.referencia,
            recibido=_money(p.recibido) if p.recibido is not None else None,
        )
        for p in payload.payments
    ]
    db.add(sale)
    await db.flush()

    for product, cantidad, _unit_price, _line_subtotal in resolved_items:
        db.add(
            InventoryMovement(
                product_id=product.id, delta=-cantidad, motivo=MOTIVO_VENTA, sale_id=sale.id, usuario_id=actor.id
            )
        )

    try:
        await db.commit()
    except IntegrityError as exc:
        await db.rollback()
        if payload.idempotency_key:
            existing = await _find_by_idempotency_key(db, payload.idempotency_key)
            if existing is not None:
                return existing
        raise SaleError(409, "No se pudo completar la venta.") from exc

    return await get_sale_or_404(db, sale.id)


async def void_sale(db: AsyncSession, actor: User, sale_id: uuid.UUID, motivo: str) -> Sale:
    sale = await get_sale_or_404(db, sale_id)
    if sale.estado == ESTADO_ANULADA:
        raise SaleError(409, "Esta venta ya fue anulada.")

    for item in sale.items:
        await db.execute(update(Product).where(Product.id == item.product_id).values(stock=Product.stock + item.cantidad))
        db.add(
            InventoryMovement(
                product_id=item.product_id,
                delta=item.cantidad,
                motivo=MOTIVO_ANULACION,
                sale_id=sale.id,
                usuario_id=actor.id,
            )
        )

    sale.estado = ESTADO_ANULADA
    sale.anulada_por = actor.id
    sale.anulada_en = datetime.now(timezone.utc)
    sale.motivo_anulacion = motivo

    await db.commit()
    return await get_sale_or_404(db, sale_id)
