import { apiGet, apiPostJson } from "./client"

export interface CashSession {
  id: string
  usuario_id: string
  abierta_en: string
  cerrada_en: string | null
  monto_inicial: number
  contado_efectivo: number | null
  diferencia: number | null
  notas: string
}

export function openCashSession(montoInicial: number): Promise<CashSession> {
  return apiPostJson<CashSession>("/cash-sessions", { monto_inicial: montoInicial })
}

export function fetchCurrentCashSession(): Promise<CashSession | null> {
  return apiGet<CashSession | null>("/cash-sessions/current")
}

export function closeCashSession(id: string, contadoEfectivo: number, notas: string): Promise<CashSession> {
  return apiPostJson<CashSession>(`/cash-sessions/${id}/close`, { contado_efectivo: contadoEfectivo, notas })
}
