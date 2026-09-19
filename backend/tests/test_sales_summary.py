from datetime import datetime, timedelta, timezone
from decimal import Decimal

from sqlalchemy import select

from app.models.product import Product
from app.models.sale import Sale
from app.models.user import ROLE_VENDEDOR, User
from app.security.jwt import create_access_token
from app.security.passwords import hash_password

PASSWORD = "Sup3rSecret!"


async def _create_user(db_session, *, role="admin", username="admin"):
    user = User(username=username, password_hash=hash_password(PASSWORD), role=role)
    db_session.add(user)
    await db_session.commit()
    await db_session.refresh(user)
    return user


def _auth_headers(user: User) -> dict[str, str]:
    return {"Authorization": f"Bearer {create_access_token(str(user.id), user.role)}"}


def _make_product(db_session, **overrides) -> Product:
    defaults = dict(name="Producto", description="Descripción", price=10, stock=50, image_object_key="products/x.jpg")
    defaults.update(overrides)
    product = Product(**defaults)
    db_session.add(product)
    return product


async def _open_session(client, headers, monto_inicial=100):
    response = await client.post("/api/cash-sessions", json={"monto_inicial": monto_inicial}, headers=headers)
    assert response.status_code == 201, response.text
    return response.json()


async def _sell(client, headers, product_id, *, cantidad=1, metodo="efectivo", monto=None):
    response = await client.post(
        "/api/sales",
        json={
            "items": [{"product_id": str(product_id), "cantidad": cantidad}],
            "payments": [{"metodo": metodo, "monto": monto if monto is not None else cantidad * 10}],
        },
        headers=headers,
    )
    assert response.status_code == 201, response.text
    return response.json()


async def test_summary_requires_admin(client, db_session):
    vendedor = await _create_user(db_session, role=ROLE_VENDEDOR, username="v1")
    response = await client.get("/api/admin/sales/summary", headers=_auth_headers(vendedor))
    assert response.status_code == 403


async def test_listing_requires_admin(client, db_session):
    vendedor = await _create_user(db_session, role=ROLE_VENDEDOR, username="v2")
    response = await client.get("/api/admin/sales", headers=_auth_headers(vendedor))
    assert response.status_code == 403


async def test_summary_totals_exclude_voided_sales(client, db_session):
    admin = await _create_user(db_session, username="admin1")
    headers = _auth_headers(admin)
    product = _make_product(db_session, price=10)
    await db_session.commit()
    await _open_session(client, headers)

    completed = await _sell(client, headers, product.id, cantidad=2, monto=20)
    voided = await _sell(client, headers, product.id, cantidad=1, monto=10)
    void_response = await client.post(f"/api/sales/{voided['id']}/void", json={"motivo": "prueba"}, headers=headers)
    assert void_response.status_code == 200

    summary = await client.get("/api/admin/sales/summary", headers=headers)
    assert summary.status_code == 200
    body = summary.json()
    assert body["total_vendido"] == completed["total"]
    assert body["cantidad_ventas"] == 1
    assert body["cantidad_anuladas"] == 1
    assert body["monto_anulado"] == voided["total"]


async def test_summary_breaks_down_by_payment_method_and_vendor(client, db_session):
    admin = await _create_user(db_session, username="admin2")
    vendedor = await _create_user(db_session, role=ROLE_VENDEDOR, username="v3")
    product_a = _make_product(db_session, price=10)
    product_b = _make_product(db_session, price=10)
    await db_session.commit()

    admin_headers = _auth_headers(admin)
    vendedor_headers = _auth_headers(vendedor)
    await _open_session(client, admin_headers)
    await _open_session(client, vendedor_headers)

    await _sell(client, admin_headers, product_a.id, cantidad=1, metodo="efectivo", monto=10)
    await _sell(client, vendedor_headers, product_b.id, cantidad=1, metodo="tarjeta", monto=10)

    summary = (await client.get("/api/admin/sales/summary", headers=admin_headers)).json()

    methods = {row["metodo"]: row["total"] for row in summary["por_metodo_pago"]}
    assert methods == {"efectivo": 10.0, "tarjeta": 10.0}

    vendors = {row["vendedor_nombre"]: row["total"] for row in summary["por_vendedor"]}
    assert vendors == {"admin2": 10.0, "v3": 10.0}


