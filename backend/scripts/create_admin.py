"""Seed the initial admin user. No public self-signup endpoint exists by design.

Usage (inside the backend container):
    docker compose exec backend python -m scripts.create_admin --username admin --password 'xxx'
"""

import argparse
import asyncio
import sys

from sqlalchemy import select

from app.database import async_session_factory
from app.models.user import ROLE_ADMIN, User
from app.security.passwords import hash_password


async def create_admin(username: str, password: str) -> None:
    async with async_session_factory() as session:
        existing = await session.execute(select(User).where(User.username == username))
        if existing.scalar_one_or_none() is not None:
            print(f"El usuario '{username}' ya existe.", file=sys.stderr)
            return

        admin = User(username=username, password_hash=hash_password(password), role=ROLE_ADMIN)
        session.add(admin)
        await session.commit()
        print(f"Admin '{username}' creado correctamente.")


def main() -> None:
    parser = argparse.ArgumentParser(description="Crea el usuario administrador inicial.")
    parser.add_argument("--username", required=True)
    parser.add_argument("--password", required=True)
    args = parser.parse_args()

    if len(args.password) < 8:
        print("La contraseña debe tener al menos 8 caracteres.", file=sys.stderr)
        raise SystemExit(1)

    asyncio.run(create_admin(args.username, args.password))


if __name__ == "__main__":
    main()
