import { theadRow, tableScroll, tableWrap } from './tableStyles.js'

const farmer = [
  { name: 'Krishna (F1022)', amount: '₹20,000', date: '15 Dec 2025', ded: '₹4,000/mo', balance: '₹8,000' },
  { name: 'Venkata Raju (F1001)', amount: '₹10,000', date: '01 Feb 2026', ded: '₹2,000/mo', balance: '₹6,000' },
]

const staff = [
  { name: 'Raju K. (Driver)', amount: '₹15,000', date: '10 Jan 2026', ded: '₹2,500/mo', balance: '₹10,000' },
  { name: 'Ravi Teja', amount: '₹8,000', date: '02 Feb 2026', ded: '₹2,000/mo', balance: '₹4,000' },
]

function Table({ title, rows: r }) {
  return (
    <div>
      <h3 className="mb-3 text-base font-bold text-slate-900">{title}</h3>
      <div className={tableWrap}>
        <div className={tableScroll}>
          <table className="w-full min-w-[640px] text-left text-sm">
            <thead>
              <tr className={theadRow}>
                <th className="px-4 py-3">Name</th>
                <th className="px-4 py-3">Amount</th>
                <th className="px-4 py-3">Date</th>
                <th className="px-4 py-3">Deduction</th>
                <th className="px-4 py-3">Balance</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {r.map((row, i) => (
                <tr key={i} className="hover:bg-slate-50/80">
                  <td className="px-4 py-3 font-medium">{row.name}</td>
                  <td className="px-4 py-3 font-mono font-semibold">{row.amount}</td>
                  <td className="px-4 py-3 text-slate-600">{row.date}</td>
                  <td className="px-4 py-3 font-mono text-sm">{row.ded}</td>
                  <td className="px-4 py-3 font-mono font-semibold text-amber-800">{row.balance}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

export default function AdvancesFinancePage() {
  return (
    <div className="space-y-10">
      <p className="text-sm text-slate-600">
        <code className="rounded bg-slate-100 px-1">farmer_advances</code> &amp;{' '}
        <code className="rounded bg-slate-100 px-1">staff_advances</code> — recover via procurement deductions and payroll.
      </p>
      <Table title="Farmer advances" rows={farmer} />
      <Table title="Staff advances" rows={staff} />
    </div>
  )
}
