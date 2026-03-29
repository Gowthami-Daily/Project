import { useEffect, useState } from 'react'
import { listAuditLogs } from './superAdminApi.js'

export default function SuperAdminLogsPage() {
  const [rows, setRows] = useState([])
  const [err, setErr] = useState('')

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const data = await listAuditLogs({ limit: 200 })
        if (!cancelled) setRows(Array.isArray(data) ? data : [])
      } catch (e) {
        if (!cancelled) setErr(e.message || 'Failed')
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  return (
    <div className="space-y-4 text-slate-100">
      <h2 className="text-xl font-bold">Audit logs</h2>
      <p className="text-sm text-slate-400">Logins and admin actions (latest first).</p>
      {err ? <p className="text-sm text-red-400">{err}</p> : null}
      <div className="overflow-x-auto rounded-xl border border-slate-800">
        <table className="min-w-full text-left text-sm">
          <thead className="bg-slate-900 text-xs uppercase text-slate-400">
            <tr>
              <th className="px-3 py-2">When</th>
              <th className="px-3 py-2">User</th>
              <th className="px-3 py-2">Action</th>
              <th className="px-3 py-2">Detail</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} className="border-t border-slate-800 bg-slate-950/40">
                <td className="whitespace-nowrap px-3 py-2 text-slate-300">{r.created_at}</td>
                <td className="px-3 py-2 tabular-nums text-slate-400">{r.user_id ?? '—'}</td>
                <td className="px-3 py-2 font-mono text-xs text-amber-200">{r.action}</td>
                <td className="px-3 py-2 text-slate-400">{r.detail ?? '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
