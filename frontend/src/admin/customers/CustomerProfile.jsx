import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { ArrowLeftIcon } from '@heroicons/react/24/outline'
import { theadRow, tableScroll, tableWrap } from './tableStyles.js'

const DEMO = {
  C3002: { name: 'Lakshmi', phone: '+91 98765 43210', email: 'lakshmi@example.com', area: 'Jayanagar', route: 'R-01', address: '4th Block, near temple' },
  C2001: { name: 'Satyanarayana', phone: '+91 98765 11101', email: 'satya@example.com', area: 'Banashankari', route: 'R-01', address: '5th Phase' },
}

const tabs = [
  { id: 'profile', label: 'Profile' },
  { id: 'subscription', label: 'Subscription' },
  { id: 'wallet', label: 'Wallet' },
  { id: 'orders', label: 'Orders' },
  { id: 'delivery', label: 'Delivery history' },
  { id: 'complaints', label: 'Complaints' },
  { id: 'notes', label: 'Notes' },
]

export default function CustomerProfile() {
  const { customerId } = useParams()
  const [tab, setTab] = useState('profile')
  const c = DEMO[customerId] || { name: 'Customer', phone: '—', email: '—', area: '—', route: '—', address: '—' }

  return (
    <div className="space-y-6">
      <Link
        to="/admin/customers/directory"
        className="inline-flex items-center gap-2 text-sm font-semibold text-[#004080] hover:underline"
      >
        <ArrowLeftIcon className="h-4 w-4" />
        Back to directory
      </Link>

      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-4">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-sky-400 to-[#004080] text-xl font-bold text-white">
              {c.name.slice(0, 1)}
            </div>
            <div>
              <h3 className="text-xl font-bold text-slate-900">{c.name}</h3>
              <p className="font-mono text-sm text-slate-500">{customerId}</p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <button type="button" className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold hover:bg-slate-50">
              Edit
            </button>
            <button type="button" className="rounded-xl bg-[#004080] px-4 py-2 text-sm font-semibold text-white hover:bg-[#003366]">
              Recharge wallet
            </button>
          </div>
        </div>

        <div className="mt-6 flex flex-wrap gap-1 border-b border-slate-200">
          {tabs.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setTab(t.id)}
              className={`rounded-t-lg px-3 py-2 text-sm font-semibold sm:px-4 ${
                tab === t.id ? 'bg-slate-100 text-[#004080]' : 'text-slate-600 hover:bg-slate-50'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        <div className="mt-6">
          {tab === 'profile' && (
            <dl className="grid max-w-2xl gap-4 sm:grid-cols-2 text-sm">
              <div>
                <dt className="text-xs font-bold uppercase text-slate-500">Phone</dt>
                <dd className="mt-1 font-mono">{c.phone}</dd>
              </div>
              <div>
                <dt className="text-xs font-bold uppercase text-slate-500">Email</dt>
                <dd className="mt-1">{c.email}</dd>
              </div>
              <div>
                <dt className="text-xs font-bold uppercase text-slate-500">Area</dt>
                <dd className="mt-1">{c.area}</dd>
              </div>
              <div>
                <dt className="text-xs font-bold uppercase text-slate-500">Route</dt>
                <dd className="mt-1 font-mono font-semibold text-[#004080]">{c.route}</dd>
              </div>
              <div className="sm:col-span-2">
                <dt className="text-xs font-bold uppercase text-slate-500">Address</dt>
                <dd className="mt-1">{c.address}</dd>
              </div>
            </dl>
          )}

          {tab === 'subscription' && (
            <div className="space-y-4">
              <div className={tableWrap}>
                <div className={tableScroll}>
                  <table className="w-full min-w-[640px] text-sm">
                    <thead>
                      <tr className={theadRow}>
                        <th className="px-3 py-2 text-left">Product</th>
                        <th className="px-3 py-2">Qty</th>
                        <th className="px-3 py-2">Schedule</th>
                        <th className="px-3 py-2">Price</th>
                        <th className="px-3 py-2">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      <tr>
                        <td className="px-3 py-2">Buffalo 1L</td>
                        <td className="px-3 py-2 font-mono">1 / day</td>
                        <td className="px-3 py-2">Daily</td>
                        <td className="px-3 py-2 font-mono">₹52/day</td>
                        <td className="px-3 py-2 text-emerald-700 font-semibold">Active</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>
              <div>
                <h4 className="text-sm font-bold text-slate-800">Vacation mode</h4>
                <p className="mt-1 text-xs text-slate-500">Auto-stops delivery for the window · feeds dispatch engine.</p>
                <div className="mt-2 rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm">
                  No active vacation (or show From / To / Reason from <code className="text-xs">subscription_pauses</code>)
                </div>
              </div>
            </div>
          )}

          {tab === 'wallet' && (
            <div className={tableWrap}>
              <div className={tableScroll}>
                <table className="w-full text-sm">
                  <thead>
                    <tr className={theadRow}>
                      <th className="px-3 py-2">Date</th>
                      <th className="px-3 py-2">Type</th>
                      <th className="px-3 py-2">Amount</th>
                      <th className="px-3 py-2">Balance</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {[
                      ['27 Mar', 'Delivery deduction', '−₹52', '₹1,450'],
                      ['26 Mar', 'Recharge', '+₹2,000', '₹1,502'],
                    ].map(([d, ty, a, b]) => (
                      <tr key={d + ty}>
                        <td className="px-3 py-2">{d}</td>
                        <td className="px-3 py-2">{ty}</td>
                        <td className="px-3 py-2 font-mono">{a}</td>
                        <td className="px-3 py-2 font-mono font-semibold text-[#004080]">{b}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {tab === 'orders' && (
            <p className="text-sm text-slate-600">
              Micro-orders (extra milk, curd, paneer) — same data as <strong>Orders</strong> tab in module nav.
            </p>
          )}

          {tab === 'delivery' && (
            <ul className="space-y-2 text-sm text-slate-700">
              <li className="rounded-lg border border-slate-100 px-3 py-2">27 Mar · R-01 · Delivered 6:12 AM · POD OK</li>
              <li className="rounded-lg border border-slate-100 px-3 py-2">26 Mar · R-01 · Delivered 6:08 AM</li>
            </ul>
          )}

          {tab === 'complaints' && (
            <p className="text-sm text-slate-600">Open tickets linked to this customer — see Complaints tab for full queue.</p>
          )}

          {tab === 'notes' && (
            <textarea
              className="min-h-[120px] w-full rounded-xl border border-slate-200 p-3 text-sm"
              placeholder="Internal CRM notes (not visible to customer)…"
              defaultValue="Prefers morning slot before 7 AM."
            />
          )}
        </div>
      </div>
    </div>
  )
}
