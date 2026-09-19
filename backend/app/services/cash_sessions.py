import uuid
from datetime import datetime, timezone
from decimal import Decimal

from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.sql import func

from app.models.cash_session import CashSession
from app.models.sale import ESTADO_COMPLETADA, METODO_EFECTIVO, Sale, SalePayment
from app.models.user import ROLE_ADMIN, User


class CashSessionError(Exception):
    """Same role as services.sales.SaleError — kept as its own class (rather
    than importing SaleError here) so this module has no dependency on
    services.sales, avoiding a needless import cycle between the two."""

    def __init__(self, status_code: int, detail: str) -> None:
        self.status_code = status_code
        self.detail = detail
        super().__init__(detail)


async def get_open_session(db: AsyncSession, usuario_id: uuid.UUID) -> CashSession | None:
    stmt = select(CashSession).where(CashSession.usuario_id == usuario_id, CashSession.cerrada_en.is_(None))
    return (await db.execute(stmt)).scalar_one_or_none()


async def open_session(db: AsyncSession, user: User, monto_inicial: Decimal) -> CashSession:
    if await get_open_session(db, user.id) is not None:
        raise CashSessionError(409, "Ya hay una caja abierta para este usuario.")

    session = CashSession(usuario_id=user.id, monto_inicial=monto_inicial)
    db.add(session)
    try:
        await db.commit()
    except IntegrityError as exc:
        # The partial unique index (ux_cash_sessions_open_per_user) is the
        # real guarantee against two open registers racing each other — the
        # get_open_session check above is just the friendly, common-case path.
        await db.rollback()
        raise CashSessionError(409, "Ya hay una caja abierta para este usuario.") from exc
    return session


async def get_session_or_404(db: AsyncSession, session_id: uuid.UUID) -> CashSession:
    session = await db.get(CashSession, session_id)
    if session is None:
        raise CashSessionError(404, "Caja no encontrada.")
    return session


async def close_session(
    db: AsyncSession, actor: User, session_id: uuid.UUID, contado_efectivo: Decimal, notas: str
) -> CashSession:
    session = await get_session_or_404(db, session_id)
    if session.cerrada_en is not None:
        raise CashSessionError(409, "Esta caja ya está cerrada.")
    if actor.role != ROLE_ADMIN and session.usuario_id != actor.id:
        raise CashSessionError(403, "No podés cerrar la caja de otro usuario.")

    # Expected cash = what it opened with, plus every efectivo payment taken
    # during this session on sales that weren't later anuladas.
    stmt = (
        select(func.coalesce(func.sum(SalePayment.monto), 0))
        .select_from(SalePayment)
        .join(Sale, Sale.id == SalePayment.sale_id)
        .where(
            Sale.cash_session_id == session_id,
            Sale.estado == ESTADO_COMPLETADA,
            SalePayment.metodo == METODO_EFECTIVO,
        )
    )
    efectivo_vendido = Decimal((await db.execute(stmt)).scalar_one())
    esperado = session.monto_inicial + efectivo_vendido

    session.cerrada_en = datetime.now(timezone.utc)
    session.contado_efectivo = contado_efectivo
    session.diferencia = contado_efectivo - esperado
    session.notas = notas or ""

    await db.commit()
    return session
