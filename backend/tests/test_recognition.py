import io
from pathlib import Path

from PIL import Image

from app.models.user import ROLE_VENDEDOR, User
from app.security.jwt import create_access_token
from app.security.passwords import hash_password

ADMIN_PASSWORD = "Sup3rSecret!"
FIXTURES_DIR = Path(__file__).parent / "fixtures"


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
    return {"Authorization": f"Bearer {create_access_token(str(user.id), user.role)}"}


def _solid_color_jpeg(color=(200, 50, 50), size=(64, 64)) -> bytes:
    buffer = io.BytesIO()
    Image.new("RGB", size, color=color).save(buffer, format="JPEG")
    return buffer.getvalue()


def _barcode_photo_bytes() -> bytes:
    return (FIXTURES_DIR / "barcode_sample.jpg").read_bytes()


async def _register_product(client, headers, *, colors, **fields):
    """`colors` is a list: one photo is uploaded per color."""
    form = {"name": "Producto", "description": "Descripción", "price": "10.00", "stock": "5"}
    form.update(fields)
    files = [
        ("images", (f"p{i}.jpg", _solid_color_jpeg(color), "image/jpeg")) for i, color in enumerate(colors)
    ]
    response = await client.post("/api/admin/products", data=form, files=files, headers=headers)
    assert response.status_code == 201, response.text
    return response.json()


async def test_scan_works_without_auth(client):
    """The Fase D scope: /api/recognition/scan is public — no session required,
    unlike the admin-only management endpoints."""
    response = await client.post("/api/recognition/scan", files={"image": ("p.jpg", _solid_color_jpeg(), "image/jpeg")})

    assert response.status_code == 200
    assert response.json()["match_type"] == "not_found"


async def test_scan_anonymous_hides_product_name(client, db_session):
    admin = await _create_admin(db_session)
    headers = _auth_headers(admin)
    await _register_product(client, headers, colors=[(10, 10, 10)], barcode="7501234567890", name="Con barcode")

    response = await client.post(
        "/api/recognition/scan",
        files={"image": ("scan.jpg", _barcode_photo_bytes(), "image/jpeg")},
    )

    assert response.status_code == 200
    body = response.json()
    assert body["match_type"] == "barcode"
    assert body["name"] is None
    assert body["description"] == "Descripción"
    assert body["price"] == 10.0


async def test_scan_vendedor_sees_product_name(client, db_session):
    admin = await _create_admin(db_session)
    await _register_product(client, _auth_headers(admin), colors=[(10, 10, 10)], barcode="7501234567890", name="Con barcode")
    vendedor = await _create_vendedor(db_session)

    response = await client.post(
        "/api/recognition/scan",
        files={"image": ("scan.jpg", _barcode_photo_bytes(), "image/jpeg")},
        headers=_auth_headers(vendedor),
    )

    assert response.status_code == 200
    assert response.json()["name"] == "Con barcode"


async def test_scan_matches_registered_barcode(client, db_session):
    admin = await _create_admin(db_session)
    headers = _auth_headers(admin)
    await _register_product(client, headers, colors=[(10, 10, 10)], barcode="7501234567890", name="Con barcode")

    response = await client.post(
        "/api/recognition/scan",
        files={"image": ("scan.jpg", _barcode_photo_bytes(), "image/jpeg")},
        headers=headers,
    )

    assert response.status_code == 200
    body = response.json()
    assert body["match_type"] == "barcode"
    assert body["name"] == "Con barcode"
    assert body["confidence"] is None


async def test_scan_barcode_not_registered_does_not_fall_back_to_similarity(client, db_session):
    admin = await _create_admin(db_session)
    headers = _auth_headers(admin)
    # Registers a very similarly-colored product on purpose: a barcode read
    # must short-circuit and never fall back to the similarity search.
    await _register_product(client, headers, colors=[(250, 250, 250)], name="Blanco parecido")

    response = await client.post(
        "/api/recognition/scan",
        files={"image": ("scan.jpg", _barcode_photo_bytes(), "image/jpeg")},
        headers=headers,
    )

    assert response.status_code == 200
    assert response.json()["match_type"] == "not_found"


