import { useEffect, useState } from "react"
import { fetchAppSettings, subscribeToAppSettings } from "../../api/settings"

interface BrandLogoProps {
  /** Matches the text-size classes each header already used for "INVENTARIO",
   * so swapping in this component doesn't change any screen's layout. */
  textClassName?: string
  imgClassName?: string
}

/** The shared brand mark that never existed before: every header wrote its
 * own "INVENTARIO" independently. Renders the text immediately (no flash of
 * empty space while the request is in flight) and swaps in the admin's
 * uploaded logo and/or company name once settings load. With neither set it
 * falls back to the literal "INVENTARIO" placeholder — reverting is just
 * clearing both fields, no separate "use text instead" toggle needed. */
export function BrandLogo({
  textClassName = "font-display text-lg font-semibold tracking-tight text-ink",
  imgClassName = "h-8",
}: BrandLogoProps) {
  const [logoUrl, setLogoUrl] = useState<string | null>(null)
  const [companyName, setCompanyName] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    function load() {
      fetchAppSettings()
        .then((settings) => {
          if (cancelled) return
          setLogoUrl(settings.logo_url)
          setCompanyName(settings.company_name)
        })
        .catch(() => {
          // Keep the text fallback — a failed settings fetch shouldn't block
          // the rest of the page or show an error for something this minor.
        })
    }
    load()
    // A previous or concurrent instance's upload/delete notifies this one to
    // refetch, so the header updates immediately instead of on next reload.
    const unsubscribe = subscribeToAppSettings(load)
    return () => {
      cancelled = true
      unsubscribe()
    }
  }, [])

  if (logoUrl) {
    return (
      <span className="inline-flex items-center gap-2">
        {/* Alt genérico y fijo: poner acá el nombre de la empresa hacía que un
            lector de pantalla anunciara la marca dos veces seguidas, porque ya
            va como texto en el <span> de al lado. */}
        <img src={logoUrl} alt="Logo de la empresa" className={`${imgClassName} w-auto object-contain`} />
        {companyName && <span className={textClassName}>{companyName}</span>}
      </span>
    )
  }
  return <p className={textClassName}>{companyName ?? "INVENTARIO"}</p>
}
