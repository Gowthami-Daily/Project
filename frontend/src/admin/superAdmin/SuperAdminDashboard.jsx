import { useEffect, useState } from 'react'
import { getAdminStats } from './superAdminApi.js'

export default function SuperAdminDashboard() {
  const [stats, setStats] = useState(null)
  const [err, setErr] = useState('')

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const s = await getAdminStats()
        if (!cancelled) setStats(s)
      } catch (e) {
        if (!cancelled) setErr(e.message || 'Failed to load stats')
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  const cards = [
    ['Total users', stats?.total_users],
    ['Loans (PF)', stats?.total_loans],
    ['Income rows', stats?.total_income_rows],
    ['Expense rows', stats?.total_expense_rows],
    ['Fixed assets', stats?.total_assets],
    ['Liabilities', stats?.total_liabilities],
  ]

  return (
    <div className="space-y-4">
      <h2 className="text-xl font-bold text-white">Dashboard</h2>
      {err ? <p className="text-sm text-red-400">{err}</p> : null}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {cards.map(([label, v]) => (
          <div key={label} className="rounded-xl border border-slate-800 bg-slate-900 p-4 shadow-sm">
            <p className="text-xs font-bold uppercase tracking-wide text-slate-400">{label}</p>
            <p className="mt-2 text-2xl font-bold tabular-nums text-white">{v ?? '—'}</p>
          </div>
        ))}
      </div>
      <p className="text-xs text-slate-500">
        Dairy ERP uses <code className="rounded bg-slate-800 px-1">/admin</code>. This panel is{' '}
        <code className="rounded bg-slate-800 px-1">/super-admin</code> for platform users & audit.
      </p>
    </div>
  )
}
