import { pfFetch } from '../personalFinance/api.js'

export function getAdminStats() {
  return pfFetch('/super-admin/stats')
}

export function listAdminUsers() {
  return pfFetch('/super-admin/users')
}

export function createAdminUser(body) {
  return pfFetch('/super-admin/users', { method: 'POST', body: JSON.stringify(body) })
}

export function patchAdminUser(userId, body) {
  return pfFetch(`/super-admin/users/${userId}`, { method: 'PATCH', body: JSON.stringify(body) })
}

export function resetAdminUserPassword(userId, password) {
  return pfFetch(`/super-admin/users/${userId}/reset-password`, {
    method: 'POST',
    body: JSON.stringify({ password }),
  })
}

export function deactivateAdminUser(userId) {
  return pfFetch(`/super-admin/users/${userId}`, { method: 'DELETE' })
}

export function listUserPermissions(userId) {
  return pfFetch(`/super-admin/users/${userId}/permissions`)
}

export function putUserPermissions(userId, rows) {
  return pfFetch(`/super-admin/users/${userId}/permissions`, {
    method: 'PUT',
    body: JSON.stringify(rows),
  })
}

export function listAuditLogs(params = {}) {
  const q = new URLSearchParams({
    skip: String(params.skip ?? 0),
    limit: String(params.limit ?? 100),
  })
  return pfFetch(`/super-admin/audit-logs?${q}`)
}

export function requestBackup() {
  return pfFetch('/super-admin/backup', { method: 'POST' })
}
