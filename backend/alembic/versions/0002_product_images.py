"""product images (multiple photos per product)

Revision ID: 0002
Revises: 0001
Create Date: 2026-09-06
"""

from alembic import op
import sqlalchemy as sa
from pgvector.sqlalchemy import VECTOR
from sqlalchemy.dialects import postgresql

revision = "0002"
down_revision = "0001"
branch_labels = None
depends_on = None

EMBEDDING_DIM = 512


def upgrade() -> None:
    op.create_table(
        "product_images",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "product_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("products.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("object_key", sa.String(500), nullable=False),
        sa.Column("thumbnail_object_key", sa.String(500), nullable=True),
        sa.Column("embedding", VECTOR(EMBEDDING_DIM), nullable=True),
        sa.Column("is_primary", sa.Boolean, nullable=False, server_default=sa.false()),
        sa.Column("position", sa.Integer, nullable=False, server_default="0"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )

    op.create_index("ix_product_images_product_id", "product_images", ["product_id"])

    op.create_index(
        "ux_product_images_primary",
        "product_images",
        ["product_id"],
        unique=True,
        postgresql_where=sa.text("is_primary = true"),
    )

    op.create_index(
        "ix_product_images_embedding_cosine",
        "product_images",
        ["embedding"],
        postgresql_using="hnsw",
        postgresql_ops={"embedding": "vector_cosine_ops"},
    )

    # Backfill: every existing product's single photo becomes its cover photo,
    # so no product loses its picture or its embedding.
    op.execute(
        """
        INSERT INTO product_images
            (id, product_id, object_key, thumbnail_object_key, embedding, is_primary, position)
        SELECT gen_random_uuid(), id, image_object_key, thumbnail_object_key, image_embedding, true, 0
        FROM products
        """
    )

    op.drop_index("ix_products_embedding_cosine", table_name="products")
    op.drop_column("products", "image_embedding")


def downgrade() -> None:
    op.add_column("products", sa.Column("image_embedding", VECTOR(EMBEDDING_DIM), nullable=True))

    op.execute(
        """
        UPDATE products
        SET image_embedding = product_images.embedding
        FROM product_images
        WHERE product_images.product_id = products.id
          AND product_images.is_primary = true
        """
    )

    op.create_index(
        "ix_products_embedding_cosine",
        "products",
        ["image_embedding"],
        postgresql_using="hnsw",
        postgresql_ops={"image_embedding": "vector_cosine_ops"},
    )

    op.drop_index("ix_product_images_embedding_cosine", table_name="product_images")
    op.drop_index("ux_product_images_primary", table_name="product_images")
    op.drop_index("ix_product_images_product_id", table_name="product_images")
    op.drop_table("product_images")
