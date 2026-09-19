import { useEffect } from "react"
import { fetchAppSettings, subscribeToAppSettings } from "../../api/settings"

const DEFAULT_FAVICON = "/favicon.svg"

/** Swaps the browser tab icon for the admin's uploaded logo — the same image
 * BrandLogo shows in the header. Without this the tab keeps the placeholder
 * icon from index.html forever, since a static <link> can't reflect a value
 * that lives in the database. Falls back to the placeholder once the logo is
 * removed, and reacts to the same upload/delete pub-sub BrandLogo listens to
 * so every open tab updates immediately. */
export function FaviconSync() {
  useEffect(() => {
    function applyFavicon(href: string) {
      let link = document.querySelector<HTMLLinkElement>('link[rel="icon"]')
      if (!link) {
        link = document.createElement("link")
        link.rel = "icon"
        document.head.appendChild(link)
      }
      // The uploaded logo can be re-encoded as PNG or JPEG depending on
      // whether it has transparency (see image_validation.py), so a fixed
      // type would be wrong half the time — let the browser sniff it.
      link.removeAttribute("type")
      link.href = href
    }

    function load() {
      fetchAppSettings()
        .then((settings) => applyFavicon(settings.logo_url ?? DEFAULT_FAVICON))
        .catch(() => {
          // Cosmetic only — keep whatever favicon is already on the page.
        })
    }
    load()
    return subscribeToAppSettings(load)
  }, [])

  return null
}
