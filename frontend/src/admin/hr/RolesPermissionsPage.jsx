const modules = [
  { key: 'dashboard', label: 'Dashboard' },
  { key: 'inflow', label: 'Inflow' },
  { key: 'production', label: 'Production' },
  { key: 'dispatch', label: 'Dispatch' },
  { key: 'finance', label: 'Finance' },
  { key: 'hr', label: 'HR' },
]

/** Yes / No / App (mobile app only) */
const roles = [
  { name: 'Admin', perms: { dashboard: 'Y', inflow: 'Y', production: 'Y', dispatch: 'Y', finance: 'Y', hr: 'Y' } },
  { name: 'Manager', perms: { dashboard: 'Y', inflow: 'Y', production: 'Y', dispatch: 'Y', finance: 'R', hr: 'R' } },
  { name: 'Accountant', perms: { dashboard: 'N', inflow: 'N', production: 'N', dispatch: 'N', finance: 'Y', hr: 'N' } },
  { name: 'Dispatch Manager', perms: { dashboard: 'N', inflow: 'N', production: 'N', dispatch: 'Y', finance: 'N', hr: 'N' } },
  { name: 'Collection Operator', perms: { dashboard: 'N', inflow: 'Y', production: 'N', dispatch: 'N', finance: 'N', hr: 'N' } },
  { name: 'Lab Technician', perms: { dashboard: 'N', inflow: 'Y', production: 'N', dispatch: 'N', finance: 'N', hr: 'N' } },
  { name: 'Plant Operator', perms: { dashboard: 'N', inflow: 'N', production: 'Y', dispatch: 'N', finance: 'N', hr: 'N' } },
  { name: 'Driver', perms: { dashboard: 'N', inflow: 'N', production: 'N', dispatch: 'App', finance: 'N', hr: 'N' } },
  { name: 'Delivery Boy', perms: { dashboard: 'N', inflow: 'N', production: 'N', dispatch: 'App', finance: 'N', hr: 'N' } },
  { name: 'Helper', perms: { dashboard: 'N', inflow: 'N', production: 'R', dispatch: 'N', finance: 'N', hr: 'N' } },
]

function Cell({ v }) {
  const style =
    v === 'Y'
      ? 'bg-emerald-100 text-emerald-900'
      : v === 'N'
        ? 'bg-slate-100 text-slate-500'
        : v === 'App'
          ? 'bg-sky-100 text-sky-900 font-semibold'
          : v === 'R'
            ? 'bg-violet-100 text-violet-900 text-xs'
            : 'bg-slate-100'
  const label = v === 'R' ? 'Read' : v === 'Y' ? 'Yes' : v === 'N' ? 'No' : v
  return (
    <span className={`inline-flex min-w-[2.5rem] justify-center rounded-md px-2 py-1 text-xs font-bold ${style}`}>{label}</span>
  )
}

export default function RolesPermissionsPage() {
  return (
    <div className="space-y-4">
      <p className="text-sm text-slate-600">
        RBAC matrix — <strong>App</strong> = mobile-only access (delivery). <strong>Read</strong> = view-only where shown. Wire to{' '}
        <code className="rounded bg-slate-100 px-1">role_permissions</code>.
      </p>
      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[900px] text-left text-sm">
            <thead>
              <tr className="bg-sky-50/90 text-xs font-bold uppercase tracking-wide text-sky-900/85">
                <th className="sticky left-0 z-10 bg-sky-50/90 px-4 py-3">Role</th>
                {modules.map((m) => (
                  <th key={m.key} className="px-2 py-3 text-center">
                    {m.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {roles.map((r) => (
                <tr key={r.name} className="hover:bg-slate-50/80">
                  <td className="sticky left-0 z-[1] border-r border-slate-100 bg-white px-4 py-3 font-semibold text-slate-900 shadow-[2px_0_8px_-4px_rgba(0,0,0,0.08)]">
                    {r.name}
                  </td>
                  {modules.map((m) => (
                    <td key={m.key} className="px-2 py-3 text-center">
                      <Cell v={r.perms[m.key]} />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
