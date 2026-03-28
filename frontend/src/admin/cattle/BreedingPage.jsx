import { theadRow, tableScroll, tableWrap } from './cattleTableStyles.js'

const rows = [
  { animal: 'C-021', type: 'Artificial insemination', date: '2025-12-10', result: 'Pregnant', next: '2026-03-10 USG' },
  { animal: 'B-003', type: 'Natural', date: '2025-09-22', result: 'Calved', next: '—' },
  { animal: 'C-014', type: 'Artificial insemination', date: '2026-02-01', result: 'Pending', next: '2026-03-01 PD' },
]

export default function BreedingPage() {
  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-lg font-bold text-slate-900">Breeding tracking</h3>
        <p className="text-sm text-slate-500">AI vs natural service — tie to dry / transition and projected calving.</p>
      </div>

      <div className={tableWrap}>
        <div className={tableScroll}>
          <table className="min-w-full text-left text-sm">
            <thead className={theadRow}>
              <tr>
                <th className="px-4 py-3">Animal</th>
                <th className="px-4 py-3">Type</th>
                <th className="px-4 py-3">Date</th>
                <th className="px-4 py-3">Result</th>
                <th className="px-4 py-3">Next check</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {rows.map((r) => (
                <tr key={`${r.animal}-${r.date}`} className="bg-white hover:bg-slate-50/80">
                  <td className="px-4 py-3 font-mono font-bold text-slate-900">{r.animal}</td>
                  <td className="px-4 py-3 text-slate-700">{r.type}</td>
                  <td className="px-4 py-3 tabular-nums text-slate-700">{r.date}</td>
                  <td className="px-4 py-3">
                    <span className="rounded-full bg-violet-100 px-2.5 py-1 text-xs font-semibold text-violet-900">
                      {r.result}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-sm text-slate-600">{r.next}</td>
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
        + Breeding event
      </button>
    </div>
  )
}
