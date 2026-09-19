import io
import uuid
from functools import lru_cache

from minio import Minio

from app.config import get_settings


@lru_cache
def get_minio_client() -> Minio:
    settings = get_settings()
    return Minio(
        settings.minio_endpoint,
        access_key=settings.minio_root_user,
        secret_key=settings.minio_root_password,
        secure=settings.minio_secure,
    )


def _new_object_key(prefix: str, content_type: str) -> str:
    extension = content_type.split("/")[-1]
    return f"{prefix}/{uuid.uuid4()}.{extension}"


def _put(prefix: str, content: bytes, content_type: str) -> str:
    settings = get_settings()
    object_key = _new_object_key(prefix, content_type)
    get_minio_client().put_object(
        settings.minio_bucket,
        object_key,
        data=io.BytesIO(content),
        length=len(content),
        content_type=content_type,
    )
    return object_key


def upload_image(content: bytes, content_type: str) -> str:
    return _put("products", content, content_type)


def upload_thumbnail(content: bytes, content_type: str = "image/jpeg") -> str:
    return _put("thumbnails", content, content_type)


def upload_logo(content: bytes, content_type: str) -> str:
    return _put("branding", content, content_type)


def delete_object(object_key: str) -> None:
    settings = get_settings()
    get_minio_client().remove_object(settings.minio_bucket, object_key)


def public_url(object_key: str) -> str:
    settings = get_settings()
    return f"{settings.minio_public_url}/{settings.minio_bucket}/{object_key}"
