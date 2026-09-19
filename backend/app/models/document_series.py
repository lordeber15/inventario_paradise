from sqlalchemy import CheckConstraint, Integer, String
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base

TIPO_BOLETA = "boleta"
TIPO_TICKET = "ticket"
VALID_DOCUMENT_TYPES = (TIPO_BOLETA, TIPO_TICKET)


class DocumentSeries(Base):
    """One row per comprobante series (e.g. 'B001'). `ultimo_correlativo` is
    incremented under `SELECT ... FOR UPDATE` inside the sale transaction
    (see services/sales.py) — that row lock is what SUNAT's "no gaps, no
    duplicates" correlativo requirement actually rests on, not application
    logic alone."""

    __tablename__ = "document_series"
    __table_args__ = (
        CheckConstraint("tipo_comprobante IN ('boleta', 'ticket')", name="ck_document_series_tipo_valid"),
    )

    serie: Mapped[str] = mapped_column(String(10), primary_key=True)
    tipo_comprobante: Mapped[str] = mapped_column(String(20), nullable=False)
    ultimo_correlativo: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
