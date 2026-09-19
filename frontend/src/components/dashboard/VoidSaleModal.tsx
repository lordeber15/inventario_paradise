import { useEffect, useRef, useState } from "react"
import { ApiError } from "../../api/client"
import type { Sale } from "../../api/sales"

interface VoidSaleModalProps {
  sale: Sale | null
  onClose: () => void
  onConfirm: (motivo: string) => Promise<void>
}

/** Replaces a bare window.prompt() — this is the one place in the app that
 * reverses a completed sale, and a native prompt can't show what that
 * actually does (restores stock, never deletes the row) or surface a
 * rejected request without losing the reason the admin already typed. */
export function VoidSaleModal({ sale, onClose, onConfirm }: VoidSaleModalProps) {
  const ref = useRef<HTMLDialogElement>(null)
  const [motivo, setMotivo] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    const dialog = ref.current
    if (sale) {
      setMotivo("")
      setError(null)
      dialog?.showModal()
      return () => dialog?.close()
    }
  }, [sale])

  async function handleSubmit() {
    if (!sale || !motivo.trim()) return
    setSubmitting(true)
    setError(null)
    try {
      await onConfirm(motivo.trim())
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "No se pudo anular la venta.")
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
      aria-labelledby="void-sale-title"
      className="product-dialog w-[min(92vw,26rem)] rounded-2xl border border-line bg-surface p-5 text-ink shadow-2xl"
    >
      {sale && (
        <>
          <div className="flex items-start justify-between gap-4">
            <h2 id="void-sale-title" className="text-base font-semibold text-ink">
              Anular {sale.serie}-{String(sale.correlativo).padStart(6, "0")}
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

          <p className="mt-3 text-sm text-ink-soft">
            Repone el stock de los productos vendidos y la excluye de los totales. La venta no se borra: queda
            registrada como anulada.
          </p>

          <label className="mt-4 block">
            <span className="mb-1 block text-xs font-medium text-ink-soft">Motivo (obligatorio)</span>
            <textarea
              autoFocus
              rows={2}
              value={motivo}
              onChange={(event) => setMotivo(event.target.value)}
              className="w-full rounded-lg border border-line bg-inset px-3 py-2 text-sm text-ink focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/30"
            />
          </label>

          {error && (
            <p className="animate-fade-in mt-3 text-sm" style={{ color: "var(--color-stock-out)" }}>
              {error}
            </p>
          )}

          <div className="mt-4 flex gap-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 rounded-lg border border-line bg-surface px-4 py-2.5 text-sm font-medium text-ink transition-transform active:scale-[0.98]"
            >
              Volver
            </button>
            <button
              type="button"
              onClick={() => void handleSubmit()}
              disabled={submitting || !motivo.trim()}
              className="flex-1 rounded-lg px-4 py-2.5 text-sm font-semibold text-paper transition-transform active:scale-[0.98] disabled:opacity-60"
              style={{ backgroundColor: "var(--color-stock-out)" }}
            >
              {submitting ? "Anulando…" : "Anular venta"}
            </button>
          </div>
        </>
      )}
    </dialog>
  )
}
