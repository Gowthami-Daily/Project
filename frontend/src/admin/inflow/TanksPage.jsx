import { useEffect, useState } from 'react'
import { getTankTransactions, getTanks } from './api.js'

function MilkTank({ name, current, capacity, temp, milkType, fillPct }) {
  const safePct = Math.min(100, Math.max(0, fillPct))
  return (
    <div className="flex flex-col items-center">
      <div
        className="relative flex h-52 w-28 flex-col justify-end overflow-hidden rounded-b-[2.5rem] rounded-t-lg border-4 border-slate-300 bg-gradient-to-b from-slate-100 to-slate-200 shadow-inner dark:border-slate-400"
        role="img"
        aria-label={`${name} at ${safePct} percent capacity`}
      >
        <div
          className="absolute inset-x-1 bottom-1 overflow-hidden rounded-b-[2rem] rounded-t-sm bg-gradient-to-t from-sky-200/90 via-white to-sky-50 transition-all duration-700"
          style={{ height: `${safePct}%` }}
        >
          <div className="pointer-events-none absolute inset-x-0 bottom-0 h-3 animate-pulse bg-white/40" />
        </div>
        <div className="relative z-10 px-2 pb-3 pt-2 text-center">
          <p className="text-[10px] font-bold uppercase leading-tight text-slate-600">{name}</p>
        </div>
      </div>
      <p className="mt-3 font-mono text-lg font-bold tabular-nums text-slate-900">
        {current} L <span className="text-sm font-normal text-slate-500">/ {capacity} L</span>
      </p>
      <p className="mt-1 text-sm text-slate-600">
        Temp:{' '}
        <span className="font-mono font-bold text-emerald-600">{temp != null ? `${temp}°C` : '—'}</span>
      </p>
      <p className="text-xs font-medium uppercase text-slate-500">{milkType}</p>
    </div>
  )
}

export default function TanksPage() {
  const [tanks, setTanks] = useState([])
  const [tx, setTx] = useState([])
  const [error, setError] = useState(null)

  useEffect(() => {
    let cancelled = false
    setError(null)
    Promise.all([getTanks(), getTankTransactions(30)])
      .then(([t, x]) => {
        if (!cancelled) {
          setTanks(t)
          setTx(x)
        }
      })
      .catch((e) => {
        if (!cancelled) setError(e.message || 'Failed to load inventory')
      })
    return () => {
      cancelled = true
    }
  }, [])

  return (
    <div className="space-y-8">
      <div>
        <h3 className="text-lg font-semibold text-slate-900">Milk inventory &amp; storage</h3>
        <p className="text-sm text-slate-500">Chilling tanks — bridge between inflow procurement and outflow dispatch.</p>
      </div>

      {error && <p className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{error}</p>}

      <div className="flex flex-wrap justify-center gap-10 rounded-xl border border-slate-200/80 bg-white py-10 shadow-sm">
        {tanks.map((t) => (
          <MilkTank
            key={t.tank_id}
            name={t.tank_name}
            current={t.current_liters}
            capacity={t.max_capacity_liters}
            temp={t.current_temperature_celsius}
            milkType={t.milk_type ?? '—'}
            fillPct={t.fill_pct}
          />
        ))}
        {tanks.length === 0 && !error && <p className="text-slate-500">No tanks configured.</p>}
      </div>

      <div className="overflow-hidden rounded-xl border border-slate-200/80 bg-white shadow-sm">
        <div className="border-b border-slate-100 px-5 py-4">
          <h4 className="font-bold text-slate-900">Tank transaction history</h4>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] text-left text-sm">
            <thead className="bg-slate-50 text-xs font-semibold uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-4 py-3">Time</th>
                <th className="px-4 py-3">Type</th>
                <th className="px-4 py-3">From</th>
                <th className="px-4 py-3">To</th>
                <th className="px-4 py-3 text-right">Qty (L)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {tx.map((r) => (
                <tr key={r.transaction_id} className="hover:bg-slate-50/80">
                  <td className="px-4 py-3 font-mono text-slate-600">
                    {new Date(r.occurred_at).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' })}
                  </td>
                  <td className="px-4 py-3">{r.txn_type ?? '—'}</td>
                  <td className="px-4 py-3 text-slate-700">{r.from_source ?? '—'}</td>
                  <td className="px-4 py-3 text-slate-700">{r.to_destination ?? '—'}</td>
                  <td className="px-4 py-3 text-right font-mono font-bold tabular-nums text-[#004080]">
                    {r.quantity_liters > 0 ? '+' : ''}
                    {r.quantity_liters} L
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
