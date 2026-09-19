import io
from dataclasses import dataclass

from PIL import Image, ImageOps

MAX_UPLOAD_SIZE_BYTES = 8 * 1024 * 1024  # 8 MB
MAX_DIMENSION_PIXELS = 6000
ALLOWED_FORMATS = {"JPEG", "PNG", "WEBP"}
THUMBNAIL_MAX_SIZE = 256


class InvalidImageError(ValueError):
    """Raised when an uploaded file is not a safe, valid image."""


@dataclass
class CleanedImage:
    content: bytes
    content_type: str
    width: int
    height: int


def validate_and_clean_image(raw_bytes: bytes) -> CleanedImage:
    """Validate an upload and re-encode it, stripping any embedded payload/metadata.

    Never trusts the client-declared Content-Type or filename extension: decodes the
    actual pixel data and re-saves it as a fresh JPEG.
    """
    if not raw_bytes:
        raise InvalidImageError("El archivo está vacío.")
    if len(raw_bytes) > MAX_UPLOAD_SIZE_BYTES:
        raise InvalidImageError("La imagen supera el tamaño máximo permitido (8 MB).")

    try:
        probe = Image.open(io.BytesIO(raw_bytes))
        probe.verify()
    except Exception as exc:
        raise InvalidImageError("El archivo no es una imagen válida.") from exc

    if probe.format not in ALLOWED_FORMATS:
        raise InvalidImageError("Formato de imagen no soportado. Usa JPEG, PNG o WEBP.")

    # verify() closes the file handle; reopen to actually decode pixel data
    # (also guards against Pillow's decompression-bomb threshold on .load()).
    try:
        image = Image.open(io.BytesIO(raw_bytes))
        image = ImageOps.exif_transpose(image)
        image.load()
    except Exception as exc:
        raise InvalidImageError("No se pudo procesar la imagen.") from exc

    if image.width > MAX_DIMENSION_PIXELS or image.height > MAX_DIMENSION_PIXELS:
        raise InvalidImageError("La imagen excede las dimensiones máximas permitidas.")

    if image.mode not in ("RGB", "L"):
        image = image.convert("RGB")

    buffer = io.BytesIO()
    image.save(buffer, format="JPEG", quality=90)

    return CleanedImage(content=buffer.getvalue(), content_type="image/jpeg", width=image.width, height=image.height)


def make_thumbnail(cleaned: CleanedImage, max_size: int = THUMBNAIL_MAX_SIZE) -> bytes:
    image = Image.open(io.BytesIO(cleaned.content))
    image.thumbnail((max_size, max_size))
    buffer = io.BytesIO()
    image.save(buffer, format="JPEG", quality=85)
    return buffer.getvalue()


MAX_LOGO_SIZE_BYTES = 4 * 1024 * 1024  # 4 MB — a logo, not a photograph
MAX_LOGO_DIMENSION_PIXELS = 2000  # never rendered taller than ~40px in a header


def validate_and_clean_logo(raw_bytes: bytes) -> CleanedImage:
    """Same trust model as validate_and_clean_image (decode real pixels, never
    the declared content-type/extension) but for a company logo instead of a
    product photo: smaller limits, and — unlike products — transparency is
    preserved instead of always flattening to JPEG, since the logo sits on a
    header background that changes colour with the light/dark theme. Vector
    formats (SVG) are deliberately not accepted: they can carry scripts or
    external references, which is exactly the class of risk this pixel-decode
    approach exists to avoid.
    """
    if not raw_bytes:
        raise InvalidImageError("El archivo está vacío.")
    if len(raw_bytes) > MAX_LOGO_SIZE_BYTES:
        raise InvalidImageError("El logo supera el tamaño máximo permitido (4 MB).")

    try:
        probe = Image.open(io.BytesIO(raw_bytes))
        probe.verify()
    except Exception as exc:
        raise InvalidImageError("El archivo no es una imagen válida.") from exc

    if probe.format not in ALLOWED_FORMATS:
        raise InvalidImageError("Formato de imagen no soportado. Usa JPEG, PNG o WEBP.")

    try:
        image = Image.open(io.BytesIO(raw_bytes))
        image = ImageOps.exif_transpose(image)
        image.load()
    except Exception as exc:
        raise InvalidImageError("No se pudo procesar la imagen.") from exc

    if image.width > MAX_LOGO_DIMENSION_PIXELS or image.height > MAX_LOGO_DIMENSION_PIXELS:
        raise InvalidImageError("El logo excede las dimensiones máximas permitidas.")

    has_alpha = image.mode in ("RGBA", "LA") or (image.mode == "P" and "transparency" in image.info)

    buffer = io.BytesIO()
    if has_alpha:
        image = image.convert("RGBA")
        image.save(buffer, format="PNG", optimize=True)
        content_type = "image/png"
    else:
        if image.mode not in ("RGB", "L"):
            image = image.convert("RGB")
        image.save(buffer, format="JPEG", quality=90)
        content_type = "image/jpeg"

    return CleanedImage(content=buffer.getvalue(), content_type=content_type, width=image.width, height=image.height)
