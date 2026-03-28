import { ArrowDownTrayIcon } from '@heroicons/react/24/outline'

const reports = [
  { name: 'Daily collection summary', purpose: 'Liters, fat/SNF, reject % by center' },
  { name: 'Farmer payment sheet', purpose: 'Period totals for disbursement' },
  { name: 'Quality reject register', purpose: 'Audit trail for discarded milk' },
  { name: 'Tank receipt log', purpose: 'Aligns with inventory tank transactions' },
  { name: 'Shift-wise throughput', purpose: 'Morning vs evening productivity' },
]

export default function InflowReportsPage() {
  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-lg font-bold text-slate-900">Inflow reports</h3>
        <p className="text-sm text-slate-500">Procurement analytics for managers and finance.</p>
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
              className="inline-flex min-h-[44px] shrink-0 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-4 text-sm font-semibold text-slate-800 hover:bg-slate-100"
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
