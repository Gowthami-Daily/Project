import { CheckCircleIcon, ClockIcon } from '@heroicons/react/24/solid'
import { theadRow, tableScroll, tableWrap } from './productionTableStyles.js'

const rows = [
  {
    batch: 'PP-2026-0313',
    tank: 'T3 · 6,500 L in',
    packed: '6,172 L out',
    dispatched: '5,400 L',
    delivered: '5,200 L',
    stage: 'Delivered',
  },
  {
    batch: 'PP-2026-0314',
    tank: 'T1+T2 · 4,200 L',
    packed: 'In progress',
    dispatched: '—',
    delivered: '—',
    stage: 'Packing',
  },
  {
    batch: 'PP-2026-0311',
    tank: 'T2',
    packed: '7,960 L',
    dispatched: '7,800 L',
    delivered: 'Pending POD',
    stage: 'Dispatch',
  },
]

const stageTone = {
  Delivered: 'text-emerald-700',
  Packing: 'text-sky-700',
  Dispatch: 'text-amber-700',
}

export default function BatchTrackingPage() {
  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-lg font-bold text-slate-900">Batch tracking</h3>
        <p className="text-sm text-slate-500">
          End-to-end traceability: tank → processing → packing → dispatch → delivery — critical for quality issues.
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-4">
        <div className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white p-3 text-sm shadow-sm">
          <ClockIcon className="h-8 w-8 text-sky-500" aria-hidden />
          <div>
            <p className="text-xs font-bold uppercase text-slate-500">Active batches</p>
            <p className="text-lg font-bold text-slate-900">4</p>
          </div>
        </div>
        <div className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white p-3 text-sm shadow-sm sm:col-span-3">
          <CheckCircleIcon className="h-8 w-8 text-emerald-500" aria-hidden />
          <p className="text-sm text-slate-600">
            Drill-down (demo): link each cell to ledger lines, vehicle load, and customer POD when wired to backend.
          </p>
        </div>
      </div>

      <div className={tableWrap}>
        <div className={tableScroll}>
          <table className="min-w-full text-left text-sm">
            <thead className={theadRow}>
              <tr>
                <th className="px-4 py-3">Batch</th>
                <th className="px-4 py-3">Tank</th>
                <th className="px-4 py-3">Packed</th>
                <th className="px-4 py-3">Dispatched</th>
                <th className="px-4 py-3">Delivered</th>
                <th className="px-4 py-3">Stage</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {rows.map((r) => (
                <tr key={r.batch} className="bg-white hover:bg-slate-50/80">
                  <td className="px-4 py-3 font-mono text-xs font-bold text-slate-900">{r.batch}</td>
                  <td className="max-w-[180px] px-4 py-3 text-slate-700">{r.tank}</td>
                  <td className="px-4 py-3 text-slate-700">{r.packed}</td>
                  <td className="px-4 py-3 text-slate-700">{r.dispatched}</td>
                  <td className="px-4 py-3 text-slate-700">{r.delivered}</td>
                  <td className="px-4 py-3">
                    <span className={`text-xs font-bold uppercase ${stageTone[r.stage]}`}>{r.stage}</span>
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
