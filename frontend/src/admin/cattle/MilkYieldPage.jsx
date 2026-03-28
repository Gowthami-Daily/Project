import { theadRow, tableScroll, tableWrap } from './cattleTableStyles.js'

const rows = [
  { date: '2026-03-27', animal: 'C-014 · HF cross', morning: 7.8, evening: 6.4, total: 14.2 },
  { date: '2026-03-27', animal: 'B-003 · Murrah', morning: 6.5, evening: 5.6, total: 12.1 },
  { date: '2026-03-27', animal: 'C-021 · Jersey', morning: 7.1, evening: 6.2, total: 13.3 },
  { date: '2026-03-26', animal: 'C-014 · HF cross', morning: 7.6, evening: 6.2, total: 13.8 },
  { date: '2026-03-26', animal: 'B-003 · Murrah', morning: 6.4, evening: 5.5, total: 11.9 },
]

export default function MilkYieldPage() {
  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-lg font-bold text-slate-900">Milk yield tracking</h3>
        <p className="text-sm text-slate-500">
          Per-animal morning / evening — spot best performers and low producers for breeding or culling.
        </p>
      </div>

      <div className={tableWrap}>
        <div className={tableScroll}>
          <table className="min-w-full text-left text-sm">
            <thead className={theadRow}>
              <tr>
                <th className="px-4 py-3">Date</th>
                <th className="px-4 py-3">Animal</th>
                <th className="px-4 py-3 text-right">Morning (L)</th>
                <th className="px-4 py-3 text-right">Evening (L)</th>
                <th className="px-4 py-3 text-right">Total (L)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {rows.map((r, i) => (
                <tr key={`${r.date}-${i}`} className="bg-white hover:bg-slate-50/80">
                  <td className="px-4 py-3 tabular-nums text-slate-700">{r.date}</td>
                  <td className="px-4 py-3 font-medium text-slate-900">{r.animal}</td>
                  <td className="px-4 py-3 text-right tabular-nums text-slate-700">{r.morning}</td>
                  <td className="px-4 py-3 text-right tabular-nums text-slate-700">{r.evening}</td>
                  <td className="px-4 py-3 text-right tabular-nums text-lg font-bold text-emerald-800">{r.total}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <button
        type="button"
        className="min-h-[44px] rounded-xl bg-emerald-700 px-5 text-sm font-semibold text-white hover:bg-emerald-800"
      >
        + Log yield
      </button>
    </div>
  )
}
