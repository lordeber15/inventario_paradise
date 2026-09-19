import { useSyncExternalStore } from "react"

export type Theme = "light" | "dark"

// Kept in sync with the inline script in index.html, which reads the same key
// before first paint so the page never flashes the wrong theme.
const STORAGE_KEY = "inventario:theme"

const listeners = new Set<() => void>()

function notify() {
  for (const listener of listeners) listener()
}

function stored(): Theme | null {
  try {
    const value = localStorage.getItem(STORAGE_KEY)
    return value === "light" || value === "dark" ? value : null
  } catch {
    // Safari in private mode throws on localStorage access.
    return null
  }
}

function systemTheme(): Theme {
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light"
}

/** The theme actually being rendered, whether it was chosen or inherited. */
export function currentTheme(): Theme {
  return stored() ?? systemTheme()
}

export function setTheme(theme: Theme) {
  try {
    localStorage.setItem(STORAGE_KEY, theme)
  } catch {
    // Not being able to remember the choice shouldn't stop us applying it.
  }
  document.documentElement.dataset.theme = theme
  notify()
}

function subscribe(listener: () => void) {
  listeners.add(listener)
  // Until someone picks a theme there is nothing stored, so the app follows
  // the OS live — including a change made while the tab is open.
  const media = window.matchMedia("(prefers-color-scheme: dark)")
  media.addEventListener("change", notify)
  return () => {
    listeners.delete(listener)
    media.removeEventListener("change", notify)
  }
}

export function useTheme(): [Theme, (theme: Theme) => void] {
  // setTheme is module-level, so it is already stable across renders.
  const theme = useSyncExternalStore(subscribe, currentTheme, () => "light" as Theme)
  return [theme, setTheme]
}
