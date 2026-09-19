import { useState } from "react"
import { ApiError } from "../api/client"
import { scanProductImage, type RecognitionResult as RecognitionResultType } from "../api/recognition"
import { CameraCapture } from "../components/recognition/CameraCapture"
import { RecognitionResult } from "../components/recognition/RecognitionResult"

type Status = "idle" | "scanning" | "done" | "error"

/** Admin-only quick lookup (`/admin/scan`, inside AppShell): identify a
 * product without adding it to anything. The vendedor's equivalent isn't a
 * separate page anymore — it's the inline "Escanear producto" button on the
 * sale screen (SaleScreen/ScanToCartModal), which adds the match straight to
 * the cart instead of just displaying it. */
export function ScanPage() {
  const [status, setStatus] = useState<Status>("idle")
  const [result, setResult] = useState<RecognitionResultType | null>(null)
  const [preview, setPreview] = useState<string | null>(null)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

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
    <div className="mx-auto max-w-md space-y-6">
      <div>
        <h1 className="text-lg font-semibold text-ink">Escanear producto</h1>
        <p className="text-sm text-ink-soft">Toma una foto del producto para identificarlo.</p>
      </div>

      {preview && <img src={preview} alt="" className="mx-auto h-48 w-48 rounded-xl object-cover" />}

      <CameraCapture onCapture={(file) => void handleCapture(file)} disabled={status === "scanning"} />

      {status === "scanning" && <p className="text-center text-sm text-ink-soft">Analizando imagen…</p>}
      {status === "error" && (
        <p className="text-center text-sm" style={{ color: "var(--color-stock-out)" }}>
          {errorMessage}
        </p>
      )}
      {status === "done" && result && <RecognitionResult result={result} />}
    </div>
  )
}
