import { useEffect, useState } from 'react'
import { Cell, Legend, Pie, PieChart, ResponsiveContainer, Tooltip, Bar, BarChart, CartesianGrid, XAxis, YAxis } from 'recharts'
import { getScalingAnalytics, inr } from './api.js'

export default function ScalingPage() {
  const [data, setData] = useState(null)
  const [error, setError] = useState(null)

  useEffect(() => {
    getScalingAnalytics()
      .then(setData)
      .catch((e) => setError(e.message || 'Failed to load analytics'))
  }, [])

  if (error) {
    return <p className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{error}</p>
  }
  if (!data) return <p className="text-slate-500">Loading…</p>

  const routeData = data.route_profitability.map((r) => ({
    name: r.route,
    margin: r.net_margin_inr,
  }))

  return (
    <div className="space-y-8">
      <section className="rounded-xl border border-slate-200/80 bg-white p-6 shadow-sm">
        <p className="text-xs font-semibold uppercase text-slate-500">Avg profit per liter (MTD)</p>
        <p className="mt-2 font-mono text-4xl font-bold tabular-nums text-emerald-600">
          ₹{data.profit_per_liter.toFixed(2)}{' '}
          <span className="text-xl font-semibold text-slate-500">/ L</span>
        </p>
        <p className="mt-2 text-sm text-slate-600">
          Revenue − COGS − OpEx over {data.dispatched_liters_mtd.toLocaleString()} L dispatched (demo allocation).
        </p>
      </section>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-xl border border-slate-200/80 bg-white p-5 shadow-sm">
          <h3 className="font-bold text-slate-900">Product mix — profit contribution</h3>
          <div className="mt-4 h-[280px]">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={data.product_mix}
                  dataKey="profit_contribution_pct"
                  nameKey="name"
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={100}
                  paddingAngle={2}
                >
                  {data.product_mix.map((entry, i) => (
                    <Cell key={i} fill={entry.fill} />
                  ))}
                </Pie>
                <Tooltip formatter={(v) => `${v}%`} />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="rounded-xl border border-slate-200/80 bg-white p-5 shadow-sm">
          <h3 className="font-bold text-slate-900">Route profitability ranking</h3>
          <div className="mt-4 h-[280px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={routeData} layout="vertical" margin={{ left: 8, right: 16 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis type="number" tickFormatter={(v) => `₹${(v / 1000).toFixed(0)}k`} />
                <YAxis type="category" dataKey="name" width={120} tick={{ fontSize: 11 }} />
                <Tooltip formatter={(v) => inr(v)} />
                <Bar dataKey="margin" fill="#004080" name="Net margin" radius={[0, 6, 6, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      <div className="overflow-hidden rounded-xl border border-slate-200/80 bg-white shadow-sm">
        <div className="border-b border-slate-100 px-5 py-4">
          <h3 className="font-bold text-slate-900">Wastage &amp; rejection costs</h3>
          <p className="text-xs text-slate-500">Operational leaks affecting PPL</p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[560px] text-left text-sm">
            <thead className="bg-slate-50 text-xs font-semibold uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-4 py-3">Type</th>
                <th className="px-4 py-3">Quantity (L)</th>
                <th className="px-4 py-3">Est. cost</th>
                <th className="px-4 py-3">Trend</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {data.wastage_rows.map((w, i) => (
                <tr key={i}>
                  <td className="px-4 py-3 font-medium text-slate-900">{w.type}</td>
                  <td className="px-4 py-3 font-mono">{w.quantity_l} L</td>
                  <td className="px-4 py-3 font-mono text-red-600">{inr(w.est_cost)}</td>
                  <td className="px-4 py-3">
                    {w.trend === 'up' ? (
                      <span className="font-semibold text-red-600">↑</span>
                    ) : (
                      <span className="font-semibold text-emerald-600">↓</span>
                    )}
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
