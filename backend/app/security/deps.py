import uuid

from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models.user import ROLE_ADMIN, ROLE_VENDEDOR, User
from app.security.jwt import TokenError, decode_token

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/auth/login", auto_error=False)


def _credentials_error() -> HTTPException:
    return HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="No se pudo validar la credencial",
        headers={"WWW-Authenticate": "Bearer"},
    )


def _forbidden_error(detail: str) -> HTTPException:
    return HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=detail)


async def get_user_by_id(db: AsyncSession, user_id: str) -> User | None:
    try:
        user_uuid = uuid.UUID(user_id)
    except ValueError:
        return None
    return await db.get(User, user_uuid)


async def get_current_user(
    token: str | None = Depends(oauth2_scheme),
    db: AsyncSession = Depends(get_db),
) -> User:
    """Resolves the authenticated user for the request. Deliberately re-reads
    the row from the database on every call rather than trusting anything
    beyond the JWT's subject: a deactivated or role-changed account is denied
    immediately, not just after its 30-minute access token happens to expire."""
    if token is None:
        raise _credentials_error()

    try:
        subject = decode_token(token, expected_type="access")
    except TokenError as exc:
        raise _credentials_error() from exc

    user = await get_user_by_id(db, subject)
    if user is None or not user.is_active:
        raise _credentials_error()

    return user


async def get_optional_user(
    token: str | None = Depends(oauth2_scheme),
    db: AsyncSession = Depends(get_db),
) -> User | None:
    """Like get_current_user, but returns None instead of raising 401 for a
    missing, invalid, expired, or otherwise unusable token — for endpoints
    open to anonymous traffic (e.g. /api/recognition/scan) that still want to
    recognize a logged-in admin/vendedor when one is present, to shape the
    response and rate limit for that audience."""
    if token is None:
        return None

    try:
        subject = decode_token(token, expected_type="access")
    except TokenError:
        return None

    user = await get_user_by_id(db, subject)
    if user is None or not user.is_active:
        return None

    return user


async def require_admin(user: User = Depends(get_current_user)) -> User:
    if user.role != ROLE_ADMIN:
        raise _forbidden_error("Esta acción requiere el rol de administrador.")
    return user


async def require_seller_or_admin(user: User = Depends(get_current_user)) -> User:
    if user.role not in (ROLE_ADMIN, ROLE_VENDEDOR):
        raise _forbidden_error("Esta acción requiere una cuenta de vendedor o administrador.")
    return user
