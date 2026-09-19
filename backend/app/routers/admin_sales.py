from datetime import date, timedelta

from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models.user import User
from app.schemas.sale import SaleOut
from app.schemas.sales_summary import SalesPageOut, SalesSummaryOut
from app.security.deps import require_admin
from app.services.sales_summary import get_sales_summary, list_sales_page

router = APIRouter(prefix="/api/admin/sales", tags=["admin-sales"])

DEFAULT_RANGE_DAYS = 30


@router.get("/summary", response_model=SalesSummaryOut)
async def get_sales_summary_endpoint(
    desde: date | None = Query(None),
    hasta: date | None = Query(None),
    db: AsyncSession = Depends(get_db),
    _admin: User = Depends(require_admin),
) -> SalesSummaryOut:
    today = date.today()
    effective_hasta = hasta or today
    effective_desde = desde or (effective_hasta - timedelta(days=DEFAULT_RANGE_DAYS))
    return await get_sales_summary(db, effective_desde, effective_hasta)


@router.get("", response_model=SalesPageOut)
async def list_sales_endpoint(
    desde: date | None = Query(None),
    hasta: date | None = Query(None),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
    _admin: User = Depends(require_admin),
) -> SalesPageOut:
    items, total = await list_sales_page(db, desde=desde, hasta=hasta, page=page, page_size=page_size)
    return SalesPageOut(items=[SaleOut.model_validate(sale) for sale in items], total=total, page=page, page_size=page_size)
