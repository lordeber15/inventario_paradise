import io

from PIL import Image

from app.models.user import User
from app.security.jwt import create_access_token
from app.security.passwords import hash_password

ADMIN_PASSWORD = "Sup3rSecret!"


async def _create_admin(db_session, username="admin"):
    admin = User(username=username, password_hash=hash_password(ADMIN_PASSWORD))
    db_session.add(admin)
    await db_session.commit()
    await db_session.refresh(admin)
    return admin


def _auth_headers(admin: User) -> dict[str, str]:
    return {"Authorization": f"Bearer {create_access_token(str(admin.id))}"}


def _image_files(name="product.jpg"):
    buffer = io.BytesIO()
    Image.new("RGB", (64, 64), color=(10, 200, 10)).save(buffer, format="JPEG")
    return [("images", (name, buffer.getvalue(), "image/jpeg"))]


async def _create_product(client, admin, **overrides):
    form = {"name": "Producto", "description": "Una descripcion", "price": "12.50", "stock": "7"}
    form.update(overrides)
    response = await client.post(
        "/api/admin/products", data=form, files=_image_files(), headers=_auth_headers(admin)
    )
    assert response.status_code == 201
    return response.json()


async def test_public_listing_exposes_name_and_price_but_never_barcode(client, db_session):
    admin = await _create_admin(db_session)
    await _create_product(client, admin, name="Con nombre", barcode="123456")

    response = await client.get("/api/products")

    assert response.status_code == 200
    body = response.json()
    assert len(body) == 1
    # Asserting the exact key set (not just "barcode not in body") is the point:
    # it fails loudly if a new Product column ever leaks into the public schema.
    assert set(body[0].keys()) == {
        "id",
        "name",
        "description",
        "category",
        "stock",
        "price",
        "thumbnail_url",
        "image_url",
        "images",
        "created_at",
    }
    # The name used to be null for an anonymous caller (see docs/PLAN-POS.md
    # §11's open question) — it's now the catalog's title for everyone, same
    # as an authenticated vendedor/admin always saw.
    assert body[0]["name"] == "Con nombre"
    assert body[0]["stock"] == 7
    assert body[0]["price"] == 12.50
    # Relativa, no absoluta: es lo que permite abrir el catálogo desde otro
    # dispositivo de la red (una URL con "localhost" apuntaría al celular).
    assert body[0]["image_url"].startswith("/media/")
    assert body[0]["images"][0]["image_url"].startswith("/media/")


async def test_search_matches_name_and_description(client, db_session):
    admin = await _create_admin(db_session)
    await _create_product(client, admin, name="Vela aromática", description="Aroma a lavanda")
    await _create_product(client, admin, name="Jabón artesanal", description="Con avena")

    by_name = await client.get("/api/products", params={"q": "vela"})
    assert [p["description"] for p in by_name.json()] == ["Aroma a lavanda"]

    by_description = await client.get("/api/products", params={"q": "avena"})
    assert [p["description"] for p in by_description.json()] == ["Con avena"]


async def test_search_ignores_accents_in_both_directions(client, db_session):
    admin = await _create_admin(db_session)
    await _create_product(client, admin, name="Vela aromática", description="Aroma a lavanda")
    await _create_product(client, admin, name="Jabón artesanal", description="Con avena")

    # Nobody types the accent at the counter, and the stored name keeps it.
    unaccented_query = await client.get("/api/products", params={"q": "jabon"})
    assert [p["description"] for p in unaccented_query.json()] == ["Con avena"]

    # And the reverse: typing the accent still finds a product loaded without
    # one, so neither side has to be "the right way" to write it.
    await _create_product(client, admin, name="Cafe molido", description="Tueste medio")
    accented_query = await client.get("/api/products", params={"q": "café"})
    assert [p["description"] for p in accented_query.json()] == ["Tueste medio"]

    # ñ folds to n as well, which is what a Spanish search expects.
    await _create_product(client, admin, name="Muñeca de trapo", description="Hecha a mano")
    assert [p["description"] for p in (await client.get("/api/products", params={"q": "muneca"})).json()] == [
        "Hecha a mano"
    ]


async def test_public_listing_excludes_soft_deleted_products(client, db_session):
    admin = await _create_admin(db_session)
    headers = _auth_headers(admin)
    product = await _create_product(client, admin)

    await client.delete(f"/api/admin/products/{product['id']}", headers=headers)

    response = await client.get("/api/products")

    assert response.status_code == 200
    assert all(p["id"] != product["id"] for p in response.json())


async def test_public_listing_does_not_require_auth(client, db_session):
    admin = await _create_admin(db_session)
    await _create_product(client, admin)

    response = await client.get("/api/products")

    assert response.status_code == 200
    assert len(response.json()) == 1
