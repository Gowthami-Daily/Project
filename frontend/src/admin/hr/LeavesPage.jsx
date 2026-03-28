import { theadRow, tableScroll, tableWrap } from './tableStyles.js'

const rows = [
  { staff: 'Sridevi M.', type: 'Sick', from: '24 Mar 2026', to: '26 Mar 2026', days: '3', status: 'Approved' },
  { staff: 'Ravi Teja', type: 'Casual', from: '30 Mar 2026', to: '30 Mar 2026', days: '1', status: 'Pending' },
  { staff: 'Lakshmi P.', type: 'Paid leave', from: '05 Apr 2026', to: '09 Apr 2026', days: '5', status: 'Approved' },
  { staff: 'Krishna Rao', type: 'Unpaid', from: '12 Apr 2026', to: '13 Apr 2026', days: '2', status: 'Pending' },
]

function statusPill(s) {
  const map = {
    Approved: 'bg-emerald-100 text-emerald-800 ring-emerald-200/80',
    Pending: 'bg-amber-100 text-amber-900 ring-amber-200/80',
    Rejected: 'bg-red-100 text-red-800 ring-red-200/80',
  }
  return map[s] || map.Pending
}

export default function LeavesPage() {
  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-slate-200 bg-slate-50/80 p-4 text-sm text-slate-700">
        <strong>Leave types:</strong> Sick · Casual · Paid leave · Unpaid leave — map to policy rules and accruals in backend.
      </div>
      <div className={tableWrap}>
        <div className={tableScroll}>
          <table className="w-full min-w-[800px] text-left text-sm">
            <thead>
              <tr className={theadRow}>
                <th className="px-4 py-3">Staff</th>
                <th className="px-4 py-3">Leave type</th>
                <th className="px-4 py-3">From</th>
                <th className="px-4 py-3">To</th>
                <th className="px-4 py-3">Days</th>
                <th className="px-4 py-3">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {rows.map((r, i) => (
                <tr key={i} className="hover:bg-slate-50/80">
                  <td className="px-4 py-3 font-medium">{r.staff}</td>
                  <td className="px-4 py-3">{r.type}</td>
                  <td className="px-4 py-3 text-slate-600">{r.from}</td>
                  <td className="px-4 py-3 text-slate-600">{r.to}</td>
                  <td className="px-4 py-3 font-mono">{r.days}</td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ${statusPill(r.status)}`}>
                      {r.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
