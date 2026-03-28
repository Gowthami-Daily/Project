import { ArrowDownTrayIcon } from '@heroicons/react/24/outline'

const reports = [
  { name: 'Daily production summary', purpose: 'Pasteurized vs packed vs loss by shift' },
  { name: 'Batch yield report', purpose: 'Input/output and efficiency by batch' },
  { name: 'Packing performance', purpose: '500ml vs 1L mix, line speed, rework' },
  { name: 'Loss analysis', purpose: 'Reason codes and cost impact' },
  { name: 'Traceability export', purpose: 'Batch → tank → dispatch → delivery for audits' },
]

export default function ProductionReportsPage() {
  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-lg font-bold text-slate-900">Production reports</h3>
        <p className="text-sm text-slate-500">Manufacturing-style exports for plant managers and finance.</p>
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
