#!/bin/sh
set -eu

: "${MINIO_ROOT_USER:?MINIO_ROOT_USER is required}"
: "${MINIO_ROOT_PASSWORD:?MINIO_ROOT_PASSWORD is required}"
: "${MINIO_BUCKET:=product-images}"

mc alias set local http://minio:9000 "$MINIO_ROOT_USER" "$MINIO_ROOT_PASSWORD"

if ! mc ls "local/$MINIO_BUCKET" >/dev/null 2>&1; then
  mc mb "local/$MINIO_BUCKET"
fi

# Public read-only access: product photos/thumbnails are not sensitive,
# and this lets the read-only catalog render images without presigned URLs.
mc anonymous set download "local/$MINIO_BUCKET"

echo "MinIO bucket '$MINIO_BUCKET' ready."
