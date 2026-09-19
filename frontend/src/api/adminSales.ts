import { apiGet } from "./client"
import type { Sale } from "./sales"

export interface PaymentMethodTotal {
  metodo: string
  total: number
  cantidad: number
}

export interface VendorTotal {
  vendedor_id: string
  vendedor_nombre: string
  total: number
  cantidad_ventas: number
}

export interface TopProduct {
  product_id: string
  nombre: string
  cantidad_vendida: number
  total_vendido: number
}

export interface LowStockProduct {
  id: string
  name: string
  stock: number
}

export interface DailyTotal {
  fecha: string
  total: number
}

export interface SalesSummary {
  desde: string
  hasta: string
  total_vendido: number
  cantidad_ventas: number
  ticket_promedio: number
  total_descuentos: number
  cantidad_anuladas: number
  monto_anulado: number
  por_metodo_pago: PaymentMethodTotal[]
  por_vendedor: VendorTotal[]
  top_productos: TopProduct[]
  stock_bajo: LowStockProduct[]
  por_dia: DailyTotal[]
}

export interface SalesPage {
  items: Sale[]
  total: number
  page: number
  page_size: number
}

export function fetchSalesSummary(desde?: string, hasta?: string): Promise<SalesSummary> {
  const params = new URLSearchParams()
  if (desde) params.set("desde", desde)
  if (hasta) params.set("hasta", hasta)
  const query = params.toString()
  return apiGet<SalesSummary>(`/admin/sales/summary${query ? `?${query}` : ""}`)
}

export function fetchSalesPage(options: { desde?: string; hasta?: string; page?: number; pageSize?: number }): Promise<SalesPage> {
  const params = new URLSearchParams()
  if (options.desde) params.set("desde", options.desde)
  if (options.hasta) params.set("hasta", options.hasta)
  params.set("page", String(options.page ?? 1))
  params.set("page_size", String(options.pageSize ?? 20))
  return apiGet<SalesPage>(`/admin/sales?${params.toString()}`)
}
