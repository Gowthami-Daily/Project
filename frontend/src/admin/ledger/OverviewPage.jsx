import { useEffect, useMemo, useState } from 'react'
import { getPL, inr } from './api.js'

function ymFromInput(v) {
  if (!v) return { year: null, month: null }
  const [y, m] = v.split('-').map(Number)
  return { year: y, month: m }
}

export default function OverviewPage() {
  const defaultYm = useMemo(() => {
    const d = new Date()
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
  }, [])
  const [ym, setYm] = useState(defaultYm)
  const [data, setData] = useState(null)
  const [error, setError] = useState(null)

  const { year, month } = ymFromInput(ym)

  useEffect(() => {
    let c = false
    setError(null)
    getPL(year, month)
      .then((d) => {
        if (!c) setData(d)
      })
      .catch((e) => {
        if (!c) setError(e.message || 'Failed to load P&L')
      })
    return () => {
      c = true
    }
  }, [year, month])

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <label className="block text-xs font-semibold uppercase text-slate-500">Period</label>
          <input
            type="month"
            className="mt-1 rounded-lg border border-slate-200 px-3 py-2 text-sm"
            value={ym}
            onChange={(e) => setYm(e.target.value)}
          />
        </div>
        <button
          type="button"
          onClick={() => window.print()}
          className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
        >
          Generate P&amp;L PDF (print)
        </button>
      </div>

      {error && (
        <p className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{error}</p>
      )}

      {data && (
        <>
          <p className="text-sm font-medium text-slate-600">Month-to-date · {data.kpis.period_label}</p>
          <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4" aria-label="Financial KPIs">
            <div className="rounded-xl border border-slate-200/80 bg-white p-5 shadow-sm">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Total revenue</p>
              <p className="mt-2 font-mono text-2xl font-bold tabular-nums text-emerald-600">{inr(data.kpis.total_revenue)}</p>
              <p className="mt-1 text-xs text-slate-500">Subscription + Micro-Orders</p>
            </div>
            <div className="rounded-xl border border-slate-200/80 bg-white p-5 shadow-sm">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Cost of milk (COGS)</p>
              <p className="mt-2 font-mono text-2xl font-bold tabular-nums text-red-600">{inr(data.kpis.cogs)}</p>
              <p className="mt-1 text-xs text-slate-500">Procurement from farmers</p>
            </div>
            <div className="rounded-xl border border-slate-200/80 bg-white p-5 shadow-sm">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Operating expense (OpEx)</p>
              <p className="mt-2 font-mono text-2xl font-bold tabular-nums text-red-600">{inr(data.kpis.opex)}</p>
              <p className="mt-1 text-xs text-slate-500">Fuel, staff, rent, etc.</p>
            </div>
            <div className="rounded-xl border border-slate-200/80 bg-white p-5 shadow-sm">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Estimated net profit</p>
              <p className="mt-2 font-mono text-2xl font-bold tabular-nums text-emerald-600">{inr(data.kpis.net_profit)}</p>
              <p className="mt-1 text-xs text-slate-500">Margin: {data.kpis.margin_pct}%</p>
            </div>
          </section>

          <div className="overflow-hidden rounded-xl border border-slate-200/80 bg-white shadow-sm">
            <div className="border-b border-slate-100 px-5 py-4">
              <h3 className="font-bold text-slate-900">Summarized P&amp;L</h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[480px] text-left text-sm">
                <tbody className="divide-y divide-slate-100">
                  {data.lines.map((row, i) => (
                    <tr
                      key={i}
                      className={
                        row.line_type === 'subtotal'
                          ? 'bg-sky-50/60 font-semibold'
                          : row.line_type === 'net'
                            ? 'bg-emerald-50/80 font-bold'
                            : ''
                      }
                    >
                      <td className="px-5 py-3 text-slate-800">{row.label}</td>
                      <td
                        className={`px-5 py-3 text-right font-mono tabular-nums ${
                          row.amount >= 0 ? 'text-emerald-700' : 'text-red-600'
                        }`}
                      >
                        {row.amount < 0 ? '−' : ''}
                        {inr(Math.abs(row.amount))}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
