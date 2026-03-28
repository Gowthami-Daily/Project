import { theadRow, tableScroll, tableWrap } from './tableStyles.js'

const rows = [
  { date: '27 Mar 2026', farmer: 'Venkata Raju (F1001)', liters: '45', rate: '₹56.20', amount: '₹2,529', ded: '₹200', net: '₹2,329' },
  { date: '27 Mar 2026', farmer: 'Sridevi (F1005)', liters: '32', rate: '₹55.80', amount: '₹1,786', ded: '₹150', net: '₹1,636' },
  { date: '27 Mar 2026', farmer: 'Krishna (F1022)', liters: '28', rate: '₹56.00', amount: '₹1,568', ded: '₹320', net: '₹1,248' },
  { date: '26 Mar 2026', farmer: 'Venkata Raju (F1001)', liters: '44', rate: '₹56.10', amount: '₹2,468', ded: '₹200', net: '₹2,268' },
]

export default function FarmerLedgerPage() {
  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-slate-200 bg-slate-50/80 p-4 text-sm text-slate-700">
        <p className="font-semibold text-slate-900">Deductions</p>
        <p className="mt-1">
          Advance recovery · Feed cost · Transport · Commission — map to <code className="rounded bg-white px-1">farmer_ledger</code>{' '}
          lines.
        </p>
      </div>
      <div className="flex flex-wrap gap-2">
        <button type="button" className="rounded-xl bg-[#004080] px-4 py-2 text-sm font-semibold text-white hover:bg-[#003366]">
          Export payout batch
        </button>
      </div>
      <div className={tableWrap}>
        <div className={tableScroll}>
          <table className="w-full min-w-[880px] text-left text-sm">
            <thead>
              <tr className={theadRow}>
                <th className="px-4 py-3">Date</th>
                <th className="px-4 py-3">Farmer</th>
                <th className="px-4 py-3">Liters</th>
                <th className="px-4 py-3">Rate</th>
                <th className="px-4 py-3">Amount</th>
                <th className="px-4 py-3">Deduction</th>
                <th className="px-4 py-3">Net amount</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {rows.map((r, i) => (
                <tr key={i} className="hover:bg-slate-50/80">
                  <td className="px-4 py-3 text-slate-600">{r.date}</td>
                  <td className="px-4 py-3 font-medium text-slate-900">{r.farmer}</td>
                  <td className="px-4 py-3 font-mono tabular-nums">{r.liters}</td>
                  <td className="px-4 py-3 font-mono tabular-nums">{r.rate}</td>
                  <td className="px-4 py-3 font-mono tabular-nums">{r.amount}</td>
                  <td className="px-4 py-3 font-mono tabular-nums text-rose-700">{r.ded}</td>
                  <td className="px-4 py-3 font-mono font-bold tabular-nums text-emerald-800">{r.net}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
