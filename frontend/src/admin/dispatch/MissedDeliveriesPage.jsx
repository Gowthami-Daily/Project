import { theadRow, tableScroll, tableWrap } from './dispatchTableStyles.js'

const reasons = [
  'Customer not available',
  'Address not found',
  'Payment issue',
  'Vehicle issue',
  'Milk spoiled',
]

const rows = [
  { date: '2026-03-26', customer: 'Fatima Begum', route: 'South D', reason: 'Customer not available' },
  { date: '2026-03-26', customer: 'Suresh N', route: 'East B', reason: 'Address not found' },
  { date: '2026-03-25', customer: 'Anil Gupta', route: 'North A', reason: 'Payment issue' },
  { date: '2026-03-25', customer: 'Deepa M', route: 'West C', reason: 'Vehicle issue' },
  { date: '2026-03-24', customer: 'Kiran P', route: 'North A', reason: 'Milk spoiled' },
]

export default function MissedDeliveriesPage() {
  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-lg font-bold text-slate-900">Missed deliveries</h3>
        <p className="text-sm text-slate-500">Exception log for reattempts, wallet credits, and route analytics.</p>
      </div>

      <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-xs text-slate-600">
        <span className="font-bold text-slate-800">Reason codes: </span>
        {reasons.join(' · ')}
      </div>

      <div className={tableWrap}>
        <div className={tableScroll}>
          <table className="min-w-full text-left text-sm">
            <thead className={theadRow}>
              <tr>
                <th className="px-4 py-3">Date</th>
                <th className="px-4 py-3">Customer</th>
                <th className="px-4 py-3">Route</th>
                <th className="px-4 py-3">Reason</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {rows.map((r) => (
                <tr key={`${r.date}-${r.customer}`} className="bg-white hover:bg-slate-50/80">
                  <td className="px-4 py-3 tabular-nums text-slate-700">{r.date}</td>
                  <td className="px-4 py-3 font-medium text-slate-900">{r.customer}</td>
                  <td className="px-4 py-3 text-slate-700">{r.route}</td>
                  <td className="px-4 py-3">
                    <span className="rounded-full bg-rose-50 px-2.5 py-1 text-xs font-semibold text-rose-900 ring-1 ring-rose-200">
                      {r.reason}
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
