import { theadRow, tableScroll, tableWrap } from './cattleTableStyles.js'

const vaccines = ['FMD', 'HS', 'BQ', 'Brucellosis']

const rows = [
  { animal: 'C-014', vaccine: 'FMD', date: '2026-01-12', next: '2026-07-12' },
  { animal: 'B-003', vaccine: 'HS', date: '2025-11-03', next: '2026-11-03' },
  { animal: 'C-021', vaccine: 'BQ', date: '2026-02-20', next: '2027-02-20' },
  { animal: 'B-011', vaccine: 'Brucellosis', date: '2025-08-01', next: '—' },
]

export default function VaccinationPage() {
  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-lg font-bold text-slate-900">Vaccination</h3>
        <p className="text-sm text-slate-500">Common programs: {vaccines.join(' · ')}.</p>
      </div>

      <div className={tableWrap}>
        <div className={tableScroll}>
          <table className="min-w-full text-left text-sm">
            <thead className={theadRow}>
              <tr>
                <th className="px-4 py-3">Animal</th>
                <th className="px-4 py-3">Vaccine</th>
                <th className="px-4 py-3">Date</th>
                <th className="px-4 py-3">Next due</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {rows.map((r) => (
                <tr key={`${r.animal}-${r.vaccine}`} className="bg-white hover:bg-slate-50/80">
                  <td className="px-4 py-3 font-mono font-bold text-slate-900">{r.animal}</td>
                  <td className="px-4 py-3">
                    <span className="rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-semibold text-emerald-900">
                      {r.vaccine}
                    </span>
                  </td>
                  <td className="px-4 py-3 tabular-nums text-slate-700">{r.date}</td>
                  <td className="px-4 py-3 tabular-nums font-medium text-slate-800">{r.next}</td>
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
        + Record vaccination
      </button>
    </div>
  )
}
