from app.models.user import ROLE_ADMIN, ROLE_VENDEDOR, User
from app.security.jwt import create_access_token
from app.security.passwords import hash_password

ADMIN_PASSWORD = "Sup3rSecret!"


async def _create_user(db_session, *, username="admin", role=ROLE_ADMIN, is_active=True, password=ADMIN_PASSWORD):
    user = User(username=username, password_hash=hash_password(password), role=role, is_active=is_active)
    db_session.add(user)
    await db_session.commit()
    await db_session.refresh(user)
    return user


def _auth_headers(user: User) -> dict[str, str]:
    return {"Authorization": f"Bearer {create_access_token(str(user.id))}"}


async def test_list_users_requires_admin(client, db_session):
    vendedor = await _create_user(db_session, username="v1", role=ROLE_VENDEDOR)

    response = await client.get("/api/admin/users", headers=_auth_headers(vendedor))

    assert response.status_code == 403


async def test_list_users_requires_auth(client):
    response = await client.get("/api/admin/users")

    assert response.status_code == 401


async def test_admin_can_create_a_vendedor(client, db_session):
    admin = await _create_user(db_session)

    response = await client.post(
        "/api/admin/users",
        json={"username": "vendedora1", "password": "otraClave123", "full_name": "Ana Vendedora", "role": "vendedor"},
        headers=_auth_headers(admin),
    )

    assert response.status_code == 201
    body = response.json()
    assert body["username"] == "vendedora1"
    assert body["role"] == "vendedor"
    assert body["full_name"] == "Ana Vendedora"
    assert body["is_active"] is True
    assert "password_hash" not in body

    # The created vendedor can actually log in with that password.
    login = await client.post("/api/auth/login", json={"username": "vendedora1", "password": "otraClave123"})
    assert login.status_code == 200


async def test_vendedor_cannot_create_users(client, db_session):
    vendedor = await _create_user(db_session, username="v1", role=ROLE_VENDEDOR)

    response = await client.post(
        "/api/admin/users",
        json={"username": "otro", "password": "otraClave123", "full_name": "", "role": "vendedor"},
        headers=_auth_headers(vendedor),
    )

    assert response.status_code == 403


async def test_create_user_rejects_duplicate_username(client, db_session):
    admin = await _create_user(db_session)

    first = await client.post(
        "/api/admin/users",
        json={"username": "dup", "password": "otraClave123", "full_name": "", "role": "vendedor"},
        headers=_auth_headers(admin),
    )
    assert first.status_code == 201

    second = await client.post(
        "/api/admin/users",
        json={"username": "dup", "password": "otraClave123", "full_name": "", "role": "admin"},
        headers=_auth_headers(admin),
    )
    assert second.status_code == 409


async def test_admin_can_promote_and_demote_roles(client, db_session):
    admin = await _create_user(db_session)
    vendedor = await _create_user(db_session, username="v1", role=ROLE_VENDEDOR)

    response = await client.put(
        f"/api/admin/users/{vendedor.id}", json={"role": "admin"}, headers=_auth_headers(admin)
    )

    assert response.status_code == 200
    assert response.json()["role"] == "admin"


async def test_admin_can_deactivate_a_vendedor(client, db_session):
    admin = await _create_user(db_session)
    vendedor = await _create_user(db_session, username="v1", role=ROLE_VENDEDOR)

    response = await client.put(
        f"/api/admin/users/{vendedor.id}", json={"is_active": False}, headers=_auth_headers(admin)
    )

    assert response.status_code == 200
    assert response.json()["is_active"] is False

    # And that account can no longer log in.
    login = await client.post("/api/auth/login", json={"username": "v1", "password": ADMIN_PASSWORD})
    assert login.status_code == 401


async def test_cannot_demote_the_last_active_admin(client, db_session):
    admin = await _create_user(db_session)

    response = await client.put(f"/api/admin/users/{admin.id}", json={"role": "vendedor"}, headers=_auth_headers(admin))

    assert response.status_code == 409
    # Nothing changed.
    listing = await client.get("/api/admin/users", headers=_auth_headers(admin))
    assert next(u for u in listing.json() if u["id"] == str(admin.id))["role"] == "admin"


async def test_cannot_deactivate_the_last_active_admin(client, db_session):
    admin = await _create_user(db_session)

    response = await client.put(f"/api/admin/users/{admin.id}", json={"is_active": False}, headers=_auth_headers(admin))

    assert response.status_code == 409


async def test_can_demote_an_admin_when_another_active_admin_remains(client, db_session):
    admin_a = await _create_user(db_session, username="admin-a")
    admin_b = await _create_user(db_session, username="admin-b")

    response = await client.put(
        f"/api/admin/users/{admin_b.id}", json={"role": "vendedor"}, headers=_auth_headers(admin_a)
    )

    assert response.status_code == 200
    assert response.json()["role"] == "vendedor"


async def test_deactivating_an_already_inactive_vendedor_does_not_trip_the_admin_guard(client, db_session):
    """The last-admin guard only fires when the target row is currently an
    active admin — an already-inactive or non-admin user is never blocked."""
    admin = await _create_user(db_session)
    vendedor = await _create_user(db_session, username="v1", role=ROLE_VENDEDOR, is_active=False)

    response = await client.put(
        f"/api/admin/users/{vendedor.id}", json={"full_name": "Actualizado"}, headers=_auth_headers(admin)
    )

    assert response.status_code == 200


async def test_admin_can_reset_a_users_password(client, db_session):
    admin = await _create_user(db_session)
    vendedor = await _create_user(db_session, username="v1", role=ROLE_VENDEDOR)

    response = await client.post(
        f"/api/admin/users/{vendedor.id}/reset-password", json={"new_password": "unaClaveNueva1"}, headers=_auth_headers(admin)
    )

    assert response.status_code == 200

    old_login = await client.post("/api/auth/login", json={"username": "v1", "password": ADMIN_PASSWORD})
    assert old_login.status_code == 401

    new_login = await client.post("/api/auth/login", json={"username": "v1", "password": "unaClaveNueva1"})
    assert new_login.status_code == 200


async def test_update_nonexistent_user_returns_404(client, db_session):
    admin = await _create_user(db_session)

    response = await client.put(
        "/api/admin/users/00000000-0000-0000-0000-000000000000", json={"full_name": "x"}, headers=_auth_headers(admin)
    )

    assert response.status_code == 404


async def test_vendedor_cannot_manage_products(client, db_session):
    """Confirms the permission matrix, not just the users endpoints: a
    vendedor authenticates fine but is still turned away from product CRUD."""
    vendedor = await _create_user(db_session, username="v1", role=ROLE_VENDEDOR)

    response = await client.get("/api/admin/products", headers=_auth_headers(vendedor))

    assert response.status_code == 403
