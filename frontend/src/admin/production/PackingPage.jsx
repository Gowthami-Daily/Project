import { theadRow, tableScroll, tableWrap } from './productionTableStyles.js'

const rows = [
  { batch: 'PP-2026-0313', size: '500ml', qty: 1000, liters: 500 },
  { batch: 'PP-2026-0313', size: '1L', qty: 300, liters: 300 },
  { batch: 'PP-2026-0311', size: '500ml', qty: 2400, liters: 1200 },
  { batch: 'PP-2026-0311', size: '1L', qty: 520, liters: 520 },
]

export default function PackingPage() {
  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h3 className="text-lg font-bold text-slate-900">Packing</h3>
          <p className="text-sm text-slate-500">
            Packing floor entry — posts to <strong className="font-semibold text-slate-700">packed milk inventory</strong>.
          </p>
        </div>
        <button
          type="button"
          className="rounded-xl bg-amber-500 px-4 py-2 text-sm font-bold text-slate-900 shadow-sm hover:bg-amber-400"
        >
          + Packing entry
        </button>
      </div>

      <div className={tableWrap}>
        <div className={tableScroll}>
          <table className="min-w-full text-left text-sm">
            <thead className={theadRow}>
              <tr>
                <th className="px-4 py-3">Batch</th>
                <th className="px-4 py-3">Pack size</th>
                <th className="px-4 py-3 text-right">Quantity</th>
                <th className="px-4 py-3 text-right">Total liters</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {rows.map((r, i) => (
                <tr key={`${r.batch}-${r.size}-${i}`} className="bg-white hover:bg-slate-50/80">
                  <td className="px-4 py-3 font-mono text-xs font-semibold text-slate-800">{r.batch}</td>
                  <td className="px-4 py-3 font-medium text-slate-900">{r.size}</td>
                  <td className="px-4 py-3 text-right tabular-nums text-slate-800">{r.qty.toLocaleString()}</td>
                  <td className="px-4 py-3 text-right tabular-nums font-semibold text-[#004080]">{r.liters} L</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
