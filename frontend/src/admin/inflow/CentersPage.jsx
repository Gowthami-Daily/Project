import { useEffect, useMemo, useState } from 'react'
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { getCenterAnalytics } from './api.js'

function localMonth() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

function heatColor(v, max) {
  const t = max ? Math.min(1, v / max) : 0
  const alpha = 0.15 + t * 0.75
  return `rgba(0, 64, 128, ${alpha})`
}

export default function CentersPage() {
  const [month, setMonth] = useState(localMonth)
  const [data, setData] = useState(null)
  const [error, setError] = useState(null)

  useEffect(() => {
    let cancelled = false
    setError(null)
    getCenterAnalytics()
      .then((d) => {
        if (!cancelled) setData(d)
      })
      .catch((e) => {
        if (!cancelled) setError(e.message || 'Failed to load analytics')
      })
    return () => {
      cancelled = true
    }
  }, [])

  const maxHeat = useMemo(() => {
    if (!data?.heatmap?.values) return 120
    return Math.max(...data.heatmap.values.flat(), 1)
  }, [data])

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h3 className="text-lg font-semibold text-slate-900">Collection center analytics</h3>
          <p className="text-sm text-slate-500">Branch volume, quality mix, and peak procurement times (MTD).</p>
        </div>
        <div>
          <label className="block text-xs font-semibold uppercase text-slate-500">Period (UI filter)</label>
          <input
            type="month"
            className="mt-1 rounded-lg border border-slate-200 px-3 py-2 text-sm"
            value={month}
            onChange={(e) => setMonth(e.target.value)}
          />
        </div>
      </div>

      {error && <p className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{error}</p>}

      {data && (
        <>
          <div className="grid gap-4 lg:grid-cols-2">
            <div className="rounded-xl border border-slate-200/80 bg-white p-5 shadow-sm">
              <h4 className="font-bold text-slate-900">Procurement volume (MTD liters)</h4>
              <p className="text-xs text-slate-500">Compare centers for bottlenecks</p>
              <div className="mt-4 h-[280px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={data.volume_by_center} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                    <XAxis dataKey="name" tick={{ fontSize: 11 }} stroke="#64748b" interval={0} angle={-12} textAnchor="end" height={60} />
                    <YAxis tick={{ fontSize: 11 }} stroke="#64748b" />
                    <Tooltip formatter={(v) => [`${v.toLocaleString()} L`, 'Volume']} />
                    <Bar dataKey="liters" fill="#004080" name="Liters" radius={[6, 6, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="rounded-xl border border-slate-200/80 bg-white p-5 shadow-sm">
              <h4 className="font-bold text-slate-900">Average quality (Fat % &amp; SNF %)</h4>
              <p className="text-xs text-slate-500">Premium buffalo sourcing by branch</p>
              <div className="mt-4 h-[280px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={data.quality_by_center} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                    <XAxis dataKey="name" tick={{ fontSize: 11 }} stroke="#64748b" interval={0} angle={-12} textAnchor="end" height={60} />
                    <YAxis tick={{ fontSize: 11 }} stroke="#64748b" domain={[0, 10]} />
                    <Tooltip />
                    <Legend />
                    <Bar dataKey="avg_fat" fill="#004080" name="Avg Fat %" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="avg_snf" fill="#38bdf8" name="Avg SNF %" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>

          <div className="rounded-xl border border-slate-200/80 bg-white p-5 shadow-sm">
            <h4 className="font-bold text-slate-900">Peak procurement heatmap</h4>
            <p className="text-xs text-slate-500">Relative intensity by hour (5:00–12:00) — staff planning</p>
            <div className="mt-4 overflow-x-auto">
              <table className="w-full min-w-[520px] border-collapse text-center text-xs">
                <thead>
                  <tr>
                    <th className="border border-slate-200 bg-slate-50 p-2 text-slate-600">Center / Hour</th>
                    {data.heatmap.hours.map((h) => (
                      <th key={h} className="border border-slate-200 bg-slate-50 p-2 font-mono text-slate-600">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {data.heatmap.centers.map((name, ri) => (
                    <tr key={name}>
                      <td className="border border-slate-200 bg-slate-50 p-2 text-left text-sm font-medium text-slate-800">
                        {name}
                      </td>
                      {(data.heatmap.values[ri] || []).map((v, ci) => (
                        <td
                          key={ci}
                          className="border border-slate-200 p-2 font-mono font-semibold text-slate-800"
                          style={{ backgroundColor: heatColor(v, maxHeat) }}
                        >
                          {v}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="overflow-hidden rounded-xl border border-slate-200/80 bg-white shadow-sm">
            <div className="border-b border-slate-100 px-5 py-4">
              <h4 className="font-bold text-slate-900">Branch summary</h4>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[800px] text-left text-sm">
                <thead className="bg-slate-50 text-xs font-semibold uppercase tracking-wide text-slate-500">
                  <tr>
                    <th className="px-4 py-3">Center</th>
                    <th className="px-4 py-3">Active farmers</th>
                    <th className="px-4 py-3">Avg L/day</th>
                    <th className="px-4 py-3">Total procured (MTD)</th>
                    <th className="px-4 py-3">Avg Fat %</th>
                    <th className="px-4 py-3">Staff</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {data.branch_rows.map((r) => (
                    <tr key={r.center_name} className="hover:bg-slate-50/80">
                      <td className="px-4 py-3 font-medium text-slate-900">{r.center_name}</td>
                      <td className="px-4 py-3 font-mono tabular-nums">{r.active_farmers}</td>
                      <td className="px-4 py-3 font-mono tabular-nums">{r.avg_liters_per_day.toLocaleString()} L</td>
                      <td className="px-4 py-3 font-mono font-semibold tabular-nums">{r.total_procured_mtd_liters.toLocaleString()} L</td>
                      <td className="px-4 py-3 font-mono tabular-nums text-[#004080]">{r.avg_fat_pct}</td>
                      <td className="px-4 py-3 text-slate-600">{r.staff_label}</td>
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
