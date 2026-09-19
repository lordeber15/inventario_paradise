import uuid
from datetime import datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field

PaymentMethod = Literal["efectivo", "yape_plin", "tarjeta", "transferencia"]


class SaleItemIn(BaseModel):
    product_id: uuid.UUID
    cantidad: int = Field(gt=0)


class PaymentIn(BaseModel):
    metodo: PaymentMethod
    monto: float = Field(gt=0)
    referencia: str | None = None
    # Only meaningful for metodo == "efectivo" — how much cash the customer
    # handed over, so the frontend can show the change. Ignored otherwise.
    recibido: float | None = None


class SaleCreate(BaseModel):
    items: list[SaleItemIn]
    payments: list[PaymentIn]
    descuento_monto: float = Field(default=0, ge=0)
    descuento_motivo: str | None = None
    cliente_nombre: str | None = None
    cliente_doc_tipo: str | None = None
    cliente_doc_num: str | None = None
    # One per checkout attempt, generated client-side — see Sale.idempotency_key.
    idempotency_key: str | None = Field(default=None, max_length=100)


class SaleItemOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    product_id: uuid.UUID
    producto_nombre: str
    unit_price: float
    cantidad: int
    subtotal_linea: float


class PaymentOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    metodo: PaymentMethod
    monto: float
    referencia: str | None
    recibido: float | None


class SaleOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    serie: str
    correlativo: int
    tipo_comprobante: str
    estado: Literal["completada", "anulada"]
    subtotal: float
    igv: float
    descuento_monto: float
    descuento_motivo: str | None
    total: float
    cliente_nombre: str | None
    cliente_doc_tipo: str | None
    cliente_doc_num: str | None
    vendedor_id: uuid.UUID
    cash_session_id: uuid.UUID
    anulada_por: uuid.UUID | None
    anulada_en: datetime | None
    motivo_anulacion: str | None
    idempotency_key: str | None
    estado_sunat: str
    created_at: datetime
    items: list[SaleItemOut]
    payments: list[PaymentOut]


class VoidSaleIn(BaseModel):
    motivo: str = Field(min_length=1, max_length=1000)


class OpenCashSessionIn(BaseModel):
    monto_inicial: float = Field(ge=0)


class CloseCashSessionIn(BaseModel):
    contado_efectivo: float = Field(ge=0)
    notas: str = Field(default="", max_length=2000)


class CashSessionOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    usuario_id: uuid.UUID
    abierta_en: datetime
    cerrada_en: datetime | None
    monto_inicial: float
    contado_efectivo: float | None
    diferencia: float | None
    notas: str
