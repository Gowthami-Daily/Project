import { theadRow, tableScroll, tableWrap } from './tableStyles.js'

const rows = [
  {
    reg: 'AP-XX-1234',
    type: 'Bike',
    driver: 'Raju K.',
    route: 'R-01',
    status: 'Active',
    fuelAvg: '52 km/L',
    lastService: '12 Feb 2026',
    nextService: '12 May 2026',
  },
  {
    reg: 'AP-YY-5678',
    type: 'Auto',
    driver: 'Satyam N.',
    route: 'R-02',
    status: 'Active',
    fuelAvg: '28 km/L',
    lastService: '01 Mar 2026',
    nextService: '01 Jun 2026',
  },
  {
    reg: 'AP-ZZ-9012',
    type: 'Bike',
    driver: 'Ravi T.',
    route: 'R-03',
    status: 'Maintenance',
    fuelAvg: '48 km/L',
    lastService: '20 Jan 2026',
    nextService: '—',
  },
  {
    reg: 'AP-11-4455',
    type: 'Van',
    driver: '—',
    route: 'Hub',
    status: 'Idle',
    fuelAvg: '14 km/L',
    lastService: '05 Mar 2026',
    nextService: '05 Sep 2026',
  },
]

function statusPill(status) {
  const map = {
    Active: 'bg-emerald-100 text-emerald-800 ring-emerald-200/80',
    Maintenance: 'bg-amber-100 text-amber-900 ring-amber-200/80',
    Idle: 'bg-slate-100 text-slate-700 ring-slate-200/80',
  }
  return map[status] || map.Idle
}

export default function VehiclesPage() {
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        <span className="rounded-full bg-[#004080]/10 px-3 py-1 text-xs font-semibold text-[#004080]">All vehicles</span>
        <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">On route</span>
        <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">In workshop</span>
      </div>
      <div className={tableWrap}>
        <div className={tableScroll}>
          <table className="w-full min-w-[960px] text-left text-sm">
            <thead>
              <tr className={theadRow}>
                <th className="px-4 py-3">Vehicle no.</th>
                <th className="px-4 py-3">Type</th>
                <th className="px-4 py-3">Driver</th>
                <th className="px-4 py-3">Route</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Fuel avg</th>
                <th className="px-4 py-3">Last service</th>
                <th className="px-4 py-3">Next service</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {rows.map((r) => (
                <tr key={r.reg} className="hover:bg-slate-50/80">
                  <td className="px-4 py-3 font-mono font-semibold text-[#004080]">{r.reg}</td>
                  <td className="px-4 py-3 text-slate-700">{r.type}</td>
                  <td className="px-4 py-3 font-medium text-slate-900">{r.driver}</td>
                  <td className="px-4 py-3 font-mono text-slate-600">{r.route}</td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ${statusPill(r.status)}`}>
                      {r.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 font-mono tabular-nums text-slate-700">{r.fuelAvg}</td>
                  <td className="px-4 py-3 text-slate-600">{r.lastService}</td>
                  <td className="px-4 py-3 text-slate-600">{r.nextService}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
