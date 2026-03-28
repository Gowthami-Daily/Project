import { useState } from 'react'
import { CheckCircleIcon } from '@heroicons/react/24/solid'
import { theadRow, tableScroll, tableWrap } from './tableStyles.js'

const ledger = [
  { date: '27 Mar 2026', type: 'Delivery deduction', amount: '−₹52', balance: '₹1,450' },
  { date: '26 Mar 2026', type: 'Recharge (UPI)', amount: '+₹2,000', balance: '₹1,502' },
  { date: '25 Mar 2026', type: 'Bonus (promo)', amount: '+₹50', balance: '₹502' },
  { date: '25 Mar 2026', type: 'Milk delivery', amount: '−₹52', balance: '₹452' },
]

function Toggle({ checked, onChange }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className={`relative h-7 w-12 shrink-0 rounded-full transition ${checked ? 'bg-[#004080]' : 'bg-slate-300'}`}
    >
      <span className={`absolute top-1 h-5 w-5 rounded-full bg-white shadow ${checked ? 'left-6' : 'left-1'}`} />
    </button>
  )
}

export default function CrmWalletPage() {
  const [auto, setAuto] = useState(false)

  return (
    <div className="space-y-8">
      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2 space-y-4">
          <div className="flex flex-wrap gap-2 text-xs font-semibold text-slate-500">
            <span className="flex items-center gap-1 text-[#004080]">
              <CheckCircleIcon className="h-4 w-4" /> Add funds
            </span>
            <span>→</span>
            <span className="rounded-full bg-slate-200 px-2 py-0.5 text-slate-700">Checkout details</span>
            <span>→</span>
            <span className="text-slate-400">Confirm</span>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <h3 className="text-sm font-bold text-slate-900">Recharge amount</h3>
            <div className="mt-3 flex flex-wrap gap-2">
              {['₹500', '₹1,000', '₹2,000', '₹5,000'].map((a) => (
                <button
                  key={a}
                  type="button"
                  className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold hover:border-[#004080] hover:text-[#004080]"
                >
                  {a}
                </button>
              ))}
            </div>
            <label className="mt-4 block text-xs font-bold uppercase text-slate-500">Custom (₹)</label>
            <input type="number" className="mt-1 w-full max-w-xs rounded-xl border border-slate-200 px-3 py-2 text-sm" placeholder="1500" />

            <div className="mt-6 rounded-xl border border-emerald-200 bg-emerald-50/50 p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <p className="text-sm font-bold text-slate-900">Auto top-up</p>
                  <span className="mt-1 inline-block rounded-full bg-emerald-600 px-2 py-0.5 text-[10px] font-bold uppercase text-white">
                    Highly recommended
                  </span>
                </div>
                <Toggle checked={auto} onChange={setAuto} />
              </div>
              <div className={`mt-4 grid gap-3 sm:grid-cols-2 ${auto ? '' : 'opacity-50'}`}>
                <label className="block text-xs font-semibold text-slate-600">
                  When balance below (₹)
                  <input type="number" disabled={!auto} className="mt-1 w-full rounded-lg border border-slate-200 px-2 py-2 text-sm" defaultValue="100" />
                </label>
                <label className="block text-xs font-semibold text-slate-600">
                  Recharge amount (₹)
                  <input type="number" disabled={!auto} className="mt-1 w-full rounded-lg border border-slate-200 px-2 py-2 text-sm" defaultValue="2000" />
                </label>
              </div>
            </div>

            <p className="mt-4 text-xs text-slate-500">UPI / card settlements may take up to 24h to reflect in ledger (demo copy).</p>
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm ring-1 ring-slate-100">
          <h3 className="text-sm font-bold text-slate-900">Summary</h3>
          <dl className="mt-4 space-y-2 text-sm">
            <div className="flex justify-between">
              <dt className="text-slate-600">Wallet credit</dt>
              <dd className="font-mono font-semibold">₹2,000</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-slate-600">GST (if applicable)</dt>
              <dd className="font-mono">₹0</dd>
            </div>
            <div className="border-t border-slate-100 pt-3 flex justify-between text-base font-bold">
              <dt>Total</dt>
              <dd className="font-mono text-[#004080]">₹2,000</dd>
            </div>
          </dl>
          <div className="mt-4 rounded-xl bg-sky-50 p-3 text-xs text-sky-900">
            After top-up · <strong>Lakshmi (C3002)</strong> · est. balance <strong>₹3,450</strong>
          </div>
          <button type="button" className="mt-4 w-full rounded-xl bg-[#004080] py-3 text-sm font-bold text-white hover:bg-[#003366]">
            Confirm recharge
          </button>
        </div>
      </div>

      <div>
        <h3 className="mb-3 text-lg font-bold text-slate-900">Wallet ledger (sample)</h3>
        <p className="mb-3 text-sm text-slate-600">
          Types: Recharge · Delivery deduction · Refund · Adjustment · Bonus — all lines in <code className="rounded bg-slate-100 px-1">wallet_ledger</code>.
        </p>
        <div className={tableWrap}>
          <div className={tableScroll}>
            <table className="w-full min-w-[560px] text-sm">
              <thead>
                <tr className={theadRow}>
                  <th className="px-4 py-3">Date</th>
                  <th className="px-4 py-3">Type</th>
                  <th className="px-4 py-3">Amount</th>
                  <th className="px-4 py-3">Balance</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {ledger.map((r, i) => (
                  <tr key={i}>
                    <td className="px-4 py-3 text-slate-600">{r.date}</td>
                    <td className="px-4 py-3">{r.type}</td>
                    <td className="px-4 py-3 font-mono font-semibold">{r.amount}</td>
                    <td className="px-4 py-3 font-mono font-bold text-[#004080]">{r.balance}</td>
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
