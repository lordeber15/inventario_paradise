import uuid
from datetime import date

from pydantic import BaseModel

from app.schemas.sale import SaleOut


class PaymentMethodTotal(BaseModel):
    metodo: str
    total: float
    cantidad: int


class VendorTotal(BaseModel):
    vendedor_id: uuid.UUID
    vendedor_nombre: str
    total: float
    cantidad_ventas: int


class TopProduct(BaseModel):
    product_id: uuid.UUID
    nombre: str
    cantidad_vendida: int
    total_vendido: float


class LowStockProduct(BaseModel):
    id: uuid.UUID
    name: str
    stock: int


class DailyTotal(BaseModel):
    fecha: date
    total: float


class SalesSummaryOut(BaseModel):
    desde: date
    hasta: date
    total_vendido: float
    cantidad_ventas: int
    ticket_promedio: float
    total_descuentos: float
    cantidad_anuladas: int
    monto_anulado: float
    por_metodo_pago: list[PaymentMethodTotal]
    por_vendedor: list[VendorTotal]
    top_productos: list[TopProduct]
    stock_bajo: list[LowStockProduct]
    por_dia: list[DailyTotal]


class SalesPageOut(BaseModel):
    items: list[SaleOut]
    total: int
    page: int
    page_size: int
