import uuid

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models.user import ROLE_ADMIN, User
from app.schemas.sale import SaleCreate, SaleOut, VoidSaleIn
from app.security.deps import require_admin, require_seller_or_admin
from app.services.sales import SaleError, create_sale, get_sale_or_404, void_sale

router = APIRouter(prefix="/api/sales", tags=["sales"])


@router.post("", response_model=SaleOut, status_code=201)
async def create_sale_endpoint(
    payload: SaleCreate,
    db: AsyncSession = Depends(get_db),
    actor: User = Depends(require_seller_or_admin),
) -> SaleOut:
    try:
        sale = await create_sale(db, actor, payload)
    except SaleError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.detail) from exc
    return SaleOut.model_validate(sale)


@router.get("/{sale_id}", response_model=SaleOut)
async def get_sale_endpoint(
    sale_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    actor: User = Depends(require_seller_or_admin),
) -> SaleOut:
    try:
        sale = await get_sale_or_404(db, sale_id)
    except SaleError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.detail) from exc
    # A vendedor can only pull up their own sales (e.g. to reprint a ticket);
    # an admin can look at any of them.
    if actor.role != ROLE_ADMIN and sale.vendedor_id != actor.id:
        raise HTTPException(status_code=403, detail="No podés ver esta venta.")
    return SaleOut.model_validate(sale)


@router.post("/{sale_id}/void", response_model=SaleOut)
async def void_sale_endpoint(
    sale_id: uuid.UUID,
    payload: VoidSaleIn,
    db: AsyncSession = Depends(get_db),
    admin: User = Depends(require_admin),
) -> SaleOut:
    try:
        sale = await void_sale(db, admin, sale_id, payload.motivo)
    except SaleError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.detail) from exc
    return SaleOut.model_validate(sale)
