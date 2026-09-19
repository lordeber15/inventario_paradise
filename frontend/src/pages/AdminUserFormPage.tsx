import { useState, type FormEvent } from "react"
import { useNavigate } from "react-router-dom"
import { ApiError } from "../api/client"
import { createUser, type UserCreateValues } from "../api/users"

const INPUT_CLASS =
  "w-full rounded-lg border border-line bg-inset px-3 py-2 text-sm text-ink " +
  "focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/30"
const LABEL_CLASS = "mb-1 block text-xs font-medium text-ink-soft"

export function AdminUserFormPage() {
  const navigate = useNavigate()
  const [username, setUsername] = useState("")
  const [password, setPassword] = useState("")
  const [fullName, setFullName] = useState("")
  const [role, setRole] = useState<UserCreateValues["role"]>("vendedor")
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    setError(null)
    setSubmitting(true)
    try {
      await createUser({ username, password, full_name: fullName, role })
      navigate("/admin/usuarios", { replace: true })
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "No se pudo crear el usuario.")
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div>
      <h1 className="mb-6 text-lg font-semibold text-ink">Nuevo usuario</h1>

      <form onSubmit={handleSubmit} className="mx-auto max-w-xl space-y-5">
        <label className="block">
          <span className={LABEL_CLASS}>Nombre completo</span>
          <input
            type="text"
            maxLength={200}
            value={fullName}
            onChange={(event) => setFullName(event.target.value)}
            className={INPUT_CLASS}
          />
        </label>

        <label className="block">
          <span className={LABEL_CLASS}>Usuario</span>
          <input
            type="text"
            required
            minLength={3}
            maxLength={50}
            autoComplete="username"
            value={username}
            onChange={(event) => setUsername(event.target.value)}
            className={INPUT_CLASS}
          />
        </label>

        <label className="block">
          <span className={LABEL_CLASS}>Contraseña</span>
          <input
            type="password"
            required
            minLength={8}
            autoComplete="new-password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            className={INPUT_CLASS}
          />
        </label>

        <label className="block">
          <span className={LABEL_CLASS}>Rol</span>
          <select
            value={role}
            onChange={(event) => setRole(event.target.value as UserCreateValues["role"])}
            className={INPUT_CLASS}
          >
            <option value="vendedor">Vendedor — vende, escanea, ve productos y precios</option>
            <option value="admin">Administrador — ve y edita todo</option>
          </select>
        </label>

        {error && (
          <p className="text-sm" style={{ color: "var(--color-stock-out)" }}>
            {error}
          </p>
        )}

        <button
          type="submit"
          disabled={submitting}
          className="w-full rounded-lg bg-ink py-2.5 text-sm font-semibold text-paper disabled:opacity-60 sm:w-auto sm:px-6"
        >
          {submitting ? "Creando…" : "Crear usuario"}
        </button>
      </form>
    </div>
  )
}
