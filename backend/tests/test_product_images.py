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


async def _create_product(client, headers, *, photo_count=1):
    form = {"name": "Producto", "description": "Descripción", "price": "10.00", "stock": "5"}
    response = await client.post(
        "/api/admin/products",
        data=form,
        files=_image_files(*[f"p{i}.jpg" for i in range(photo_count)]),
        headers=headers,
    )
    assert response.status_code == 201, response.text
    return response.json()


async def test_add_images_requires_admin(client, db_session):
    admin = await _create_admin(db_session)
    product = await _create_product(client, _auth_headers(admin))

    response = await client.post(f"/api/admin/products/{product['id']}/images", files=_image_files())

    assert response.status_code == 401


async def test_add_images_appends_without_replacing(client, db_session):
    admin = await _create_admin(db_session)
    headers = _auth_headers(admin)
    product = await _create_product(client, headers)

    response = await client.post(
        f"/api/admin/products/{product['id']}/images", files=_image_files("extra1.jpg", "extra2.jpg"), headers=headers
    )

    assert response.status_code == 201
    body = response.json()
    assert body["image_count"] == 3
    assert sum(1 for img in body["images"] if img["is_primary"]) == 1


async def test_add_images_rejects_exceeding_max(client, db_session):
    admin = await _create_admin(db_session)
    headers = _auth_headers(admin)
    product = await _create_product(client, headers, photo_count=5)

    response = await client.post(
        f"/api/admin/products/{product['id']}/images", files=_image_files("one-too-many.jpg", "and-another.jpg"), headers=headers
    )

    assert response.status_code == 409
    # Nothing was added on the rejected request.
    unchanged = await client.get(f"/api/admin/products/{product['id']}", headers=headers)
    assert unchanged.json()["image_count"] == 5


async def test_delete_image_removes_it(client, db_session):
    admin = await _create_admin(db_session)
    headers = _auth_headers(admin)
    product = await _create_product(client, headers, photo_count=2)
    image_id = next(img["id"] for img in product["images"] if not img["is_primary"])

    response = await client.delete(f"/api/admin/products/{product['id']}/images/{image_id}", headers=headers)

    assert response.status_code == 200
    assert response.json()["image_count"] == 1


async def test_delete_last_image_is_rejected(client, db_session):
    admin = await _create_admin(db_session)
    headers = _auth_headers(admin)
    product = await _create_product(client, headers, photo_count=1)
    image_id = product["images"][0]["id"]

    response = await client.delete(f"/api/admin/products/{product['id']}/images/{image_id}", headers=headers)

    assert response.status_code == 400


async def test_deleting_primary_image_promotes_another(client, db_session):
    admin = await _create_admin(db_session)
    headers = _auth_headers(admin)
    product = await _create_product(client, headers, photo_count=2)
    primary_id = next(img["id"] for img in product["images"] if img["is_primary"])
    other = next(img for img in product["images"] if not img["is_primary"])

    response = await client.delete(f"/api/admin/products/{product['id']}/images/{primary_id}", headers=headers)

    assert response.status_code == 200
    body = response.json()
    assert body["images"][0]["is_primary"] is True
    assert body["images"][0]["id"] == other["id"]
    # The denormalized cover pointer follows the new primary photo.
    assert body["image_url"] == other["image_url"]


async def test_set_primary_image_updates_cover(client, db_session):
    admin = await _create_admin(db_session)
    headers = _auth_headers(admin)
    product = await _create_product(client, headers, photo_count=2)
    other = next(img for img in product["images"] if not img["is_primary"])

    response = await client.post(f"/api/admin/products/{product['id']}/images/{other['id']}/primary", headers=headers)

    assert response.status_code == 200
    body = response.json()
    assert next(img for img in body["images"] if img["id"] == other["id"])["is_primary"] is True
    assert sum(1 for img in body["images"] if img["is_primary"]) == 1
    assert body["image_url"] == other["image_url"]


async def test_set_primary_image_requires_admin(client, db_session):
    admin = await _create_admin(db_session)
    headers = _auth_headers(admin)
    product = await _create_product(client, headers, photo_count=2)
    other = next(img for img in product["images"] if not img["is_primary"])

    response = await client.post(f"/api/admin/products/{product['id']}/images/{other['id']}/primary")

    assert response.status_code == 401


async def test_delete_nonexistent_image_returns_404(client, db_session):
    admin = await _create_admin(db_session)
    headers = _auth_headers(admin)
    product = await _create_product(client, headers, photo_count=2)

    response = await client.delete(
        f"/api/admin/products/{product['id']}/images/00000000-0000-0000-0000-000000000000", headers=headers
    )

    assert response.status_code == 404
