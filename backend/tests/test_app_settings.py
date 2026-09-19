import io

from PIL import Image

from app.config import get_settings
from app.models.user import ROLE_VENDEDOR, User
from app.security.jwt import create_access_token
from app.security.passwords import hash_password
from app.services.storage import get_minio_client

ADMIN_PASSWORD = "Sup3rSecret!"


async def _create_admin(db_session, username="admin"):
    admin = User(username=username, password_hash=hash_password(ADMIN_PASSWORD))
    db_session.add(admin)
    await db_session.commit()
    await db_session.refresh(admin)
    return admin


async def _create_vendedor(db_session, username="vendedor"):
    vendedor = User(username=username, password_hash=hash_password(ADMIN_PASSWORD), role=ROLE_VENDEDOR)
    db_session.add(vendedor)
    await db_session.commit()
    await db_session.refresh(vendedor)
    return vendedor


def _auth_headers(user: User) -> dict[str, str]:
    return {"Authorization": f"Bearer {create_access_token(str(user.id))}"}


def _png_bytes(size=(64, 64), color=(200, 50, 50, 128)) -> bytes:
    buffer = io.BytesIO()
    Image.new("RGBA", size, color=color).save(buffer, format="PNG")
    return buffer.getvalue()


def _jpeg_bytes(size=(64, 64), color=(50, 100, 200)) -> bytes:
    buffer = io.BytesIO()
    Image.new("RGB", size, color=color).save(buffer, format="JPEG")
    return buffer.getvalue()


def _object_exists(object_key: str) -> bool:
    settings = get_settings()
    try:
        get_minio_client().stat_object(settings.minio_bucket, object_key)
        return True
    except Exception:
        return False


async def test_get_settings_is_public_and_starts_without_a_logo(client):
    response = await client.get("/api/settings")
    assert response.status_code == 200
    assert response.json() == {"logo_url": None, "company_name": None}


async def test_upload_logo_requires_admin(client, db_session):
    files = {"logo": ("logo.png", _png_bytes(), "image/png")}

    anonymous = await client.post("/api/admin/settings/logo", files=files)
    assert anonymous.status_code == 401

    vendedor = await _create_vendedor(db_session)
    as_vendedor = await client.post("/api/admin/settings/logo", files=files, headers=_auth_headers(vendedor))
    assert as_vendedor.status_code == 403


async def test_admin_uploads_a_logo_and_it_appears_in_public_settings(client, db_session):
    admin = await _create_admin(db_session)
    files = {"logo": ("logo.png", _png_bytes(), "image/png")}

    response = await client.post("/api/admin/settings/logo", files=files, headers=_auth_headers(admin))
    assert response.status_code == 200
    logo_url = response.json()["logo_url"]
    assert logo_url is not None

    public = await client.get("/api/settings")
    assert public.json()["logo_url"] == logo_url


async def test_uploading_a_new_logo_deletes_the_previous_object_from_storage(client, db_session):
    admin = await _create_admin(db_session)
    headers = _auth_headers(admin)

    first = await client.post(
        "/api/admin/settings/logo", files={"logo": ("first.png", _png_bytes(), "image/png")}, headers=headers
    )
    first_key = first.json()["logo_url"].rsplit("/", 1)[-1]
    assert _object_exists(f"branding/{first_key}")

    second = await client.post(
        "/api/admin/settings/logo", files={"logo": ("second.png", _png_bytes(), "image/png")}, headers=headers
    )
    assert second.json()["logo_url"] != first.json()["logo_url"]
    assert not _object_exists(f"branding/{first_key}")


