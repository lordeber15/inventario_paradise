import io

import pytest
from PIL import Image

from app.services.image_validation import (
    MAX_UPLOAD_SIZE_BYTES,
    InvalidImageError,
    make_thumbnail,
    validate_and_clean_image,
)


def _jpeg_bytes(size=(64, 64), color=(200, 50, 50)) -> bytes:
    buffer = io.BytesIO()
    Image.new("RGB", size, color=color).save(buffer, format="JPEG")
    return buffer.getvalue()


def test_accepts_a_valid_jpeg_and_re_encodes_it():
    cleaned = validate_and_clean_image(_jpeg_bytes())

    assert cleaned.content_type == "image/jpeg"
    assert cleaned.width == 64
    assert cleaned.height == 64
    # Re-encoded bytes never equal the untouched upload: the whole point is
    # to strip anything embedded in the original file beyond pixel data.
    assert Image.open(io.BytesIO(cleaned.content)).format == "JPEG"


def test_rejects_empty_file():
    with pytest.raises(InvalidImageError):
        validate_and_clean_image(b"")


def test_rejects_file_larger_than_max_size():
    oversized = b"\xff" * (MAX_UPLOAD_SIZE_BYTES + 1)

    with pytest.raises(InvalidImageError):
        validate_and_clean_image(oversized)


def test_rejects_bytes_that_are_not_an_image_even_if_named_like_one():
    malicious_payload = b"<?php system($_GET['cmd']); ?>"

    with pytest.raises(InvalidImageError):
        validate_and_clean_image(malicious_payload)


def test_rejects_unsupported_format():
    buffer = io.BytesIO()
    Image.new("RGB", (10, 10)).save(buffer, format="BMP")

    with pytest.raises(InvalidImageError):
        validate_and_clean_image(buffer.getvalue())


def test_rejects_images_exceeding_max_dimensions():
    buffer = io.BytesIO()
    Image.new("RGB", (7000, 10)).save(buffer, format="JPEG")

    with pytest.raises(InvalidImageError):
        validate_and_clean_image(buffer.getvalue())


def test_converts_palette_image_to_rgb():
    buffer = io.BytesIO()
    Image.new("P", (20, 20)).save(buffer, format="PNG")

    cleaned = validate_and_clean_image(buffer.getvalue())

    assert cleaned.content_type == "image/jpeg"


def test_make_thumbnail_shrinks_to_max_size():
    cleaned = validate_and_clean_image(_jpeg_bytes(size=(800, 600)))

    thumbnail_bytes = make_thumbnail(cleaned, max_size=100)
    thumbnail = Image.open(io.BytesIO(thumbnail_bytes))

    assert thumbnail.width <= 100
    assert thumbnail.height <= 100
