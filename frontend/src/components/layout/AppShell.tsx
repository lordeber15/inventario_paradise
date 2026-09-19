import { useEffect, useRef, useState } from "react"
import { NavLink, Outlet, useLocation } from "react-router-dom"
import { useAuth } from "../../context/AuthContext"
import { BrandLogo } from "./BrandLogo"
import { ThemeToggle } from "./ThemeToggle"

const ADMIN_NAV_ITEMS = [
  { to: "/admin", label: "Productos", end: true },
  { to: "/admin/ventas", label: "Ventas", end: false },
  { to: "/admin/scan", label: "Escanear", end: false },
  { to: "/admin/usuarios", label: "Usuarios", end: false },
  { to: "/admin/configuracion", label: "Configuración", end: false },
]

// The bottom bar only has room for a few icons before "Configuración" and
// "Usuarios" get squeezed into unreadable labels (see docs/PLAN-POS.md
// review) — these three are what a seller-turned-admin reaches for while on
// the floor; the rest live behind "Más". The desktop nav above is roomy
// enough to keep showing all five, so it isn't touched here.
const MOBILE_PRIMARY_ITEMS = [
  { to: "/admin", label: "Productos", end: true, icon: BoxIcon },
  { to: "/admin/ventas", label: "Ventas", end: false, icon: ReceiptIcon },
  { to: "/admin/scan", label: "Escanear", end: false, icon: ScanIcon },
]

const MOBILE_MORE_ITEMS = [
  { to: "/admin/usuarios", label: "Usuarios" },
  { to: "/admin/configuracion", label: "Configuración" },
]

function BoxIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3.5 8 12 4l8.5 4-8.5 4-8.5-4Z" />
      <path d="M3.5 8v8L12 20l8.5-4V8" />
      <path d="M12 12v8" />
    </svg>
  )
}

function ReceiptIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
      <path d="M6 3.5h12v17l-2.25-1.5L13.5 20.5l-1.5-1.5-1.5 1.5-2.25-1.5L6 20.5Z" />
      <path d="M9 8h6M9 12h6M9 16h3" />
    </svg>
  )
}

function ScanIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 8V5.5A1.5 1.5 0 0 1 5.5 4H8M16 4h2.5A1.5 1.5 0 0 1 20 5.5V8M20 16v2.5a1.5 1.5 0 0 1-1.5 1.5H16M8 20H5.5A1.5 1.5 0 0 1 4 18.5V16" />
      <path d="M4 12h16" />
    </svg>
  )
}

function MoreIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="currentColor">
      <circle cx="5" cy="12" r="1.6" />
      <circle cx="12" cy="12" r="1.6" />
      <circle cx="19" cy="12" r="1.6" />
    </svg>
  )
}

function navLinkClass(isActive: boolean, variant: "desktop" | "mobile"): string {
  if (variant === "desktop") {
    return `rounded-lg px-3 py-2 text-sm font-medium transition-colors duration-150 ${
      isActive ? "bg-accent-soft text-ink" : "text-ink-soft"
    }`
  }
  return `flex flex-1 flex-col items-center gap-0.5 py-2.5 text-xs font-medium transition-colors duration-150 ${
    isActive ? "text-accent" : "text-ink-soft"
  }`
}

export function AppShell() {
  const { user, logout } = useAuth()
  const location = useLocation()
  const [moreOpen, setMoreOpen] = useState(false)
  const moreRef = useRef<HTMLDivElement>(null)

  // This shell is only reachable by AdminOnlyRoute today, so `user` is always
  // an admin in practice — the check stays explicit anyway so this doesn't
  // silently show admin-only links if the shell is ever reused elsewhere.
  const navItems = user?.role === "admin" ? ADMIN_NAV_ITEMS : []
  const moreIsActive = MOBILE_MORE_ITEMS.some((item) => location.pathname.startsWith(item.to))

  // Route changes (a tap on a menu item) close the sheet on their own via
  // each item's onClick, but a click on the transparent backdrop or an Esc
  // press needs its own listener since neither is a navigation.
  useEffect(() => {
    if (!moreOpen) return
    function handlePointerDown(event: PointerEvent) {
      if (moreRef.current && !moreRef.current.contains(event.target as Node)) setMoreOpen(false)
    }
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setMoreOpen(false)
    }
    document.addEventListener("pointerdown", handlePointerDown)
    document.addEventListener("keydown", handleKeyDown)
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown)
      document.removeEventListener("keydown", handleKeyDown)
    }
  }, [moreOpen])

  return (
    <div className="flex min-h-svh flex-col bg-paper">
      <header className="sticky top-0 z-10 border-b border-line bg-paper/95 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4">
          <div>
            <BrandLogo />
            <p className="text-xs text-ink-soft">Panel de administración</p>
          </div>

          {/* On mobile the nav lives in the bottom bar, so the switch is the
              only thing on the right up here. */}
          <div className="flex items-center gap-3">
            <nav className="hidden items-center gap-1 sm:flex">
              {navItems.map((item) => (
                <NavLink key={item.to} to={item.to} end={item.end} className={({ isActive }) => navLinkClass(isActive, "desktop")}>
                  {item.label}
                </NavLink>
              ))}
              <button
                type="button"
                onClick={() => void logout()}
                className="ml-2 rounded-lg px-3 py-2 text-sm font-medium text-ink-soft transition-colors duration-150 hover:bg-accent-soft hover:text-ink"
              >
                Salir
              </button>
            </nav>
            <ThemeToggle />
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-6 pb-24 sm:pb-6">
        <Outlet />
      </main>

      <div ref={moreRef} className="fixed inset-x-0 bottom-0 z-10 sm:hidden">
        {moreOpen && (
          <div
            role="menu"
            aria-label="Más opciones"
            className="animate-fade-in mx-3 mb-2 overflow-hidden rounded-xl border border-line bg-surface shadow-[0_4px_16px_var(--color-card-shadow)]"
          >
            {MOBILE_MORE_ITEMS.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                role="menuitem"
                onClick={() => setMoreOpen(false)}
                className={({ isActive }) =>
                  `block border-b border-line px-4 py-3 text-sm font-medium last:border-none ${
                    isActive ? "bg-accent-soft text-ink" : "text-ink"
                  }`
                }
              >
                {item.label}
              </NavLink>
            ))}
            <button
              type="button"
              role="menuitem"
              onClick={() => {
                setMoreOpen(false)
                void logout()
              }}
              className="block w-full px-4 py-3 text-left text-sm font-medium text-ink"
            >
              Salir
            </button>
          </div>
        )}

        <nav className="flex border-t border-line bg-surface">
          {MOBILE_PRIMARY_ITEMS.map((item) => (
            <NavLink key={item.to} to={item.to} end={item.end} className={({ isActive }) => navLinkClass(isActive, "mobile")}>
              <item.icon />
              {item.label}
            </NavLink>
          ))}
          <button
            type="button"
            aria-expanded={moreOpen}
            aria-haspopup="menu"
            onClick={() => setMoreOpen((open) => !open)}
            className={`flex flex-1 flex-col items-center gap-0.5 py-2.5 text-xs font-medium transition-colors duration-150 ${
              moreOpen || moreIsActive ? "text-accent" : "text-ink-soft"
            }`}
          >
            <MoreIcon />
            Más
          </button>
        </nav>
      </div>
    </div>
  )
}