async def test_summary_top_productos_ordered_by_quantity(client, db_session):
    admin = await _create_user(db_session, username="admin3")
    headers = _auth_headers(admin)
    popular = _make_product(db_session, name="Popular", price=5)
    rare = _make_product(db_session, name="Raro", price=5)
    await db_session.commit()
    await _open_session(client, headers)

    await _sell(client, headers, popular.id, cantidad=5, monto=25)
    await _sell(client, headers, rare.id, cantidad=1, monto=5)

    summary = (await client.get("/api/admin/sales/summary", headers=headers)).json()
    top = summary["top_productos"]
    assert top[0]["nombre"] == "Popular"
    assert top[0]["cantidad_vendida"] == 5
    assert top[1]["nombre"] == "Raro"


async def test_summary_reports_low_stock_regardless_of_date_range(client, db_session):
    admin = await _create_user(db_session, username="admin4")
    headers = _auth_headers(admin)
    _make_product(db_session, name="Con poco stock", stock=2)
    _make_product(db_session, name="Con stock de sobra", stock=100)
    await db_session.commit()

    summary = (await client.get("/api/admin/sales/summary", headers=headers)).json()
    names = {row["name"] for row in summary["stock_bajo"]}
    assert "Con poco stock" in names
    assert "Con stock de sobra" not in names


async def test_summary_date_range_excludes_older_sales(client, db_session):
    admin = await _create_user(db_session, username="admin5")
    headers = _auth_headers(admin)
    product = _make_product(db_session, price=10)
    await db_session.commit()
    await _open_session(client, headers)

    old_sale = await _sell(client, headers, product.id, cantidad=1, monto=10)
    # Backdates the sale outside any "last N days" query without going through
    # the API, which always stamps created_at as now().
    result = await db_session.execute(select(Sale).where(Sale.id == old_sale["id"]))
    sale_row = result.scalar_one()
    sale_row.created_at = datetime.now(timezone.utc) - timedelta(days=60)
    await db_session.commit()

    today = datetime.now(timezone.utc).date()
    recent = await client.get(
        "/api/admin/sales/summary",
        params={"desde": (today - timedelta(days=7)).isoformat(), "hasta": today.isoformat()},
        headers=headers,
    )
    assert recent.json()["cantidad_ventas"] == 0

    including_old = await client.get(
        "/api/admin/sales/summary",
        params={"desde": (today - timedelta(days=90)).isoformat(), "hasta": today.isoformat()},
        headers=headers,
    )
    assert including_old.json()["cantidad_ventas"] == 1


async def test_summary_breaks_down_by_day(client, db_session):
    admin = await _create_user(db_session, username="admin7")
    headers = _auth_headers(admin)
    product = _make_product(db_session, price=10)
    await db_session.commit()
    await _open_session(client, headers)

    # Two sales the same (backdated) day sum into one row; a third sale today
    # gets a row of its own.
    yesterday_sale_1 = await _sell(client, headers, product.id, cantidad=1, monto=10)
    yesterday_sale_2 = await _sell(client, headers, product.id, cantidad=1, monto=10)
    await _sell(client, headers, product.id, cantidad=1, monto=10)

    yesterday = datetime.now(timezone.utc) - timedelta(days=1)
    for sale_id in (yesterday_sale_1["id"], yesterday_sale_2["id"]):
        result = await db_session.execute(select(Sale).where(Sale.id == sale_id))
        result.scalar_one().created_at = yesterday
    await db_session.commit()

    today = datetime.now(timezone.utc).date()
    response = await client.get(
        "/api/admin/sales/summary",
        params={"desde": (today - timedelta(days=7)).isoformat(), "hasta": today.isoformat()},
        headers=headers,
    )
    por_dia = {row["fecha"]: row["total"] for row in response.json()["por_dia"]}
    assert por_dia == {yesterday.date().isoformat(): 20.0, today.isoformat(): 10.0}


async def test_list_sales_paginated_admin_only(client, db_session):
    admin = await _create_user(db_session, username="admin6")
    headers = _auth_headers(admin)
    product = _make_product(db_session, price=10, stock=50)
    await db_session.commit()
    await _open_session(client, headers)

    for _ in range(3):
        await _sell(client, headers, product.id, cantidad=1, monto=10)

    page1 = await client.get("/api/admin/sales", params={"page": 1, "page_size": 2}, headers=headers)
    assert page1.status_code == 200
    body1 = page1.json()
    assert body1["total"] == 3
    assert len(body1["items"]) == 2
    # Orden descendente por fecha de creación: la más nueva primero.
    assert body1["items"][0]["created_at"] >= body1["items"][1]["created_at"]

    page2 = await client.get("/api/admin/sales", params={"page": 2, "page_size": 2}, headers=headers)
    assert len(page2.json()["items"]) == 1
