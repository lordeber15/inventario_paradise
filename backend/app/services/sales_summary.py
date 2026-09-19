from datetime import date, datetime, timedelta, timezone

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.product import Product
from app.models.sale import ESTADO_ANULADA, ESTADO_COMPLETADA, Sale, SaleItem, SalePayment
from app.models.user import User
from app.schemas.sales_summary import (
    DailyTotal,
    LowStockProduct,
    PaymentMethodTotal,
    SalesSummaryOut,
    TopProduct,
    VendorTotal,
)

# Matches the "stock bajo" threshold StockBadge already uses on the frontend
# (components/products/StockBadge.tsx) — kept in sync there, not read from a
# shared constant, since one is Python and the other TypeScript.
LOW_STOCK_THRESHOLD = 5
TOP_PRODUCTS_LIMIT = 10


def day_range_utc(desde: date, hasta: date) -> tuple[datetime, datetime]:
    """Everything in this app already stores/compares timestamps in UTC
    (Sale.created_at's server_default is `now()`, no per-store timezone
    concept exists anywhere else) — day boundaries here are UTC days too,
    not Peru-local days. Fine for a single-store dashboard; would need
    revisiting before this app ever serves more than one timezone."""
    start = datetime(desde.year, desde.month, desde.day, tzinfo=timezone.utc)
    end = datetime(hasta.year, hasta.month, hasta.day, tzinfo=timezone.utc) + timedelta(days=1)
    return start, end


async def get_sales_summary(db: AsyncSession, desde: date, hasta: date) -> SalesSummaryOut:
    start, end = day_range_utc(desde, hasta)
    in_range = (Sale.created_at >= start, Sale.created_at < end)

    completed_stmt = select(
        func.coalesce(func.sum(Sale.total), 0),
        func.count(),
        func.coalesce(func.avg(Sale.total), 0),
        func.coalesce(func.sum(Sale.descuento_monto), 0),
    ).where(Sale.estado == ESTADO_COMPLETADA, *in_range)
    total_vendido, cantidad_ventas, ticket_promedio, total_descuentos = (await db.execute(completed_stmt)).one()

    voided_stmt = select(func.count(), func.coalesce(func.sum(Sale.total), 0)).where(
        Sale.estado == ESTADO_ANULADA, *in_range
    )
    cantidad_anuladas, monto_anulado = (await db.execute(voided_stmt)).one()

    by_method_stmt = (
        select(SalePayment.metodo, func.sum(SalePayment.monto), func.count())
        .join(Sale, Sale.id == SalePayment.sale_id)
        .where(Sale.estado == ESTADO_COMPLETADA, *in_range)
        .group_by(SalePayment.metodo)
        .order_by(func.sum(SalePayment.monto).desc())
    )
    by_method = (await db.execute(by_method_stmt)).all()

    by_vendor_stmt = (
        select(Sale.vendedor_id, User.full_name, User.username, func.sum(Sale.total), func.count())
        .join(User, User.id == Sale.vendedor_id)
        .where(Sale.estado == ESTADO_COMPLETADA, *in_range)
        .group_by(Sale.vendedor_id, User.full_name, User.username)
        .order_by(func.sum(Sale.total).desc())
    )
    by_vendor = (await db.execute(by_vendor_stmt)).all()

    top_products_stmt = (
        select(
            SaleItem.product_id,
            func.max(SaleItem.producto_nombre),
            func.sum(SaleItem.cantidad),
            func.sum(SaleItem.subtotal_linea),
        )
        .join(Sale, Sale.id == SaleItem.sale_id)
        .where(Sale.estado == ESTADO_COMPLETADA, *in_range)
        .group_by(SaleItem.product_id)
        .order_by(func.sum(SaleItem.cantidad).desc())
        .limit(TOP_PRODUCTS_LIMIT)
    )
    top_products = (await db.execute(top_products_stmt)).all()

    # One row per calendar day with at least one completed sale — the trend
    # a ranked list (top_productos, por_metodo_pago) can't show, since those
    # always sort by value and drop the notion of "when". UTC day boundaries,
    # same convention as day_range_utc above.
    by_day_stmt = (
        select(func.date(Sale.created_at), func.coalesce(func.sum(Sale.total), 0))
        .where(Sale.estado == ESTADO_COMPLETADA, *in_range)
        .group_by(func.date(Sale.created_at))
        .order_by(func.date(Sale.created_at))
    )
    by_day = (await db.execute(by_day_stmt)).all()

    # Current stock snapshot — not scoped to the date range, unlike everything
    # above: "what's low right now" wouldn't mean much averaged over a period.
    low_stock_stmt = (
        select(Product.id, Product.name, Product.stock)
        .where(Product.is_active.is_(True), Product.stock <= LOW_STOCK_THRESHOLD)
        .order_by(Product.stock.asc())
    )
    low_stock = (await db.execute(low_stock_stmt)).all()

    return SalesSummaryOut(
        desde=desde,
        hasta=hasta,
        total_vendido=float(total_vendido),
        cantidad_ventas=cantidad_ventas,
        ticket_promedio=float(ticket_promedio),
        total_descuentos=float(total_descuentos),
        cantidad_anuladas=cantidad_anuladas,
        monto_anulado=float(monto_anulado),
        por_metodo_pago=[
            PaymentMethodTotal(metodo=metodo, total=float(total), cantidad=cantidad)
            for metodo, total, cantidad in by_method
        ],
        por_vendedor=[
            VendorTotal(
                vendedor_id=vendedor_id,
                vendedor_nombre=full_name or username,
                total=float(total),
                cantidad_ventas=cantidad,
            )
            for vendedor_id, full_name, username, total, cantidad in by_vendor
        ],
        top_productos=[
            TopProduct(product_id=product_id, nombre=nombre, cantidad_vendida=cantidad, total_vendido=float(total))
            for product_id, nombre, cantidad, total in top_products
        ],
        stock_bajo=[LowStockProduct(id=id_, name=name, stock=stock) for id_, name, stock in low_stock],
        por_dia=[DailyTotal(fecha=fecha, total=float(total)) for fecha, total in by_day],
    )


async def list_sales_page(
    db: AsyncSession, *, desde: date | None, hasta: date | None, page: int, page_size: int
) -> tuple[list[Sale], int]:
    filters = []
    if desde is not None and hasta is not None:
        start, end = day_range_utc(desde, hasta)
        filters = [Sale.created_at >= start, Sale.created_at < end]

    total = (await db.execute(select(func.count()).select_from(Sale).where(*filters))).scalar_one()

    stmt = (
        select(Sale)
        .options(selectinload(Sale.items), selectinload(Sale.payments))
        .where(*filters)
        .order_by(Sale.created_at.desc())
        .limit(page_size)
        .offset((page - 1) * page_size)
    )
    items = list((await db.execute(stmt)).scalars().all())
    return items, total
