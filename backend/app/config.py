from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    # Database
    database_url: str = "postgresql+asyncpg://inventario:inventario@localhost:5432/inventario"

    # MinIO / S3
    minio_endpoint: str = "localhost:9000"
    minio_root_user: str = "inventario_minio"
    minio_root_password: str = "change_me"
    minio_bucket: str = "product-images"
    minio_secure: bool = False
    # Browser/phone-facing base URL for MinIO (differs from minio_endpoint, which is the
    # internal Docker network address the backend uses to talk to the minio container).
    # Relative by default, served by the frontend's nginx (see its /media/ block): an
    # absolute URL would hardcode one host, and "localhost" means the phone itself when
    # the app is opened from another device on the LAN. Can still be set to an absolute
    # URL to put a CDN in front.
    minio_public_url: str = "/media"

    # JWT
    jwt_secret: str = "change_me_in_env"
    jwt_algorithm: str = "HS256"
    jwt_access_token_expire_minutes: int = 30
    jwt_refresh_token_expire_days: int = 7

    # Recognition
    similarity_threshold: float = 0.90
    # Lower bar accepted when 2+ of the product's own photos corroborate the match
    # (see services/similarity_search.py) — a single photo still needs the full
    # threshold above.
    similarity_threshold_corroborated: float = 0.85
    # How close (in similarity) another photo of the same candidate product must be
    # to its best match to count as corroborating support.
    similarity_support_delta: float = 0.05
    # Minimum gap between the winning product's best similarity and the runner-up's:
    # below this, the match is too ambiguous to trust and is rejected.
    similarity_min_margin: float = 0.02
    # How many nearest photos (globally, across all products) to pull per scan
    # before grouping by product — not a per-product limit.
    similarity_candidate_pool: int = 20
    max_images_per_product: int = 6
    clip_model_name: str = "sentence-transformers/clip-ViT-B-32"

    # Sales (Fase E de docs/PLAN-POS.md)
    # A single store, single register-series deployment (see PLAN-POS.md §11) —
    # multi-serie would need a way to pick one per sale, not a fixed default.
    default_document_series: str = "B001"
    default_document_type: str = "boleta"
    # Vendedor discount cap as a fraction of the sale's subtotal; admin has no
    # cap. Always audited (descuento_motivo is required whenever a discount is
    # applied, regardless of role).
    discount_max_pct_vendedor: float = 0.10
    # SUNAT requires customer identification once a boleta/ticket exceeds this
    # amount (soles).
    client_data_required_above: float = 700.0
    # Price already includes IGV; this is the rate used to back it out for the
    # receipt breakdown (base = total / (1 + igv_rate)).
    igv_rate: float = 0.18

    # CORS
    cors_origins: str = "http://localhost:5173"

    # Cookies (refresh token). Enable when served over HTTPS (e.g. behind a TLS reverse proxy).
    cookie_secure: bool = False
    # "strict" works when frontend and backend share an origin (this project's
    # default: nginx proxies /api/ to the backend, so the browser never sees a
    # cross-site request). Set to "none" if frontend and backend are split
    # across different domains — the refresh-token cookie otherwise never
    # reaches the backend on a cross-site fetch. "none" requires cookie_secure
    # = true (HTTPS on both sides); browsers reject SameSite=None without Secure.
    cookie_samesite: str = "strict"

    @property
    def cors_origins_list(self) -> list[str]:
        return [origin.strip() for origin in self.cors_origins.split(",") if origin.strip()]


@lru_cache
def get_settings() -> Settings:
    return Settings()
