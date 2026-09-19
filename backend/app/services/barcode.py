from PIL import Image, ImageOps
from pyzbar.pyzbar import decode as zbar_decode


def decode_barcode(image: Image.Image) -> str | None:
    """Try to read a barcode from a product photo.

    A hand-held product photo rarely frames and lights a barcode as cleanly
    as a dedicated scanner would, so a grayscale + autocontrast pass is
    attempted as a fallback when the raw decode finds nothing.
    """
    results = zbar_decode(image)
    if not results:
        grayscale = ImageOps.autocontrast(image.convert("L"))
        results = zbar_decode(grayscale)

    if not results:
        return None

    return results[0].data.decode("utf-8", errors="replace")
