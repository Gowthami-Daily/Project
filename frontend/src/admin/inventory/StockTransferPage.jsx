import { theadRow, tableScroll, tableWrap } from './inventoryTableStyles.js'

const rows = [
  { date: '2026-03-27 06:00', product: 'Pasteurized milk', qty: '4,000 L', from: 'Buffer B1', to: 'Packing line PB-2' },
  { date: '2026-03-27 08:30', product: 'Mixed SKU pallet', qty: '1,240 eq. L', from: 'Plant cold store A', to: 'Route vehicle TS09 AB 1122' },
  { date: '2026-03-26 22:00', product: 'Raw milk', qty: '6,500 L', from: 'T3 Silo A', to: 'Production intake' },
  { date: '2026-03-26 18:15', product: 'Curd 400g', qty: '400 cups', from: 'Production FG', to: 'Cold storage B' },
]

export default function StockTransferPage() {
  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-lg font-bold text-slate-900">Stock transfer</h3>
        <p className="text-sm text-slate-500">
          Inter-location moves: plant → vehicle, tank → production, production → cold storage, etc.
        </p>
      </div>

      <div className={tableWrap}>
        <div className={tableScroll}>
          <table className="min-w-full text-left text-sm">
            <thead className={theadRow}>
              <tr>
                <th className="px-4 py-3">Date / time</th>
                <th className="px-4 py-3">Product</th>
                <th className="px-4 py-3">Qty</th>
                <th className="px-4 py-3">From</th>
                <th className="px-4 py-3">To</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {rows.map((r, i) => (
                <tr key={`${r.date}-${i}`} className="bg-white hover:bg-slate-50/80">
                  <td className="whitespace-nowrap px-4 py-3 font-mono text-xs text-slate-700">{r.date}</td>
                  <td className="px-4 py-3 font-medium text-slate-900">{r.product}</td>
                  <td className="px-4 py-3 tabular-nums font-semibold text-slate-800">{r.qty}</td>
                  <td className="max-w-[200px] px-4 py-3 text-slate-600">{r.from}</td>
                  <td className="max-w-[200px] px-4 py-3 text-slate-600">{r.to}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <button
        type="button"
        className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-800 shadow-sm hover:bg-slate-50"
      >
        + New transfer
      </button>
    </div>
  )
}
