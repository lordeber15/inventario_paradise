import asyncio
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
    defaults = dict(
        name="Producto",
        description="Descripción",
        price=10,
        stock=10,
        image_object_key="products/x.jpg",
    )
    defaults.update(overrides)
    product = Product(**defaults)
    db_session.add(product)
    return product


async def _open_session(client, headers, monto_inicial=100):
    response = await client.post("/api/cash-sessions", json={"monto_inicial": monto_inicial}, headers=headers)
    assert response.status_code == 201, response.text
    return response.json()


async def test_cannot_sell_without_an_open_cash_session(client, db_session):
    vendedor = await _create_user(db_session, role=ROLE_VENDEDOR, username="v1")
    product = _make_product(db_session, price=10, stock=5)
    await db_session.commit()

    response = await client.post(
        "/api/sales",
        json={"items": [{"product_id": str(product.id), "cantidad": 1}], "payments": [{"metodo": "efectivo", "monto": 10}]},
        headers=_auth_headers(vendedor),
    )

    assert response.status_code == 409
    assert "caja" in response.json()["detail"].lower()


async def test_cannot_open_two_cash_sessions_for_the_same_user(client, db_session):
    vendedor = await _create_user(db_session, role=ROLE_VENDEDOR, username="v2")
    headers = _auth_headers(vendedor)
    await _open_session(client, headers)

    response = await client.post("/api/cash-sessions", json={"monto_inicial": 50}, headers=headers)

    assert response.status_code == 409


async def test_full_sale_and_cash_session_close_happy_path(client, db_session):
    vendedor = await _create_user(db_session, role=ROLE_VENDEDOR, username="v3")
    headers = _auth_headers(vendedor)
    product = _make_product(db_session, price=Decimal("10.00"), stock=5)
    await db_session.commit()
    cash_session = await _open_session(client, headers, monto_inicial=100)

    response = await client.post(
        "/api/sales",
        json={
            "items": [{"product_id": str(product.id), "cantidad": 2}],
            "payments": [{"metodo": "efectivo", "monto": 20, "recibido": 50}],
        },
        headers=headers,
    )

    assert response.status_code == 201, response.text
    body = response.json()
    assert body["subtotal"] == 20.0
    assert body["total"] == 20.0
    assert body["estado"] == "completada"
    assert body["serie"] == "B001"
    assert body["correlativo"] == 1
    # base = 20 / 1.18 = 16.95 (redondeado), igv = total - base = 3.05
    assert body["igv"] == 3.05

    await db_session.refresh(product)
    assert product.stock == 3

    close_response = await client.post(
        f"/api/cash-sessions/{cash_session['id']}/close",
        json={"contado_efectivo": 120, "notas": "cuadra"},
        headers=headers,
    )
    assert close_response.status_code == 200
    closed = close_response.json()
    # esperado = 100 (inicial) + 20 (efectivo vendido) = 120; contado 120 -> diferencia 0
    assert closed["diferencia"] == 0.0
    assert closed["cerrada_en"] is not None


async def test_insufficient_stock_leaves_no_trace(client, db_session):
    vendedor = await _create_user(db_session, role=ROLE_VENDEDOR, username="v4")
    headers = _auth_headers(vendedor)
    product = _make_product(db_session, price=10, stock=1)
    await db_session.commit()
    await _open_session(client, headers)

    response = await client.post(
        "/api/sales",
        json={"items": [{"product_id": str(product.id), "cantidad": 5}], "payments": [{"metodo": "efectivo", "monto": 50}]},
        headers=headers,
    )

    assert response.status_code == 409

    await db_session.refresh(product)
    assert product.stock == 1

    sales = (await db_session.execute(select(Sale))).scalars().all()
    assert sales == []


async def test_idempotency_key_does_not_duplicate_the_sale(client, db_session):
    vendedor = await _create_user(db_session, role=ROLE_VENDEDOR, username="v5")
    headers = _auth_headers(vendedor)
    product = _make_product(db_session, price=10, stock=10)
    await db_session.commit()
    await _open_session(client, headers)

    payload = {
        "items": [{"product_id": str(product.id), "cantidad": 1}],
        "payments": [{"metodo": "efectivo", "monto": 10}],
        "idempotency_key": "retry-key-123",
    }

    first = await client.post("/api/sales", json=payload, headers=headers)
    second = await client.post("/api/sales", json=payload, headers=headers)

    assert first.status_code == 201
    assert second.status_code == 201
    assert first.json()["id"] == second.json()["id"]

    await db_session.refresh(product)
    assert product.stock == 9  # decremented only once

    sales = (await db_session.execute(select(Sale))).scalars().all()
    assert len(sales) == 1


