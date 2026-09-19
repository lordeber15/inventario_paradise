import uuid

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import func, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models.user import ROLE_ADMIN, User
from app.schemas.user import PasswordReset, UserCreate, UserOut, UserUpdate
from app.security.deps import require_admin
from app.security.passwords import hash_password

router = APIRouter(prefix="/api/admin/users", tags=["admin-users"])

USERNAME_CONFLICT_DETAIL = "Ya existe un usuario con ese nombre de usuario."
LAST_ADMIN_DETAIL = "No se puede quitar el rol de administrador o desactivar al último administrador activo."


async def _get_user_or_404(db: AsyncSession, user_id: uuid.UUID) -> User:
    user = await db.get(User, user_id)
    if user is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Usuario no encontrado")
    return user


async def _count_other_active_admins(db: AsyncSession, *, excluding: uuid.UUID) -> int:
    stmt = select(func.count()).select_from(User).where(
        User.role == ROLE_ADMIN, User.is_active.is_(True), User.id != excluding
    )
    return (await db.execute(stmt)).scalar_one()


async def _assert_wont_remove_last_admin(db: AsyncSession, target: User, *, new_role: str, new_is_active: bool) -> None:
    """Guards against a state with zero active admins — whether that's an
    admin demoting/deactivating themselves, or accidentally doing it to the
    only other admin left. There's no recovery from that short of a direct
    database edit, so the API refuses it outright."""
    was_active_admin = target.role == ROLE_ADMIN and target.is_active
    will_stay_active_admin = new_role == ROLE_ADMIN and new_is_active
    if was_active_admin and not will_stay_active_admin:
        if await _count_other_active_admins(db, excluding=target.id) == 0:
            raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=LAST_ADMIN_DETAIL)


@router.get("", response_model=list[UserOut])
async def list_users(
    db: AsyncSession = Depends(get_db),
    _admin: User = Depends(require_admin),
) -> list[User]:
    result = await db.execute(select(User).order_by(User.created_at.desc()))
    return list(result.scalars().all())


@router.post("", response_model=UserOut, status_code=status.HTTP_201_CREATED)
async def create_user(
    payload: UserCreate,
    db: AsyncSession = Depends(get_db),
    _admin: User = Depends(require_admin),
) -> User:
    user = User(
        username=payload.username,
        password_hash=hash_password(payload.password),
        full_name=payload.full_name,
        role=payload.role,
    )
    db.add(user)
    try:
        await db.commit()
    except IntegrityError as exc:
        await db.rollback()
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=USERNAME_CONFLICT_DETAIL) from exc

    await db.refresh(user)
    return user


@router.put("/{user_id}", response_model=UserOut)
async def update_user(
    user_id: uuid.UUID,
    payload: UserUpdate,
    db: AsyncSession = Depends(get_db),
    admin: User = Depends(require_admin),
) -> User:
    user = await _get_user_or_404(db, user_id)

    new_role = payload.role if payload.role is not None else user.role
    new_is_active = payload.is_active if payload.is_active is not None else user.is_active
    await _assert_wont_remove_last_admin(db, user, new_role=new_role, new_is_active=new_is_active)

    if payload.full_name is not None:
        user.full_name = payload.full_name
    user.role = new_role
    user.is_active = new_is_active

    await db.commit()
    await db.refresh(user)
    return user


@router.post("/{user_id}/reset-password", response_model=UserOut)
async def reset_password(
    user_id: uuid.UUID,
    payload: PasswordReset,
    db: AsyncSession = Depends(get_db),
    _admin: User = Depends(require_admin),
) -> User:
    user = await _get_user_or_404(db, user_id)
    user.password_hash = hash_password(payload.new_password)
    await db.commit()
    await db.refresh(user)
    return user
