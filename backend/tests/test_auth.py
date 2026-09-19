from app.models.user import User
from app.security.jwt import decode_token
from app.security.passwords import hash_password

ADMIN_PASSWORD = "Sup3rSecret!"


async def _create_admin(db_session, username="admin", password=ADMIN_PASSWORD, is_active=True):
    admin = User(username=username, password_hash=hash_password(password), is_active=is_active)
    db_session.add(admin)
    await db_session.commit()
    return admin


async def test_login_success_returns_access_token_and_sets_refresh_cookie(client, db_session):
    await _create_admin(db_session)

    response = await client.post("/api/auth/login", json={"username": "admin", "password": ADMIN_PASSWORD})

    assert response.status_code == 200
    body = response.json()
    assert body["token_type"] == "bearer"
    assert body["access_token"]
    assert response.cookies.get("refresh_token") is not None


async def test_login_wrong_password_rejected(client, db_session):
    await _create_admin(db_session)

    response = await client.post("/api/auth/login", json={"username": "admin", "password": "wrong-password"})

    assert response.status_code == 401
    assert response.json()["detail"] == "Credenciales inválidas"


async def test_login_unknown_user_uses_same_generic_message(client):
    response = await client.post("/api/auth/login", json={"username": "ghost", "password": "whatever"})

    assert response.status_code == 401
    assert response.json()["detail"] == "Credenciales inválidas"


async def test_login_inactive_admin_rejected(client, db_session):
    await _create_admin(db_session, username="inactive", is_active=False)

    response = await client.post("/api/auth/login", json={"username": "inactive", "password": ADMIN_PASSWORD})

    assert response.status_code == 401


async def test_login_rate_limited_after_five_attempts_per_minute(client, db_session):
    await _create_admin(db_session)

    for _ in range(5):
        response = await client.post("/api/auth/login", json={"username": "admin", "password": "wrong"})
        assert response.status_code == 401

    response = await client.post("/api/auth/login", json={"username": "admin", "password": "wrong"})

    assert response.status_code == 429


async def test_refresh_issues_a_valid_access_token_for_the_same_admin(client, db_session):
    admin = await _create_admin(db_session)
    await client.post("/api/auth/login", json={"username": "admin", "password": ADMIN_PASSWORD})

    refresh_response = await client.post("/api/auth/refresh")

    assert refresh_response.status_code == 200
    new_access_token = refresh_response.json()["access_token"]
    assert decode_token(new_access_token, expected_type="access") == str(admin.id)


async def test_refresh_without_cookie_rejected(client):
    response = await client.post("/api/auth/refresh")

    assert response.status_code == 401


async def test_logout_clears_refresh_cookie(client, db_session):
    await _create_admin(db_session)
    await client.post("/api/auth/login", json={"username": "admin", "password": ADMIN_PASSWORD})

    response = await client.post("/api/auth/logout")

    assert response.status_code == 204

    refresh_after_logout = await client.post("/api/auth/refresh")
    assert refresh_after_logout.status_code == 401


async def test_me_returns_current_user_info(client, db_session):
    await _create_admin(db_session)
    login_response = await client.post("/api/auth/login", json={"username": "admin", "password": ADMIN_PASSWORD})
    access_token = login_response.json()["access_token"]

    response = await client.get("/api/auth/me", headers={"Authorization": f"Bearer {access_token}"})

    assert response.status_code == 200
    body = response.json()
    assert body["username"] == "admin"
    assert body["role"] == "admin"
    assert "password_hash" not in body


async def test_me_requires_auth(client):
    response = await client.get("/api/auth/me")

    assert response.status_code == 401
