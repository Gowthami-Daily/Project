import { theadRow, tableScroll, tableWrap } from './productionTableStyles.js'

const rows = [
  { product: 'Cow milk', size: '500ml', qty: 1000, liters: 500, location: 'Cold room A' },
  { product: 'Buffalo milk', size: '1L', qty: 300, liters: 300, location: 'Cold room A' },
  { product: 'Cow milk', size: '1L', qty: 880, liters: 880, location: 'Cold room B' },
  { product: 'Toned milk', size: '500ml', qty: 420, liters: 210, location: 'Cold room A' },
]

export default function PackedInventoryPage() {
  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-lg font-bold text-slate-900">Packed milk inventory</h3>
        <p className="text-sm text-slate-500">Finished packed milk before dispatch — aligns with inventory FG.</p>
      </div>

      <div className={tableWrap}>
        <div className={tableScroll}>
          <table className="min-w-full text-left text-sm">
            <thead className={theadRow}>
              <tr>
                <th className="px-4 py-3">Product</th>
                <th className="px-4 py-3">Size</th>
                <th className="px-4 py-3 text-right">Quantity</th>
                <th className="px-4 py-3 text-right">Liters</th>
                <th className="px-4 py-3">Location</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {rows.map((r) => (
                <tr key={`${r.product}-${r.size}-${r.location}`} className="bg-white hover:bg-slate-50/80">
                  <td className="px-4 py-3 font-semibold text-slate-900">{r.product}</td>
                  <td className="px-4 py-3 text-slate-700">{r.size}</td>
                  <td className="px-4 py-3 text-right tabular-nums text-slate-800">{r.qty.toLocaleString()}</td>
                  <td className="px-4 py-3 text-right tabular-nums font-medium text-slate-900">{r.liters}</td>
                  <td className="px-4 py-3 text-slate-600">{r.location}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
