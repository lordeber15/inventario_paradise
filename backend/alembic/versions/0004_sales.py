"""sales core: document series, cash sessions, sales, sale items/payments, inventory movements

Revision ID: 0004
Revises: 0003
Create Date: 2026-09-06
"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = "0004"
down_revision = "0003"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "document_series",
        sa.Column("serie", sa.String(10), primary_key=True),
        sa.Column("tipo_comprobante", sa.String(20), nullable=False),
        sa.Column("ultimo_correlativo", sa.Integer, nullable=False, server_default="0"),
        sa.CheckConstraint("tipo_comprobante IN ('boleta', 'ticket')", name="ck_document_series_tipo_valid"),
    )
    # Single-store default series (see PLAN-POS.md §11) — an admin UI to
    # manage series is out of scope until multi-serie is actually needed.
    op.execute("INSERT INTO document_series (serie, tipo_comprobante, ultimo_correlativo) VALUES ('B001', 'boleta', 0)")

    op.create_table(
        "cash_sessions",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("usuario_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("abierta_en", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("cerrada_en", sa.DateTime(timezone=True), nullable=True),
        sa.Column("monto_inicial", sa.Numeric(12, 2), nullable=False),
        sa.Column("contado_efectivo", sa.Numeric(12, 2), nullable=True),
        sa.Column("diferencia", sa.Numeric(12, 2), nullable=True),
        sa.Column("notas", sa.Text, nullable=False, server_default=""),
    )
    op.create_index(
        "ux_cash_sessions_open_per_user",
        "cash_sessions",
        ["usuario_id"],
        unique=True,
        postgresql_where=sa.text("cerrada_en IS NULL"),
    )

    op.create_table(
        "sales",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("serie", sa.String(10), nullable=False),
        sa.Column("correlativo", sa.Integer, nullable=False),
        sa.Column("tipo_comprobante", sa.String(20), nullable=False),
        sa.Column("estado", sa.String(20), nullable=False, server_default="completada"),
        sa.Column("subtotal", sa.Numeric(12, 2), nullable=False),
        sa.Column("igv", sa.Numeric(12, 2), nullable=False),
        sa.Column("descuento_monto", sa.Numeric(12, 2), nullable=False, server_default="0"),
        sa.Column("descuento_motivo", sa.Text, nullable=True),
        sa.Column("total", sa.Numeric(12, 2), nullable=False),
        sa.Column("cliente_nombre", sa.String(200), nullable=True),
        sa.Column("cliente_doc_tipo", sa.String(10), nullable=True),
        sa.Column("cliente_doc_num", sa.String(20), nullable=True),
        sa.Column("vendedor_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id"), nullable=False),
        sa.Column(
            "cash_session_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("cash_sessions.id"), nullable=False
        ),
        sa.Column("anulada_por", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id"), nullable=True),
        sa.Column("anulada_en", sa.DateTime(timezone=True), nullable=True),
        sa.Column("motivo_anulacion", sa.Text, nullable=True),
        sa.Column("idempotency_key", sa.String(100), unique=True, nullable=True),
        sa.Column("estado_sunat", sa.String(20), nullable=False, server_default="no_emitido"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.UniqueConstraint("serie", "correlativo", name="uq_sales_serie_correlativo"),
        sa.CheckConstraint("estado IN ('completada', 'anulada')", name="ck_sales_estado_valid"),
        sa.CheckConstraint("tipo_comprobante IN ('boleta', 'ticket')", name="ck_sales_tipo_valid"),
        sa.CheckConstraint("subtotal >= 0 AND igv >= 0 AND total >= 0", name="ck_sales_amounts_non_negative"),
        sa.CheckConstraint("descuento_monto >= 0", name="ck_sales_descuento_non_negative"),
    )

    op.create_table(
        "sale_items",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("sale_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("sales.id", ondelete="CASCADE"), nullable=False),
        sa.Column("product_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("products.id"), nullable=False),
        sa.Column("producto_nombre", sa.String(200), nullable=False),
        sa.Column("unit_price", sa.Numeric(12, 2), nullable=False),
        sa.Column("cantidad", sa.Integer, nullable=False),
        sa.Column("subtotal_linea", sa.Numeric(12, 2), nullable=False),
        sa.CheckConstraint("cantidad > 0", name="ck_sale_items_cantidad_positive"),
        sa.CheckConstraint("unit_price >= 0 AND subtotal_linea >= 0", name="ck_sale_items_amounts_non_negative"),
    )

    op.create_table(
        "sale_payments",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("sale_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("sales.id", ondelete="CASCADE"), nullable=False),
        sa.Column("metodo", sa.String(20), nullable=False),
        sa.Column("monto", sa.Numeric(12, 2), nullable=False),
        sa.Column("referencia", sa.String(100), nullable=True),
        sa.Column("recibido", sa.Numeric(12, 2), nullable=True),
        sa.CheckConstraint(
            "metodo IN ('efectivo', 'yape_plin', 'tarjeta', 'transferencia')", name="ck_sale_payments_metodo_valid"
        ),
        sa.CheckConstraint("monto > 0", name="ck_sale_payments_monto_positive"),
    )

    op.create_table(
        "inventory_movements",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("product_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("products.id"), nullable=False),
        sa.Column("delta", sa.Integer, nullable=False),
        sa.Column("motivo", sa.String(20), nullable=False),
        sa.Column("sale_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("sales.id"), nullable=True),
        sa.Column("usuario_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.CheckConstraint(
            "motivo IN ('venta', 'anulacion', 'ajuste', 'alta')", name="ck_inventory_movements_motivo_valid"
        ),
    )


def downgrade() -> None:
    op.drop_table("inventory_movements")
    op.drop_table("sale_payments")
    op.drop_table("sale_items")
    op.drop_table("sales")
    op.drop_index("ux_cash_sessions_open_per_user", table_name="cash_sessions")
    op.drop_table("cash_sessions")
    op.drop_table("document_series")
