import io

from fastapi import APIRouter, Depends, File, HTTPException, Request, UploadFile, status
from PIL import Image
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import get_settings
from app.database import get_db
from app.models.product import Product
from app.models.user import User
from app.schemas.recognition import RecognitionMatch, RecognitionNotFound, RecognitionResult
from app.security.deps import get_optional_user
from app.security.rate_limit import (
    SCAN_GLOBAL_ANONYMOUS_LIMIT,
    global_anonymous_scan_key,
    limiter,
    scan_rate_limit,
    user_or_ip_key,
)
from app.services.barcode import decode_barcode
from app.services.embeddings import get_embedding
from app.services.image_validation import InvalidImageError, validate_and_clean_image
from app.services.similarity_search import ProductCandidate, find_best_product_match
from app.services.storage import public_url

router = APIRouter(prefix="/api/recognition", tags=["recognition"])
settings = get_settings()


def _to_barcode_match(product: Product, *, include_name: bool) -> RecognitionMatch:
    return RecognitionMatch(
        match_type="barcode",
        product_id=str(product.id),
        name=product.name if include_name else None,
        description=product.description,
        price=float(product.price),
        stock=product.stock,
        confidence=None,
        image_url=public_url(product.image_object_key),
        thumbnail_url=public_url(product.thumbnail_object_key) if product.thumbnail_object_key else None,
    )


def _to_similarity_match(candidate: ProductCandidate, *, include_name: bool) -> RecognitionMatch:
    product = candidate.product
    return RecognitionMatch(
        match_type="similarity",
        product_id=str(product.id),
        name=product.name if include_name else None,
        description=product.description,
        price=float(product.price),
        stock=product.stock,
        confidence=candidate.confidence,
        matched_images=candidate.matched_images,
        total_images=candidate.total_images,
        image_url=public_url(product.image_object_key),
        thumbnail_url=public_url(product.thumbnail_object_key) if product.thumbnail_object_key else None,
    )


@router.post("/scan", response_model=RecognitionResult)
# Two independent limits, both keyed off the same identity (see
# user_or_ip_key/global_anonymous_scan_key docstrings): a per-role tier
# (admin 60/min, vendedor 20/min, anonymous 10/min) plus a shared cap over
# *all* anonymous traffic combined, since CLIP inference is CPU-heavy enough
# that per-IP alone is too easy to multiply by rotating IPs.
@limiter.limit(scan_rate_limit, key_func=user_or_ip_key)
@limiter.limit(SCAN_GLOBAL_ANONYMOUS_LIMIT, key_func=global_anonymous_scan_key)
async def scan_product(
    request: Request,
    image: UploadFile = File(...),
    db: AsyncSession = Depends(get_db),
    user: User | None = Depends(get_optional_user),
) -> RecognitionMatch | RecognitionNotFound:
    # The response is modeled by audience, same guarantee as ProductPublicOut
    # for the catalog: anonymous callers get description/price/stock/photo,
    # a logged-in vendedor or admin additionally gets the product name.
    include_name = user is not None
    raw_bytes = await image.read()
    try:
        cleaned = validate_and_clean_image(raw_bytes)
    except InvalidImageError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc

    pil_image = Image.open(io.BytesIO(cleaned.content))

    barcode_value = decode_barcode(pil_image)
    if barcode_value is not None:
        result = await db.execute(select(Product).where(Product.barcode == barcode_value, Product.is_active.is_(True)))
        product = result.scalar_one_or_none()
        if product is None:
            return RecognitionNotFound(reason="Código de barras leído pero no registrado en el inventario.")
        return _to_barcode_match(product, include_name=include_name)

    embedding = get_embedding(pil_image)
    candidate = await find_best_product_match(db, embedding)
    if candidate is None:
        return RecognitionNotFound(reason="No se encontró ningún producto similar registrado.")

    # Accept either on the plain single-photo threshold, or on a lower bar when
    # 2+ of the product's own photos corroborate it — but only if the winner
    # isn't uncomfortably close to the runner-up product (ambiguous match).
    strong_enough = candidate.confidence >= settings.similarity_threshold
    corroborated_enough = (
        candidate.confidence >= settings.similarity_threshold_corroborated and candidate.matched_images >= 2
    )
    if not (strong_enough or corroborated_enough):
        return RecognitionNotFound(reason=f"Confianza insuficiente ({candidate.confidence:.0%}).")

    if candidate.margin < settings.similarity_min_margin:
        return RecognitionNotFound(
            reason=f"Coincidencia ambigua entre varios productos (diferencia de solo {candidate.margin:.0%})."
        )

    return _to_similarity_match(candidate, include_name=include_name)
