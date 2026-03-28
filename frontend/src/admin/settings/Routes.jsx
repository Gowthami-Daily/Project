const rows = [
  { id: 'R-01', name: 'Main town loop', zone: 'Zone A — Central', stops: 42, vehicle: 'Bike / Auto', status: 'Active' },
  { id: 'R-02', name: 'Temple road', zone: 'Zone B — East', stops: 38, vehicle: 'Bike', status: 'Active' },
  { id: 'R-03', name: 'River colony', zone: 'Zone C — North', stops: 51, vehicle: 'Auto', status: 'Active' },
  { id: 'R-04', name: 'Industrial belt', zone: 'Zone D — West', stops: 29, vehicle: 'Van', status: 'Draft' },
]

const statusClass = {
  Active: 'bg-emerald-100 text-emerald-800 ring-emerald-200/80',
  Draft: 'bg-slate-100 text-slate-700 ring-slate-200/80',
  Paused: 'bg-amber-100 text-amber-900 ring-amber-200/80',
}

export default function Routes() {
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h3 className="text-lg font-bold text-slate-900">Routes & zones</h3>
          <p className="mt-1 text-sm text-slate-600">
            Delivery routes linked to geographic zones. Used for dispatch planning and agent assignment.
          </p>
        </div>
        <button
          type="button"
          className="rounded-xl bg-[#004080] px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-[#003366]"
        >
          Add route
        </button>
      </div>

      <div className="overflow-hidden rounded-xl border border-slate-200 shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] text-left text-sm">
            <thead>
              <tr className="bg-sky-50/90 text-xs font-bold uppercase tracking-wide text-sky-900/85">
                <th className="px-4 py-3">Route ID</th>
                <th className="px-4 py-3">Route name</th>
                <th className="px-4 py-3">Zone</th>
                <th className="px-4 py-3">Stops</th>
                <th className="px-4 py-3">Default vehicle</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {rows.map((r) => (
                <tr key={r.id} className="hover:bg-slate-50/80">
                  <td className="px-4 py-3 font-mono font-bold text-[#004080]">{r.id}</td>
                  <td className="px-4 py-3 font-medium text-slate-900">{r.name}</td>
                  <td className="px-4 py-3 text-slate-600">{r.zone}</td>
                  <td className="px-4 py-3 font-mono tabular-nums">{r.stops}</td>
                  <td className="px-4 py-3 text-slate-600">{r.vehicle}</td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ${statusClass[r.status] || statusClass.Draft}`}>
                      {r.status}
                    </span>
                  </td>
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
    </div>
  )
}
