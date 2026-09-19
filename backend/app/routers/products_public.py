from fastapi import APIRouter, Depends, Query, Request
from sqlalchemy import func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.database import get_db
from app.models.product import Product
from app.schemas.product import ProductPublicImageOut, ProductPublicOut
from app.security.rate_limit import limiter
from app.services.storage import public_url

router = APIRouter(prefix="/api/products", tags=["public-products"])


def _to_public_out(product: Product) -> ProductPublicOut:
    images = sorted(product.images, key=lambda img: img.position)
    return ProductPublicOut(
        id=product.id,
        name=product.name,
        description=product.description,
        category=product.category,
        stock=product.stock,
        price=float(product.price),
        thumbnail_url=public_url(product.thumbnail_object_key) if product.thumbnail_object_key else None,
        image_url=public_url(product.image_object_key),
        images=[
            ProductPublicImageOut(
                image_url=public_url(image.object_key),
                thumbnail_url=public_url(image.thumbnail_object_key) if image.thumbnail_object_key else None,
            )
            for image in images
        ],
        created_at=product.created_at,
    )


@router.get("", response_model=list[ProductPublicOut])
@limiter.limit("60/minute")
async def list_public_products(
    request: Request,
    limit: int = Query(50, ge=1, le=100),
    offset: int = Query(0, ge=0),
    q: str | None = Query(None, max_length=200),
    db: AsyncSession = Depends(get_db),
) -> list[ProductPublicOut]:
    stmt = select(Product).options(selectinload(Product.images)).where(Product.is_active.is_(True))
    if q:
        # Both sides go through unaccent (migration 0005) so "cafe" finds
        # "Café": the stored name keeps its accents, and the person at the
        # counter doesn't have to type them. Applied to the search term too,
        # so it works the other way round as well — typing "café" still finds
        # a product someone loaded as "Cafe".
        term = func.unaccent(f"%{q}%")
        stmt = stmt.where(
            or_(
                func.unaccent(Product.name).ilike(term),
                func.unaccent(Product.description).ilike(term),
            )
        )
    stmt = stmt.order_by(Product.created_at.desc()).limit(limit).offset(offset)

    result = await db.execute(stmt)
    return [_to_public_out(product) for product in result.scalars().all()]
