import { useCallback, useEffect, useState } from 'react'
import { getCrmSummary, getCrmTriggers, patchCrmTrigger, postBroadcast } from './api.js'

function Toggle({ active, disabled, onChange }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={active}
      disabled={disabled}
      onClick={() => onChange(!active)}
      className={`relative h-7 w-12 shrink-0 rounded-full transition ${
        active ? 'bg-[#004080]' : 'bg-slate-300'
      } ${disabled ? 'opacity-50' : ''}`}
    >
      <span
        className={`absolute top-1 h-5 w-5 rounded-full bg-white shadow transition ${
          active ? 'left-6' : 'left-1'
        }`}
      />
    </button>
  )
}

export default function CrmPage() {
  const [summary, setSummary] = useState(null)
  const [triggers, setTriggers] = useState([])
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState(null)
  const [busyKey, setBusyKey] = useState(null)

  const load = useCallback(async () => {
    setErr(null)
    setLoading(true)
    try {
      const [s, t] = await Promise.all([getCrmSummary(), getCrmTriggers()])
      setSummary(s)
      setTriggers(t)
    } catch (e) {
      setErr(e.message)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  async function onToggle(row, next) {
    setBusyKey(row.trigger_key)
    try {
      const updated = await patchCrmTrigger(row.trigger_key, { is_active: next })
      setTriggers((prev) => prev.map((r) => (r.trigger_key === updated.trigger_key ? updated : r)))
    } catch (e) {
      setErr(e.message)
    } finally {
      setBusyKey(null)
    }
  }

  async function onBroadcast() {
    const msg = window.prompt('Broadcast message to customers (demo queue):', '')
    if (msg == null || !msg.trim()) return
    try {
      await postBroadcast(msg.trim())
      window.alert('Broadcast queued (demo).')
    } catch (e) {
      setErr(e.message)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="text-lg font-bold text-slate-900">Communication hub</h3>
          <p className="text-sm text-slate-500">Automated triggers and today&apos;s automation volume (3E).</p>
        </div>
        <button
          type="button"
          onClick={onBroadcast}
          className="rounded-lg bg-[#004080] px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-[#003366]"
        >
          New broadcast message
        </button>
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
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Low wallet alerts sent</p>
              <p className="mt-2 text-3xl font-bold text-[#004080]">{summary?.low_wallet_alerts_today ?? '—'}</p>
              <p className="mt-1 text-xs text-slate-500">Today</p>
            </div>
            <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                Dispatch confirmation SMS
              </p>
              <p className="mt-2 text-3xl font-bold text-[#004080]">
                {summary?.dispatch_confirmation_sms_today?.toLocaleString?.() ?? '—'}
              </p>
              <p className="mt-1 text-xs text-slate-500">Today</p>
            </div>
            <div className="rounded-xl border border-rose-200 bg-rose-50/50 p-4 shadow-sm">
              <p className="text-xs font-semibold uppercase tracking-wide text-rose-700">Critical delay alerts</p>
              <p className="mt-2 text-3xl font-bold text-red-600">{summary?.critical_delay_alerts ?? '—'}</p>
              <p className="mt-1 text-xs text-rose-800">
                {summary?.critical_delay_route_code
                  ? `Route ${summary.critical_delay_route_code} only`
                  : '—'}
              </p>
            </div>
          </div>

          <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
            <div className="border-b border-slate-100 px-4 py-3">
              <h4 className="text-sm font-bold text-slate-800">Automated trigger settings</h4>
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-full text-left text-sm">
                <thead className="bg-slate-50 text-xs font-semibold uppercase text-slate-500">
                  <tr>
                    <th className="px-4 py-3">Trigger</th>
                    <th className="px-4 py-3">Message</th>
                    <th className="px-4 py-3">Channel</th>
                    <th className="px-4 py-3">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {triggers.map((t) => (
                    <tr key={t.trigger_key} className="align-top">
                      <td className="px-4 py-3 font-medium text-slate-900">{t.label}</td>
                      <td className="max-w-md px-4 py-3 text-slate-600">{t.message_template}</td>
                      <td className="px-4 py-3 text-slate-600">{t.channel}</td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <Toggle
                            active={t.is_active}
                            disabled={busyKey === t.trigger_key}
                            onChange={(v) => onToggle(t, v)}
                          />
                          <span className="text-xs text-slate-500">{t.is_active ? 'Active' : 'Off'}</span>
                        </div>
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
