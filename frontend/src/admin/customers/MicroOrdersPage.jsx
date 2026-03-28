import { theadRow, tableScroll, tableWrap } from './tableStyles.js'

const rows = [
  { date: '28 Mar 2026', customer: 'Lakshmi (C3002)', product: 'Buffalo +2L', qty: '2 L', price: '₹104', status: 'Ordered' },
  { date: '28 Mar 2026', customer: 'Venkat (C3022)', product: 'Paneer 200g', qty: '2 pack', price: '₹240', status: 'Packed' },
  { date: '27 Mar 2026', customer: 'Sridevi (C3010)', product: 'Curd 500g', qty: '1', price: '₹45', status: 'Delivered' },
  { date: '27 Mar 2026', customer: 'Kumar (C3101)', product: 'Ghee 500ml', qty: '1', price: '₹320', status: 'Delivered' },
  { date: '26 Mar 2026', customer: 'Lakshmi (C3002)', product: 'Buffalo +1L', qty: '1 L', price: '₹52', status: 'Cancelled' },
]

function pill(s) {
  const map = {
    Ordered: 'bg-sky-100 text-sky-900',
    Packed: 'bg-violet-100 text-violet-900',
    Delivered: 'bg-emerald-100 text-emerald-800',
    Cancelled: 'bg-slate-200 text-slate-600',
  }
  return map[s] || map.Ordered
}

export default function MicroOrdersPage() {
  return (
    <div className="space-y-4">
      <p className="text-sm text-slate-600">Extra SKUs beyond subscription — flows into packing list &amp; wallet debit.</p>
      <div className={tableWrap}>
        <div className={tableScroll}>
          <table className="w-full min-w-[800px] text-left text-sm">
            <thead>
              <tr className={theadRow}>
                <th className="px-4 py-3">Date</th>
                <th className="px-4 py-3">Customer</th>
                <th className="px-4 py-3">Product</th>
                <th className="px-4 py-3">Qty</th>
                <th className="px-4 py-3">Price</th>
                <th className="px-4 py-3">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {rows.map((r, i) => (
                <tr key={i} className="hover:bg-slate-50/80">
                  <td className="px-4 py-3 text-slate-600">{r.date}</td>
                  <td className="px-4 py-3 font-medium">{r.customer}</td>
                  <td className="px-4 py-3">{r.product}</td>
                  <td className="px-4 py-3 font-mono">{r.qty}</td>
                  <td className="px-4 py-3 font-mono font-semibold">{r.price}</td>
                  <td className="px-4 py-3">
                    <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ring-black/5 ${pill(r.status)}`}>{r.status}</span>
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
