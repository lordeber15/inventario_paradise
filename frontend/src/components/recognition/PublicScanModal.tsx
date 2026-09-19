import { useEffect, useRef, useState } from "react"
import { ApiError } from "../../api/client"
import { scanProductImage, type RecognitionResult as RecognitionResultType } from "../../api/recognition"
import { CameraCapture } from "./CameraCapture"
import { RecognitionResult } from "./RecognitionResult"

interface PublicScanModalProps {
  open: boolean
  onClose: () => void
}

type Status = "idle" | "scanning" | "done" | "error"

/** The anonymous half of Fase D's "escaneo por rol": no session, capped at
 * the tightest rate-limit tier server-side, and the response never includes
 * the product name (see RecognitionResult, which already renders that case). */
export function PublicScanModal({ open, onClose }: PublicScanModalProps) {
  const ref = useRef<HTMLDialogElement>(null)
  const [status, setStatus] = useState<Status>("idle")
  const [result, setResult] = useState<RecognitionResultType | null>(null)
  const [preview, setPreview] = useState<string | null>(null)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  useEffect(() => {
    const dialog = ref.current
    if (open) {
      // Starts each opening from a clean slate — the alternative (resetting
      // on close) would blank the content while the closing transition is
      // still visibly playing.
      setStatus("idle")
      setResult(null)
      setPreview(null)
      setErrorMessage(null)
      dialog?.showModal()
      return () => dialog?.close()
    }
  }, [open])

  async function handleCapture(file: File) {
    setPreview(URL.createObjectURL(file))
    setStatus("scanning")
    setResult(null)
    setErrorMessage(null)
    try {
      const data = await scanProductImage(file)
      setResult(data)
      setStatus("done")
    } catch (err) {
      setErrorMessage(err instanceof ApiError ? err.message : "No se pudo procesar la imagen.")
      setStatus("error")
    }
  }

  return (
    <dialog
      ref={ref}
      onClose={onClose}
      onClick={(event) => {
        if (event.target === ref.current) onClose()
      }}
      aria-labelledby="scan-modal-title"
      className="product-dialog w-[min(92vw,26rem)] rounded-2xl border border-line bg-surface p-5 text-ink shadow-2xl"
    >
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 id="scan-modal-title" className="text-base font-semibold text-ink">
            Buscar por foto
          </h2>
          <p className="text-sm text-ink-soft">Tomá una foto para identificar el producto.</p>
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
        {preview && <img src={preview} alt="" className="mx-auto h-40 w-40 rounded-xl object-cover" />}

        <CameraCapture onCapture={(file) => void handleCapture(file)} disabled={status === "scanning"} />

        {status === "scanning" && <p className="text-center text-sm text-ink-soft">Analizando imagen…</p>}
        {status === "error" && (
          <p className="text-center text-sm" style={{ color: "var(--color-stock-out)" }}>
            {errorMessage}
          </p>
        )}
        {status === "done" && result && <RecognitionResult result={result} />}
      </div>
    </dialog>
  )
}
