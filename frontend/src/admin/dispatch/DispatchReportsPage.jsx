import { ArrowDownTrayIcon } from '@heroicons/react/24/outline'

const reports = [
  { name: 'Route performance', purpose: 'Efficiency, on-time %, liters per km' },
  { name: 'Delivery time', purpose: 'Speed — first delivery, avg stop time, SLA' },
  { name: 'Missed delivery', purpose: 'Problems — reasons, hotspots, reattempt success' },
  { name: 'Cost per route', purpose: 'Fuel, maintenance allocation, margin' },
  { name: 'Driver performance', purpose: 'Stops/hour, complaints, POD compliance' },
]

export default function DispatchReportsPage() {
  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-lg font-bold text-slate-900">Delivery reports</h3>
        <p className="text-sm text-slate-500">Export and schedule operational &amp; finance-friendly summaries.</p>
      </div>

      <ul className="grid gap-3 sm:grid-cols-2">
        {reports.map((r) => (
          <li
            key={r.name}
            className="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:flex-row sm:items-center sm:justify-between"
          >
            <div>
              <p className="font-bold text-slate-900">{r.name}</p>
              <p className="mt-1 text-sm text-slate-500">{r.purpose}</p>
            </div>
            <button
              type="button"
              className="inline-flex shrink-0 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-semibold text-slate-800 hover:bg-slate-100"
            >
              <ArrowDownTrayIcon className="h-4 w-4" aria-hidden />
              Export
            </button>
          </li>
        ))}
      </ul>
    </div>
  )
}
