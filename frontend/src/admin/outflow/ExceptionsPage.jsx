import { useCallback, useEffect, useMemo, useState } from 'react'
import { getMicroOrders, getPauses } from './api.js'

function addDays(isoDate, n) {
  const d = new Date(isoDate + 'T12:00:00')
  d.setDate(d.getDate() + n)
  return d.toISOString().slice(0, 10)
}

function badgePause(status) {
  if (status === 'UPCOMING') return 'bg-amber-100 text-amber-900 border-amber-200'
  if (status === 'ACTIVE PAUSE') return 'bg-emerald-100 text-emerald-900 border-emerald-200'
  if (status === 'COMPLETED') return 'bg-slate-100 text-slate-600 border-slate-200'
  return 'bg-slate-100 text-slate-700 border-slate-200'
}

export default function ExceptionsPage() {
  const today = new Date().toISOString().slice(0, 10)
  const tomorrow = useMemo(() => addDays(today, 1), [today])
  const [filterDate, setFilterDate] = useState(tomorrow)
  const [search, setSearch] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [pauses, setPauses] = useState([])
  const [micro, setMicro] = useState([])
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState(null)

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search.trim()), search.trim() ? 280 : 0)
    return () => clearTimeout(t)
  }, [search])

  const load = useCallback(async () => {
    setErr(null)
    setLoading(true)
    try {
      const q = debouncedSearch || undefined
      const [p, m] = await Promise.all([
        getPauses({ ref_date: today, on_date: filterDate, search: q }),
        getMicroOrders({ fulfillment_date: filterDate, search: q }),
      ])
      setPauses(p)
      setMicro(m)
    } catch (e) {
      setErr(e.message)
    } finally {
      setLoading(false)
    }
  }, [today, filterDate, debouncedSearch])

  useEffect(() => {
    load()
  }, [load])

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h3 className="text-lg font-bold text-slate-900">Exception management</h3>
          <p className="text-sm text-slate-500">
            Vacation pauses and one-day micro-orders feed Module 3B packing lists (3H).
          </p>
        </div>
        <div className="flex flex-wrap gap-3">
          <label className="flex flex-col text-xs font-semibold text-slate-600">
            Filter by date
            <input
              type="date"
              value={filterDate}
              onChange={(e) => setFilterDate(e.target.value)}
              className="mt-1 rounded-lg border border-slate-200 px-3 py-2 text-sm"
            />
          </label>
          <label className="flex flex-col text-xs font-semibold text-slate-600">
            Search customer
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Name or code"
              className="mt-1 min-w-[200px] rounded-lg border border-slate-200 px-3 py-2 text-sm"
            />
          </label>
        </div>
      </div>

      {err && (
        <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">{err}</p>
      )}

      {loading ? (
        <p className="text-sm text-slate-500">Loading…</p>
      ) : (
        <div className="grid gap-6 lg:grid-cols-2">
          <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
            <div className="border-b border-slate-100 px-4 py-3">
              <h4 className="text-sm font-bold text-slate-800">Subscription pauses</h4>
              <p className="text-xs text-slate-500">Overlapping {filterDate} · status vs today ({today})</p>
            </div>
            <ul className="divide-y divide-slate-100">
              {pauses.length === 0 && (
                <li className="px-4 py-6 text-sm text-slate-500">No pauses for this date.</li>
              )}
              {pauses.map((p) => (
                <li key={p.pause_id} className="px-4 py-4">
                  <p className="font-semibold text-slate-900">
                    {p.customer_code} — {p.customer_name}
                  </p>
                  <p className="mt-1 text-sm text-slate-600">
                    {p.start_date} → {p.end_date}
                    {p.reason && <span className="text-slate-400"> · {p.reason}</span>}
                  </p>
                  <span
                    className={`mt-2 inline-block rounded-full border px-2 py-0.5 text-xs font-semibold ${badgePause(p.display_status)}`}
                  >
                    {p.display_status}
                  </span>
                </li>
              ))}
            </ul>
          </div>

          <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
            <div className="border-b border-slate-100 px-4 py-3">
              <h4 className="text-sm font-bold text-slate-800">Micro-orders (add-ons)</h4>
              <p className="text-xs text-slate-500">Fulfillment date {filterDate}</p>
            </div>
            <ul className="divide-y divide-slate-100">
              {micro.length === 0 && (
                <li className="px-4 py-6 text-sm text-slate-500">No micro-orders for this date.</li>
              )}
              {micro.map((m) => {
                const base = m.original_subscription_liters
                const extra = m.quantity_liters
                const total = base != null ? base + extra : extra
                return (
                  <li key={m.micro_order_id} className="px-4 py-4">
                    <p className="font-semibold text-slate-900">
                      {m.customer_code} — {m.customer_name}
                    </p>
                    <p className="mt-1 text-sm text-slate-700">
                      Original: {base != null ? `${base}L ${m.milk_type}` : '—'}
                    </p>
                    <p className="mt-1 text-sm font-medium text-[#004080]">
                      Adjustment ({filterDate}): +{extra}L {m.milk_type}
                      {base != null && (
                        <span className="text-slate-700">
                          {' '}
                          → total <strong>{total}L</strong>
                        </span>
                      )}
                    </p>
                    <p className="mt-2 text-xs text-slate-500">
                      ₹{Number(m.total_price).toFixed(0)} · {m.payment_status ?? '—'} ·{' '}
                      <span className="font-semibold text-emerald-700">{m.fulfillment_status}</span>
                    </p>
                  </li>
                )
              })}
            </ul>
          </div>
        </div>
      )}
    </div>
  )
}
