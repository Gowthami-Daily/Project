import { CalendarDaysIcon } from '@heroicons/react/24/outline'
import { theadRow, tableScroll, tableWrap } from './dispatchTableStyles.js'

const statusTone = {
  Scheduled: 'bg-slate-100 text-slate-800 ring-slate-200',
  Packed: 'bg-indigo-100 text-indigo-900 ring-indigo-200',
  Dispatched: 'bg-sky-100 text-sky-900 ring-sky-200',
  Delivered: 'bg-emerald-100 text-emerald-900 ring-emerald-200',
  Missed: 'bg-rose-100 text-rose-900 ring-rose-200',
}

const rows = [
  {
    route: 'North A',
    customer: 'Lakshmi Reddy',
    product: 'Toned 1L × 2',
    qty: '2 L',
    address: 'Plot 12, KPHB 5th Phase',
    status: 'Scheduled',
    source: 'Subscription',
  },
  {
    route: 'North A',
    customer: 'Venkatesh K',
    product: 'Full cream 500ml × 4',
    qty: '2 L',
    address: 'Road 3, Kukatpally',
    status: 'Packed',
    source: 'Micro order',
  },
  {
    route: 'East B',
    customer: 'Priya Sharma',
    product: 'Curd 400g',
    qty: '0.4 kg',
    address: 'Uppal ring road',
    status: 'Dispatched',
    source: 'Subscription',
  },
  {
    route: 'West C',
    customer: 'Ramesh Iyer',
    product: 'Toned 1L × 1',
    qty: '1 L',
    address: 'Miyapur TS',
    status: 'Delivered',
    source: 'Subscription',
  },
  {
    route: 'South D',
    customer: 'Fatima Begum',
    product: 'Toned 1L × 3',
    qty: '3 L',
    address: 'Attapur',
    status: 'Missed',
    source: 'Vacation override',
  },
]

export default function DispatchSchedulePage() {
  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h3 className="text-lg font-bold text-slate-900">Delivery schedule</h3>
          <p className="text-sm text-slate-500">
            Tomorrow’s operational plan — built from subscriptions, vacation holds, and micro orders.
          </p>
        </div>
        <div className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 shadow-sm">
          <CalendarDaysIcon className="h-5 w-5 text-[#004080]" aria-hidden />
          <div>
            <p className="text-xs font-semibold text-slate-500">Plan date</p>
            <p className="text-sm font-bold text-slate-900">Sat, 28 Mar 2026</p>
          </div>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-xs font-bold uppercase text-slate-500">Stops</p>
          <p className="mt-1 text-2xl font-bold text-slate-900">1,904</p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-xs font-bold uppercase text-slate-500">Volume (L)</p>
          <p className="mt-1 text-2xl font-bold text-slate-900">43.2k</p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-xs font-bold uppercase text-slate-500">Routes</p>
          <p className="mt-1 text-2xl font-bold text-slate-900">19</p>
        </div>
      </div>

      <div className={tableWrap}>
        <div className={tableScroll}>
          <table className="min-w-full text-left text-sm">
            <thead className={theadRow}>
              <tr>
                <th className="px-4 py-3">Route</th>
                <th className="px-4 py-3">Customer</th>
                <th className="px-4 py-3">Product</th>
                <th className="px-4 py-3">Qty</th>
                <th className="px-4 py-3">Address</th>
                <th className="px-4 py-3">Source</th>
                <th className="px-4 py-3">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {rows.map((r, i) => (
                <tr key={`${r.customer}-${i}`} className="bg-white hover:bg-slate-50/80">
                  <td className="px-4 py-3 font-semibold text-slate-900">{r.route}</td>
                  <td className="px-4 py-3 text-slate-800">{r.customer}</td>
                  <td className="px-4 py-3 text-slate-700">{r.product}</td>
                  <td className="px-4 py-3 tabular-nums text-slate-800">{r.qty}</td>
                  <td className="max-w-[220px] px-4 py-3 text-xs text-slate-600">{r.address}</td>
                  <td className="px-4 py-3 text-xs text-slate-500">{r.source}</td>
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
