import io
import uuid
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, File, Form, HTTPException, Query, UploadFile, status
from PIL import Image
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.config import get_settings
from app.database import get_db
from app.models.product import Product
from app.models.product_image import ProductImage
from app.models.user import User
from app.schemas.product import ProductImageOut, ProductOut
from app.security.deps import require_admin
from app.services.barcode import decode_barcode
from app.services.embeddings import get_embedding
from app.services.image_validation import CleanedImage, InvalidImageError, make_thumbnail, validate_and_clean_image
from app.services.storage import delete_object, public_url, upload_image, upload_thumbnail

router = APIRouter(prefix="/api/admin/products", tags=["admin-products"])

BARCODE_CONFLICT_DETAIL = "Ya existe un producto activo con ese código de barras."


def _to_image_out(image: ProductImage) -> ProductImageOut:
    return ProductImageOut(
        id=image.id,
        image_url=public_url(image.object_key),
        thumbnail_url=public_url(image.thumbnail_object_key) if image.thumbnail_object_key else None,
        is_primary=image.is_primary,
        position=image.position,
    )


def _to_out(product: Product) -> ProductOut:
    images = sorted(product.images, key=lambda img: img.position)
    return ProductOut(
        id=product.id,
        name=product.name,
        description=product.description,
        category=product.category,
        price=float(product.price),
        stock=product.stock,
        barcode=product.barcode,
        is_active=product.is_active,
        image_url=public_url(product.image_object_key),
        thumbnail_url=public_url(product.thumbnail_object_key) if product.thumbnail_object_key else None,
        images=[_to_image_out(image) for image in images],
        image_count=len(images),
        created_at=product.created_at,
        updated_at=product.updated_at,
        deleted_at=product.deleted_at,
    )


async def _get_product_or_404(db: AsyncSession, product_id: uuid.UUID) -> Product:
    stmt = select(Product).options(selectinload(Product.images)).where(Product.id == product_id)
    product = (await db.execute(stmt)).scalar_one_or_none()
    if product is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Producto no encontrado")
    return product


async def _clean_uploaded_image(image: UploadFile) -> CleanedImage:
    raw_bytes = await image.read()
    try:
        return validate_and_clean_image(raw_bytes)
    except InvalidImageError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc


async def _clean_uploaded_images(images: list[UploadFile]) -> list[CleanedImage]:
    """Validates every photo before persisting any of them, so a single bad
    file in a multi-photo upload doesn't leave a partial set of images."""
    return [await _clean_uploaded_image(image) for image in images]


def _embed(cleaned: CleanedImage) -> list[float]:
    pil_image = Image.open(io.BytesIO(cleaned.content))
    return get_embedding(pil_image)


def _detect_barcode_in_any(cleaned_images: list[CleanedImage]) -> str | None:
    """The barcode doesn't need to appear in every photo — the first photo
    where it's readable wins."""
    for cleaned in cleaned_images:
        pil_image = Image.open(io.BytesIO(cleaned.content))
        detected = decode_barcode(pil_image)
        if detected:
            return detected
    return None


def _store_image(cleaned: CleanedImage, *, product_id: uuid.UUID, is_primary: bool, position: int) -> ProductImage:
    object_key = upload_image(cleaned.content, cleaned.content_type)
    thumbnail_key = upload_thumbnail(make_thumbnail(cleaned))
    return ProductImage(
        product_id=product_id,
        object_key=object_key,
        thumbnail_object_key=thumbnail_key,
        embedding=_embed(cleaned),
        is_primary=is_primary,
        position=position,
    )


def _sync_cover(product: Product) -> None:
    """Keeps `products.image_object_key`/`thumbnail_object_key` pointing at
    whichever ProductImage row has is_primary=true — the single place this
    invariant is maintained."""
    primary = next((img for img in product.images if img.is_primary), None)
    if primary is None:
        return
    product.image_object_key = primary.object_key
    product.thumbnail_object_key = primary.thumbnail_object_key


