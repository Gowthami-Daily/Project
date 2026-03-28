import { theadRow, tableScroll, tableWrap } from './cattleTableStyles.js'

const rows = [
  { feed: 'Dry fodder', stock: 500, unit: 'Kg', cost: '₹8 / kg' },
  { feed: 'Green fodder', stock: 1200, unit: 'Kg', cost: '₹4 / kg' },
  { feed: 'Concentrate', stock: 300, unit: 'Kg', cost: '₹25 / kg' },
  { feed: 'Mineral mix', stock: 25, unit: 'Kg', cost: '₹100 / kg' },
  { feed: 'Silage', stock: 800, unit: 'Kg', cost: '₹6 / kg' },
]

export default function FeedInventoryPage() {
  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-lg font-bold text-slate-900">Feed inventory</h3>
        <p className="text-sm text-slate-500">Stock on hand and valuation basis for ration costing.</p>
      </div>

      <div className={tableWrap}>
        <div className={tableScroll}>
          <table className="min-w-full text-left text-sm">
            <thead className={theadRow}>
              <tr>
                <th className="px-4 py-3">Feed type</th>
                <th className="px-4 py-3 text-right">Stock</th>
                <th className="px-4 py-3">Unit</th>
                <th className="px-4 py-3">Cost / unit</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {rows.map((r) => (
                <tr key={r.feed} className="bg-white hover:bg-slate-50/80">
                  <td className="px-4 py-3 font-semibold text-slate-900">{r.feed}</td>
                  <td className="px-4 py-3 text-right tabular-nums font-medium text-slate-900">
                    {r.stock.toLocaleString()}
                  </td>
                  <td className="px-4 py-3 text-slate-600">{r.unit}</td>
                  <td className="px-4 py-3 font-mono text-slate-700">{r.cost}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <button
        type="button"
        className="min-h-[44px] rounded-xl border border-slate-200 bg-white px-5 text-sm font-semibold text-slate-800 shadow-sm hover:bg-slate-50"
      >
        + Stock receipt
      </button>
    </div>
  )
}
