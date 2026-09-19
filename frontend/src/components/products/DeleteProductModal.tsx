import { useEffect, useRef, useState } from "react"
import { ApiError } from "../../api/client"
import type { AdminProduct } from "../../api/products"

interface DeleteProductModalProps {
  product: AdminProduct | null
  onClose: () => void
  onConfirm: () => Promise<void>
}

/** Replaces a bare window.confirm() — the confirm message already explained
 * the consequence ("podrás restaurarlo luego"), but as plain browser chrome
 * it looked like every other confirm on the web, destructive or not. */
export function DeleteProductModal({ product, onClose, onConfirm }: DeleteProductModalProps) {
  const ref = useRef<HTMLDialogElement>(null)
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    const dialog = ref.current
    if (product) {
      setError(null)
      dialog?.showModal()
      return () => dialog?.close()
    }
  }, [product])

  async function handleConfirm() {
    setSubmitting(true)
    setError(null)
    try {
      await onConfirm()
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "No se pudo eliminar el producto.")
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
      aria-labelledby="delete-product-title"
      className="product-dialog w-[min(92vw,26rem)] rounded-2xl border border-line bg-surface p-5 text-ink shadow-2xl"
    >
      {product && (
        <>
          <div className="flex items-start justify-between gap-4">
            <h2 id="delete-product-title" className="text-base font-semibold text-ink">
              Eliminar "{product.name}"
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
            Desaparece del catálogo público y de la venta. No se borra: podrás restaurarlo luego con "Incluir
            eliminados".
          </p>

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
              Cancelar
            </button>
            <button
              type="button"
              onClick={() => void handleConfirm()}
              disabled={submitting}
              className="flex-1 rounded-lg px-4 py-2.5 text-sm font-semibold text-paper transition-transform active:scale-[0.98] disabled:opacity-60"
              style={{ backgroundColor: "var(--color-stock-out)" }}
            >
              {submitting ? "Eliminando…" : "Eliminar"}
            </button>
          </div>
        </>
      )}
    </dialog>
  )
}
