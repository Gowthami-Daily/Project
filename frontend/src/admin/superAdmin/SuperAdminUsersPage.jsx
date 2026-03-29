import { useCallback, useEffect, useState } from 'react'
import {
  createAdminUser,
  deactivateAdminUser,
  listAdminUsers,
  patchAdminUser,
  resetAdminUserPassword,
} from './superAdminApi.js'

const roles = ['USER', 'STAFF', 'ADMIN']

export default function SuperAdminUsersPage() {
  const [rows, setRows] = useState([])
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [form, setForm] = useState({ name: '', email: '', password: '', role: 'USER' })

  const load = useCallback(async () => {
    setError('')
    try {
      const data = await listAdminUsers()
      setRows(Array.isArray(data) ? data : [])
    } catch (e) {
      setError(e.message || 'Load failed')
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  async function onCreate(e) {
    e.preventDefault()
    setBusy(true)
    setError('')
    try {
      await createAdminUser({
        name: form.name.trim(),
        email: form.email.trim(),
        password: form.password,
        role: form.role,
      })
      setForm({ name: '', email: '', password: '', role: 'USER' })
      await load()
    } catch (err) {
      setError(err.message || 'Create failed')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="space-y-6 text-slate-100">
      <h2 className="text-xl font-bold">User management</h2>
      {error ? <p className="text-sm text-red-400">{error}</p> : null}

      <form onSubmit={onCreate} className="grid gap-3 rounded-xl border border-slate-800 bg-slate-900 p-4 sm:grid-cols-2">
        <h3 className="sm:col-span-2 text-sm font-bold text-amber-200">Create user</h3>
        <input
          className="rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm"
          placeholder="Name"
          value={form.name}
          onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
          required
        />
        <input
          type="email"
          className="rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm"
          placeholder="Email"
          value={form.email}
          onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
          required
        />
        <input
          type="password"
          className="rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm"
          placeholder="Password (min 8)"
          value={form.password}
          onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
          required
          minLength={8}
        />
        <select
          className="rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm"
          value={form.role}
          onChange={(e) => setForm((f) => ({ ...f, role: e.target.value }))}
        >
          {roles.map((r) => (
            <option key={r} value={r}>
              {r}
            </option>
          ))}
        </select>
        <div className="sm:col-span-2">
          <button
            type="submit"
            disabled={busy}
            className="rounded-lg bg-amber-600 px-4 py-2 text-sm font-bold text-white hover:bg-amber-500 disabled:opacity-50"
          >
            Create user
          </button>
        </div>
      </form>

      <div className="overflow-x-auto rounded-xl border border-slate-800">
        <table className="min-w-full text-left text-sm">
          <thead className="bg-slate-900 text-xs uppercase text-slate-400">
            <tr>
              <th className="px-3 py-2">ID</th>
              <th className="px-3 py-2">Name</th>
              <th className="px-3 py-2">Email</th>
              <th className="px-3 py-2">Role</th>
              <th className="px-3 py-2">Active</th>
              <th className="px-3 py-2">Actions</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} className="border-t border-slate-800 bg-slate-950/50">
                <td className="px-3 py-2 tabular-nums">{r.id}</td>
                <td className="px-3 py-2">{r.name}</td>
                <td className="px-3 py-2">{r.email}</td>
                <td className="px-3 py-2">{r.role}</td>
                <td className="px-3 py-2">{r.is_active ? 'Yes' : 'No'}</td>
                <td className="px-3 py-2">
                  <div className="flex flex-wrap gap-1">
                    <button
                      type="button"
                      className="rounded bg-slate-800 px-2 py-1 text-xs font-semibold hover:bg-slate-700"
                      onClick={async () => {
                        const role = window.prompt(`New role for ${r.email}`, r.role)
                        if (!role) return
                        try {
                          await patchAdminUser(r.id, { role: role.trim() })
                          await load()
                        } catch (e) {
                          window.alert(e.message)
                        }
                      }}
                    >
                      Role
                    </button>
                    <button
                      type="button"
                      className="rounded bg-slate-800 px-2 py-1 text-xs font-semibold hover:bg-slate-700"
                      onClick={async () => {
                        const pw = window.prompt('New password (min 8 chars)')
                        if (!pw || pw.length < 8) return
                        try {
                          await resetAdminUserPassword(r.id, pw)
                          window.alert('Password updated')
                        } catch (e) {
                          window.alert(e.message)
                        }
                      }}
                    >
                      Reset PW
                    </button>
                    <button
                      type="button"
                      className="rounded bg-amber-900/60 px-2 py-1 text-xs font-semibold hover:bg-amber-800"
                      onClick={async () => {
                        try {
                          await patchAdminUser(r.id, { is_active: !r.is_active })
                          await load()
                        } catch (e) {
                          window.alert(e.message)
                        }
                      }}
                    >
                      {r.is_active ? 'Deactivate' : 'Activate'}
                    </button>
                    <button
                      type="button"
                      className="rounded bg-red-900/50 px-2 py-1 text-xs font-semibold text-red-200 hover:bg-red-900"
                      onClick={async () => {
                        if (!window.confirm(`Deactivate user ${r.email}?`)) return
                        try {
                          await deactivateAdminUser(r.id)
                          await load()
                        } catch (e) {
                          window.alert(e.message)
                        }
                      }}
                    >
                      Remove
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
