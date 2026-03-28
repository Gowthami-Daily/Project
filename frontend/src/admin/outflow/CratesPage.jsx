import { useCallback, useEffect, useState } from 'react'
import { getCrateDispatchLog, getCrateKpis, patchCrateDispatch } from './api.js'

export default function CratesPage() {
  const today = new Date().toISOString().slice(0, 10)
  const [routeFilter, setRouteFilter] = useState('')
  const [kpis, setKpis] = useState(null)
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState(null)
  const [busyId, setBusyId] = useState(null)

  const load = useCallback(async () => {
    setErr(null)
    setLoading(true)
    try {
      const rc = routeFilter || undefined
      const [k, log] = await Promise.all([
        getCrateKpis({ route_code: rc }),
        getCrateDispatchLog({ dispatch_date: today, route_code: rc }),
      ])
      setKpis(k)
      setRows(log)
    } catch (e) {
      setErr(e.message)
    } finally {
      setLoading(false)
    }
  }, [today, routeFilter])

  useEffect(() => {
    load()
  }, [load])

  async function resolve(row, resolution) {
    if (!window.confirm(`Mark variance as ${resolution}? (demo — ties to agent commission workflows later.)`)) return
    setBusyId(row.dispatch_id)
    try {
      const updated = await patchCrateDispatch(row.dispatch_id, { variance_resolution: resolution })
      setRows((prev) => prev.map((r) => (r.dispatch_id === updated.dispatch_id ? updated : r)))
    } catch (e) {
      setErr(e.message)
    } finally {
      setBusyId(null)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h3 className="text-lg font-bold text-slate-900">Crate inventory</h3>
          <p className="text-sm text-slate-500">Asset KPIs and dispatch log with variance resolution (3F).</p>
        </div>
        <div className="flex flex-wrap gap-3">
          <label className="flex flex-col text-xs font-semibold text-slate-600">
            Collection center
            <select
              disabled
              className="mt-1 rounded-lg border border-slate-200 bg-slate-100 px-3 py-2 text-sm text-slate-500"
            >
              <option>All centers (demo)</option>
            </select>
          </label>
          <label className="flex flex-col text-xs font-semibold text-slate-600">
            Route
            <select
              value={routeFilter}
              onChange={(e) => setRouteFilter(e.target.value)}
              className="mt-1 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm"
            >
              <option value="">All routes</option>
              <option value="R-01">R-01</option>
              <option value="R-02">R-02</option>
              <option value="R-03">R-03</option>
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
              <p className="text-xs font-semibold uppercase text-slate-500">Total crates owned</p>
              <p className="mt-2 text-3xl font-bold text-slate-900">{kpis?.total_crates_owned ?? '—'}</p>
            </div>
            <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
              <p className="text-xs font-semibold uppercase text-slate-500">Crates en route</p>
              <p className="mt-2 text-3xl font-bold text-[#004080]">{kpis?.crates_en_route ?? '—'}</p>
            </div>
            <div className="rounded-xl border border-amber-200 bg-amber-50/40 p-4 shadow-sm">
              <p className="text-xs font-semibold uppercase text-amber-800">Damaged / in repair</p>
              <p className="mt-2 text-3xl font-bold text-amber-700">{kpis?.crates_damaged_or_repair ?? '—'}</p>
            </div>
          </div>

          <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
            <div className="border-b border-slate-100 px-4 py-3">
              <h4 className="text-sm font-bold text-slate-800">Crate dispatch log</h4>
              <p className="text-xs text-slate-500">Date: {today} · Packing integration with Module 3B / micro-orders.</p>
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-full text-left text-sm">
                <thead className="bg-slate-50 text-xs font-semibold uppercase text-slate-500">
                  <tr>
                    <th className="px-4 py-3">Route</th>
                    <th className="px-4 py-3">Agent</th>
                    <th className="px-4 py-3">Vehicle</th>
                    <th className="px-4 py-3">Issued (morn)</th>
                    <th className="px-4 py-3">Returned (eve)</th>
                    <th className="px-4 py-3">Variance</th>
                    <th className="px-4 py-3">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {rows.map((r) => {
                    const v = r.variance
                    const bad = v != null && v !== 0
                    const warnReturn = v != null && v < 0
                    return (
                      <tr key={r.dispatch_id}>
                        <td className="px-4 py-3 font-mono font-medium">{r.route_code}</td>
                        <td className="px-4 py-3">{r.agent_name}</td>
                        <td className="px-4 py-3 font-mono text-slate-600">{r.vehicle_reg}</td>
                        <td className="px-4 py-3">{r.crates_issued_morn} crates</td>
                        <td className="px-4 py-3">
                          <span className={warnReturn ? 'font-semibold text-amber-700' : ''}>
                            {r.crates_returned_eve != null ? `${r.crates_returned_eve} crates` : '—'}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          {v == null ? (
                            <span className="text-slate-400">—</span>
                          ) : (
                            <span
                              className={
                                v === 0
                                  ? 'font-semibold text-emerald-600'
                                  : v < 0
                                    ? 'font-semibold text-red-600'
                                    : 'font-semibold text-slate-700'
                              }
                            >
                              {v > 0 ? `+${v}` : v}
                            </span>
                          )}
                          {r.variance_resolution && (
                            <span className="ml-2 text-xs text-slate-500">({r.variance_resolution})</span>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          {bad && !r.variance_resolution && v < 0 ? (
                            <div className="flex flex-wrap gap-1">
                              <button
                                type="button"
                                disabled={busyId === r.dispatch_id}
                                onClick={() => resolve(r, 'LOST')}
                                className="rounded border border-red-200 bg-red-50 px-2 py-1 text-xs font-semibold text-red-800 hover:bg-red-100"
                              >
                                Lost
                              </button>
                              <button
                                type="button"
                                disabled={busyId === r.dispatch_id}
                                onClick={() => resolve(r, 'DAMAGED')}
                                className="rounded border border-amber-200 bg-amber-50 px-2 py-1 text-xs font-semibold text-amber-900 hover:bg-amber-100"
                              >
                                Damaged
                              </button>
                            </div>
                          ) : (
                            <span className="text-xs text-slate-400">—</span>
                          )}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>

          <p className="text-xs text-slate-400">
            Hint: delete <code className="rounded bg-slate-100 px-1">gowthami_inflow.db</code> and restart the API if
            new tables are missing (SQLite create_all on startup).
          </p>
        </>
      )}
    </div>
  )
}
