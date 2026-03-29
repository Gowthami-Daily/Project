import { useCallback, useEffect, useState } from 'react'
import { listAdminUsers, listUserPermissions, putUserPermissions } from './superAdminApi.js'

const MODULES = [
  'dashboard',
  'income',
  'expense',
  'loans',
  'reports',
  'investments',
  'assets',
  'liabilities',
  'export',
  'admin_panel',
]

export default function SuperAdminPermissionsPage() {
  const [users, setUsers] = useState([])
  const [userId, setUserId] = useState('')
  const [rows, setRows] = useState([])
  const [msg, setMsg] = useState('')

  const loadUsers = useCallback(async () => {
    const data = await listAdminUsers()
    setUsers(Array.isArray(data) ? data : [])
  }, [])

  useEffect(() => {
    loadUsers()
  }, [loadUsers])

  async function loadPerms(uid) {
    if (!uid) return
    const data = await listUserPermissions(Number(uid))
    setRows(Array.isArray(data) ? data : [])
  }

  async function seedDefaults() {
    const uid = Number(userId)
    if (!uid) return
    const body = MODULES.map((module_name) => ({
      module_name,
      can_view: true,
      can_edit: true,
      can_delete: false,
      can_export: true,
    }))
    await putUserPermissions(uid, body)
    await loadPerms(uid)
    setMsg('Saved default module rows.')
  }

  return (
    <div className="space-y-4 text-slate-100">
      <h2 className="text-xl font-bold">Access control</h2>
      <p className="text-sm text-slate-400">
        Store per-user module flags. Full enforcement in API middleware can follow; data model is ready.
      </p>
      <div className="flex flex-wrap items-end gap-2">
        <label className="text-xs font-bold text-slate-400">
          User
          <select
            className="ml-2 rounded-lg border border-slate-700 bg-slate-900 px-2 py-2 text-sm"
            value={userId}
            onChange={(e) => {
              setUserId(e.target.value)
              loadPerms(e.target.value)
            }}
          >
            <option value="">Select…</option>
            {users.map((u) => (
              <option key={u.id} value={String(u.id)}>
                {u.email} ({u.role})
              </option>
            ))}
          </select>
        </label>
        <button
          type="button"
          className="rounded-lg bg-amber-600 px-3 py-2 text-sm font-bold text-white hover:bg-amber-500"
          onClick={() => seedDefaults()}
        >
          Seed defaults
        </button>
      </div>
      {msg ? <p className="text-sm text-emerald-400">{msg}</p> : null}
      <div className="overflow-x-auto rounded-xl border border-slate-800">
        <table className="min-w-full text-left text-sm">
          <thead className="bg-slate-900 text-xs uppercase text-slate-400">
            <tr>
              <th className="px-3 py-2">Module</th>
              <th className="px-3 py-2">View</th>
              <th className="px-3 py-2">Edit</th>
              <th className="px-3 py-2">Delete</th>
              <th className="px-3 py-2">Export</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-3 py-6 text-center text-slate-500">
                  No rows — pick a user and seed defaults.
                </td>
              </tr>
            ) : (
              rows.map((r) => (
                <tr key={r.id} className="border-t border-slate-800">
                  <td className="px-3 py-2">{r.module_name}</td>
                  <td className="px-3 py-2">{r.can_view ? '✓' : '—'}</td>
                  <td className="px-3 py-2">{r.can_edit ? '✓' : '—'}</td>
                  <td className="px-3 py-2">{r.can_delete ? '✓' : '—'}</td>
                  <td className="px-3 py-2">{r.can_export ? '✓' : '—'}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
