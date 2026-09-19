import { useRef } from "react"

interface CameraCaptureProps {
  onCapture: (file: File) => void
  disabled?: boolean
}

export function CameraCapture({ onCapture, disabled }: CameraCaptureProps) {
  const inputRef = useRef<HTMLInputElement>(null)

  return (
    <div className="flex flex-col items-center gap-3">
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={(event) => {
          const file = event.target.files?.[0]
          if (file) onCapture(file)
          event.target.value = ""
        }}
      />
      <button
        type="button"
        disabled={disabled}
        onClick={() => inputRef.current?.click()}
        className="w-full max-w-xs rounded-xl bg-ink py-4 text-base font-semibold text-paper disabled:opacity-60"
      >
        {disabled ? "Analizando…" : "Escanear producto"}
      </button>
      <p className="text-center text-xs text-ink-soft">
        Apunta primero al código de barras. Si no se ve ninguno, se busca por parecido visual.
      </p>
    </div>
  )
}
