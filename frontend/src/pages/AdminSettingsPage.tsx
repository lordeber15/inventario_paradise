import { useEffect, useRef, useState } from "react"
import { ApiError } from "../api/client"
import { deleteLogo, fetchAppSettings, updateCompanyName, uploadLogo } from "../api/settings"

type Status = "loading" | "ready" | "error"

export function AdminSettingsPage() {
  const [status, setStatus] = useState<Status>("loading")
  const [logoUrl, setLogoUrl] = useState<string | null>(null)
  const [companyName, setCompanyName] = useState<string | null>(null)
  const [nameDraft, setNameDraft] = useState("")
  const [busy, setBusy] = useState(false)
  const [nameBusy, setNameBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [nameError, setNameError] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  async function load() {
    setStatus("loading")
    try {
      const settings = await fetchAppSettings()
      setLogoUrl(settings.logo_url)
      setCompanyName(settings.company_name)
      setNameDraft(settings.company_name ?? "")
      setStatus("ready")
    } catch {
      setStatus("error")
    }
  }

  useEffect(() => {
    void load()
  }, [])

  async function handleFileChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    event.target.value = ""
    if (!file) return

    setError(null)
    setBusy(true)
    try {
      setLogoUrl((await uploadLogo(file)).logo_url)
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "No se pudo subir el logo.")
    } finally {
      setBusy(false)
    }
  }

  async function handleDelete() {
    if (!window.confirm("¿Quitar el logo? La app volverá a mostrar el nombre en texto.")) return
    setError(null)
    setBusy(true)
    try {
      setLogoUrl((await deleteLogo()).logo_url)
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "No se pudo quitar el logo.")
    } finally {
      setBusy(false)
    }
  }

  const trimmedDraft = nameDraft.trim()
  const nameHasChange = trimmedDraft !== (companyName ?? "")

  async function handleSaveName() {
    setNameError(null)
    setNameBusy(true)
    try {
      const settings = await updateCompanyName(trimmedDraft || null)
      setCompanyName(settings.company_name)
      setNameDraft(settings.company_name ?? "")
    } catch (err) {
      setNameError(err instanceof ApiError ? err.message : "No se pudo guardar el nombre.")
    } finally {
      setNameBusy(false)
    }
  }

  return (
    <div>
      <h1 className="mb-6 text-lg font-semibold text-ink">Configuración</h1>

      {status === "loading" && <p className="text-sm text-ink-soft">Cargando…</p>}
      {status === "error" && (
        <p className="text-sm" style={{ color: "var(--color-stock-out)" }}>
          No se pudo cargar la configuración.
        </p>
      )}

      {status === "ready" && (
        <div className="space-y-4">
          <div className="max-w-md rounded-xl border border-line bg-surface p-6">
            <p className="text-sm font-medium text-ink">Nombre de la empresa</p>
            <p className="mt-1 text-xs text-ink-soft">
              Reemplaza el nombre "INVENTARIO" en el panel, el catálogo público, el inicio de sesión,
              la pantalla de venta y el ticket impreso. Si además hay un logo, el nombre se muestra
              junto a él.
            </p>

            <div className="mt-4 flex gap-2">
              <input
                type="text"
                value={nameDraft}
                onChange={(event) => setNameDraft(event.target.value)}
                placeholder="INVENTARIO"
                maxLength={200}
                className="w-full rounded-lg border border-line bg-inset px-3 py-2 text-sm text-ink"
              />
              <button
                type="button"
                disabled={nameBusy || !nameHasChange}
                onClick={() => void handleSaveName()}
                className="shrink-0 rounded-lg bg-ink px-4 py-2 text-sm font-semibold text-paper disabled:opacity-60"
              >
                Guardar
              </button>
            </div>

            {nameError && (
              <p className="mt-3 text-xs" style={{ color: "var(--color-stock-out)" }}>
                {nameError}
              </p>
            )}
          </div>

          <div className="max-w-md rounded-xl border border-line bg-surface p-6">
            <p className="text-sm font-medium text-ink">Logo de la empresa</p>
            <p className="mt-1 text-xs text-ink-soft">
              JPEG, PNG o WEBP, hasta 4 MB — PNG con fondo transparente es lo que mejor se ve en ambos
              temas.
            </p>

            <div className="mt-4 flex h-20 items-center justify-center rounded-lg border border-dashed border-line bg-inset">
              {logoUrl ? (
                <img src={logoUrl} alt="Logo actual" className="h-14 w-auto object-contain" />
              ) : (
                <span className="text-xs text-ink-soft">Sin logo — se muestra el nombre en texto</span>
              )}
            </div>

            <div className="mt-4 flex flex-wrap gap-2">
              <button
                type="button"
                disabled={busy}
                onClick={() => fileInputRef.current?.click()}
                className="rounded-lg bg-ink px-4 py-2 text-sm font-semibold text-paper disabled:opacity-60"
              >
                {logoUrl ? "Cambiar logo" : "Subir logo"}
              </button>
              {logoUrl && (
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => void handleDelete()}
                  className="rounded-lg border border-line px-4 py-2 text-sm font-medium text-ink disabled:opacity-60"
                >
                  Quitar logo
                </button>
              )}
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/png,image/jpeg,image/webp"
              className="hidden"
              onChange={(event) => void handleFileChange(event)}
            />

            {error && (
              <p className="mt-3 text-xs" style={{ color: "var(--color-stock-out)" }}>
                {error}
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
