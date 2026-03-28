import { theadRow, tableScroll, tableWrap } from './cattleTableStyles.js'

const rows = [
  { animal: 'C-014', feed: '₹ 4,050', doctor: '₹ 400', medicine: '₹ 120', total: '₹ 4,570' },
  { animal: 'B-003', feed: '₹ 4,680', doctor: '₹ 1,200', medicine: '₹ 800', total: '₹ 6,680' },
  { animal: 'C-021', feed: '₹ 3,720', doctor: '₹ 0', medicine: '₹ 0', total: '₹ 3,720' },
  { animal: 'C-008', feed: '₹ 3,900', doctor: '₹ 850', medicine: '₹ 200', total: '₹ 4,950' },
  { animal: 'B-011', feed: '₹ 4,200', doctor: '₹ 2,050', medicine: '₹ 1,100', total: '₹ 7,350' },
]

export default function AnimalExpensesPage() {
  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-lg font-bold text-slate-900">Expense per animal</h3>
        <p className="text-sm text-slate-500">Monthly roll-up (demo) — feed + vet + medicine.</p>
      </div>

      <div className={tableWrap}>
        <div className={tableScroll}>
          <table className="min-w-full text-left text-sm">
            <thead className={theadRow}>
              <tr>
                <th className="px-4 py-3">Animal</th>
                <th className="px-4 py-3 text-right">Feed cost</th>
                <th className="px-4 py-3 text-right">Doctor</th>
                <th className="px-4 py-3 text-right">Medicine</th>
                <th className="px-4 py-3 text-right">Total</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {rows.map((r) => (
                <tr key={r.animal} className="bg-white hover:bg-slate-50/80">
                  <td className="px-4 py-3 font-mono font-bold text-slate-900">{r.animal}</td>
                  <td className="px-4 py-3 text-right font-mono text-slate-700">{r.feed}</td>
                  <td className="px-4 py-3 text-right font-mono text-slate-700">{r.doctor}</td>
                  <td className="px-4 py-3 text-right font-mono text-slate-700">{r.medicine}</td>
                  <td className="px-4 py-3 text-right font-mono text-lg font-bold text-slate-900">{r.total}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
