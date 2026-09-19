from dataclasses import dataclass

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import get_settings
from app.models.product import Product
from app.models.product_image import ProductImage


@dataclass
class ProductCandidate:
    product: Product
    confidence: float  # "best": highest similarity among this product's own photos
    matched_images: int  # "support": how many of its photos corroborate that match
    total_images: int
    margin: float  # gap between this product's `confidence` and the runner-up's


async def find_best_product_match(db: AsyncSession, embedding: list[float]) -> ProductCandidate | None:
    """Nearest product by cosine distance, using every registered photo as a vote.

    Pulls the globally-nearest `similarity_candidate_pool` photos (not just the
    single nearest), then groups them by product in Python — cheap since the pool
    is small (default 20 rows), and it lets a product with several photos win on
    corroboration even when no single photo alone clears the plain threshold.
    """
    settings = get_settings()
    distance_expr = ProductImage.embedding.cosine_distance(embedding)
    stmt = (
        select(ProductImage.product_id, distance_expr.label("distance"))
        .join(Product, Product.id == ProductImage.product_id)
        .where(Product.is_active.is_(True), ProductImage.embedding.is_not(None))
        .order_by(distance_expr)
        .limit(settings.similarity_candidate_pool)
    )
    result = await db.execute(stmt)
    rows = result.all()
    if not rows:
        return None

    # Group nearest-photo distances by product, preserving arrival order (already
    # sorted by distance) so `distances[0]` is always that product's best photo.
    distances_by_product: dict = {}
    for product_id, distance in rows:
        distances_by_product.setdefault(product_id, []).append(float(distance))

    scored = []
    for product_id, distances in distances_by_product.items():
        best_confidence = 1.0 - min(distances)
        support = sum(
            1 for d in distances if (1.0 - d) >= best_confidence - settings.similarity_support_delta
        )
        scored.append((product_id, best_confidence, support))

    scored.sort(key=lambda item: item[1], reverse=True)
    winner_id, winner_confidence, winner_support = scored[0]
    runner_up_confidence = scored[1][1] if len(scored) > 1 else 0.0
    margin = winner_confidence - runner_up_confidence

    total_images_stmt = select(ProductImage.id).where(ProductImage.product_id == winner_id)
    total_images = len((await db.execute(total_images_stmt)).all())

    product = await db.get(Product, winner_id)
    if product is None:  # pragma: no cover - defensive, product deleted mid-request
        return None

    return ProductCandidate(
        product=product,
        confidence=winner_confidence,
        matched_images=winner_support,
        total_images=total_images,
        margin=margin,
    )