async def test_scan_matches_by_similarity_above_threshold(client, db_session):
    admin = await _create_admin(db_session)
    headers = _auth_headers(admin)
    await _register_product(client, headers, colors=[(220, 30, 30)], name="Rojo")

    response = await client.post(
        "/api/recognition/scan",
        files={"image": ("scan.jpg", _solid_color_jpeg((225, 25, 35)), "image/jpeg")},
        headers=headers,
    )

    assert response.status_code == 200
    body = response.json()
    assert body["match_type"] == "similarity"
    assert body["name"] == "Rojo"
    assert body["confidence"] > 0.9
    assert body["matched_images"] == 1
    assert body["total_images"] == 1


async def test_scan_matches_a_secondary_angle_not_used_as_cover(client, db_session):
    """The false negative this feature fixes: a product registered with a photo
    of one angle (the cover) plus a second angle should still be recognized
    when the scanned photo resembles the *second* angle instead of the cover."""
    admin = await _create_admin(db_session)
    headers = _auth_headers(admin)
    cover_color = (10, 10, 10)
    second_angle_color = (220, 30, 30)
    await _register_product(client, headers, colors=[cover_color, second_angle_color], name="Dos ángulos")

    response = await client.post(
        "/api/recognition/scan",
        files={"image": ("scan.jpg", _solid_color_jpeg((225, 25, 35)), "image/jpeg")},
        headers=headers,
    )

    assert response.status_code == 200
    body = response.json()
    assert body["match_type"] == "similarity"
    assert body["name"] == "Dos ángulos"
    assert body["total_images"] == 2


async def test_scan_reports_not_found_when_nothing_similar_enough(client, db_session):
    admin = await _create_admin(db_session)
    headers = _auth_headers(admin)
    await _register_product(client, headers, colors=[(10, 10, 200)], name="Azul")

    response = await client.post(
        "/api/recognition/scan",
        files={"image": ("scan.jpg", _solid_color_jpeg((230, 200, 10)), "image/jpeg")},
        headers=headers,
    )

    assert response.status_code == 200
    assert response.json()["match_type"] == "not_found"


async def test_scan_reports_ambiguous_when_two_products_are_nearly_identical(client, db_session):
    admin = await _create_admin(db_session)
    headers = _auth_headers(admin)
    await _register_product(client, headers, colors=[(200, 60, 60)], name="Producto A")
    await _register_product(client, headers, colors=[(201, 61, 61)], name="Producto B")

    response = await client.post(
        "/api/recognition/scan",
        files={"image": ("scan.jpg", _solid_color_jpeg((200, 60, 60)), "image/jpeg")},
        headers=headers,
    )

    assert response.status_code == 200
    assert response.json()["match_type"] == "not_found"


async def test_scan_reports_not_found_on_empty_catalog(client, db_session):
    admin = await _create_admin(db_session)

    response = await client.post(
        "/api/recognition/scan",
        files={"image": ("scan.jpg", _solid_color_jpeg(), "image/jpeg")},
        headers=_auth_headers(admin),
    )

    assert response.status_code == 200
    assert response.json()["match_type"] == "not_found"


async def test_scan_anonymous_rate_limit_is_tighter_than_authenticated(client):
    """Anonymous traffic gets the tightest tier (10/min, see security/rate_limit.py)."""
    for _ in range(10):
        response = await client.post(
            "/api/recognition/scan",
            files={"image": ("scan.jpg", _barcode_photo_bytes(), "image/jpeg")},
        )
        assert response.status_code == 200

    response = await client.post(
        "/api/recognition/scan",
        files={"image": ("scan.jpg", _barcode_photo_bytes(), "image/jpeg")},
    )
    assert response.status_code == 429


async def test_scan_admin_rate_limit_is_higher_than_anonymous(client, db_session):
    """A logged-in admin's token carries a role claim that raises the tier well
    past the 10/min anonymous cap that would otherwise kick in (see the
    previous test) — proves the dynamic per-role limit is actually engaging,
    not silently falling back to the anonymous tier for everyone."""
    admin = await _create_admin(db_session)
    headers = _auth_headers(admin)

    for _ in range(15):
        response = await client.post(
            "/api/recognition/scan",
            files={"image": ("scan.jpg", _barcode_photo_bytes(), "image/jpeg")},
            headers=headers,
        )
        assert response.status_code == 200
