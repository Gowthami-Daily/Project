import { theadRow, tableScroll, tableWrap } from './tableStyles.js'

const rows = [
  { staff: 'Raju K.', amount: '₹15,000', date: '10 Jan 2026', monthly: '₹2,500', balance: '₹10,000' },
  { staff: 'Ravi Teja', amount: '₹8,000', date: '02 Feb 2026', monthly: '₹2,000', balance: '₹4,000' },
  { staff: 'Krishna Rao', amount: '₹20,000', date: '15 Dec 2025', monthly: '₹4,000', balance: '₹8,000' },
  { staff: 'Venkat Helper', amount: '₹5,000', date: '20 Mar 2026', monthly: '₹1,250', balance: '₹5,000' },
]

export default function AdvancesPage() {
  return (
    <div className="space-y-4">
      <p className="text-sm text-slate-600">
        Staff loans common in dairy operations — balance recovered via payroll deductions (<code className="rounded bg-slate-100 px-1">staff_advances</code>).
      </p>
      <div className="flex flex-wrap gap-2">
        <button type="button" className="rounded-xl bg-[#004080] px-4 py-2 text-sm font-semibold text-white hover:bg-[#003366]">
          Record new advance
        </button>
      </div>
      <div className={tableWrap}>
        <div className={tableScroll}>
          <table className="w-full min-w-[800px] text-left text-sm">
            <thead>
              <tr className={theadRow}>
                <th className="px-4 py-3">Staff</th>
                <th className="px-4 py-3">Amount</th>
                <th className="px-4 py-3">Date</th>
                <th className="px-4 py-3">Deduction / month</th>
                <th className="px-4 py-3">Balance</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {rows.map((r) => (
                <tr key={`${r.staff}-${r.date}`} className="hover:bg-slate-50/80">
                  <td className="px-4 py-3 font-medium text-slate-900">{r.staff}</td>
                  <td className="px-4 py-3 font-mono font-semibold">{r.amount}</td>
                  <td className="px-4 py-3 text-slate-600">{r.date}</td>
                  <td className="px-4 py-3 font-mono tabular-nums">{r.monthly}</td>
                  <td className="px-4 py-3 font-mono font-semibold text-amber-800">{r.balance}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
