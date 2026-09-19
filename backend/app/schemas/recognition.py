from typing import Annotated, Literal, Union

from pydantic import BaseModel, Field


class RecognitionMatch(BaseModel):
    match_type: Literal["barcode", "similarity"]
    product_id: str
    # Null for an anonymous caller: the public audience gets description,
    # price, stock and photo (same fields as ProductPublicOut), same as
    # every other unauthenticated response in this app. A logged-in
    # vendedor or admin gets the name too (see recognition.py's
    # _to_barcode_match/_to_similarity_match).
    name: str | None
    description: str
    price: float
    stock: int
    confidence: float | None = None
    # Corroboration detail, only present for match_type="similarity": how many of
    # the product's own registered photos supported the winning match, out of how
    # many it has in total. Null for a barcode match, where this doesn't apply.
    matched_images: int | None = None
    total_images: int | None = None
    image_url: str
    thumbnail_url: str | None = None


class RecognitionNotFound(BaseModel):
    match_type: Literal["not_found"] = "not_found"
    reason: str


RecognitionResult = Annotated[Union[RecognitionMatch, RecognitionNotFound], Field(discriminator="match_type")]
