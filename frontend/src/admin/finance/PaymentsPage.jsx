import { theadRow, tableScroll, tableWrap } from './tableStyles.js'

const rows = [
  { date: '27 Mar 2026', to: 'Venkata Raju', type: 'Milk payment', amount: '₹52,400', mode: 'Bank NEFT' },
  { date: '27 Mar 2026', to: 'HP Petrol Bunk', type: 'Fuel expense', amount: '₹12,800', mode: 'UPI' },
  { date: '26 Mar 2026', to: 'Salary batch (March 1–15)', type: 'Salary', amount: '₹4,20,000', mode: 'Bank' },
  { date: '26 Mar 2026', to: 'Grid electricity', type: 'Utilities', amount: '₹38,200', mode: 'Auto-debit' },
  { date: '25 Mar 2026', to: 'Packing supplier', type: 'Packing material', amount: '₹64,500', mode: 'Bank' },
]

export default function PaymentsPage() {
  return (
    <div className="space-y-4">
      <p className="text-sm text-slate-600">
        All outflows — farmers, vendors, salaries. Post through <code className="rounded bg-slate-100 px-1">payments</code> → journal
        lines.
      </p>
      <div className={tableWrap}>
        <div className={tableScroll}>
          <table className="w-full min-w-[800px] text-left text-sm">
            <thead>
              <tr className={theadRow}>
                <th className="px-4 py-3">Date</th>
                <th className="px-4 py-3">Paid to</th>
                <th className="px-4 py-3">Type</th>
                <th className="px-4 py-3">Amount</th>
                <th className="px-4 py-3">Mode</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {rows.map((r, i) => (
                <tr key={i} className="hover:bg-slate-50/80">
                  <td className="px-4 py-3 text-slate-600">{r.date}</td>
                  <td className="px-4 py-3 font-medium">{r.to}</td>
                  <td className="px-4 py-3 text-slate-700">{r.type}</td>
                  <td className="px-4 py-3 font-mono font-semibold tabular-nums">{r.amount}</td>
                  <td className="px-4 py-3 text-slate-600">{r.mode}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
