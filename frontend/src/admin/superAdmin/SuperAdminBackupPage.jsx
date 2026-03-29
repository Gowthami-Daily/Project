import { useState } from 'react'
import { requestBackup } from './superAdminApi.js'

export default function SuperAdminBackupPage() {
  const [status, setStatus] = useState(null)
  const [err, setErr] = useState('')

  async function run() {
    setErr('')
    setStatus(null)
    try {
      const s = await requestBackup()
      setStatus(s)
    } catch (e) {
      setErr(e.message || 'Request failed')
    }
  }

  return (
    <div className="max-w-xl space-y-4 text-slate-100">
      <h2 className="text-xl font-bold">Database backup</h2>
      <p className="text-sm text-slate-400">
        Production backups should use managed PostgreSQL snapshots or pg_dump from secured infrastructure. This
        button records intent and returns configuration guidance.
      </p>
      <button
        type="button"
        onClick={run}
        className="rounded-lg bg-sky-600 px-4 py-2 text-sm font-bold text-white hover:bg-sky-500"
      >
        Backup Now
      </button>
      {err ? <p className="text-sm text-red-400">{err}</p> : null}
      {status ? (
        <pre className="overflow-x-auto rounded-lg border border-slate-800 bg-slate-900 p-3 text-xs text-slate-300">
          {JSON.stringify(status, null, 2)}
        </pre>
      ) : null}
    </div>
  )
}
