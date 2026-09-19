import uuid
from decimal import Decimal

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models.user import ROLE_ADMIN, User
from app.schemas.sale import CashSessionOut, CloseCashSessionIn, OpenCashSessionIn
from app.security.deps import require_seller_or_admin
from app.services.cash_sessions import CashSessionError, close_session, get_open_session, get_session_or_404, open_session

router = APIRouter(prefix="/api/cash-sessions", tags=["cash-sessions"])


@router.post("", response_model=CashSessionOut, status_code=201)
async def open_cash_session_endpoint(
    payload: OpenCashSessionIn,
    db: AsyncSession = Depends(get_db),
    actor: User = Depends(require_seller_or_admin),
) -> CashSessionOut:
    try:
        session = await open_session(db, actor, Decimal(str(payload.monto_inicial)))
    except CashSessionError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.detail) from exc
    return CashSessionOut.model_validate(session)


@router.get("/current", response_model=CashSessionOut | None)
async def get_current_cash_session_endpoint(
    db: AsyncSession = Depends(get_db),
    actor: User = Depends(require_seller_or_admin),
) -> CashSessionOut | None:
    """The caller's own open session, or null — this is how the seller UI
    decides between showing "open the register" and the sale screen."""
    session = await get_open_session(db, actor.id)
    return CashSessionOut.model_validate(session) if session is not None else None


@router.get("/{session_id}", response_model=CashSessionOut)
async def get_cash_session_endpoint(
    session_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    actor: User = Depends(require_seller_or_admin),
) -> CashSessionOut:
    try:
        session = await get_session_or_404(db, session_id)
    except CashSessionError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.detail) from exc
    if actor.role != ROLE_ADMIN and session.usuario_id != actor.id:
        raise HTTPException(status_code=403, detail="No podés ver la caja de otro usuario.")
    return CashSessionOut.model_validate(session)


@router.post("/{session_id}/close", response_model=CashSessionOut)
async def close_cash_session_endpoint(
    session_id: uuid.UUID,
    payload: CloseCashSessionIn,
    db: AsyncSession = Depends(get_db),
    actor: User = Depends(require_seller_or_admin),
) -> CashSessionOut:
    try:
        session = await close_session(db, actor, session_id, Decimal(str(payload.contado_efectivo)), payload.notas)
    except CashSessionError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.detail) from exc
    return CashSessionOut.model_validate(session)
