import { createContext, useContext, useEffect, useState, type ReactNode } from "react"
import {
  fetchCurrentUser,
  login as loginRequest,
  logout as logoutRequest,
  type CurrentUser,
} from "../api/auth"
import { ApiError, refreshAccessTokenInternal, setUnauthorizedHandler } from "../api/client"

type AuthStatus = "loading" | "authenticated" | "anonymous"

interface AuthContextValue {
  status: AuthStatus
  user: CurrentUser | null
  login: (username: string, password: string) => Promise<CurrentUser>
  logout: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | null>(null)
const MAX_RESTORE_ATTEMPTS = 3

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

/** A real 401 here means the access token itself is invalid — no amount of
 * retrying fixes that. Anything else (429, a network blip, a cold-started
 * backend) is transient, so it's worth a couple of short retries before
 * giving up — unlike a stale access token, there's no fallback state to keep
 * showing on first load, so a persistent failure here does mean "log out",
 * not "carry on as if nothing happened" (contrast with apiFetch's own
 * "error" handling elsewhere, which has a still-possibly-valid token to fall
 * back on instead of nothing at all). */
async function loadCurrentUserWithRetry(): Promise<CurrentUser> {
  for (let attempt = 0; ; attempt++) {
    try {
      return await fetchCurrentUser()
    } catch (err) {
      const isAuthError = err instanceof ApiError && err.status === 401
      if (isAuthError || attempt >= MAX_RESTORE_ATTEMPTS - 1) throw err
      await sleep(500 * (attempt + 1))
    }
  }
}

/** Restores a session on mount from the httpOnly refresh cookie. Retries on
 * "error" (rate limited, network hiccup) rather than collapsing it into an
 * immediate logout — a page load that happens to land during a brief 429
 * shouldn't bounce someone with a perfectly valid session back to the login
 * screen. Only a genuine "invalid" (401) gives up right away. */
async function restoreSession(): Promise<CurrentUser | null> {
  for (let attempt = 0; ; attempt++) {
    const outcome = await refreshAccessTokenInternal()
    if (outcome === "ok") break
    if (outcome === "invalid" || attempt >= MAX_RESTORE_ATTEMPTS - 1) return null
    await sleep(500 * (attempt + 1))
  }

  try {
    return await loadCurrentUserWithRetry()
  } catch {
    return null
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<AuthStatus>("loading")
  const [user, setUser] = useState<CurrentUser | null>(null)

  useEffect(() => {
    // The access token lives only in memory, so a page reload loses it; the
    // httpOnly refresh cookie survives, so try to silently restore a session.
    restoreSession()
      .then((restoredUser) => {
        setUser(restoredUser)
        setStatus(restoredUser ? "authenticated" : "anonymous")
      })
      .catch(() => setStatus("anonymous"))
  }, [])

  useEffect(() => {
    setUnauthorizedHandler(() => {
      setUser(null)
      setStatus("anonymous")
    })
    return () => setUnauthorizedHandler(null)
  }, [])

  async function login(username: string, password: string): Promise<CurrentUser> {
    await loginRequest(username, password)
    const me = await fetchCurrentUser()
    setUser(me)
    setStatus("authenticated")
    return me
  }

  async function logout() {
    await logoutRequest()
    setUser(null)
    setStatus("anonymous")
  }

  return <AuthContext.Provider value={{ status, user, login, logout }}>{children}</AuthContext.Provider>
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext)
  if (!context) throw new Error("useAuth must be used within AuthProvider")
  return context
}
