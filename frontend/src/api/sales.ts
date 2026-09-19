import { apiGet, apiPostJson } from "./client"

export type PaymentMethod = "efectivo" | "yape_plin" | "tarjeta" | "transferencia"

export interface SaleItemInput {
  product_id: string
  cantidad: number
}

export interface PaymentInput {
  metodo: PaymentMethod
  monto: number
  referencia?: string | null
  // Only meaningful for "efectivo" — how much cash the customer handed
  // over, so the UI can show the change (vuelto = recibido - monto).
  recibido?: number | null
}

export interface SaleCreateInput {
  items: SaleItemInput[]
  payments: PaymentInput[]
  descuento_monto?: number
  descuento_motivo?: string | null
  cliente_nombre?: string | null
  cliente_doc_tipo?: string | null
  cliente_doc_num?: string | null
  // One per checkout attempt — a retry (double tap, a network blip) reuses
  // the same key so the backend returns the already-created sale instead of
  // charging twice.
  idempotency_key?: string | null
}

export interface SaleItem {
  id: string
  product_id: string
  producto_nombre: string
  unit_price: number
  cantidad: number
  subtotal_linea: number
}

export interface Payment {
  id: string
  metodo: PaymentMethod
  monto: number
  referencia: string | null
  recibido: number | null
}

export interface Sale {
  id: string
  serie: string
  correlativo: number
  tipo_comprobante: string
  estado: "completada" | "anulada"
  subtotal: number
  igv: number
  descuento_monto: number
  descuento_motivo: string | null
  total: number
  cliente_nombre: string | null
  cliente_doc_tipo: string | null
  cliente_doc_num: string | null
  vendedor_id: string
  cash_session_id: string
  anulada_por: string | null
  anulada_en: string | null
  motivo_anulacion: string | null
  idempotency_key: string | null
  estado_sunat: string
  created_at: string
  items: SaleItem[]
  payments: Payment[]
}

export function createSale(input: SaleCreateInput): Promise<Sale> {
  return apiPostJson<Sale>("/sales", input)
}

export function voidSale(id: string, motivo: string): Promise<Sale> {
  return apiPostJson<Sale>(`/sales/${id}/void`, { motivo })
}

export function fetchSale(id: string): Promise<Sale> {
  return apiGet<Sale>(`/sales/${id}`)
}
