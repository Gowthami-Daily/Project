import { theadRow, tableScroll, tableWrap } from './tableStyles.js'

const rows = [
  { date: '27 Mar', customer: 'Lakshmi (C3002)', issue: 'Late delivery', status: 'Open', assigned: 'Dispatch lead' },
  { date: '26 Mar', customer: 'Venkat (C3022)', issue: 'Packet missing', status: 'In progress', assigned: 'R-03 agent' },
  { date: '25 Mar', customer: 'Sridevi (C3010)', issue: 'Milk spoiled', status: 'Resolved', assigned: 'QA' },
  { date: '24 Mar', customer: 'Anita (C2988)', issue: 'Payment issue', status: 'Open', assigned: 'Accounts' },
  { date: '24 Mar', customer: 'Kumar (C3088)', issue: 'Wrong product', status: 'Open', assigned: 'Hub ops' },
]

export default function ComplaintsPage() {
  return (
    <div className="space-y-4">
      <p className="text-sm text-slate-600">
        Types: Milk spoiled · Packet missing · Wrong delivery · Late delivery · Payment — SLA tracking in{' '}
        <code className="rounded bg-slate-100 px-1">complaints</code>.
      </p>
      <div className={tableWrap}>
        <div className={tableScroll}>
          <table className="w-full min-w-[880px] text-left text-sm">
            <thead>
              <tr className={theadRow}>
                <th className="px-4 py-3">Date</th>
                <th className="px-4 py-3">Customer</th>
                <th className="px-4 py-3">Issue</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Assigned to</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {rows.map((r, i) => (
                <tr key={i} className="hover:bg-slate-50/80">
                  <td className="px-4 py-3 text-slate-600">{r.date}</td>
                  <td className="px-4 py-3 font-medium">{r.customer}</td>
                  <td className="px-4 py-3">{r.issue}</td>
                  <td className="px-4 py-3 font-semibold">{r.status}</td>
                  <td className="px-4 py-3 text-slate-600">{r.assigned}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
