import { useEffect, useRef, useState } from "react"
import { ApiError } from "../../api/client"
import { scanProductImage, type RecognitionMatch } from "../../api/recognition"
import { CameraCapture } from "../recognition/CameraCapture"

interface ScanToCartModalProps {
  open: boolean
  onClose: () => void
  onMatch: (match: RecognitionMatch) => void
}

type Status = "idle" | "scanning" | "error"

/** The Fase F counterpart to PublicScanModal: same camera pipeline, but a
 * found match is added straight to the cart instead of just displayed —
 * this is the "point the camera and it's in the cart" flow the plan calls
 * the app's real differentiator. */
export function ScanToCartModal({ open, onClose, onMatch }: ScanToCartModalProps) {
  const ref = useRef<HTMLDialogElement>(null)
  const [status, setStatus] = useState<Status>("idle")
  const [message, setMessage] = useState<string | null>(null)

  useEffect(() => {
    const dialog = ref.current
    if (open) {
      setStatus("idle")
      setMessage(null)
      dialog?.showModal()
      return () => dialog?.close()
    }
  }, [open])

  async function handleCapture(file: File) {
    setStatus("scanning")
    setMessage(null)
    try {
      const result = await scanProductImage(file)
      if (result.match_type === "not_found") {
        setStatus("error")
        setMessage(result.reason)
        return
      }
      // Reset before closing: the dialog hides via the `open` prop turning
      // false, but this component stays mounted, so leaving status at
      // "scanning" would sit in the hidden DOM until the next open resets it.
      setStatus("idle")
      onMatch(result)
      onClose()
    } catch (err) {
      setStatus("error")
      setMessage(err instanceof ApiError ? err.message : "No se pudo procesar la imagen.")
    }
  }

  return (
    <dialog
      ref={ref}
      onClose={onClose}
      onClick={(event) => {
        if (event.target === ref.current) onClose()
      }}
      aria-labelledby="scan-to-cart-title"
      className="product-dialog w-[min(92vw,26rem)] rounded-2xl border border-line bg-surface p-5 text-ink shadow-2xl"
    >
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 id="scan-to-cart-title" className="text-base font-semibold text-ink">
            Escanear producto
          </h2>
          <p className="text-sm text-ink-soft">Se agrega al carrito apenas lo identifica.</p>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Cerrar"
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-lg font-semibold text-ink-soft transition-colors hover:bg-accent-soft active:scale-90"
        >
          ×
        </button>
      </div>

      <div className="mt-4 space-y-4">
        <CameraCapture onCapture={(file) => void handleCapture(file)} disabled={status === "scanning"} />

        {status === "scanning" && <p className="text-center text-sm text-ink-soft">Analizando imagen…</p>}
        {status === "error" && message && (
          <p className="text-center text-sm" style={{ color: "var(--color-stock-out)" }}>
            {message}
          </p>
        )}
      </div>
    </dialog>
  )
}
