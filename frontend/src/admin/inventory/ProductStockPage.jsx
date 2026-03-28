import { theadRow, tableScroll, tableWrap } from './inventoryTableStyles.js'

const statusTone = {
  OK: 'bg-emerald-100 text-emerald-900 ring-emerald-200',
  Low: 'bg-amber-100 text-amber-900 ring-amber-200',
  Critical: 'bg-rose-100 text-rose-900 ring-rose-200',
}

const rows = [
  { product: 'Cow milk 500ml', stock: 500, unit: 'Packets', reorder: 100, status: 'OK' },
  { product: 'Buffalo milk 1L', stock: 300, unit: 'Packets', reorder: 50, status: 'OK' },
  { product: 'Curd 400g', stock: 200, unit: 'Cups', reorder: 40, status: 'Low' },
  { product: 'Paneer', stock: 80, unit: 'Kg', reorder: 20, status: 'OK' },
  { product: 'Ghee 1L', stock: 60, unit: 'L', reorder: 10, status: 'OK' },
  { product: 'Toned 1L', stock: 18, unit: 'Packets', reorder: 80, status: 'Critical' },
]

export default function ProductStockPage() {
  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h3 className="text-lg font-bold text-slate-900">Product inventory</h3>
          <p className="text-sm text-slate-500">Finished goods · cold storage and dispatch staging.</p>
        </div>
        <button
          type="button"
          className="rounded-xl bg-[#004080] px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-[#003366]"
        >
          + Stock receipt
        </button>
      </div>

      <div className={tableWrap}>
        <div className={tableScroll}>
          <table className="min-w-full text-left text-sm">
            <thead className={theadRow}>
              <tr>
                <th className="px-4 py-3">Product</th>
                <th className="px-4 py-3 text-right">Stock</th>
                <th className="px-4 py-3">Unit</th>
                <th className="px-4 py-3 text-right">Reorder level</th>
                <th className="px-4 py-3">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {rows.map((r) => (
                <tr key={r.product} className="bg-white hover:bg-slate-50/80">
                  <td className="px-4 py-3 font-semibold text-slate-900">{r.product}</td>
                  <td className="px-4 py-3 text-right tabular-nums font-medium text-slate-900">{r.stock}</td>
                  <td className="px-4 py-3 text-slate-600">{r.unit}</td>
                  <td className="px-4 py-3 text-right tabular-nums text-slate-700">{r.reorder}</td>
                  <td className="px-4 py-3">
                    <span
                      className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ${statusTone[r.status]}`}
                    >
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
