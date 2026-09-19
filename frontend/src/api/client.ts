const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? "/api"

export class ApiError extends Error {
  status: number

  constructor(status: number, message: string) {
    super(message)
    this.status = status
  }
}

let accessToken: string | null = null
let onUnauthorized: (() => void) | null = null

export function setAccessToken(token: string | null): void {
  accessToken = token
}

export function setUnauthorizedHandler(handler: (() => void) | null): void {
  onUnauthorized = handler
}

interface RequestOptions {
  method?: string
  body?: BodyInit
  headers?: Record<string, string>
  skipAuthRetry?: boolean
}

function rawFetch(path: string, options: RequestOptions = {}): Promise<Response> {
  const headers: Record<string, string> = { ...options.headers }
  if (accessToken) headers.Authorization = `Bearer ${accessToken}`

  return fetch(`${API_BASE_URL}${path}`, {
    method: options.method ?? "GET",
    body: options.body,
    headers,
    credentials: "include",
  })
}

export type RefreshOutcome = "ok" | "invalid" | "error"

/** "invalid" means the refresh token itself is gone/expired (a real logout).
 * "error" covers anything else — rate limited, network hiccup, server error —
 * which says nothing about whether the session is actually still good, so
 * callers should NOT treat it as a logout.
 *
 * Exported as-is (not collapsed to a boolean) so callers can tell "log out
 * now" apart from "try again in a bit" — AuthContext's mount-time session
 * restore in particular retries on "error" instead of giving up immediately,
 * since a rate-limited or network-flaky refresh says nothing about whether
 * the underlying session is actually still good. */
export async function refreshAccessTokenInternal(): Promise<RefreshOutcome> {
  let response: Response
  try {
    response = await rawFetch("/auth/refresh", { method: "POST" })
  } catch {
    return "error"
  }

  if (response.status === 401) return "invalid"
  if (!response.ok) return "error"

  const data = (await response.json()) as { access_token: string }
  accessToken = data.access_token
  return "ok"
}

async function apiFetch(path: string, options: RequestOptions = {}): Promise<Response> {
  const response = await rawFetch(path, options)

  if (response.status === 401 && !options.skipAuthRetry) {
    const outcome = await refreshAccessTokenInternal()
    if (outcome === "ok") {
      return rawFetch(path, options)
    }
    if (outcome === "invalid") {
      onUnauthorized?.()
    }
    // "error": leave the original 401 as-is. The access token in memory may
    // still be perfectly valid — a rate-limited or network-flaky refresh
    // attempt is not proof the session is over, so don't force a logout.
  }

  return response
}

async function parseJsonOrThrow<T>(response: Response): Promise<T> {
  if (!response.ok) {
    let detail = `Error ${response.status}`
    try {
      const body = (await response.json()) as { detail?: string }
      if (typeof body?.detail === "string") detail = body.detail
    } catch {
      // Non-JSON error body: fall back to the generic message above.
    }
    throw new ApiError(response.status, detail)
  }
  if (response.status === 204) return undefined as T
  return response.json() as Promise<T>
}

export async function apiGet<T>(path: string): Promise<T> {
  return parseJsonOrThrow<T>(await apiFetch(path))
}

export async function apiPostJson<T>(
  path: string,
  data?: unknown,
  options?: { skipAuthRetry?: boolean },
): Promise<T> {
  const hasBody = data !== undefined
  return parseJsonOrThrow<T>(
    await apiFetch(path, {
      method: "POST",
      headers: hasBody ? { "Content-Type": "application/json" } : undefined,
      body: hasBody ? JSON.stringify(data) : undefined,
      skipAuthRetry: options?.skipAuthRetry,
    }),
  )
}

export async function apiPostForm<T>(path: string, form: FormData): Promise<T> {
  return parseJsonOrThrow<T>(await apiFetch(path, { method: "POST", body: form }))
}

export async function apiPutForm<T>(path: string, form: FormData): Promise<T> {
  return parseJsonOrThrow<T>(await apiFetch(path, { method: "PUT", body: form }))
}

export async function apiPutJson<T>(path: string, data: unknown): Promise<T> {
  return parseJsonOrThrow<T>(
    await apiFetch(path, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    }),
  )
}

export async function apiDelete<T = void>(path: string): Promise<T> {
  return parseJsonOrThrow<T>(await apiFetch(path, { method: "DELETE" }))
}
