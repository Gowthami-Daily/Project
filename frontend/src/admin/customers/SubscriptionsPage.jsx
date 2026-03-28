import { theadRow, tableScroll, tableWrap } from './tableStyles.js'

const subs = [
  { customer: 'Lakshmi (C3002)', product: 'Buffalo 1L', qty: '1 / day', schedule: 'Daily', price: '₹52/day', status: 'Active' },
  { customer: 'Satyanarayana (C2001)', product: 'Buffalo 1L', qty: '1 / day', schedule: 'Daily', price: '₹52/day', status: 'Vacation' },
  { customer: 'Sridevi (C3010)', product: 'Cow 500ml', qty: '1 / alt day', schedule: 'Alternate days', price: '₹28/day avg', status: 'Active' },
  { customer: 'Venkat (C3022)', product: 'Buffalo 2L', qty: '2 / day', schedule: 'Daily', price: '₹104/day', status: 'Paused' },
  { customer: 'Kumar (C3101)', product: 'Curd 500g', qty: '3 / week', schedule: 'Custom (Tue,Thu,Sat)', price: '₹45/unit', status: 'Active' },
]

const vacation = [
  { customer: 'Satyanarayana', from: '29 Mar 2026', to: '31 Mar 2026', reason: 'Out of town' },
]

export default function SubscriptionsPage() {
  return (
    <div className="space-y-8">
      <div className="rounded-xl border border-slate-200 bg-slate-50/80 p-4 text-sm text-slate-700">
        <strong>Schedule types:</strong> Daily · Alternate days · Custom days · Weekend only · Monthly plan — stored in{' '}
        <code className="rounded bg-white px-1">subscription_schedule</code>.
      </div>

      <div>
        <h3 className="mb-3 text-lg font-bold text-slate-900">Active subscriptions</h3>
        <div className={tableWrap}>
          <div className={tableScroll}>
            <table className="w-full min-w-[900px] text-left text-sm">
              <thead>
                <tr className={theadRow}>
                  <th className="px-4 py-3">Customer</th>
                  <th className="px-4 py-3">Product</th>
                  <th className="px-4 py-3">Quantity</th>
                  <th className="px-4 py-3">Schedule</th>
                  <th className="px-4 py-3">Price</th>
                  <th className="px-4 py-3">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {subs.map((r, i) => (
                  <tr key={i} className="hover:bg-slate-50/80">
                    <td className="px-4 py-3 font-medium">{r.customer}</td>
                    <td className="px-4 py-3">{r.product}</td>
                    <td className="px-4 py-3 font-mono text-xs">{r.qty}</td>
                    <td className="px-4 py-3">{r.schedule}</td>
                    <td className="px-4 py-3 font-mono font-semibold">{r.price}</td>
                    <td className="px-4 py-3 text-slate-700">{r.status}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <div>
        <h3 className="mb-3 text-lg font-bold text-slate-900">Vacation mode</h3>
        <p className="mb-3 text-sm text-slate-600">System auto-excludes these customers from tomorrow’s delivery schedule / dispatch.</p>
        <div className={tableWrap}>
          <div className={tableScroll}>
            <table className="w-full min-w-[560px] text-left text-sm">
              <thead>
                <tr className={theadRow}>
                  <th className="px-4 py-3">Customer</th>
                  <th className="px-4 py-3">From</th>
                  <th className="px-4 py-3">To</th>
                  <th className="px-4 py-3">Reason</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {vacation.map((v) => (
                  <tr key={v.customer}>
                    <td className="px-4 py-3 font-medium">{v.customer}</td>
                    <td className="px-4 py-3">{v.from}</td>
                    <td className="px-4 py-3">{v.to}</td>
                    <td className="px-4 py-3 text-slate-600">{v.reason}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  )
}