async def _assert_barcode_available(
    db: AsyncSession, barcode: str, *, exclude_product_id: uuid.UUID | None = None
) -> None:
    stmt = select(Product).where(Product.barcode == barcode, Product.is_active.is_(True))
    if exclude_product_id is not None:
        stmt = stmt.where(Product.id != exclude_product_id)
    existing = await db.execute(stmt)
    if existing.scalar_one_or_none() is not None:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=BARCODE_CONFLICT_DETAIL)


@router.get("", response_model=list[ProductOut])
async def list_products(
    include_inactive: bool = Query(False),
    db: AsyncSession = Depends(get_db),
    _admin: User = Depends(require_admin),
) -> list[ProductOut]:
    stmt = select(Product).options(selectinload(Product.images)).order_by(Product.created_at.desc())
    if not include_inactive:
        stmt = stmt.where(Product.is_active.is_(True))
    result = await db.execute(stmt)
    return [_to_out(product) for product in result.scalars().all()]


@router.get("/{product_id}", response_model=ProductOut)
async def get_product(
    product_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    _admin: User = Depends(require_admin),
) -> ProductOut:
    return _to_out(await _get_product_or_404(db, product_id))


@router.post("", response_model=ProductOut, status_code=status.HTTP_201_CREATED)
async def create_product(
    name: str = Form(..., min_length=1, max_length=200),
    description: str = Form("", max_length=5000),
    category: str | None = Form(None, max_length=100),
    price: float = Form(..., ge=0),
    stock: int = Form(0, ge=0),
    barcode: str | None = Form(None, max_length=64),
    images: list[UploadFile] = File(...),
    db: AsyncSession = Depends(get_db),
    admin: User = Depends(require_admin),
) -> ProductOut:
    settings = get_settings()
    if not images:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Se requiere al menos una foto.")
    if len(images) > settings.max_images_per_product:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Un producto admite como máximo {settings.max_images_per_product} fotos.",
        )

    cleaned_images = await _clean_uploaded_images(images)
    detected_barcode = _detect_barcode_in_any(cleaned_images)
    effective_barcode = barcode or detected_barcode

    if effective_barcode:
        await _assert_barcode_available(db, effective_barcode)

    product_id = uuid.uuid4()
    stored_images = [
        _store_image(cleaned, product_id=product_id, is_primary=(index == 0), position=index)
        for index, cleaned in enumerate(cleaned_images)
    ]

    product = Product(
        id=product_id,
        name=name,
        description=description,
        category=category or None,
        price=price,
        stock=stock,
        barcode=effective_barcode or None,
        image_object_key=stored_images[0].object_key,
        thumbnail_object_key=stored_images[0].thumbnail_object_key,
        created_by=admin.id,
    )
    product.images = stored_images
    db.add(product)

    try:
        await db.commit()
    except IntegrityError as exc:
        await db.rollback()
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=BARCODE_CONFLICT_DETAIL) from exc

    return _to_out(await _get_product_or_404(db, product.id))


@router.put("/{product_id}", response_model=ProductOut)
async def update_product(
    product_id: uuid.UUID,
    name: str | None = Form(None, min_length=1, max_length=200),
    description: str | None = Form(None, max_length=5000),
    category: str | None = Form(None, max_length=100),
    price: float | None = Form(None, ge=0),
    stock: int | None = Form(None, ge=0),
    barcode: str | None = Form(None, max_length=64),
    db: AsyncSession = Depends(get_db),
    _admin: User = Depends(require_admin),
) -> ProductOut:
    """Product data only — photos are managed via the /images endpoints below."""
    product = await _get_product_or_404(db, product_id)

    if barcode is not None and barcode != product.barcode:
        if barcode:
            await _assert_barcode_available(db, barcode, exclude_product_id=product_id)
        product.barcode = barcode or None

    if name is not None:
        product.name = name
    if description is not None:
        product.description = description
    if category is not None:
        product.category = category or None
    if price is not None:
        product.price = price
    if stock is not None:
        product.stock = stock

    try:
        await db.commit()
    except IntegrityError as exc:
        await db.rollback()
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=BARCODE_CONFLICT_DETAIL) from exc

    return _to_out(await _get_product_or_404(db, product_id))