async def test_price_snapshot_is_unaffected_by_a_later_product_edit(client, db_session):
    admin = await _create_user(db_session, role="admin", username="a1")
    headers = _auth_headers(admin)
    product = _make_product(db_session, price=Decimal("10.00"), stock=10)
    await db_session.commit()
    await _open_session(client, headers)

    sale_response = await client.post(
        "/api/sales",
        json={"items": [{"product_id": str(product.id), "cantidad": 1}], "payments": [{"metodo": "efectivo", "monto": 10}]},
        headers=headers,
    )
    assert sale_response.status_code == 201
    sale_id = sale_response.json()["id"]

    product.price = Decimal("20.00")
    await db_session.commit()

    fetched = await client.get(f"/api/sales/{sale_id}", headers=headers)
    assert fetched.status_code == 200
    assert fetched.json()["items"][0]["unit_price"] == 10.0


async def test_mixed_payment_must_sum_exactly_to_the_total(client, db_session):
    vendedor = await _create_user(db_session, role=ROLE_VENDEDOR, username="v6")
    headers = _auth_headers(vendedor)
    product = _make_product(db_session, price=Decimal("10.00"), stock=10)
    await db_session.commit()
    await _open_session(client, headers)

    mismatched = await client.post(
        "/api/sales",
        json={
            "items": [{"product_id": str(product.id), "cantidad": 1}],
            "payments": [{"metodo": "efectivo", "monto": 5}, {"metodo": "tarjeta", "monto": 4}],
        },
        headers=headers,
    )
    assert mismatched.status_code == 400

    exact = await client.post(
        "/api/sales",
        json={
            "items": [{"product_id": str(product.id), "cantidad": 1}],
            "payments": [{"metodo": "efectivo", "monto": 4}, {"metodo": "tarjeta", "monto": 6}],
        },
        headers=headers,
    )
    assert exact.status_code == 201
    assert len(exact.json()["payments"]) == 2


async def test_vendedor_discount_over_cap_is_rejected_admin_has_no_cap(client, db_session):
    vendedor = await _create_user(db_session, role=ROLE_VENDEDOR, username="v7")
    admin = await _create_user(db_session, role="admin", username="a2")
    product_v = _make_product(db_session, price=Decimal("100.00"), stock=10)
    product_a = _make_product(db_session, price=Decimal("100.00"), stock=10)
    await db_session.commit()

    v_headers = _auth_headers(vendedor)
    await _open_session(client, v_headers)
    over_cap = await client.post(
        "/api/sales",
        json={
            "items": [{"product_id": str(product_v.id), "cantidad": 1}],
            "payments": [{"metodo": "efectivo", "monto": 80}],
            "descuento_monto": 20,  # 20% > 10% cap
            "descuento_motivo": "promo",
        },
        headers=v_headers,
    )
    assert over_cap.status_code == 403

    a_headers = _auth_headers(admin)
    await _open_session(client, a_headers)
    admin_over_cap = await client.post(
        "/api/sales",
        json={
            "items": [{"product_id": str(product_a.id), "cantidad": 1}],
            "payments": [{"metodo": "efectivo", "monto": 50}],
            "descuento_monto": 50,  # 50% — fine for admin
            "descuento_motivo": "cortesía",
        },
        headers=a_headers,
    )
    assert admin_over_cap.status_code == 201


async def test_discount_without_a_motivo_is_rejected(client, db_session):
    vendedor = await _create_user(db_session, role=ROLE_VENDEDOR, username="v8")
    headers = _auth_headers(vendedor)
    product = _make_product(db_session, price=Decimal("100.00"), stock=10)
    await db_session.commit()
    await _open_session(client, headers)

    response = await client.post(
        "/api/sales",
        json={
            "items": [{"product_id": str(product.id), "cantidad": 1}],
            "payments": [{"metodo": "efectivo", "monto": 95}],
            "descuento_monto": 5,
        },
        headers=headers,
    )
    assert response.status_code == 400


