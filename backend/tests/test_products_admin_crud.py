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


def _fake_image_bytes(color=(200, 50, 50), size=(64, 64)) -> bytes:
    buffer = io.BytesIO()
    Image.new("RGB", size, color=color).save(buffer, format="JPEG")
    return buffer.getvalue()


def _image_files(*names: str):
    names = names or ("product.jpg",)
    return [("images", (name, _fake_image_bytes(color=(200 + i, 50, 50)), "image/jpeg")) for i, name in enumerate(names)]


def _product_form(**overrides):
    form = {"name": "Coca-Cola 600ml", "description": "Botella de 600ml", "price": "25.50", "stock": "10"}
    form.update(overrides)
    return form


async def test_create_product_requires_admin(client):
    response = await client.post("/api/admin/products", data=_product_form(), files=_image_files())
    assert response.status_code == 401


async def test_create_product_success(client, db_session):
    admin = await _create_admin(db_session)

    response = await client.post(
        "/api/admin/products",
        data=_product_form(barcode="7501234567890"),
        files=_image_files(),
        headers=_auth_headers(admin),
    )

    assert response.status_code == 201
    body = response.json()
    assert body["name"] == "Coca-Cola 600ml"
    assert body["price"] == 25.5
    assert body["stock"] == 10
    assert body["barcode"] == "7501234567890"
    assert body["is_active"] is True
    assert body["image_url"].startswith("/media/")
    assert body["thumbnail_url"].startswith("/media/")
    assert body["image_count"] == 1
    assert body["images"][0]["is_primary"] is True


async def test_create_product_with_category(client, db_session):
    admin = await _create_admin(db_session)

    response = await client.post(
        "/api/admin/products",
        data=_product_form(category="Bebidas"),
        files=_image_files(),
        headers=_auth_headers(admin),
    )

    assert response.status_code == 201
    assert response.json()["category"] == "Bebidas"


async def test_create_product_without_category_is_null(client, db_session):
    admin = await _create_admin(db_session)

    response = await client.post(
        "/api/admin/products", data=_product_form(), files=_image_files(), headers=_auth_headers(admin)
    )

    assert response.status_code == 201
    assert response.json()["category"] is None


async def test_create_product_accepts_multiple_photos(client, db_session):
    admin = await _create_admin(db_session)

    response = await client.post(
        "/api/admin/products",
        data=_product_form(),
        files=_image_files("front.jpg", "back.jpg", "side.jpg"),
        headers=_auth_headers(admin),
    )

    assert response.status_code == 201
    body = response.json()
    assert body["image_count"] == 3
    assert sum(1 for img in body["images"] if img["is_primary"]) == 1
    # First photo uploaded becomes the cover.
    assert body["images"][0]["is_primary"] is True


async def test_create_product_rejects_more_than_max_images(client, db_session):
    admin = await _create_admin(db_session)

    response = await client.post(
        "/api/admin/products",
        data=_product_form(),
        files=_image_files(*[f"photo-{i}.jpg" for i in range(7)]),
        headers=_auth_headers(admin),
    )

    assert response.status_code == 409


async def test_create_product_rejects_invalid_image(client, db_session):
    admin = await _create_admin(db_session)

    response = await client.post(
        "/api/admin/products",
        data=_product_form(),
        files=[("images", ("not-an-image.jpg", b"this is not a jpeg", "image/jpeg"))],
        headers=_auth_headers(admin),
    )

    assert response.status_code == 400


async def test_create_product_rejects_duplicate_active_barcode(client, db_session):
    admin = await _create_admin(db_session)
    headers = _auth_headers(admin)

    first = await client.post(
        "/api/admin/products", data=_product_form(barcode="111"), files=_image_files(), headers=headers
    )
    assert first.status_code == 201

    second = await client.post(
        "/api/admin/products",
        data=_product_form(name="Otro producto", barcode="111"),
        files=_image_files(),
        headers=headers,
    )

    assert second.status_code == 409


async def test_list_products_excludes_inactive_by_default(client, db_session):
    admin = await _create_admin(db_session)
    headers = _auth_headers(admin)

    created = await client.post("/api/admin/products", data=_product_form(), files=_image_files(), headers=headers)
    product_id = created.json()["id"]
    await client.delete(f"/api/admin/products/{product_id}", headers=headers)

    active_only = await client.get("/api/admin/products", headers=headers)
    assert active_only.status_code == 200
    assert all(p["id"] != product_id for p in active_only.json())

    with_inactive = await client.get("/api/admin/products", params={"include_inactive": True}, headers=headers)
    assert any(p["id"] == product_id and p["is_active"] is False for p in with_inactive.json())


async def test_update_product_fields_only(client, db_session):
    admin = await _create_admin(db_session)
    headers = _auth_headers(admin)

    created = await client.post("/api/admin/products", data=_product_form(), files=_image_files(), headers=headers)
    product = created.json()

    updated = await client.put(f"/api/admin/products/{product['id']}", data={"stock": "3"}, headers=headers)

    assert updated.status_code == 200
    body = updated.json()
    assert body["stock"] == 3
    assert body["name"] == product["name"]
    # PUT no longer touches photos — they're managed via the /images endpoints.
    assert body["image_url"] == product["image_url"]
    assert body["image_count"] == product["image_count"]


async def test_update_product_category(client, db_session):
    admin = await _create_admin(db_session)
    headers = _auth_headers(admin)

    created = await client.post("/api/admin/products", data=_product_form(), files=_image_files(), headers=headers)
    product = created.json()
    assert product["category"] is None

    updated = await client.put(
        f"/api/admin/products/{product['id']}", data={"category": "Bebidas"}, headers=headers
    )

    assert updated.status_code == 200
    assert updated.json()["category"] == "Bebidas"


async def test_delete_product_is_soft_delete_not_physical(client, db_session):
    admin = await _create_admin(db_session)
    headers = _auth_headers(admin)

    created = await client.post("/api/admin/products", data=_product_form(), files=_image_files(), headers=headers)
    product_id = created.json()["id"]

    delete_response = await client.delete(f"/api/admin/products/{product_id}", headers=headers)
    assert delete_response.status_code == 204

    detail = await client.get(f"/api/admin/products/{product_id}", headers=headers)
    assert detail.status_code == 200
    assert detail.json()["is_active"] is False
    assert detail.json()["deleted_at"] is not None


async def test_restore_reactivates_a_soft_deleted_product(client, db_session):
    admin = await _create_admin(db_session)
    headers = _auth_headers(admin)

    created = await client.post("/api/admin/products", data=_product_form(), files=_image_files(), headers=headers)
    product_id = created.json()["id"]
    await client.delete(f"/api/admin/products/{product_id}", headers=headers)

    restored = await client.post(f"/api/admin/products/{product_id}/restore", headers=headers)

    assert restored.status_code == 200
    assert restored.json()["is_active"] is True
    assert restored.json()["deleted_at"] is None


async def test_get_nonexistent_product_returns_404(client, db_session):
    admin = await _create_admin(db_session)

    response = await client.get(
        "/api/admin/products/00000000-0000-0000-0000-000000000000", headers=_auth_headers(admin)
    )

    assert response.status_code == 404
