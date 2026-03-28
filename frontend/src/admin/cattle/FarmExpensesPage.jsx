import { theadRow, tableScroll, tableWrap } from './cattleTableStyles.js'

const rows = [
  { date: '2026-03-27', category: 'Labor — milker overtime', amount: '₹ 2,400', notes: 'Festival shift' },
  { date: '2026-03-26', category: 'Electricity — dairy shed', amount: '₹ 18,500', notes: 'Monthly bill' },
  { date: '2026-03-25', category: 'Water / bore maintenance', amount: '₹ 3,200', tags: 'Infrastructure' },
  { date: '2026-03-20', category: 'Bedding straw', amount: '₹ 6,800', notes: '10 tons' },
]

export default function FarmExpensesPage() {
  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-lg font-bold text-slate-900">Farm expenses</h3>
        <p className="text-sm text-slate-500">
          Overhead not tied to a single animal — allocate to herd or cost center in finance.
        </p>
      </div>

      <div className={tableWrap}>
        <div className={tableScroll}>
          <table className="min-w-full text-left text-sm">
            <thead className={theadRow}>
              <tr>
                <th className="px-4 py-3">Date</th>
                <th className="px-4 py-3">Category</th>
                <th className="px-4 py-3 text-right">Amount</th>
                <th className="px-4 py-3">Notes</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {rows.map((r, i) => (
                <tr key={`${r.date}-${i}`} className="bg-white hover:bg-slate-50/80">
                  <td className="px-4 py-3 tabular-nums text-slate-700">{r.date}</td>
                  <td className="px-4 py-3 font-medium text-slate-900">{r.category}</td>
                  <td className="px-4 py-3 text-right font-mono font-semibold text-slate-900">{r.amount}</td>
                  <td className="px-4 py-3 text-sm text-slate-600">{r.notes || r.tags}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <button
        type="button"
        className="min-h-[44px] rounded-xl border border-slate-200 bg-white px-5 text-sm font-semibold text-slate-800 hover:bg-slate-50"
      >
        + Farm expense
      </button>
    </div>
  )
}
