import { ArrowDownTrayIcon } from '@heroicons/react/24/outline'

const reports = [
  { name: 'Herd register export', purpose: 'All animals with status and purchase' },
  { name: 'Yield vs feed efficiency', purpose: 'Liters per ₹ feed by animal' },
  { name: 'Vaccination due list', purpose: 'Next dates for FMD / HS / BQ' },
  { name: 'Health cost summary', purpose: 'Vet + medicine by month' },
  { name: 'Breeding calendar', purpose: 'Expected calving / PD follow-ups' },
]

export default function CattleReportsPage() {
  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-lg font-bold text-slate-900">Cattle reports</h3>
        <p className="text-sm text-slate-500">Herd management exports for owners and auditors.</p>
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
              className="inline-flex min-h-[44px] shrink-0 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-emerald-50 px-4 text-sm font-semibold text-emerald-900 hover:bg-emerald-100"
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
