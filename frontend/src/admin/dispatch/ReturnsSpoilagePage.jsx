import { theadRow, tableScroll, tableWrap } from './dispatchTableStyles.js'

const rows = [
  { date: '2026-03-26', route: 'North A', product: 'Toned 1L', qty: 12, reason: 'Temperature excursion' },
  { date: '2026-03-26', route: 'East B', product: 'Curd 400g', qty: 8, reason: 'Damaged crate' },
  { date: '2026-03-25', route: 'West C', product: 'Full cream 500ml', qty: 24, reason: 'Expired batch' },
]

export default function ReturnsSpoilagePage() {
  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-lg font-bold text-slate-900">Returns &amp; spoilage</h3>
        <p className="text-sm text-slate-500">Stock adjustments back to inventory / wastage with audit trail.</p>
      </div>

      <div className={tableWrap}>
        <div className={tableScroll}>
          <table className="min-w-full text-left text-sm">
            <thead className={theadRow}>
              <tr>
                <th className="px-4 py-3">Date</th>
                <th className="px-4 py-3">Route</th>
                <th className="px-4 py-3">Product</th>
                <th className="px-4 py-3 text-right">Qty</th>
                <th className="px-4 py-3">Reason</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {rows.map((r) => (
                <tr key={`${r.date}-${r.product}-${r.qty}`} className="bg-white hover:bg-slate-50/80">
                  <td className="px-4 py-3 tabular-nums text-slate-700">{r.date}</td>
                  <td className="px-4 py-3 font-medium text-slate-900">{r.route}</td>
                  <td className="px-4 py-3 text-slate-700">{r.product}</td>
                  <td className="px-4 py-3 text-right tabular-nums text-slate-800">{r.qty}</td>
                  <td className="px-4 py-3 text-sm text-slate-600">{r.reason}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
