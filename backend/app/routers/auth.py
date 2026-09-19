from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Request, Response, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import get_settings
from app.database import get_db
from app.models.user import User
from app.schemas.auth import LoginRequest, TokenResponse
from app.schemas.user import UserOut
from app.security.deps import get_current_user, get_user_by_id
from app.security.jwt import TokenError, create_access_token, create_refresh_token, decode_token
from app.security.passwords import verify_password
from app.security.rate_limit import limiter

router = APIRouter(prefix="/api/auth", tags=["auth"])
settings = get_settings()

REFRESH_COOKIE_NAME = "refresh_token"
REFRESH_COOKIE_PATH = "/api/auth"

INVALID_CREDENTIALS_DETAIL = "Credenciales inválidas"
INVALID_REFRESH_TOKEN_DETAIL = "Sesión inválida o expirada"


def _set_refresh_cookie(response: Response, refresh_token: str) -> None:
    response.set_cookie(
        key=REFRESH_COOKIE_NAME,
        value=refresh_token,
        httponly=True,
        secure=settings.cookie_secure,
        samesite=settings.cookie_samesite,
        path=REFRESH_COOKIE_PATH,
        max_age=settings.jwt_refresh_token_expire_days * 24 * 60 * 60,
    )


@router.post("/login", response_model=TokenResponse)
@limiter.limit("5/minute")
async def login(
    request: Request,
    response: Response,
    credentials: LoginRequest,
    db: AsyncSession = Depends(get_db),
) -> TokenResponse:
    result = await db.execute(select(User).where(User.username == credentials.username))
    user = result.scalar_one_or_none()

    if user is None or not user.is_active or not verify_password(credentials.password, user.password_hash):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail=INVALID_CREDENTIALS_DETAIL)

    user.last_login_at = datetime.now(timezone.utc)
    await db.commit()

    access_token = create_access_token(str(user.id), user.role)
    refresh_token = create_refresh_token(str(user.id))
    _set_refresh_cookie(response, refresh_token)

    return TokenResponse(access_token=access_token, expires_in=settings.jwt_access_token_expire_minutes * 60)


@router.post("/refresh", response_model=TokenResponse)
# Higher than /login's 5/min on purpose: a refresh call requires an already-
# valid refresh-token cookie, so it can't be used to guess credentials —
# unlike login, capping it tightly buys little real security (an attacker who
# already stole the cookie can just wait out the window) while every full
# page load in the app fires one silently on mount. 40/min gives normal
# multi-page navigation (admin + a vendedor session, e2e tests exercising
# both) real headroom without materially loosening the actual threat model.
@limiter.limit("40/minute")
async def refresh(
    request: Request,
    response: Response,
    db: AsyncSession = Depends(get_db),
) -> TokenResponse:
    refresh_token = request.cookies.get(REFRESH_COOKIE_NAME)
    if refresh_token is None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail=INVALID_REFRESH_TOKEN_DETAIL)

    try:
        subject = decode_token(refresh_token, expected_type="refresh")
    except TokenError as exc:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail=INVALID_REFRESH_TOKEN_DETAIL) from exc

    user = await get_user_by_id(db, subject)
    if user is None or not user.is_active:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail=INVALID_REFRESH_TOKEN_DETAIL)

    new_access_token = create_access_token(str(user.id), user.role)
    new_refresh_token = create_refresh_token(str(user.id))
    _set_refresh_cookie(response, new_refresh_token)

    return TokenResponse(access_token=new_access_token, expires_in=settings.jwt_access_token_expire_minutes * 60)


@router.post("/logout", status_code=status.HTTP_204_NO_CONTENT)
async def logout(response: Response) -> None:
    response.delete_cookie(
        REFRESH_COOKIE_NAME,
        path=REFRESH_COOKIE_PATH,
        secure=settings.cookie_secure,
        samesite=settings.cookie_samesite,
    )


@router.get("/me", response_model=UserOut)
async def read_current_user(user: User = Depends(get_current_user)) -> UserOut:
    """Lets the frontend know who's logged in and with which role, so it can
    show/hide admin-only navigation (Usuarios, product management) without
    guessing from an unverified JWT claim — this always reflects the current
    DB row, same as every other authorization check in the app."""
    return UserOut.model_validate(user)
