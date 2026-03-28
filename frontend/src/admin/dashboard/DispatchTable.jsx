const ROWS = [
  {
    route: 'R-01',
    vehicle: 'AP-XX-1234',
    driver: 'Raju Kumar',
    initials: 'RK',
    loaded: 320,
    delivered: 298,
    pending: 22,
    status: 'In transit',
    statusTone: 'blue',
  },
  {
    route: 'R-02',
    vehicle: 'AP-YY-5678',
    driver: 'Satyam N.',
    initials: 'SN',
    loaded: 280,
    delivered: 280,
    pending: 0,
    status: 'Completed',
    statusTone: 'green',
  },
  {
    route: 'R-03',
    vehicle: 'AP-ZZ-9012',
    driver: 'Ravi Teja',
    initials: 'RT',
    loaded: 300,
    delivered: 210,
    pending: 90,
    status: 'Delayed',
    statusTone: 'amber',
  },
  {
    route: 'R-04',
    vehicle: 'AP-11-3344',
    driver: 'Lakshmi P.',
    initials: 'LP',
    loaded: 195,
    delivered: 0,
    pending: 195,
    status: 'Loading',
    statusTone: 'slate',
  },
]

const toneStyles = {
  green: 'bg-emerald-100 text-emerald-800 ring-emerald-200/80',
  blue: 'bg-sky-100 text-sky-900 ring-sky-200/80',
  amber: 'bg-amber-100 text-amber-900 ring-amber-200/80',
  slate: 'bg-slate-100 text-slate-700 ring-slate-200/80',
}

function DriverCell({ name, initials }) {
  return (
    <div className="flex items-center gap-2.5">
      <div
        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-sky-400 to-[#004080] text-xs font-bold text-white shadow-sm ring-2 ring-white"
        aria-hidden
      >
        {initials}
      </div>
      <span className="font-medium text-slate-800">{name}</span>
    </div>
  )
}

export default function DispatchTable() {
  return (
    <div className="overflow-hidden rounded-2xl border border-slate-200/90 bg-white shadow-sm">
      <div className="border-b border-slate-100 px-5 py-4">
        <h3 className="text-lg font-bold text-slate-900">Dispatch routes</h3>
        <p className="mt-0.5 text-sm text-slate-500">Live route load vs delivered liters (demo data)</p>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[860px] text-left text-sm">
          <thead>
            <tr className="bg-sky-50/90 text-xs font-bold uppercase tracking-wide text-sky-900/80">
              <th className="px-5 py-3.5">Route</th>
              <th className="px-5 py-3.5">Vehicle</th>
              <th className="px-5 py-3.5">Driver</th>
              <th className="px-5 py-3.5">Loaded liters</th>
              <th className="px-5 py-3.5">Delivered liters</th>
              <th className="px-5 py-3.5">Pending liters</th>
              <th className="px-5 py-3.5">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {ROWS.map((r) => (
              <tr key={r.route} className="transition hover:bg-slate-50/80">
                <td className="px-5 py-3.5 font-mono text-base font-bold text-[#004080]">{r.route}</td>
                <td className="px-5 py-3.5 font-mono text-slate-600">{r.vehicle}</td>
                <td className="px-5 py-3.5">
                  <DriverCell name={r.driver} initials={r.initials} />
                </td>
                <td className="px-5 py-3.5 font-mono tabular-nums font-semibold text-slate-800">{r.loaded} L</td>
                <td className="px-5 py-3.5 font-mono tabular-nums text-emerald-700">{r.delivered} L</td>
                <td className="px-5 py-3.5 font-mono tabular-nums text-amber-700">{r.pending} L</td>
                <td className="px-5 py-3.5">
                  <span
                    className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ${toneStyles[r.statusTone]}`}
                  >
                    {r.status}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
