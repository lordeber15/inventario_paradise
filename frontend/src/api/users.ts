import { apiGet, apiPostJson, apiPutJson } from "./client"
import type { Role } from "./auth"

export interface AdminUserRow {
  id: string
  username: string
  full_name: string
  role: Role
  is_active: boolean
  created_at: string
  last_login_at: string | null
}

export interface UserCreateValues {
  username: string
  password: string
  full_name: string
  role: Role
}

export interface UserUpdateValues {
  full_name?: string
  role?: Role
  is_active?: boolean
}

export function fetchUsers(): Promise<AdminUserRow[]> {
  return apiGet<AdminUserRow[]>("/admin/users")
}

export function createUser(values: UserCreateValues): Promise<AdminUserRow> {
  return apiPostJson<AdminUserRow>("/admin/users", values)
}

export function updateUser(id: string, values: UserUpdateValues): Promise<AdminUserRow> {
  return apiPutJson<AdminUserRow>(`/admin/users/${id}`, values)
}

export function resetUserPassword(id: string, newPassword: string): Promise<AdminUserRow> {
  return apiPostJson<AdminUserRow>(`/admin/users/${id}/reset-password`, { new_password: newPassword })
}
