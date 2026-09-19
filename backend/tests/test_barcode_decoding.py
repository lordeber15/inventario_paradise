from pathlib import Path

from PIL import Image, ImageOps

from app.services.barcode import decode_barcode

FIXTURES_DIR = Path(__file__).parent / "fixtures"


def test_decodes_barcode_from_clean_photo():
    image = Image.open(FIXTURES_DIR / "barcode_sample.jpg")

    result = decode_barcode(image)

    assert result == "7501234567890"


def test_decodes_barcode_rotated_like_a_phone_photo():
    image = Image.open(FIXTURES_DIR / "barcode_sample.jpg").rotate(90, expand=True)

    result = decode_barcode(image)

    assert result == "7501234567890"


def test_returns_none_when_no_barcode_present():
    image = Image.open(FIXTURES_DIR / "no_barcode_sample.jpg")

    result = decode_barcode(image)

    assert result is None


def test_decodes_low_contrast_barcode_via_autocontrast_fallback():
    image = Image.open(FIXTURES_DIR / "barcode_sample.jpg")
    washed_out = ImageOps.autocontrast(image, cutoff=0).point(lambda p: 128 + p // 4)

    result = decode_barcode(washed_out)

    assert result == "7501234567890"
