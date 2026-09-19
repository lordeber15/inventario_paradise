from fastapi import APIRouter, Depends, Request
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models.app_settings import APP_SETTINGS_ID, AppSettings
from app.schemas.settings import AppSettingsOut
from app.security.rate_limit import limiter
from app.services.storage import public_url

router = APIRouter(prefix="/api/settings", tags=["public-settings"])


@router.get("", response_model=AppSettingsOut)
@limiter.limit("120/minute")
async def get_app_settings(request: Request, db: AsyncSession = Depends(get_db)) -> AppSettingsOut:
    settings_row = await db.get(AppSettings, APP_SETTINGS_ID)
    logo_url = public_url(settings_row.logo_object_key) if settings_row and settings_row.logo_object_key else None
    company_name = settings_row.company_name if settings_row else None
    return AppSettingsOut(logo_url=logo_url, company_name=company_name)
