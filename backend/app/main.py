import logging

from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, PlainTextResponse

from slowapi import _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded
from sqlalchemy import text

from app.config import get_settings
from app.database import engine
from app.routers import (
    admin_sales,
    auth,
    cash_sessions,
    products_admin,
    products_public,
    recognition,
    sales,
    settings_admin,
    settings_public,
    users_admin,
)
from app.security.rate_limit import limiter
from app.services.storage import get_minio_client

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("inventario")

settings = get_settings()

# Matches nginx's client_max_body_size in production use; guards the backend itself
# since its port is also reachable directly (see docker-compose.yml). Without this,
# FastAPI/Starlette has no default request body size cap, so an unauthenticated
# oversized body (e.g. to /api/auth/login) is fully buffered into memory before any
# field-level validation runs — a cheap memory-exhaustion DoS.
MAX_BODY_SIZE_BYTES = 10 * 1024 * 1024
# Product photo uploads (up to 6 files, 8MB each per image_validation.py) can
# legitimately exceed the default cap. Raising the global limit to cover them
# would reopen the DoS above on unauthenticated routes like /api/auth/login, so
# this higher limit applies only to the admin product-photo routes, which
# already require a valid admin JWT before any body is processed.
UPLOAD_MAX_BODY_SIZE_BYTES = 52 * 1024 * 1024
UPLOAD_PATH_PREFIX = "/api/admin/products"


class MaxBodySizeMiddleware:
    """Pure ASGI middleware: counts bytes as they stream through `receive`,
    without touching Starlette's `Request` object. A `BaseHTTPMiddleware`-based
    version that reads and replays the body was tried first, but it broke
    downstream Form/File/JSON parsing (two separate Request instances end up
    disagreeing about how much of the body has already been consumed).
    """

    def __init__(self, app) -> None:
        self.app = app

    async def __call__(self, scope, receive, send) -> None:
        if scope["type"] != "http":
            await self.app(scope, receive, send)
            return

        limit = UPLOAD_MAX_BODY_SIZE_BYTES if scope["path"].startswith(UPLOAD_PATH_PREFIX) else MAX_BODY_SIZE_BYTES

        content_length = next((v for k, v in scope.get("headers", []) if k == b"content-length"), None)
        if content_length is not None and int(content_length) > limit:
            response = PlainTextResponse("Payload too large", status_code=413)
            await response(scope, receive, send)
            return

        total_size = 0

        async def guarded_receive():
            nonlocal total_size
            message = await receive()
            if message["type"] == "http.request":
                total_size += len(message.get("body") or b"")
                if total_size > limit:
                    raise HTTPException(status_code=413, detail="Payload too large")
            return message

        await self.app(scope, guarded_receive, send)


app = FastAPI(title="Inventario API", version="0.1.0")

app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

app.add_middleware(MaxBodySizeMiddleware)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins_list,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE"],
    allow_headers=["Authorization", "Content-Type"],
)


@app.middleware("http")
async def security_headers_middleware(request: Request, call_next):
    response = await call_next(request)
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["X-Frame-Options"] = "DENY"
    response.headers["Referrer-Policy"] = "no-referrer"
    response.headers["Content-Security-Policy"] = "default-src 'none'"
    return response


app.include_router(auth.router)
app.include_router(products_admin.router)
app.include_router(products_public.router)
app.include_router(recognition.router)
app.include_router(users_admin.router)
app.include_router(sales.router)
app.include_router(cash_sessions.router)
app.include_router(admin_sales.router)
app.include_router(settings_public.router)
app.include_router(settings_admin.router)


@app.get("/api/health")
async def health_check() -> JSONResponse:
    checks = {"database": "unknown", "storage": "unknown"}
    healthy = True

    try:
        async with engine.connect() as conn:
            await conn.execute(text("SELECT 1"))
        checks["database"] = "ok"
    except Exception as exc:  # noqa: BLE001 - health check must not crash on any backend error
        logger.warning("Database health check failed: %s", exc)
        checks["database"] = "error"
        healthy = False

    try:
        get_minio_client().bucket_exists(settings.minio_bucket)
        checks["storage"] = "ok"
    except Exception as exc:  # noqa: BLE001
        logger.warning("Storage health check failed: %s", exc)
        checks["storage"] = "error"
        healthy = False

    status_code = 200 if healthy else 503
    return JSONResponse(status_code=status_code, content={"status": "ok" if healthy else "degraded", "checks": checks})
