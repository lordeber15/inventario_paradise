from fastapi import Request
from slowapi import Limiter
from slowapi.util import get_remote_address

from app.models.user import ROLE_ADMIN, ROLE_VENDEDOR
from app.security.jwt import peek_access_token

limiter = Limiter(key_func=get_remote_address)


def _bearer_token(request: Request) -> str | None:
    header = request.headers.get("authorization", "")
    if not header.lower().startswith("bearer "):
        return None
    return header[7:]


def _role_and_identity(request: Request) -> tuple[str, str]:
    """Resolves (role, identity) for the scan endpoint's rate limiting,
    without touching the database — slowapi calls key_func/limit callables
    before FastAPI resolves any Depends(), so this only decodes the JWT
    locally (see peek_access_token's docstring on why that's safe for a
    rate-limit tier but never for authorization). `role` is "anonymous" for
    a missing/invalid/expired token, one of the real role constants
    otherwise; `identity` is the user id when known, the caller's IP
    otherwise."""
    token = _bearer_token(request)
    peeked = peek_access_token(token) if token is not None else None
    if peeked is not None:
        subject, role = peeked
        return role or "authenticated", subject
    return "anonymous", get_remote_address(request)


def user_or_ip_key(request: Request) -> str:
    """Rate-limit key for /api/recognition/scan: role-prefixed so the
    dynamic limit-value callable below (scan_rate_limit) can read the tier
    straight off the key slowapi already computed, without a second JWT
    decode — slowapi only ever hands a dynamic limit-value callable the
    resulting key string, never the request itself (see LimitGroup.__iter__
    in slowapi/wrappers.py)."""
    role, identity = _role_and_identity(request)
    return f"{role}:{identity}"


# Per-role scan tiers (see docs/PLAN-POS.md §5): a logged-in admin/vendedor
# gets a generous budget since they're identified and accountable, anonymous
# public traffic gets the tightest one since CLIP inference is CPU-heavy and
# open to anyone.
_SCAN_LIMIT_ADMIN = "60/minute"
_SCAN_LIMIT_VENDEDOR = "20/minute"
_SCAN_LIMIT_ANONYMOUS = "10/minute"


def scan_rate_limit(key: str) -> str:
    """Dynamic per-role limit for /api/recognition/scan. `key` is whatever
    user_or_ip_key (this endpoint's key_func) returned for the request —
    slowapi passes a dynamic limit-value callable the key, not the request,
    when its signature names a `key` parameter (see LimitGroup.__iter__)."""
    role = key.split(":", 1)[0]
    if role == ROLE_ADMIN:
        return _SCAN_LIMIT_ADMIN
    if role == ROLE_VENDEDOR:
        return _SCAN_LIMIT_VENDEDOR
    return _SCAN_LIMIT_ANONYMOUS


# Belt-and-suspenders on top of the per-identity limit above: 10/minute per
# IP is trivial to multiply by rotating IPs, and CLIP inference is expensive
# enough that unauthenticated traffic alone could still peg the container's
# CPU. This caps *all* anonymous scan traffic combined, regardless of source
# IP; logged-in users (identified, accountable, and already capped
# individually above) are exempt.
SCAN_GLOBAL_ANONYMOUS_LIMIT = "120/minute"


def global_anonymous_scan_key(request: Request) -> str:
    role, _identity = _role_and_identity(request)
    if role in (ROLE_ADMIN, ROLE_VENDEDOR):
        # Empty key => slowapi skips this particular limit for the request
        # (see __evaluate_limits: `if all(args):`), leaving only the
        # per-identity limit above in effect for authenticated traffic.
        return ""
    return "anonymous"
