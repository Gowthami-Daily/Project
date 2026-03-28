import { theadRow, tableScroll, tableWrap } from './productionTableStyles.js'

const reasons = ['Heating loss', 'Leakage', 'Machine issue', 'Packing damage']

const rows = [
  { date: '2026-03-27', batch: 'PP-2026-0313', input: '6,500 L', output: '6,388 L', loss: '112 L', reason: 'Heating loss' },
  { date: '2026-03-27', batch: 'PP-2026-0314', input: '4,200 L', output: '—', loss: '150 L (est.)', reason: 'Leakage' },
  { date: '2026-03-26', batch: 'PP-2026-0310', input: '5,000 L', output: '4,965 L', loss: '35 L', reason: 'Packing damage' },
  { date: '2026-03-26', batch: 'PK line-2', input: '—', output: '—', loss: '18 L eq.', reason: 'Machine issue' },
]

export default function ProductionLossPage() {
  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-lg font-bold text-slate-900">Production loss</h3>
        <p className="text-sm text-slate-500">
          Reasons: {reasons.join(' · ')} — feeds cost, yield KPIs, and QA investigations.
        </p>
      </div>

      <div className={tableWrap}>
        <div className={tableScroll}>
          <table className="min-w-full text-left text-sm">
            <thead className={theadRow}>
              <tr>
                <th className="px-4 py-3">Date</th>
                <th className="px-4 py-3">Batch</th>
                <th className="px-4 py-3">Input</th>
                <th className="px-4 py-3">Output</th>
                <th className="px-4 py-3">Loss</th>
                <th className="px-4 py-3">Reason</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {rows.map((r, i) => (
                <tr key={`${r.date}-${i}`} className="bg-white hover:bg-slate-50/80">
                  <td className="px-4 py-3 tabular-nums text-slate-700">{r.date}</td>
                  <td className="px-4 py-3 font-mono text-xs font-semibold text-slate-800">{r.batch}</td>
                  <td className="px-4 py-3 tabular-nums text-slate-700">{r.input}</td>
                  <td className="px-4 py-3 tabular-nums text-slate-700">{r.output}</td>
                  <td className="px-4 py-3 tabular-nums font-semibold text-rose-800">{r.loss}</td>
                  <td className="px-4 py-3">
                    <span className="rounded-full bg-amber-50 px-2.5 py-1 text-xs font-semibold text-amber-900 ring-1 ring-amber-200">
                      {r.reason}
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
