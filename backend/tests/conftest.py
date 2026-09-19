import asyncio
import os
from urllib.parse import urlsplit, urlunsplit

import asyncpg
import numpy as np
import pytest
import pytest_asyncio
from httpx import ASGITransport, AsyncClient
from PIL import Image
from sqlalchemy import text
from sqlalchemy.ext.asyncio import async_sessionmaker

EMBEDDING_DIM = 512


def _to_test_database_url(url: str) -> str:
    parts = urlsplit(url)
    return urlunsplit((parts.scheme, parts.netloc, parts.path.rstrip("/") + "_test", parts.query, parts.fragment))


def _to_asyncpg_dsn(sqlalchemy_url: str) -> str:
    return sqlalchemy_url.replace("postgresql+asyncpg://", "postgresql://")


_BASE_DATABASE_URL = os.environ.get(
    "DATABASE_URL", "postgresql+asyncpg://inventario:inventario@localhost:5433/inventario"
)
_TEST_DATABASE_URL = _to_test_database_url(_BASE_DATABASE_URL)
# Must happen before any `app.*` module is imported, so app.database builds its
# engine against the test database instead of the real one.
os.environ["DATABASE_URL"] = _TEST_DATABASE_URL

from app.database import Base, engine  # noqa: E402
from app.main import app  # noqa: E402
from app.models.app_settings import APP_SETTINGS_ID, AppSettings  # noqa: F401,E402
from app.models.cash_session import CashSession  # noqa: F401,E402
from app.models.document_series import DocumentSeries  # noqa: F401,E402
from app.models.inventory_movement import InventoryMovement  # noqa: F401,E402
from app.models.product import Product  # noqa: F401,E402
from app.models.product_image import ProductImage  # noqa: F401,E402
from app.models.sale import Sale, SaleItem, SalePayment  # noqa: F401,E402
from app.models.user import User  # noqa: F401,E402

# Matches the row the real migration (0004_sales.py) seeds — create_all()
# doesn't run data migrations, so tests need their own seed of the one
# series the sale-creation flow relies on (settings.default_document_series).
DEFAULT_DOCUMENT_SERIES = "B001"


async def _seed_document_series(conn) -> None:
    await conn.execute(
        text(
            "INSERT INTO document_series (serie, tipo_comprobante, ultimo_correlativo) "
            "VALUES (:serie, 'boleta', 0) ON CONFLICT (serie) DO NOTHING"
        ),
        {"serie": DEFAULT_DOCUMENT_SERIES},
    )


async def _seed_app_settings(conn) -> None:
    await conn.execute(
        text("INSERT INTO app_settings (id, logo_object_key) VALUES (:id, NULL) ON CONFLICT (id) DO NOTHING"),
        {"id": APP_SETTINGS_ID},
    )


async def _setup_database() -> None:
    test_db_name = urlsplit(_to_asyncpg_dsn(_TEST_DATABASE_URL)).path.lstrip("/")
    conn = await asyncpg.connect(_to_asyncpg_dsn(_BASE_DATABASE_URL))
    try:
        exists = await conn.fetchval("SELECT 1 FROM pg_database WHERE datname = $1", test_db_name)
        if not exists:
            await conn.execute(f'CREATE DATABASE "{test_db_name}"')
    finally:
        await conn.close()

    async with engine.begin() as conn:
        await conn.execute(text("CREATE EXTENSION IF NOT EXISTS vector"))
        # Same extensions the real migrations install (0001, 0005) — create_all()
        # only builds tables, so anything a query depends on has to be repeated here.
        await conn.execute(text("CREATE EXTENSION IF NOT EXISTS unaccent"))
        await conn.run_sync(Base.metadata.create_all)
        await _seed_document_series(conn)
        await _seed_app_settings(conn)

    # Each test runs in its own event loop (pytest-asyncio default), but this
    # setup ran in a throwaway loop via asyncio.run(). Dispose so the shared
    # engine opens fresh connections bound to whichever loop is live later,
    # instead of leaking connections tied to this loop.
    await engine.dispose()


@pytest.fixture(scope="session", autouse=True)
def _prepare_test_database():
    asyncio.run(_setup_database())


@pytest_asyncio.fixture(autouse=True)
async def _clean_tables():
    yield
    async with engine.begin() as conn:
        for table in reversed(Base.metadata.sorted_tables):
            await conn.execute(table.delete())
        # The delete loop above wipes document_series along with everything
        # else — reseed it so the next test's sale-creation flow still has a
        # series to assign correlativos from.
        await _seed_document_series(conn)
        await _seed_app_settings(conn)
    # Each test runs in its own event loop (pytest-asyncio default scope).
    # Disposing here, still inside this test's loop, closes every pooled
    # connection before that loop goes away — otherwise the next test's loop
    # inherits stale connections bound to an already-closed loop.
    await engine.dispose()


def fake_embedding(image: Image.Image) -> list[float]:
    """Deterministic stand-in for the real CLIP embedding, so tests don't
    need to download/run the ~350MB model. Derived from the image's average
    color so visually-similar test fixtures land close together in cosine
    distance, same as real embeddings would for genuinely similar photos."""
    arr = np.asarray(image.convert("RGB"), dtype=np.float32)
    mean_color = arr.reshape(-1, 3).mean(axis=0) / 255.0
    vector = np.tile(mean_color, EMBEDDING_DIM // 3 + 1)[:EMBEDDING_DIM]
    norm = np.linalg.norm(vector)
    return (vector / norm).tolist() if norm > 0 else vector.tolist()


@pytest.fixture(autouse=True)
def _mock_clip_embeddings(monkeypatch, request):
    if "slow" in request.keywords:
        yield
        return
    monkeypatch.setattr("app.routers.products_admin.get_embedding", fake_embedding)
    monkeypatch.setattr("app.routers.recognition.get_embedding", fake_embedding)
    yield


@pytest_asyncio.fixture(autouse=True)
async def _reset_rate_limiter():
    app.state.limiter.reset()
    yield


@pytest_asyncio.fixture
async def db_session():
    session_factory = async_sessionmaker(engine, expire_on_commit=False)
    async with session_factory() as session:
        yield session


@pytest_asyncio.fixture
async def client():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://testserver") as ac:
        yield ac
