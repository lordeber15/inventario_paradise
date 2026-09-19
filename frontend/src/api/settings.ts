import { apiDelete, apiGet, apiPostForm, apiPutJson } from "./client"

export interface AppSettings {
  logo_url: string | null
  company_name: string | null
}

// Same apiGet used by fetchPublicProducts: it works with or without a
// session because the endpoint never responds 401, so calling it from an
// anonymous screen (the public catalog, the login page) is safe.
export function fetchAppSettings(): Promise<AppSettings> {
  return apiGet<AppSettings>("/settings")
}

// Every BrandLogo instance fetches independently on its own mount (see that
// component), so an admin changing the logo on /admin/configuracion would
// otherwise not see the AppShell header right above the form update until a
// full page reload. This tiny pub-sub — same shape as theme.ts's listener
// set — lets a successful upload/delete notify every already-mounted
// BrandLogo to refetch, without reaching for a bigger state library for one
// value.
const listeners = new Set<() => void>()

export function subscribeToAppSettings(listener: () => void): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

function notifyAppSettingsChanged() {
  for (const listener of listeners) listener()
}

export async function uploadLogo(file: File): Promise<AppSettings> {
  const form = new FormData()
  form.set("logo", file)
  const settings = await apiPostForm<AppSettings>("/admin/settings/logo", form)
  notifyAppSettingsChanged()
  return settings
}

export async function deleteLogo(): Promise<AppSettings> {
  const settings = await apiDelete<AppSettings>("/admin/settings/logo")
  notifyAppSettingsChanged()
  return settings
}

export async function updateCompanyName(companyName: string | null): Promise<AppSettings> {
  const settings = await apiPutJson<AppSettings>("/admin/settings/company-name", { company_name: companyName })
  notifyAppSettingsChanged()
  return settings
}
