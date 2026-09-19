import { useState, type FormEvent } from "react"
import { ApiError } from "../../api/client"
import { ThemeToggle } from "../layout/ThemeToggle"

interface OpenRegisterScreenProps {
  onOpen: (montoInicial: number) => Promise<void>
}

export function OpenRegisterScreen({ onOpen }: OpenRegisterScreenProps) {
  const [montoInicial, setMontoInicial] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    setError(null)
    setSubmitting(true)
    try {
      await onOpen(Number(montoInicial))
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "No se pudo abrir la caja.")
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="flex min-h-svh items-center justify-center bg-paper px-4">
      <form
        onSubmit={handleSubmit}
        className="animate-fade-in w-full max-w-sm rounded-xl border border-line bg-surface p-6 shadow-sm"
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="font-display text-lg font-semibold tracking-tight text-ink">Abrir caja</p>
            <p className="mt-1 text-sm text-ink-soft">Cuenta el efectivo con el que empiezas el turno.</p>
          </div>
          <ThemeToggle />
        </div>

        <label className="mt-6 block">
          <span className="mb-1 block text-xs font-medium text-ink-soft">Monto inicial (S/)</span>
          <input
            type="number"
            inputMode="decimal"
            min="0"
            step="0.10"
            required
            autoFocus
            value={montoInicial}
            onChange={(event) => setMontoInicial(event.target.value)}
            className="w-full rounded-lg border border-line bg-inset px-3 py-2 text-sm text-ink focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/30"
          />
        </label>

        {error && (
          <p className="animate-fade-in mt-4 text-sm" style={{ color: "var(--color-stock-out)" }}>
            {error}
          </p>
        )}

        <button
          type="submit"
          disabled={submitting}
          className="mt-6 w-full rounded-lg bg-ink py-2.5 text-sm font-semibold text-paper transition-transform active:scale-[0.98] disabled:opacity-60"
        >
          {submitting ? "Abriendo…" : "Abrir caja"}
        </button>
      </form>
    </div>
  )
}
