from datetime import datetime, timedelta, timezone

from jose import JWTError, jwt

from app.config import get_settings

settings = get_settings()


class TokenError(Exception):
    """Raised when a JWT is missing, malformed, expired, or of the wrong type."""


def _create_token(
    subject: str, token_type: str, expires_delta: timedelta, extra_claims: dict | None = None
) -> str:
    now = datetime.now(timezone.utc)
    claims = {
        "sub": subject,
        "type": token_type,
        "iat": now,
        "exp": now + expires_delta,
        **(extra_claims or {}),
    }
    return jwt.encode(claims, settings.jwt_secret, algorithm=settings.jwt_algorithm)


def create_access_token(subject: str, role: str | None = None) -> str:
    # The role claim is only ever used as a rate-limit *tier hint* (see
    # security/rate_limit.py's scan_rate_limit) for endpoints slowapi's
    # key_func/limit callables must evaluate before FastAPI resolves any
    # Depends() — real authorization never trusts it and always re-reads the
    # user row from the database (see get_current_user in security/deps.py),
    # so a stale role claim here can at most make an already-demoted user's
    # rate limit generous for up to one access-token lifetime, never grant an
    # actual permission.
    extra = {"role": role} if role is not None else None
    return _create_token(subject, "access", timedelta(minutes=settings.jwt_access_token_expire_minutes), extra)


def create_refresh_token(subject: str) -> str:
    return _create_token(subject, "refresh", timedelta(days=settings.jwt_refresh_token_expire_days))


def decode_token(token: str, expected_type: str) -> str:
    try:
        payload = jwt.decode(token, settings.jwt_secret, algorithms=[settings.jwt_algorithm])
    except JWTError as exc:
        raise TokenError("Invalid or expired token") from exc

    if payload.get("type") != expected_type:
        raise TokenError(f"Expected a '{expected_type}' token")

    subject = payload.get("sub")
    if not subject:
        raise TokenError("Token missing subject")

    return subject


def peek_access_token(token: str) -> tuple[str, str | None] | None:
    """Best-effort peek at an access token's subject and role claim, for
    slowapi's key_func/limit callables (see security/rate_limit.py) which run
    before FastAPI resolves any dependency and therefore can't call
    get_current_user. Returns None for anything short of a fully valid,
    non-expired access token — never raises, since the caller's job is to
    fall back to the safe (most restrictive/anonymous) rate-limit tier, not
    to reject the request. NEVER use this for authorization: the role in
    particular is only as fresh as the token, unlike get_current_user which
    always re-reads it from the database."""
    try:
        payload = jwt.decode(token, settings.jwt_secret, algorithms=[settings.jwt_algorithm])
    except JWTError:
        return None
    if payload.get("type") != "access":
        return None
    subject = payload.get("sub")
    if not isinstance(subject, str) or not subject:
        return None
    role = payload.get("role")
    return subject, (role if isinstance(role, str) else None)
