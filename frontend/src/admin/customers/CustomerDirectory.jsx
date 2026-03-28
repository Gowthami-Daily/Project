import { Link } from 'react-router-dom'
import { EllipsisVerticalIcon, MagnifyingGlassIcon } from '@heroicons/react/24/outline'
import { theadRow, tableScroll, tableWrap } from './tableStyles.js'

const rows = [
  { id: 'C3002', name: 'Lakshmi', phone: '+91 98765 43210', area: 'Jayanagar', route: 'R-01', plan: '1L Buffalo · Daily', wallet: '₹1,450', status: 'Active' },
  { id: 'C2001', name: 'Satyanarayana', phone: '+91 98765 11101', area: 'Banashankari', route: 'R-01', plan: '1L Buffalo · Daily', wallet: '₹2,100', status: 'Vacation' },
  { id: 'C3010', name: 'Sridevi', phone: '+91 98765 22202', area: 'Koramangala', route: 'R-02', plan: '500ml Cow · Alt days', wallet: '₹320', status: 'Active' },
  { id: 'C3022', name: 'Venkat', phone: '+91 98765 33303', area: 'Whitefield', route: 'R-03', plan: '2L Buffalo · Daily', wallet: '₹890', status: 'Paused' },
  { id: 'C2988', name: 'Anita Rao', phone: '+91 98765 44404', area: 'Indiranagar', route: 'R-02', plan: 'Curd add-on', wallet: '₹0', status: 'Stopped' },
]

function statusPill(s) {
  const map = {
    Active: 'bg-emerald-100 text-emerald-800 ring-emerald-200/80',
    Paused: 'bg-amber-100 text-amber-900 ring-amber-200/80',
    Vacation: 'bg-sky-100 text-sky-900 ring-sky-200/80',
    Stopped: 'bg-slate-200 text-slate-700 ring-slate-300/80',
  }
  return map[s] || map.Active
}

function Avatar({ name }) {
  const initial = name.slice(0, 1).toUpperCase()
  return (
    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-sky-400 to-[#004080] text-sm font-bold text-white">
      {initial}
    </div>
  )
}

export default function CustomerDirectory() {
  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h3 className="text-lg font-bold text-slate-900">Customer directory</h3>
          <p className="text-sm text-slate-500">
            <span className="font-mono font-semibold text-[#004080]">1,284</span> customers · CRM list view
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <label className="relative flex-1 min-w-[200px] sm:max-w-xs">
            <MagnifyingGlassIcon className="pointer-events-none absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" />
            <input
              type="search"
              placeholder="Search name, phone, ID…"
              className="w-full rounded-xl border border-slate-200 py-2.5 pl-10 pr-3 text-sm focus:border-[#004080] focus:outline-none focus:ring-2 focus:ring-[#004080]/20"
            />
          </label>
          <button
            type="button"
            className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 shadow-sm hover:bg-slate-50"
          >
            Filter
          </button>
          <button
            type="button"
            className="rounded-xl bg-[#004080] px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-[#003366]"
          >
            Add customer
          </button>
        </div>
      </div>

      <div className={tableWrap}>
        <div className={tableScroll}>
          <table className="w-full min-w-[1000px] text-left text-sm">
            <thead>
              <tr className={theadRow}>
                <th className="w-10 px-3 py-3">
                  <input type="checkbox" className="rounded border-slate-300" aria-label="Select all" />
                </th>
                <th className="px-4 py-3">Customer</th>
                <th className="px-4 py-3">Phone</th>
                <th className="px-4 py-3">Area</th>
                <th className="px-4 py-3">Route</th>
                <th className="px-4 py-3">Plan</th>
                <th className="px-4 py-3">Wallet</th>
                <th className="px-4 py-3">Status</th>
                <th className="w-12 px-2 py-3" aria-label="Actions" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {rows.map((r) => (
                <tr key={r.id} className="hover:bg-slate-50/80">
                  <td className="px-3 py-3">
                    <input type="checkbox" className="rounded border-slate-300" aria-label={`Select ${r.name}`} />
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <Avatar name={r.name} />
                      <div>
                        <Link to={r.id} className="font-semibold text-slate-900 hover:text-[#004080]">
                          {r.name}
                        </Link>
                        <p className="font-mono text-xs text-slate-500">{r.id}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3 font-mono text-xs text-slate-600">{r.phone}</td>
                  <td className="px-4 py-3 text-slate-700">{r.area}</td>
                  <td className="px-4 py-3 font-mono font-medium text-[#004080]">{r.route}</td>
                  <td className="max-w-[200px] px-4 py-3 text-slate-700">{r.plan}</td>
                  <td className="px-4 py-3 font-mono font-semibold tabular-nums">{r.wallet}</td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ${statusPill(r.status)}`}>
                      {r.status}
                    </span>
                  </td>
                  <td className="px-2 py-3">
                    <button type="button" className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-600" aria-label="More">
                      <EllipsisVerticalIcon className="h-5 w-5" />
                    </button>
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