async def test_void_sale_restores_stock_and_is_admin_only(client, db_session):
    vendedor = await _create_user(db_session, role=ROLE_VENDEDOR, username="v9")
    admin = await _create_user(db_session, role="admin", username="a3")
    v_headers = _auth_headers(vendedor)
    product = _make_product(db_session, price=Decimal("10.00"), stock=10)
    await db_session.commit()
    await _open_session(client, v_headers)

    sale_response = await client.post(
        "/api/sales",
        json={"items": [{"product_id": str(product.id), "cantidad": 3}], "payments": [{"metodo": "efectivo", "monto": 30}]},
        headers=v_headers,
    )
    sale_id = sale_response.json()["id"]
    await db_session.refresh(product)
    assert product.stock == 7

    forbidden = await client.post(f"/api/sales/{sale_id}/void", json={"motivo": "error"}, headers=v_headers)
    assert forbidden.status_code == 403

    a_headers = _auth_headers(admin)
    voided = await client.post(f"/api/sales/{sale_id}/void", json={"motivo": "cliente se arrepintió"}, headers=a_headers)
    assert voided.status_code == 200
    assert voided.json()["estado"] == "anulada"

    await db_session.refresh(product)
    assert product.stock == 10

    already_voided = await client.post(f"/api/sales/{sale_id}/void", json={"motivo": "otra vez"}, headers=a_headers)
    assert already_voided.status_code == 409


async def test_client_data_required_above_threshold(client, db_session):
    vendedor = await _create_user(db_session, role=ROLE_VENDEDOR, username="v10")
    headers = _auth_headers(vendedor)
    product = _make_product(db_session, price=Decimal("800.00"), stock=10)
    await db_session.commit()
    await _open_session(client, headers)

    without_client = await client.post(
        "/api/sales",
        json={"items": [{"product_id": str(product.id), "cantidad": 1}], "payments": [{"metodo": "efectivo", "monto": 800}]},
        headers=headers,
    )
    assert without_client.status_code == 400

    with_client = await client.post(
        "/api/sales",
        json={
            "items": [{"product_id": str(product.id), "cantidad": 1}],
            "payments": [{"metodo": "efectivo", "monto": 800}],
            "cliente_nombre": "Cliente de Prueba",
        },
        headers=headers,
    )
    assert with_client.status_code == 201


async def test_correlativos_have_no_duplicates_under_real_concurrency(client, db_session):
    """Two different sellers, each with their own open register, checking out
    at the same time must never land on the same correlativo — the guarantee
    SUNAT actually cares about. Uses two real concurrent HTTP requests
    (asyncio.gather) against the running app, each getting its own DB
    connection, so this exercises the SELECT ... FOR UPDATE lock for real
    rather than asserting it by reading the code."""
    seller_a = await _create_user(db_session, role=ROLE_VENDEDOR, username="conc-a")
    seller_b = await _create_user(db_session, role=ROLE_VENDEDOR, username="conc-b")
    product_a = _make_product(db_session, price=10, stock=10)
    product_b = _make_product(db_session, price=10, stock=10)
    await db_session.commit()

    headers_a = _auth_headers(seller_a)
    headers_b = _auth_headers(seller_b)
    await _open_session(client, headers_a)
    await _open_session(client, headers_b)

    payload_a = {"items": [{"product_id": str(product_a.id), "cantidad": 1}], "payments": [{"metodo": "efectivo", "monto": 10}]}
    payload_b = {"items": [{"product_id": str(product_b.id), "cantidad": 1}], "payments": [{"metodo": "efectivo", "monto": 10}]}

    response_a, response_b = await asyncio.gather(
        client.post("/api/sales", json=payload_a, headers=headers_a),
        client.post("/api/sales", json=payload_b, headers=headers_b),
    )

    assert response_a.status_code == 201, response_a.text
    assert response_b.status_code == 201, response_b.text
    correlativos = {response_a.json()["correlativo"], response_b.json()["correlativo"]}
    assert correlativos == {1, 2}


async def test_anonymous_cannot_sell_or_open_a_cash_session(client, db_session):
    product = _make_product(db_session, price=10, stock=10)
    await db_session.commit()

    sale_response = await client.post(
        "/api/sales",
        json={"items": [{"product_id": str(product.id), "cantidad": 1}], "payments": [{"metodo": "efectivo", "monto": 10}]},
    )
    assert sale_response.status_code == 401

    session_response = await client.post("/api/cash-sessions", json={"monto_inicial": 50})
    assert session_response.status_code == 401
