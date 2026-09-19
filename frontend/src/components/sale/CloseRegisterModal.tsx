import { useEffect, useRef, useState } from "react"
import { closeCashSession, type CashSession } from "../../api/cashSessions"
import { ApiError } from "../../api/client"
import { formatPrice } from "../../lib/currency"

interface CloseRegisterModalProps {
  open: boolean
  session: CashSession | null
  onClose: () => void
  onClosed: () => void
}

export function CloseRegisterModal({ open, session, onClose, onClosed }: CloseRegisterModalProps) {
  const ref = useRef<HTMLDialogElement>(null)
  const [contado, setContado] = useState("")
  const [notas, setNotas] = useState("")
  const [result, setResult] = useState<CashSession | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    const dialog = ref.current
    if (open) {
      setContado("")
      setNotas("")
      setResult(null)
      setError(null)
      dialog?.showModal()
      return () => dialog?.close()
    }
  }, [open])

  async function handleSubmit() {
    if (!session) return
    setError(null)
    setSubmitting(true)
    try {
      const closed = await closeCashSession(session.id, Number(contado), notas)
      setResult(closed)
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "No se pudo cerrar la caja.")
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <dialog
      ref={ref}
      onClose={onClose}
      onClick={(event) => {
        if (event.target === ref.current) onClose()
      }}
      aria-labelledby="close-register-title"
      className="product-dialog w-[min(92vw,26rem)] rounded-2xl border border-line bg-surface p-5 text-ink shadow-2xl"
    >
      <div className="flex items-start justify-between gap-4">
        <h2 id="close-register-title" className="text-base font-semibold text-ink">
          Cerrar caja
        </h2>
        <button
          type="button"
          onClick={onClose}
          aria-label="Cerrar"
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-lg font-semibold text-ink-soft transition-colors hover:bg-accent-soft active:scale-90"
        >
          ×
        </button>
      </div>

      {!result ? (
        <div className="mt-4 space-y-4">
          <p className="text-sm text-ink-soft">Cuenta el efectivo que hay en la caja ahora.</p>

          <label className="block">
            <span className="mb-1 block text-xs font-medium text-ink-soft">Efectivo contado (S/)</span>
            <input
              type="number"
              inputMode="decimal"
              min="0"
              step="0.10"
              autoFocus
              value={contado}
              onChange={(event) => setContado(event.target.value)}
              className="w-full rounded-lg border border-line bg-inset px-3 py-2 text-sm text-ink focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/30"
            />
          </label>

          <label className="block">
            <span className="mb-1 block text-xs font-medium text-ink-soft">Notas (opcional)</span>
            <textarea
              value={notas}
              onChange={(event) => setNotas(event.target.value)}
              rows={2}
              className="w-full rounded-lg border border-line bg-inset px-3 py-2 text-sm text-ink focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/30"
            />
          </label>

          {error && (
            <p className="animate-fade-in text-sm" style={{ color: "var(--color-stock-out)" }}>
              {error}
            </p>
          )}

          <button
            type="button"
            onClick={() => void handleSubmit()}
            disabled={submitting || contado === ""}
            className="w-full rounded-lg bg-ink py-2.5 text-sm font-semibold text-paper transition-transform active:scale-[0.98] disabled:opacity-60"
          >
            {submitting ? "Cerrando…" : "Cerrar caja"}
          </button>
        </div>
      ) : (
        <div className="animate-fade-in mt-4 space-y-3">
          <div className="space-y-1 text-sm">
            <div className="flex justify-between text-ink-soft">
              <span>Efectivo esperado</span>
              <span className="tabular-nums">
                {formatPrice((result.contado_efectivo ?? 0) - (result.diferencia ?? 0))}
              </span>
            </div>
            <div className="flex justify-between text-ink-soft">
              <span>Efectivo contado</span>
              <span className="tabular-nums">{formatPrice(result.contado_efectivo ?? 0)}</span>
            </div>
            <div className="flex justify-between text-base font-semibold text-ink">
              <span>Diferencia</span>
              <span
                className="tabular-nums"
                style={{
                  color:
                    (result.diferencia ?? 0) === 0
                      ? "var(--color-stock-good)"
                      : "var(--color-stock-out)",
                }}
              >
                {formatPrice(result.diferencia ?? 0)}
              </span>
            </div>
          </div>

          <button
            type="button"
            onClick={onClosed}
            className="w-full rounded-lg bg-ink py-2.5 text-sm font-semibold text-paper transition-transform active:scale-[0.98]"
          >
            Entendido
          </button>
        </div>
      )}
    </dialog>
  )
}
