import { useState, type FormEvent } from "react"
import { Navigate, useLocation, useNavigate } from "react-router-dom"
import { useAuth } from "../context/AuthContext"
import { BrandLogo } from "../components/layout/BrandLogo"
import { ThemeToggle } from "../components/layout/ThemeToggle"

export function LoginPage() {
  const { status, user, login } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [username, setUsername] = useState("")
  const [password, setPassword] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  // Where a session lands by default once we know the role — a vendedor has
  // no reason to end up on the admin product list.
  const defaultDestination = user?.role === "admin" ? "/admin" : "/vender"

  if (status === "authenticated") {
    const redirectTo = (location.state as { from?: string } | null)?.from ?? defaultDestination
    return <Navigate to={redirectTo} replace />
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    setError(null)
    setSubmitting(true)
    try {
      const me = await login(username, password)
      const from = (location.state as { from?: string } | null)?.from
      navigate(from ?? (me.role === "admin" ? "/admin" : "/vender"), { replace: true })
    } catch {
      setError("Usuario o contraseña incorrectos.")
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="flex min-h-svh items-center justify-center bg-paper px-4">
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-sm rounded-xl border border-line bg-surface p-6 shadow-sm"
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <BrandLogo />
            <p className="mt-1 text-sm text-ink-soft">Iniciar sesión</p>
          </div>
          <ThemeToggle />
        </div>

        <div className="mt-6 space-y-4">
          <label className="block">
            <span className="mb-1 block text-xs font-medium text-ink-soft">Usuario</span>
            <input
              type="text"
              autoComplete="username"
              required
              value={username}
              onChange={(event) => setUsername(event.target.value)}
              className="w-full rounded-lg border border-line bg-inset px-3 py-2 text-sm text-ink focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/30"
            />
          </label>

          <label className="block">
            <span className="mb-1 block text-xs font-medium text-ink-soft">Contraseña</span>
            <input
              type="password"
              autoComplete="current-password"
              required
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              className="w-full rounded-lg border border-line bg-inset px-3 py-2 text-sm text-ink focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/30"
            />
          </label>
        </div>

        {error && (
          <p className="mt-4 text-sm" style={{ color: "var(--color-stock-out)" }}>
            {error}
          </p>
        )}

        <button
          type="submit"
          disabled={submitting}
          className="mt-6 w-full rounded-lg bg-ink py-2.5 text-sm font-semibold text-paper disabled:opacity-60"
        >
          {submitting ? "Ingresando…" : "Ingresar"}
        </button>
      </form>
    </div>
  )
}
