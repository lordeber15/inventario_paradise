import uuid
from datetime import datetime

from pydantic import BaseModel


class ProductImageOut(BaseModel):
    id: uuid.UUID
    image_url: str
    thumbnail_url: str | None
    is_primary: bool
    position: int


class ProductOut(BaseModel):
    id: uuid.UUID
    name: str
    description: str
    category: str | None
    price: float
    stock: int
    barcode: str | None
    is_active: bool
    image_url: str
    thumbnail_url: str | None
    images: list[ProductImageOut]
    image_count: int
    created_at: datetime
    updated_at: datetime
    deleted_at: datetime | None


class ProductPublicImageOut(BaseModel):
    """Same photo a ProductImageOut points at, minus the admin-only fields
    (`id`, `is_primary`, `position`) — the public gallery just needs an
    ordered list of URLs to page through, not the identifiers used to manage
    them."""

    image_url: str
    thumbnail_url: str | None


class ProductPublicOut(BaseModel):
    """Deliberately smaller than ProductOut: the public catalog shows name,
    price and photos, but never `barcode` or any other admin-only field.
    Keeping this a separate model (instead of filtering ProductOut) is what
    guarantees a new column on Product can't leak into the public listing by
    accident.

    `image_url`/`images` are not a new exposure: the MinIO bucket is
    anonymous-read (`mc anonymous set download`), so every photo was already
    reachable by URL.

    `name` used to be null for an anonymous caller (see docs/PLAN-POS.md
    §11's open question) — the public catalog now shows it as the product's
    title, same as an authenticated vendedor/admin always saw. The scan
    endpoint's RecognitionMatch.name keeps its own, separate anonymous/
    authenticated split; that's a different surface and wasn't part of this
    decision.
    """

    id: uuid.UUID
    name: str
    description: str
    category: str | None
    stock: int
    price: float
    thumbnail_url: str | None
    image_url: str
    images: list[ProductPublicImageOut]
    created_at: datetime
