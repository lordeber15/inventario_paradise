import { apiGet, apiPostJson, setAccessToken } from "./client"

interface LoginResponse {
  access_token: string
  token_type: string
  expires_in: number
}

export type Role = "admin" | "vendedor"

export interface CurrentUser {
  id: string
  username: string
  full_name: string
  role: Role
  is_active: boolean
}

export async function login(username: string, password: string): Promise<void> {
  const data = await apiPostJson<LoginResponse>(
    "/auth/login",
    { username, password },
    { skipAuthRetry: true },
  )
  setAccessToken(data.access_token)
}

export async function logout(): Promise<void> {
  try {
    await apiPostJson<void>("/auth/logout")
  } finally {
    setAccessToken(null)
  }
}

export function fetchCurrentUser(): Promise<CurrentUser> {
  return apiGet<CurrentUser>("/auth/me")
}