async def test_uploaded_png_keeps_its_transparency(client, db_session):
    admin = await _create_admin(db_session)
    response = await client.post(
        "/api/admin/settings/logo",
        files={"logo": ("logo.png", _png_bytes(color=(10, 20, 30, 60)), "image/png")},
        headers=_auth_headers(admin),
    )
    object_key = response.json()["logo_url"].rsplit("/", 1)[-1]

    settings = get_settings()
    data = get_minio_client().get_object(settings.minio_bucket, f"branding/{object_key}").read()
    reopened = Image.open(io.BytesIO(data))
    assert reopened.mode == "RGBA"
    assert reopened.getpixel((0, 0))[3] < 255  # alpha channel survived, not flattened to opaque


async def test_a_non_image_file_is_rejected(client, db_session):
    admin = await _create_admin(db_session)
    response = await client.post(
        "/api/admin/settings/logo",
        files={"logo": ("not-a-photo.txt", b"hello world", "text/plain")},
        headers=_auth_headers(admin),
    )
    assert response.status_code == 400

    public = await client.get("/api/settings")
    assert public.json()["logo_url"] is None


async def test_svg_is_rejected(client, db_session):
    admin = await _create_admin(db_session)
    svg = b"<svg xmlns='http://www.w3.org/2000/svg'><script>alert(1)</script></svg>"
    response = await client.post(
        "/api/admin/settings/logo",
        files={"logo": ("logo.svg", svg, "image/svg+xml")},
        headers=_auth_headers(admin),
    )
    assert response.status_code == 400


async def test_delete_logo_reverts_to_no_logo_and_removes_the_object(client, db_session):
    admin = await _create_admin(db_session)
    headers = _auth_headers(admin)
    uploaded = await client.post(
        "/api/admin/settings/logo", files={"logo": ("logo.jpg", _jpeg_bytes(), "image/jpeg")}, headers=headers
    )
    object_key = uploaded.json()["logo_url"].rsplit("/", 1)[-1]
    assert _object_exists(f"branding/{object_key}")

    response = await client.delete("/api/admin/settings/logo", headers=headers)
    assert response.status_code == 200
    assert response.json() == {"logo_url": None, "company_name": None}
    assert not _object_exists(f"branding/{object_key}")

    public = await client.get("/api/settings")
    assert public.json()["logo_url"] is None


async def test_delete_logo_is_a_no_op_when_none_is_set(client, db_session):
    admin = await _create_admin(db_session)
    response = await client.delete("/api/admin/settings/logo", headers=_auth_headers(admin))
    assert response.status_code == 200
    assert response.json() == {"logo_url": None, "company_name": None}


async def test_delete_logo_requires_admin(client, db_session):
    vendedor = await _create_vendedor(db_session)
    response = await client.delete("/api/admin/settings/logo", headers=_auth_headers(vendedor))
    assert response.status_code == 403


async def test_admin_sets_company_name_and_it_appears_in_public_settings(client, db_session):
    admin = await _create_admin(db_session)
    response = await client.put(
        "/api/admin/settings/company-name", json={"company_name": "Bodega Don José"}, headers=_auth_headers(admin)
    )
    assert response.status_code == 200
    assert response.json()["company_name"] == "Bodega Don José"

    public = await client.get("/api/settings")
    assert public.json()["company_name"] == "Bodega Don José"


async def test_company_name_is_trimmed_and_blank_becomes_none(client, db_session):
    admin = await _create_admin(db_session)
    response = await client.put(
        "/api/admin/settings/company-name", json={"company_name": "  Bodega Don José  "}, headers=_auth_headers(admin)
    )
    assert response.json()["company_name"] == "Bodega Don José"

    cleared = await client.put(
        "/api/admin/settings/company-name", json={"company_name": "   "}, headers=_auth_headers(admin)
    )
    assert cleared.json()["company_name"] is None


async def test_update_company_name_requires_admin(client, db_session):
    anonymous = await client.put("/api/admin/settings/company-name", json={"company_name": "Nope"})
    assert anonymous.status_code == 401

    vendedor = await _create_vendedor(db_session)
    response = await client.put(
        "/api/admin/settings/company-name", json={"company_name": "Nope"}, headers=_auth_headers(vendedor)
    )
    assert response.status_code == 403
