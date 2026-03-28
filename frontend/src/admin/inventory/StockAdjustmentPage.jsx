import { theadRow, tableScroll, tableWrap } from './inventoryTableStyles.js'

const rows = [
  { date: '2026-03-27', product: 'Paneer', system: 80, actual: 78, diff: -2 },
  { date: '2026-03-26', product: 'Ghee 1L', system: 60, actual: 61, diff: 1 },
  { date: '2026-03-25', product: 'Curd 400g', system: 200, actual: 188, diff: -12 },
]

function diffClass(d) {
  if (d === 0) return 'text-slate-600'
  if (d > 0) return 'text-emerald-700 font-semibold'
  return 'text-rose-700 font-semibold'
}

export default function StockAdjustmentPage() {
  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-lg font-bold text-slate-900">Stock adjustment</h3>
        <p className="text-sm text-slate-500">
          Manual corrections and physical count variances — posts to inventory ledger as adjustment.
        </p>
      </div>

      <div className={tableWrap}>
        <div className={tableScroll}>
          <table className="min-w-full text-left text-sm">
            <thead className={theadRow}>
              <tr>
                <th className="px-4 py-3">Date</th>
                <th className="px-4 py-3">Product</th>
                <th className="px-4 py-3 text-right">System stock</th>
                <th className="px-4 py-3 text-right">Actual stock</th>
                <th className="px-4 py-3 text-right">Difference</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {rows.map((r) => (
                <tr key={`${r.date}-${r.product}`} className="bg-white hover:bg-slate-50/80">
                  <td className="px-4 py-3 tabular-nums text-slate-700">{r.date}</td>
                  <td className="px-4 py-3 font-medium text-slate-900">{r.product}</td>
                  <td className="px-4 py-3 text-right tabular-nums text-slate-800">{r.system}</td>
                  <td className="px-4 py-3 text-right tabular-nums text-slate-800">{r.actual}</td>
                  <td className={`px-4 py-3 text-right tabular-nums ${diffClass(r.diff)}`}>
                    {r.diff > 0 ? `+${r.diff}` : r.diff}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <button
        type="button"
        className="rounded-xl bg-[#004080] px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-[#003366]"
      >
        + New count / adjustment
      </button>
    </div>
  )
}
