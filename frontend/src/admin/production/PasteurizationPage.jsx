import { theadRow, tableScroll, tableWrap } from './productionTableStyles.js'

const statusTone = {
  Processing: 'bg-sky-100 text-sky-900 ring-sky-200',
  Completed: 'bg-emerald-100 text-emerald-900 ring-emerald-200',
  Failed: 'bg-rose-100 text-rose-900 ring-rose-200',
}

const lossReasons = ['Evaporation', 'Leakage', 'Spillage']

const rows = [
  {
    id: 'PP-2026-0314',
    tank: 'T1 + T2 blend',
    input: '4,200 L',
    output: '4,050 L',
    loss: '150 L',
    operator: 'Ramesh K.',
    status: 'Processing',
  },
  {
    id: 'PP-2026-0313',
    tank: 'T3 Silo A',
    input: '6,500 L',
    output: '6,388 L',
    loss: '112 L',
    operator: 'Anita S.',
    status: 'Completed',
  },
  {
    id: 'PP-2026-0312',
    tank: 'T2',
    input: '3,100 L',
    output: '—',
    loss: '—',
    operator: 'Ramesh K.',
    status: 'Failed',
  },
]

export default function PasteurizationPage() {
  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h3 className="text-lg font-bold text-slate-900">Pasteurization batches</h3>
          <p className="text-sm text-slate-500">
            Standardization (fat adjust) happens in-line with pasteurization where configured.
          </p>
        </div>
        <button
          type="button"
          className="rounded-xl bg-[#004080] px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-[#003366]"
        >
          + New batch
        </button>
      </div>

      <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-xs text-slate-600">
        <span className="font-bold text-slate-800">Typical loss reasons: </span>
        {lossReasons.join(' · ')}
      </div>

      <div className={tableWrap}>
        <div className={tableScroll}>
          <table className="min-w-full text-left text-sm">
            <thead className={theadRow}>
              <tr>
                <th className="px-4 py-3">Batch ID</th>
                <th className="px-4 py-3">Tank</th>
                <th className="px-4 py-3">Input milk</th>
                <th className="px-4 py-3">Output milk</th>
                <th className="px-4 py-3">Loss</th>
                <th className="px-4 py-3">Operator</th>
                <th className="px-4 py-3">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {rows.map((r) => (
                <tr key={r.id} className="bg-white hover:bg-slate-50/80">
                  <td className="px-4 py-3 font-mono text-xs font-semibold text-slate-800">{r.id}</td>
                  <td className="px-4 py-3 text-slate-700">{r.tank}</td>
                  <td className="px-4 py-3 tabular-nums text-slate-800">{r.input}</td>
                  <td className="px-4 py-3 tabular-nums text-slate-800">{r.output}</td>
                  <td className="px-4 py-3 tabular-nums text-amber-800">{r.loss}</td>
                  <td className="px-4 py-3 text-slate-700">{r.operator}</td>
                  <td className="px-4 py-3">
                    <span
                      className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ${statusTone[r.status]}`}
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
    </div>
  )
}
