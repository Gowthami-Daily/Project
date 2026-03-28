import { theadRow, tableScroll, tableWrap } from './cattleTableStyles.js'

const rows = [
  {
    date: '2026-03-26',
    animal: 'B-011',
    problem: 'Mastitis — early',
    doctor: 'Dr. Reddy',
    cost: '₹ 1,200',
    medicine: 'Antibiotic course + teat dip',
  },
  {
    date: '2026-03-20',
    animal: 'C-014',
    problem: 'Hoof trim',
    doctor: 'Dr. Sharma',
    cost: '₹ 400',
    medicine: '—',
  },
  {
    date: '2026-03-15',
    animal: 'C-008',
    problem: 'Fever',
    doctor: 'Dr. Reddy',
    cost: '₹ 850',
    medicine: 'NSAIDs, electrolytes',
  },
]

export default function HealthDoctorPage() {
  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-lg font-bold text-slate-900">Health &amp; doctor visits</h3>
        <p className="text-sm text-slate-500">Vet costs roll into <strong className="text-slate-800">profit per animal</strong>.</p>
      </div>

      <div className={tableWrap}>
        <div className={tableScroll}>
          <table className="min-w-full text-left text-sm">
            <thead className={theadRow}>
              <tr>
                <th className="px-4 py-3">Date</th>
                <th className="px-4 py-3">Animal</th>
                <th className="px-4 py-3">Problem</th>
                <th className="px-4 py-3">Doctor</th>
                <th className="px-4 py-3">Cost</th>
                <th className="px-4 py-3">Medicine</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {rows.map((r, i) => (
                <tr key={`${r.date}-${i}`} className="bg-white hover:bg-slate-50/80">
                  <td className="px-4 py-3 tabular-nums text-slate-700">{r.date}</td>
                  <td className="px-4 py-3 font-mono font-semibold text-slate-900">{r.animal}</td>
                  <td className="max-w-[200px] px-4 py-3 text-slate-700">{r.problem}</td>
                  <td className="px-4 py-3 text-slate-600">{r.doctor}</td>
                  <td className="px-4 py-3 font-mono font-semibold text-rose-800">{r.cost}</td>
                  <td className="max-w-[220px] px-4 py-3 text-sm text-slate-600">{r.medicine}</td>
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
        + Log visit
      </button>
    </div>
  )
}
