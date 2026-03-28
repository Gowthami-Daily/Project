import { useCallback, useEffect, useMemo, useState } from 'react'
import { getFleetAgentRanking, getFleetKpis, getFleetReplay } from './api.js'

function normPoints(points, w = 280, h = 160) {
  if (!points?.length) return ''
  const lats = points.map((p) => p.latitude)
  const lngs = points.map((p) => p.longitude)
  const minLat = Math.min(...lats)
  const maxLat = Math.max(...lats)
  const minLng = Math.min(...lngs)
  const maxLng = Math.max(...lngs)
  const pad = 8
  const sx = (lng) => {
    if (maxLng === minLng) return w / 2
    return pad + ((lng - minLng) / (maxLng - minLng)) * (w - 2 * pad)
  }
  const sy = (lat) => {
    if (maxLat === minLat) return h / 2
    return h - (pad + ((lat - minLat) / (maxLat - minLat)) * (h - 2 * pad))
  }
  return points.map((p) => `${sx(p.longitude)},${sy(p.latitude)}`).join(' ')
}

export default function FleetPage() {
  const now = new Date()
  const defaultMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
  const [month, setMonth] = useState(defaultMonth)
  const [vehicleType, setVehicleType] = useState('')
  const [kpis, setKpis] = useState(null)
  const [agents, setAgents] = useState([])
  const [replayRoute, setReplayRoute] = useState('R-03')
  const yesterday = useMemo(() => {
    const d = new Date()
    d.setDate(d.getDate() - 1)
    return d.toISOString().slice(0, 10)
  }, [])
  const [replayDate, setReplayDate] = useState(yesterday)
  const [replay, setReplay] = useState(null)
  const [replayErr, setReplayErr] = useState(null)
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState(null)

  const { year, monthNum } = useMemo(() => {
    const [y, m] = month.split('-').map(Number)
    return { year: y, monthNum: m }
  }, [month])

  const load = useCallback(async () => {
    setErr(null)
    setLoading(true)
    try {
      const vt = vehicleType || undefined
      const [k, a] = await Promise.all([
        getFleetKpis({ year, month: monthNum, vehicle_type: vt }),
        getFleetAgentRanking(),
      ])
      setKpis(k)
      setAgents(a)
    } catch (e) {
      setErr(e.message)
    } finally {
      setLoading(false)
    }
  }, [year, monthNum, vehicleType])

  useEffect(() => {
    load()
  }, [load])

  useEffect(() => {
    let cancelled = false
    setReplayErr(null)
    ;(async () => {
      try {
        const r = await getFleetReplay({ route_code: replayRoute, replay_date: replayDate })
        if (!cancelled) setReplay(r)
      } catch (e) {
        if (!cancelled) setReplayErr(e.message)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [replayRoute, replayDate])

  const polyActual = replay ? normPoints(replay.actual_path) : ''
  const polyOpt = replay ? normPoints(replay.optimized_path) : ''

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h3 className="text-lg font-bold text-slate-900">Fleet analytics</h3>
          <p className="text-sm text-slate-500">Fuel KPIs, agent ranking, and route replay (3G).</p>
        </div>
        <div className="flex flex-wrap gap-3">
          <label className="flex flex-col text-xs font-semibold text-slate-600">
            Month
            <input
              type="month"
              value={month}
              onChange={(e) => setMonth(e.target.value)}
              className="mt-1 rounded-lg border border-slate-200 px-3 py-2 text-sm"
            />
          </label>
          <label className="flex flex-col text-xs font-semibold text-slate-600">
            Vehicle type
            <select
              value={vehicleType}
              onChange={(e) => setVehicleType(e.target.value)}
              className="mt-1 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm"
            >
              <option value="">All</option>
              <option value="BIKE">Bike</option>
              <option value="AUTO">Auto</option>
            </select>
          </label>
        </div>
      </div>

      {err && (
        <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">{err}</p>
      )}

      {loading ? (
        <p className="text-sm text-slate-500">Loading…</p>
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-3">
            <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
              <p className="text-xs font-semibold uppercase text-slate-500">Avg. cost / delivery stop</p>
              <p className="mt-2 text-2xl font-bold text-[#004080]">
                ₹{kpis?.avg_cost_per_delivery_stop_inr?.toFixed(2) ?? '—'}
              </p>
            </div>
            <div className="rounded-xl border border-emerald-200 bg-emerald-50/40 p-4 shadow-sm">
              <p className="text-xs font-semibold uppercase text-emerald-800">Fuel efficiency (overall)</p>
              <p className="mt-2 text-2xl font-bold text-emerald-700">
                {kpis?.fuel_efficiency_kmpl?.toFixed(1) ?? '—'} kmpl
              </p>
            </div>
            <div className="rounded-xl border border-amber-200 bg-amber-50/40 p-4 shadow-sm">
              <p className="text-xs font-semibold uppercase text-amber-800">Vehicles pending maintenance</p>
              <p className="mt-2 text-3xl font-bold text-amber-700">{kpis?.vehicles_pending_maintenance ?? '—'}</p>
            </div>
          </div>

          <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
            <div className="border-b border-slate-100 px-4 py-3">
              <h4 className="text-sm font-bold text-slate-800">Agent performance ranking</h4>
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-full text-left text-sm">
                <thead className="bg-slate-50 text-xs font-semibold uppercase text-slate-500">
                  <tr>
                    <th className="px-4 py-3">Agent</th>
                    <th className="px-4 py-3">Route</th>
                    <th className="px-4 py-3">Stops / hr</th>
                    <th className="px-4 py-3">On-time %</th>
                    <th className="px-4 py-3">Distance (km)</th>
                    <th className="px-4 py-3">Avg speed</th>
                    <th className="px-4 py-3">Note</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {agents.map((a) => {
                    const slow = a.avg_speed_kmh < 20
                    const otLow = a.on_time_delivery_pct < 95
                    return (
                      <tr key={a.agent_name}>
                        <td className="px-4 py-3 font-medium">{a.agent_name}</td>
                        <td className="px-4 py-3 font-mono text-slate-600">{a.route_code}</td>
                        <td className="px-4 py-3">{a.avg_stops_per_hour}</td>
                        <td className="px-4 py-3">
                          <span
                            className={
                              otLow ? 'font-semibold text-amber-700' : 'font-semibold text-emerald-600'
                            }
                          >
                            {a.on_time_delivery_pct}%
                          </span>
                        </td>
                        <td className="px-4 py-3">{a.distance_km_total}</td>
                        <td className="px-4 py-3">
                          <span className={slow ? 'font-semibold text-amber-700' : ''}>{a.avg_speed_kmh} km/h</span>
                        </td>
                        <td className="px-4 py-3 text-slate-600">{a.note ?? '—'}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>

          <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <h4 className="text-sm font-bold text-slate-800">Route replay</h4>
            <p className="mt-1 text-xs text-slate-500">
              Actual path (blue) vs optimized recommendation (emerald). Select a completed route and date.
            </p>
            <div className="mt-3 flex flex-wrap gap-3">
              <label className="flex flex-col text-xs font-semibold text-slate-600">
                Route
                <select
                  value={replayRoute}
                  onChange={(e) => setReplayRoute(e.target.value)}
                  className="mt-1 rounded-lg border border-slate-200 px-3 py-2 text-sm"
                >
                  <option value="R-01">R-01</option>
                  <option value="R-02">R-02</option>
                  <option value="R-03">R-03</option>
                </select>
              </label>
              <label className="flex flex-col text-xs font-semibold text-slate-600">
                Date
                <input
                  type="date"
                  value={replayDate}
                  onChange={(e) => setReplayDate(e.target.value)}
                  className="mt-1 rounded-lg border border-slate-200 px-3 py-2 text-sm"
                />
              </label>
            </div>
            {replayErr && (
              <p className="mt-2 text-xs text-red-600">{replayErr}</p>
            )}
            {replay && (
              <div className="mt-4">
                <svg viewBox="0 0 280 160" className="h-48 w-full max-w-md rounded-lg border border-slate-200 bg-slate-50">
                  <title>Route path comparison</title>
                  {polyOpt && (
                    <polyline
                      fill="none"
                      stroke="#10b981"
                      strokeWidth="2"
                      strokeDasharray="4 3"
                      points={polyOpt}
                    />
                  )}
                  {polyActual && (
                    <polyline fill="none" stroke="#004080" strokeWidth="2.5" points={polyActual} />
                  )}
                </svg>
                <p className="mt-2 text-xs text-slate-600">{replay.note}</p>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  )
}
