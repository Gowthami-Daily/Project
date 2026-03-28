import { EllipsisVerticalIcon, FunnelIcon, MapPinIcon } from '@heroicons/react/24/outline'
import { theadRow, tableScroll, tableWrap } from './dispatchTableStyles.js'

const statusTone = {
  Active: 'bg-emerald-100 text-emerald-800 ring-emerald-200',
  Available: 'bg-sky-100 text-sky-800 ring-sky-200',
  'Under repair': 'bg-amber-100 text-amber-900 ring-amber-200',
  Planned: 'bg-slate-100 text-slate-700 ring-slate-200',
}

const rows = [
  {
    id: 'RT-0092634',
    route: 'North A',
    area: 'Kukatpally',
    customers: 48,
    liters: 612,
    driver: 'Darlene Robertson',
    vehicle: 'TS09 AB 1122 · Refrigerated van',
    status: 'Active',
  },
  {
    id: 'RT-0092635',
    route: 'East B',
    area: 'Uppal',
    customers: 36,
    liters: 420,
    driver: '—',
    vehicle: 'TS12 CD 8899 · Mini truck',
    status: 'Available',
  },
  {
    id: 'RT-0092636',
    route: 'West C',
    area: 'Miyapur',
    customers: 52,
    liters: 705,
    driver: 'Ravi Kumar',
    vehicle: 'TS07 EF 3344 · Van',
    status: 'Under repair',
  },
]

export default function RoutePlanningPage() {
  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h3 className="text-lg font-bold text-slate-900">Route planning</h3>
          <p className="text-sm text-slate-500">Assign drivers &amp; vehicles, optimize stops, view map.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 shadow-sm hover:bg-slate-50"
          >
            <FunnelIcon className="h-4 w-4" aria-hidden />
            Filter
          </button>
          <button
            type="button"
            className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 shadow-sm hover:bg-slate-50"
          >
            Export
          </button>
          <button
            type="button"
            className="inline-flex items-center gap-2 rounded-xl bg-[#004080] px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-[#003366]"
          >
            + Create route
          </button>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="lg:col-span-2 rounded-2xl border border-dashed border-slate-300 bg-gradient-to-br from-slate-50 to-sky-50/50 p-6 shadow-inner">
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#004080] text-white shadow">
              <MapPinIcon className="h-5 w-5" aria-hidden />
            </div>
            <div>
              <p className="text-sm font-bold text-slate-900">Map &amp; quick actions</p>
              <p className="mt-1 text-xs text-slate-600">
                Placeholder for route map (polyline, depots, geofences). Wire to your maps provider and optimization
                API.
              </p>
            </div>
          </div>
          <div className="mt-6 flex h-[200px] items-center justify-center rounded-xl bg-white/80 text-sm text-slate-400 ring-1 ring-slate-200">
            Map canvas
          </div>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-xs font-bold uppercase tracking-wide text-slate-500">Today</p>
          <p className="mt-2 text-2xl font-bold text-slate-900">18 routes</p>
          <p className="text-sm text-slate-500">1,842 stops · ~42k L planned</p>
          <button
            type="button"
            className="mt-4 w-full rounded-xl bg-slate-900 py-2.5 text-sm font-semibold text-white hover:bg-slate-800"
          >
            Optimize all
          </button>
        </div>
      </div>

      <div className={tableWrap}>
        <div className={tableScroll}>
          <table className="min-w-full text-left text-sm">
            <thead className={theadRow}>
              <tr>
                <th className="px-4 py-3">Route / ID</th>
                <th className="px-4 py-3">Area</th>
                <th className="px-4 py-3 text-right">Customers</th>
                <th className="px-4 py-3 text-right">Total L</th>
                <th className="px-4 py-3">Driver</th>
                <th className="px-4 py-3">Vehicle</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {rows.map((r) => (
                <tr key={r.id} className="bg-white hover:bg-slate-50/80">
                  <td className="px-4 py-3">
                    <p className="font-mono text-xs font-semibold text-slate-800">{r.id}</p>
                    <p className="text-sm font-semibold text-slate-900">{r.route}</p>
                  </td>
                  <td className="px-4 py-3 text-slate-700">{r.area}</td>
                  <td className="px-4 py-3 text-right tabular-nums text-slate-800">{r.customers}</td>
                  <td className="px-4 py-3 text-right tabular-nums font-medium text-slate-900">{r.liters}</td>
                  <td className="px-4 py-3">
                    <select
                      className="w-full max-w-[180px] rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-sm font-medium text-slate-800"
                      defaultValue={r.driver === '—' ? '' : r.driver}
                      aria-label={`Driver for ${r.route}`}
                    >
                      <option value="">Assign…</option>
                      <option>Darlene Robertson</option>
                      <option>Ravi Kumar</option>
                      <option>Anita Rao</option>
                    </select>
                  </td>
                  <td className="max-w-[220px] px-4 py-3 text-xs text-slate-600">{r.vehicle}</td>
                  <td className="px-4 py-3">
                    <span
                      className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ${statusTone[r.status] || statusTone.Planned}`}
                    >
                      {r.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex flex-wrap justify-end gap-1">
                      <button
                        type="button"
                        className="rounded-lg bg-slate-100 px-2 py-1 text-xs font-semibold text-slate-800 hover:bg-slate-200"
                      >
                        View
                      </button>
                      <button
                        type="button"
                        className="rounded-lg bg-slate-100 px-2 py-1 text-xs font-semibold text-slate-800 hover:bg-slate-200"
                      >
                        Vehicle
                      </button>
                      <button
                        type="button"
                        className="rounded-lg bg-sky-100 px-2 py-1 text-xs font-semibold text-sky-900 hover:bg-sky-200"
                      >
                        Optimize
                      </button>
                      <button
                        type="button"
                        className="rounded-lg p-1 text-slate-500 hover:bg-slate-100"
                        aria-label="More"
                      >
                        <EllipsisVerticalIcon className="h-5 w-5" />
                      </button>
                    </div>
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