@router.delete("/{product_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_product(
    product_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    _admin: User = Depends(require_admin),
) -> None:
    product = await _get_product_or_404(db, product_id)
    product.is_active = False
    product.deleted_at = datetime.now(timezone.utc)
    await db.commit()


@router.post("/{product_id}/restore", response_model=ProductOut)
async def restore_product(
    product_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    _admin: User = Depends(require_admin),
) -> ProductOut:
    product = await _get_product_or_404(db, product_id)
    product.is_active = True
    product.deleted_at = None
    await db.commit()
    return _to_out(await _get_product_or_404(db, product_id))


@router.post("/{product_id}/images", response_model=ProductOut, status_code=status.HTTP_201_CREATED)
async def add_product_images(
    product_id: uuid.UUID,
    images: list[UploadFile] = File(...),
    db: AsyncSession = Depends(get_db),
    _admin: User = Depends(require_admin),
) -> ProductOut:
    settings = get_settings()
    product = await _get_product_or_404(db, product_id)

    if not images:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Se requiere al menos una foto.")
    if len(product.images) + len(images) > settings.max_images_per_product:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Un producto admite como máximo {settings.max_images_per_product} fotos.",
        )

    cleaned_images = await _clean_uploaded_images(images)
    next_position = max((img.position for img in product.images), default=-1) + 1
    has_primary_already = any(img.is_primary for img in product.images)

    new_images = [
        _store_image(
            cleaned,
            product_id=product_id,
            is_primary=(not has_primary_already and index == 0),
            position=next_position + index,
        )
        for index, cleaned in enumerate(cleaned_images)
    ]
    product.images.extend(new_images)
    _sync_cover(product)

    await db.commit()
    return _to_out(await _get_product_or_404(db, product_id))


@router.delete("/{product_id}/images/{image_id}", response_model=ProductOut)
async def delete_product_image(
    product_id: uuid.UUID,
    image_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    _admin: User = Depends(require_admin),
) -> ProductOut:
    product = await _get_product_or_404(db, product_id)
    target = next((img for img in product.images if img.id == image_id), None)
    if target is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Foto no encontrada")
    if len(product.images) <= 1:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, detail="Un producto debe tener al menos una foto."
        )

    was_primary = target.is_primary
    product.images.remove(target)
    await db.delete(target)
    # Flush the delete on its own: `ux_product_images_primary` is a partial
    # unique index on is_primary=true, and if the promotion UPDATE below were
    # flushed before this DELETE actually lands, both rows would briefly read
    # as is_primary=true within the same statement batch and violate it.
    await db.flush()

    if was_primary and product.images:
        remaining = sorted(product.images, key=lambda img: img.position)
        remaining[0].is_primary = True
        _sync_cover(product)

    await db.commit()
    delete_object(target.object_key)
    if target.thumbnail_object_key:
        delete_object(target.thumbnail_object_key)

    return _to_out(await _get_product_or_404(db, product_id))


@router.post("/{product_id}/images/{image_id}/primary", response_model=ProductOut)
async def set_primary_product_image(
    product_id: uuid.UUID,
    image_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    _admin: User = Depends(require_admin),
) -> ProductOut:
    product = await _get_product_or_404(db, product_id)
    target = next((img for img in product.images if img.id == image_id), None)
    if target is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Foto no encontrada")

    # Unset the current primary (if any) and flush before setting the new one:
    # `ux_product_images_primary` is a partial unique index on is_primary=true,
    # and SQLAlchemy doesn't guarantee these UPDATEs flush in list order, so
    # setting both in one flush risks two rows briefly reading as true at once.
    for image in product.images:
        if image.is_primary and image.id != image_id:
            image.is_primary = False
    await db.flush()

    target.is_primary = True
    _sync_cover(product)

    await db.commit()
    return _to_out(await _get_product_or_404(db, product_id))
