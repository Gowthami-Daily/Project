const users = [
  {
    name: 'Ramesh K.',
    email: 'ramesh@gowthamidaily.example',
    role: 'Admin',
    perms: { inflow: true, outflow: true, ledger: true, settings: true, reports: true, hr: false },
  },
  {
    name: 'Lakshmi P.',
    email: 'lakshmi@gowthamidaily.example',
    role: 'Accountant',
    perms: { inflow: false, outflow: true, ledger: true, settings: false, reports: true, hr: false },
  },
  {
    name: 'Satyam N.',
    email: 'satyam@gowthamidaily.example',
    role: 'Dispatch lead',
    perms: { inflow: true, outflow: true, ledger: false, settings: false, reports: true, hr: false },
  },
  {
    name: 'Guest viewer',
    email: 'viewer@gowthamidaily.example',
    role: 'Read-only',
    perms: { inflow: true, outflow: true, ledger: true, settings: false, reports: true, hr: false },
  },
]

const permLabels = [
  { key: 'inflow', label: 'Inflow' },
  { key: 'outflow', label: 'Outflow' },
  { key: 'ledger', label: 'Finance' },
  { key: 'settings', label: 'Settings' },
  { key: 'reports', label: 'Reports' },
  { key: 'hr', label: 'HR' },
]

function Check({ checked }) {
  return (
    <span
      className={`inline-flex h-6 w-6 items-center justify-center rounded-md border text-xs font-bold ${
        checked
          ? 'border-emerald-300 bg-emerald-100 text-emerald-800'
          : 'border-slate-200 bg-slate-50 text-slate-300'
      }`}
      aria-label={checked ? 'Allowed' : 'Denied'}
    >
      {checked ? '✓' : '—'}
    </span>
  )
}

export default function UserRoles() {
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h3 className="text-lg font-bold text-slate-900">Users & roles</h3>
          <p className="mt-1 text-sm text-slate-600">
            Role templates and module permissions (read demo — wire to RBAC API).
          </p>
        </div>
        <button
          type="button"
          className="rounded-xl bg-[#004080] px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-[#003366]"
        >
          Invite user
        </button>
      </div>

      <div className="overflow-hidden rounded-xl border border-slate-200 shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[900px] text-left text-sm">
            <thead>
              <tr className="bg-sky-50/90 text-xs font-bold uppercase tracking-wide text-sky-900/85">
                <th className="sticky left-0 z-10 bg-sky-50/90 px-4 py-3">User</th>
                <th className="px-3 py-3">Role</th>
                {permLabels.map((p) => (
                  <th key={p.key} className="px-2 py-3 text-center">
                    {p.label}
                  </th>
                ))}
                <th className="px-4 py-3">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {users.map((u) => (
                <tr key={u.email} className="hover:bg-slate-50/80">
                  <td className="sticky left-0 z-[1] border-r border-slate-100 bg-white px-4 py-3 shadow-[2px_0_8px_-4px_rgba(0,0,0,0.08)]">
                    <p className="font-semibold text-slate-900">{u.name}</p>
                    <p className="text-xs text-slate-500">{u.email}</p>
                  </td>
                  <td className="px-3 py-3">
                    <span className="rounded-lg bg-slate-100 px-2 py-1 text-xs font-semibold text-slate-800">{u.role}</span>
                  </td>
                  {permLabels.map((p) => (
                    <td key={p.key} className="px-2 py-3 text-center">
                      <Check checked={u.perms[p.key]} />
                    </td>
                  ))}
                  <td className="px-4 py-3">
                    <button type="button" className="text-sm font-semibold text-[#004080] hover:underline">
                      Edit
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <p className="text-xs text-slate-500">
        Tip: map columns to JWT scopes or permission keys such as <code className="rounded bg-slate-100 px-1">inflow:write</code>.
      </p>
    </div>
  )
}
