import { BrowserRouter, Outlet, Route, Routes } from "react-router-dom"
import { AppShell } from "./components/layout/AppShell"
import { AuthProvider } from "./context/AuthContext"
import { AdminDashboardPage } from "./pages/AdminDashboardPage"
import { AdminProductFormPage } from "./pages/AdminProductFormPage"
import { AdminSalesDashboardPage } from "./pages/AdminSalesDashboardPage"
import { AdminSettingsPage } from "./pages/AdminSettingsPage"
import { AdminUserFormPage } from "./pages/AdminUserFormPage"
import { AdminUsersPage } from "./pages/AdminUsersPage"
import { LoginPage } from "./pages/LoginPage"
import { PublicCatalogPage } from "./pages/PublicCatalogPage"
import { ScanPage } from "./pages/ScanPage"
import { VenderPage } from "./pages/VenderPage"
import { AdminOnlyRoute } from "./routes/AdminOnlyRoute"
import { ProtectedRoute } from "./routes/ProtectedRoute"

// Scopes AuthProvider (and the silent refresh-token check it runs on mount)
// to the /admin/* subtree only, so anonymous visitors to the public catalog
// never touch the auth cookie or /api/auth/refresh at all.
function AdminArea() {
  return (
    <AuthProvider>
      <Outlet />
    </AuthProvider>
  )
}

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<PublicCatalogPage />} />
        <Route element={<AdminArea />}>
          <Route path="/admin/login" element={<LoginPage />} />
          {/* Any authenticated role (admin or vendedor) lands here — the real
              sale screen (Fase F): open the register, build a cart by
              search or by photo, charge, print the ticket. */}
          <Route element={<ProtectedRoute />}>
            <Route path="/vender" element={<VenderPage />} />
          </Route>
          {/* Admin-only: product management and user management. A vendedor
              hitting any of these is redirected to /vender, not to login. */}
          <Route element={<AdminOnlyRoute />}>
            <Route element={<AppShell />}>
              <Route path="/admin" element={<AdminDashboardPage />} />
              <Route path="/admin/ventas" element={<AdminSalesDashboardPage />} />
              <Route path="/admin/products/new" element={<AdminProductFormPage />} />
              <Route path="/admin/products/:id/edit" element={<AdminProductFormPage />} />
              <Route path="/admin/scan" element={<ScanPage />} />
              <Route path="/admin/usuarios" element={<AdminUsersPage />} />
              <Route path="/admin/usuarios/nuevo" element={<AdminUserFormPage />} />
              <Route path="/admin/configuracion" element={<AdminSettingsPage />} />
            </Route>
          </Route>
        </Route>
      </Routes>
    </BrowserRouter>
  )
}

export default App
