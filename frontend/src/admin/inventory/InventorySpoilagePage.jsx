import { theadRow, tableScroll, tableWrap } from './inventoryTableStyles.js'

const reasons = ['Expired', 'Damaged packet', 'Leakage', 'Temperature issue', 'Transport damage']

const rows = [
  { date: '2026-03-27', product: 'Curd 400g', qty: '24 cups', reason: 'Temperature issue' },
  { date: '2026-03-27', product: 'Cow 500ml', qty: '12 packets', reason: 'Damaged packet' },
  { date: '2026-03-26', product: 'Toned 1L', qty: '8 packets', reason: 'Expired' },
  { date: '2026-03-26', product: 'Raw milk (tank)', qty: '140 L', reason: 'Leakage' },
  { date: '2026-03-25', product: 'Paneer', qty: '4 kg', reason: 'Transport damage' },
]

export default function InventorySpoilagePage() {
  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-lg font-bold text-slate-900">Spoilage / loss</h3>
        <p className="text-sm text-slate-500">
          Non-saleable stock — links to wastage cost and QA. Reasons: {reasons.join(' · ')}.
        </p>
      </div>

      <div className={tableWrap}>
        <div className={tableScroll}>
          <table className="min-w-full text-left text-sm">
            <thead className={theadRow}>
              <tr>
                <th className="px-4 py-3">Date</th>
                <th className="px-4 py-3">Product</th>
                <th className="px-4 py-3">Qty</th>
                <th className="px-4 py-3">Reason</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {rows.map((r) => (
                <tr key={`${r.date}-${r.product}`} className="bg-white hover:bg-slate-50/80">
                  <td className="px-4 py-3 tabular-nums text-slate-700">{r.date}</td>
                  <td className="px-4 py-3 font-medium text-slate-900">{r.product}</td>
                  <td className="px-4 py-3 tabular-nums text-rose-800">{r.qty}</td>
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
