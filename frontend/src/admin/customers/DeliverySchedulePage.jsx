import { theadRow, tableScroll, tableWrap } from './tableStyles.js'

/** Tomorrow’s demand — feeds dispatch generation */
const rows = [
  { route: 'R-01', customer: 'Lakshmi (C3002)', product: 'Buffalo 1L', qty: '1', status: 'Scheduled' },
  { route: 'R-01', customer: 'Satyanarayana (C2001)', product: '—', qty: '—', status: 'Skipped (vacation)' },
  { route: 'R-01', customer: 'Kumar (C3088)', product: 'Buffalo 1L + Curd', qty: '1 + 1', status: 'Scheduled' },
  { route: 'R-02', customer: 'Sridevi (C3010)', product: 'Cow 500ml', qty: '1', status: 'Scheduled' },
  { route: 'R-03', customer: 'Venkat (C3022)', product: 'Buffalo 2L', qty: '2', status: 'Scheduled' },
]

export default function DeliverySchedulePage() {
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="text-lg font-bold text-slate-900">Delivery schedule</h3>
          <p className="text-sm text-slate-500">
            Target: <strong>Tomorrow</strong> · excludes vacation / pauses · export to dispatch (Module 3).
          </p>
        </div>
        <button type="button" className="rounded-xl bg-[#004080] px-4 py-2 text-sm font-semibold text-white hover:bg-[#003366]">
          Push to dispatch
        </button>
      </div>
      <div className={tableWrap}>
        <div className={tableScroll}>
          <table className="w-full min-w-[800px] text-left text-sm">
            <thead>
              <tr className={theadRow}>
                <th className="px-4 py-3">Route</th>
                <th className="px-4 py-3">Customer</th>
                <th className="px-4 py-3">Product</th>
                <th className="px-4 py-3">Qty</th>
                <th className="px-4 py-3">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {rows.map((r, i) => (
                <tr key={i} className="hover:bg-slate-50/80">
                  <td className="px-4 py-3 font-mono font-bold text-[#004080]">{r.route}</td>
                  <td className="px-4 py-3 font-medium">{r.customer}</td>
                  <td className="px-4 py-3">{r.product}</td>
                  <td className="px-4 py-3 font-mono">{r.qty}</td>
                  <td className="px-4 py-3 text-slate-700">{r.status}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
