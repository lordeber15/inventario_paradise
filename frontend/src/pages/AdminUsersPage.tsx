import { useEffect, useState } from "react"
import { Link } from "react-router-dom"
import { fetchUsers, resetUserPassword, updateUser, type AdminUserRow } from "../api/users"
import { ApiError } from "../api/client"
import { useAuth } from "../context/AuthContext"

type Status = "loading" | "ready" | "error"

const ROLE_LABEL: Record<AdminUserRow["role"], string> = {
  admin: "Administrador",
  vendedor: "Vendedor",
}

export function AdminUsersPage() {
  const { user: currentUser } = useAuth()
  const [users, setUsers] = useState<AdminUserRow[]>([])
  const [status, setStatus] = useState<Status>("loading")
  const [rowError, setRowError] = useState<{ id: string; message: string } | null>(null)

  async function load() {
    setStatus("loading")
    try {
      setUsers(await fetchUsers())
      setStatus("ready")
    } catch {
      setStatus("error")
    }
  }

  useEffect(() => {
    void load()
  }, [])

  async function handleRoleChange(target: AdminUserRow, role: AdminUserRow["role"]) {
    setRowError(null)
    try {
      await updateUser(target.id, { role })
      void load()
    } catch (err) {
      setRowError({ id: target.id, message: err instanceof ApiError ? err.message : "No se pudo cambiar el rol." })
    }
  }

  async function handleToggleActive(target: AdminUserRow) {
    setRowError(null)
    try {
      await updateUser(target.id, { is_active: !target.is_active })
      void load()
    } catch (err) {
      setRowError({
        id: target.id,
        message: err instanceof ApiError ? err.message : "No se pudo cambiar el estado.",
      })
    }
  }

  async function handleResetPassword(target: AdminUserRow) {
    const newPassword = window.prompt(`Nueva contraseña para "${target.username}" (mínimo 8 caracteres):`)
    if (!newPassword) return
    setRowError(null)
    try {
      await resetUserPassword(target.id, newPassword)
      window.alert("Contraseña actualizada.")
    } catch (err) {
      setRowError({
        id: target.id,
        message: err instanceof ApiError ? err.message : "No se pudo restablecer la contraseña.",
      })
    }
  }

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-lg font-semibold text-ink">Usuarios</h1>
        <Link
          to="/admin/usuarios/nuevo"
          className="rounded-lg bg-ink px-4 py-2 text-sm font-semibold text-paper"
        >
          + Nuevo
        </Link>
      </div>

      {status === "loading" && <p className="text-sm text-ink-soft">Cargando…</p>}
      {status === "error" && (
        <p className="text-sm" style={{ color: "var(--color-stock-out)" }}>
          No se pudo cargar el listado.
        </p>
      )}

      {status === "ready" && (
        <>
        <ul className="space-y-3 sm:hidden">
          {users.map((row) => {
            const isSelf = row.id === currentUser?.id
            return (
              <li
                key={row.id}
                className={`rounded-xl border border-line bg-surface p-3 ${row.is_active ? "" : "opacity-60"}`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-ink">
                      {row.username}
                      {isSelf && <span className="ml-1 text-xs text-ink-soft">(vos)</span>}
                    </p>
                    <p className="truncate text-xs text-ink-soft">{row.full_name || "—"}</p>
                  </div>
                  <span
                    className="tag-badge inline-flex shrink-0 items-center py-1 pl-4 pr-2.5 text-xs font-semibold"
                    style={{
                      backgroundColor: row.is_active
                        ? "color-mix(in srgb, var(--color-stock-good) 16%, transparent)"
                        : "color-mix(in srgb, var(--color-stock-out) 16%, transparent)",
                      color: row.is_active ? "var(--color-stock-good)" : "var(--color-stock-out)",
                    }}
                  >
                    {row.is_active ? "Activo" : "Inactivo"}
                  </span>
                </div>

                <label className="mt-3 flex items-center gap-2 text-xs text-ink-soft">
                  Rol
                  <select
                    value={row.role}
                    onChange={(event) => void handleRoleChange(row, event.target.value as AdminUserRow["role"])}
                    className="flex-1 rounded-lg border border-line bg-inset px-2 py-1 text-sm text-ink"
                  >
                    <option value="admin">{ROLE_LABEL.admin}</option>
                    <option value="vendedor">{ROLE_LABEL.vendedor}</option>
                  </select>
                </label>

                <div className="mt-3 flex gap-2 text-xs">
                  <button
                    type="button"
                    onClick={() => void handleToggleActive(row)}
                    className="flex-1 rounded-lg border border-line py-1.5 font-medium text-ink"
                  >
                    {row.is_active ? "Desactivar" : "Activar"}
                  </button>
                  <button
                    type="button"
                    onClick={() => void handleResetPassword(row)}
                    className="flex-1 rounded-lg border border-line py-1.5 font-medium text-ink"
                  >
                    Restablecer clave
                  </button>
                </div>
                {rowError?.id === row.id && (
                  <p className="mt-2 text-xs" style={{ color: "var(--color-stock-out)" }}>
                    {rowError.message}
                  </p>
                )}
              </li>
            )
          })}
        </ul>

        <div className="hidden overflow-x-auto rounded-xl border border-line bg-surface sm:block">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-line text-xs uppercase tracking-wide text-ink-soft">
              <tr>
                <th className="px-4 py-3 font-medium">Usuario</th>
                <th className="px-4 py-3 font-medium">Nombre</th>
                <th className="px-4 py-3 font-medium">Rol</th>
                <th className="px-4 py-3 font-medium">Estado</th>
                <th className="px-4 py-3 font-medium">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {users.map((row) => {
                const isSelf = row.id === currentUser?.id
                return (
                  <tr key={row.id} className={`border-b border-line last:border-none ${row.is_active ? "" : "opacity-60"}`}>
                    <td className="px-4 py-3 font-medium text-ink">
                      {row.username}
                      {isSelf && <span className="ml-1 text-xs text-ink-soft">(vos)</span>}
                    </td>
                    <td className="px-4 py-3 text-ink-soft">{row.full_name || "—"}</td>
                    <td className="px-4 py-3">
                      <select
                        value={row.role}
                        onChange={(event) => void handleRoleChange(row, event.target.value as AdminUserRow["role"])}
                        className="rounded-lg border border-line bg-inset px-2 py-1 text-sm text-ink"
                      >
                        <option value="admin">{ROLE_LABEL.admin}</option>
                        <option value="vendedor">{ROLE_LABEL.vendedor}</option>
                      </select>
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className="tag-badge inline-flex items-center py-1 pl-4 pr-2.5 text-xs font-semibold"
                        style={{
                          backgroundColor: row.is_active
                            ? "color-mix(in srgb, var(--color-stock-good) 16%, transparent)"
                            : "color-mix(in srgb, var(--color-stock-out) 16%, transparent)",
                          color: row.is_active ? "var(--color-stock-good)" : "var(--color-stock-out)",
                        }}
                      >
                        {row.is_active ? "Activo" : "Inactivo"}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-2">
                        <button
                          type="button"
                          onClick={() => void handleToggleActive(row)}
                          className="rounded-lg border border-line px-3 py-1.5 font-medium text-ink"
                        >
                          {row.is_active ? "Desactivar" : "Activar"}
                        </button>
                        <button
                          type="button"
                          onClick={() => void handleResetPassword(row)}
                          className="rounded-lg border border-line px-3 py-1.5 font-medium text-ink"
                        >
                          Restablecer clave
                        </button>
                      </div>
                      {rowError?.id === row.id && (
                        <p className="mt-1 text-xs" style={{ color: "var(--color-stock-out)" }}>
                          {rowError.message}
                        </p>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
        </>
      )}
    </div>
  )
}
