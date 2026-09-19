import { useEffect, useState } from "react"
import { fetchCurrentCashSession, openCashSession, type CashSession } from "../api/cashSessions"
import { OpenRegisterScreen } from "../components/sale/OpenRegisterScreen"
import { SaleScreen } from "../components/sale/SaleScreen"

type Status = "loading" | "closed" | "open" | "error"

/** The real vendedor landing page (Fase F) — replaces the Fase C/D
 * placeholder. "Caja cerrada" and "caja abierta" are two different screens
 * entirely (OpenRegisterScreen / SaleScreen): nothing here can sell without
 * an open register, mirroring the backend's own guard in services/sales.py. */
export function VenderPage() {
  const [status, setStatus] = useState<Status>("loading")
  const [session, setSession] = useState<CashSession | null>(null)

  function loadCurrentSession() {
    setStatus("loading")
    fetchCurrentCashSession()
      .then((current) => {
        setSession(current)
        setStatus(current ? "open" : "closed")
      })
      .catch(() => setStatus("error"))
  }

  useEffect(loadCurrentSession, [])

  if (status === "loading") {
    return (
      <div className="flex min-h-svh items-center justify-center text-sm text-ink-soft">Cargando…</div>
    )
  }

  if (status === "error") {
    return (
      <div className="flex min-h-svh items-center justify-center px-4 text-center text-sm" style={{ color: "var(--color-stock-out)" }}>
        No se pudo cargar el estado de la caja. Recarga la página.
      </div>
    )
  }

  if (status === "open" && session) {
    return <SaleScreen session={session} onSessionClosed={loadCurrentSession} />
  }

  return (
    <OpenRegisterScreen
      onOpen={async (montoInicial) => {
        const opened = await openCashSession(montoInicial)
        setSession(opened)
        setStatus("open")
      }}
    />
  )
}
