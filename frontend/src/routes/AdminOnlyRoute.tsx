import { Navigate, Outlet, useLocation } from "react-router-dom"
import { useAuth } from "../context/AuthContext"

/** Same three states as ProtectedRoute, plus a role check: an authenticated
 * vendedor is redirected to their own landing page rather than to login —
 * they're not unauthenticated, they're just not allowed here. */
export function AdminOnlyRoute() {
  const { status, user } = useAuth()
  const location = useLocation()

  if (status === "loading") {
    return (
      <div className="flex min-h-svh items-center justify-center text-sm text-ink-soft">
        Verificando sesión…
      </div>
    )
  }

  if (status === "anonymous") {
    return <Navigate to="/admin/login" state={{ from: location.pathname }} replace />
  }

  if (user?.role !== "admin") {
    return <Navigate to="/vender" replace />
  }

  return <Outlet />
}
