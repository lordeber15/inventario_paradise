from PIL import Image

from app.models.product import Product
from app.models.product_image import ProductImage
from app.services.similarity_search import find_best_product_match
from tests.conftest import fake_embedding


def _make_product(**overrides) -> Product:
    defaults = dict(
        name="Producto",
        description="Descripción",
        price=10,
        stock=5,
        image_object_key="products/x.jpg",
        thumbnail_object_key="thumbnails/x.jpg",
    )
    defaults.update(overrides)
    return Product(**defaults)


def _image(color: tuple[int, int, int], **overrides) -> ProductImage:
    defaults = dict(object_key="products/i.jpg", embedding=_color_embedding(color))
    defaults.update(overrides)
    return ProductImage(**defaults)


def _color_embedding(color: tuple[int, int, int]) -> list[float]:
    return fake_embedding(Image.new("RGB", (32, 32), color=color))


async def test_finds_the_closest_active_product_by_color(db_session):
    red = _make_product(name="Rojo")
    red.images = [_image((220, 30, 30))]
    blue = _make_product(name="Azul")
    blue.images = [_image((20, 30, 220))]
    db_session.add_all([red, blue])
    await db_session.commit()

    query_embedding = _color_embedding((225, 25, 35))  # close to red, far from blue

    match = await find_best_product_match(db_session, query_embedding)

    assert match is not None
    assert match.product.name == "Rojo"
    assert match.confidence > 0.9


async def test_multiple_photos_raise_confidence_via_the_closest_angle(db_session):
    """A product registered with several angles should be found even when the
    scanned photo only resembles one of them (the false negative this feature
    fixes) — the other, dissimilar photos of the same product don't hurt it."""
    product = _make_product(name="Multi-ángulo")
    product.images = [_image((220, 30, 30)), _image((10, 10, 10)), _image((250, 250, 250))]
    db_session.add(product)
    await db_session.commit()

    match = await find_best_product_match(db_session, _color_embedding((225, 25, 35)))

    assert match is not None
    assert match.product.name == "Multi-ángulo"
    assert match.total_images == 3


async def test_support_from_corroborating_photos_counts_matches(db_session):
    product = _make_product(name="Corroborado")
    close_color = (200, 60, 60)
    product.images = [_image(close_color), _image((205, 55, 65)), _image((10, 10, 200))]
    db_session.add(product)
    await db_session.commit()

    match = await find_best_product_match(db_session, _color_embedding(close_color))

    assert match is not None
    # Two of its three photos land within the support delta of the best match;
    # the third (blue) is far off and shouldn't count.
    assert match.matched_images == 2
    assert match.total_images == 3


async def test_margin_reflects_gap_to_the_runner_up_product(db_session):
    winner = _make_product(name="Ganador")
    winner.images = [_image((200, 60, 60))]
    almost_identical = _make_product(name="Casi idéntico")
    almost_identical.images = [_image((201, 61, 61))]
    db_session.add_all([winner, almost_identical])
    await db_session.commit()

    match = await find_best_product_match(db_session, _color_embedding((200, 60, 60)))

    assert match is not None
    assert match.margin < 0.02  # near-duplicate colors: should read as ambiguous upstream


async def test_ignores_inactive_products(db_session):
    inactive_red = _make_product(name="Rojo inactivo", is_active=False)
    inactive_red.images = [_image((220, 30, 30))]
    db_session.add(inactive_red)
    await db_session.commit()

    match = await find_best_product_match(db_session, _color_embedding((225, 25, 35)))

    assert match is None


async def test_ignores_images_without_an_embedding(db_session):
    product = _make_product(name="Sin embedding")
    product.images = [_image((0, 0, 0), embedding=None)]
    db_session.add(product)
    await db_session.commit()

    match = await find_best_product_match(db_session, _color_embedding((225, 25, 35)))

    assert match is None


async def test_returns_none_when_catalog_is_empty(db_session):
    match = await find_best_product_match(db_session, _color_embedding((225, 25, 35)))

    assert match is None
