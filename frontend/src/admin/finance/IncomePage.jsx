import { theadRow, tableScroll, tableWrap } from './tableStyles.js'

const rows = [
  { date: '27 Mar 2026', source: 'Subscription (wallet debit)', amount: '₹2,10,000', mode: 'Wallet' },
  { date: '27 Mar 2026', source: 'Milk sales (retail)', amount: '₹38,400', mode: 'UPI + Cash' },
  { date: '26 Mar 2026', source: 'Curd', amount: '₹22,100', mode: 'Mixed' },
  { date: '26 Mar 2026', source: 'Paneer', amount: '₹14,800', mode: 'Bank' },
  { date: '25 Mar 2026', source: 'Ghee', amount: '₹9,200', mode: 'Retail' },
]

export default function IncomePage() {
  return (
    <div className="space-y-4">
      <p className="text-sm text-slate-600">
        Sources: milk sales, curd, paneer, ghee, subscription, retail — post to <code className="rounded bg-slate-100 px-1">income</code>{' '}
        / revenue accounts.
      </p>
      <div className={tableWrap}>
        <div className={tableScroll}>
          <table className="w-full min-w-[640px] text-left text-sm">
            <thead>
              <tr className={theadRow}>
                <th className="px-4 py-3">Date</th>
                <th className="px-4 py-3">Source</th>
                <th className="px-4 py-3">Amount</th>
                <th className="px-4 py-3">Payment mode</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {rows.map((r, i) => (
                <tr key={i} className="hover:bg-slate-50/80">
                  <td className="px-4 py-3 text-slate-600">{r.date}</td>
                  <td className="px-4 py-3 font-medium">{r.source}</td>
                  <td className="px-4 py-3 font-mono font-semibold tabular-nums text-emerald-800">{r.amount}</td>
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
