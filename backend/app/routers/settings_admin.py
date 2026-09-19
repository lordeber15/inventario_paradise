from fastapi import APIRouter, Depends, File, HTTPException, UploadFile, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models.app_settings import APP_SETTINGS_ID, AppSettings
from app.models.user import User
from app.schemas.settings import AppSettingsOut, CompanyNameIn
from app.security.deps import require_admin
from app.services.image_validation import InvalidImageError, validate_and_clean_logo
from app.services.storage import delete_object, public_url, upload_logo

router = APIRouter(prefix="/api/admin/settings", tags=["admin-settings"])


async def _get_settings_row(db: AsyncSession) -> AppSettings:
    settings_row = await db.get(AppSettings, APP_SETTINGS_ID)
    assert settings_row is not None  # seeded by migration 0006, always exists
    return settings_row


def _to_out(settings_row: AppSettings) -> AppSettingsOut:
    logo_url = public_url(settings_row.logo_object_key) if settings_row.logo_object_key else None
    return AppSettingsOut(logo_url=logo_url, company_name=settings_row.company_name)


@router.put("/company-name", response_model=AppSettingsOut)
async def update_company_name_route(
    payload: CompanyNameIn,
    db: AsyncSession = Depends(get_db),
    admin: User = Depends(require_admin),
) -> AppSettingsOut:
    settings_row = await _get_settings_row(db)
    settings_row.company_name = payload.company_name
    settings_row.updated_by = admin.id
    await db.commit()
    await db.refresh(settings_row)
    return _to_out(settings_row)


@router.post("/logo", response_model=AppSettingsOut)
async def upload_logo_route(
    logo: UploadFile = File(...),
    db: AsyncSession = Depends(get_db),
    admin: User = Depends(require_admin),
) -> AppSettingsOut:
    try:
        cleaned = validate_and_clean_logo(await logo.read())
    except InvalidImageError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc

    settings_row = await _get_settings_row(db)
    old_object_key = settings_row.logo_object_key

    settings_row.logo_object_key = upload_logo(cleaned.content, cleaned.content_type)
    settings_row.updated_by = admin.id
    await db.commit()
    await db.refresh(settings_row)

    if old_object_key:
        delete_object(old_object_key)

    return _to_out(settings_row)


@router.delete("/logo", response_model=AppSettingsOut)
async def delete_logo_route(
    db: AsyncSession = Depends(get_db),
    admin: User = Depends(require_admin),
) -> AppSettingsOut:
    settings_row = await _get_settings_row(db)
    old_object_key = settings_row.logo_object_key

    settings_row.logo_object_key = None
    settings_row.updated_by = admin.id
    await db.commit()
    await db.refresh(settings_row)

    if old_object_key:
        delete_object(old_object_key)

    return _to_out(settings_row)
