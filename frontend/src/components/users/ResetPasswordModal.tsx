import { useEffect, useRef, useState } from "react"
import { ApiError } from "../../api/client"
import type { AdminUserRow } from "../../api/users"

interface ResetPasswordModalProps {
  user: AdminUserRow | null
  onClose: () => void
  onConfirm: (newPassword: string) => Promise<void>
}

/** Replaces window.prompt() + window.alert() for password resets — native
 * dialogs can't enforce the minimum length up front or confirm success
 * without blocking the page with browser chrome. */
export function ResetPasswordModal({ user, onClose, onConfirm }: ResetPasswordModalProps) {
  const ref = useRef<HTMLDialogElement>(null)
  const [password, setPassword] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [done, setDone] = useState(false)

  useEffect(() => {
    const dialog = ref.current
    if (user) {
      setPassword("")
      setError(null)
      setDone(false)
      dialog?.showModal()
      return () => dialog?.close()
    }
  }, [user])

  const canSubmit = password.trim().length >= 8

  async function handleSubmit() {
    if (!user || !canSubmit) return
    setSubmitting(true)
    setError(null)
    try {
      await onConfirm(password.trim())
      setDone(true)
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "No se pudo restablecer la contraseña.")
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
      aria-labelledby="reset-password-title"
      className="product-dialog w-[min(92vw,26rem)] rounded-2xl border border-line bg-surface p-5 text-ink shadow-2xl"
    >
      {user && (
        <>
          <div className="flex items-start justify-between gap-4">
            <h2 id="reset-password-title" className="text-base font-semibold text-ink">
              {done ? "Contraseña actualizada" : `Restablecer clave de "${user.username}"`}
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

          {done ? (
            <>
              <p className="mt-3 text-sm text-ink-soft">
                La nueva contraseña de "{user.username}" ya está activa.
              </p>
              <div className="mt-4 flex gap-2">
                <button
                  type="button"
                  onClick={onClose}
                  className="flex-1 rounded-lg bg-ink px-4 py-2.5 text-sm font-semibold text-paper transition-transform active:scale-[0.98]"
                >
                  Listo
                </button>
              </div>
            </>
          ) : (
            <>
              <label className="mt-4 block">
                <span className="mb-1 block text-xs font-medium text-ink-soft">
                  Nueva contraseña (mínimo 8 caracteres)
                </span>
                <input
                  autoFocus
                  type="password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") void handleSubmit()
                  }}
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
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={() => void handleSubmit()}
                  disabled={submitting || !canSubmit}
                  className="flex-1 rounded-lg bg-ink px-4 py-2.5 text-sm font-semibold text-paper transition-transform active:scale-[0.98] disabled:opacity-60"
                >
                  {submitting ? "Guardando…" : "Restablecer"}
                </button>
              </div>
            </>
          )}
        </>
      )}
    </dialog>
  )
}
