import { useCallback, useEffect, useState } from 'react'
import { getWalletSummary, getWalletTopups, inr, patchTopup } from './api.js'

export default function WalletsPage() {
  const [summary, setSummary] = useState(null)
  const [topups, setTopups] = useState([])
  const [error, setError] = useState(null)
  const [selectedId, setSelectedId] = useState(null)
  const [busy, setBusy] = useState(false)

  const load = useCallback(() => {
    setError(null)
    return Promise.all([getWalletSummary(), getWalletTopups()])
      .then(([s, t]) => {
        setSummary(s)
        setTopups(t)
      })
      .catch((e) => setError(e.message || 'Failed to load wallets'))
  }, [])

  useEffect(() => {
    load()
  }, [load])

  async function markDeposited() {
    if (!selectedId) return
    setBusy(true)
    try {
      await patchTopup(selectedId, { reconciliation_status: 'DEPOSITED', staff_reconciled_by: 1 })
      setSelectedId(null)
      await load()
    } catch (e) {
      setError(e.message || 'Update failed')
    } finally {
      setBusy(false)
    }
  }

  const selected = topups.find((t) => t.topup_id === selectedId)

  return (
    <div className="space-y-6">
      {error && (
        <p className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{error}</p>
      )}

      {summary && (
        <section className="grid gap-4 sm:grid-cols-3" aria-label="Wallet KPIs">
          <div className="rounded-xl border border-slate-200/80 bg-white p-5 shadow-sm">
            <p className="text-xs font-semibold uppercase text-slate-500">Total active float</p>
            <p className="mt-2 font-mono text-2xl font-bold tabular-nums text-emerald-600">{inr(summary.total_active_float)}</p>
            <p className="mt-1 text-xs text-slate-500">Total prepaid balances</p>
          </div>
          <div className="rounded-xl border border-slate-200/80 bg-white p-5 shadow-sm">
            <p className="text-xs font-semibold uppercase text-slate-500">Top-ups today</p>
            <p className="mt-2 font-mono text-2xl font-bold tabular-nums text-[#004080]">+{inr(summary.topups_today)}</p>
          </div>
          <div className="rounded-xl border border-slate-200/80 bg-white p-5 shadow-sm">
            <p className="text-xs font-semibold uppercase text-slate-500">Top-up methods (today)</p>
            <p className="mt-2 text-lg font-semibold text-slate-800">
              UPI / digital ~{summary.upi_pct}% · Cash ~{summary.cash_pct}%
            </p>
          </div>
        </section>
      )}

      <div className="overflow-hidden rounded-xl border border-slate-200/80 bg-white shadow-sm">
        <div className="border-b border-slate-100 px-5 py-4">
          <h3 className="font-bold text-slate-900">Reconciliation</h3>
          <p className="text-xs text-slate-500">
            Select a cash COD row to link agent deposit confirmation (accountant workflow).
          </p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[800px] text-left text-sm">
            <thead className="bg-slate-50 text-xs font-semibold uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-4 py-3">Date</th>
                <th className="px-4 py-3">Customer</th>
                <th className="px-4 py-3">Method</th>
                <th className="px-4 py-3">Reference</th>
                <th className="px-4 py-3 text-right">Amount</th>
                <th className="px-4 py-3">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {topups.map((t) => {
                const isCash = t.payment_method.includes('CASH')
                const isSel = selectedId === t.topup_id
                return (
                  <tr
                    key={t.topup_id}
                    onClick={() => setSelectedId(t.topup_id)}
                    className={`cursor-pointer hover:bg-slate-50/80 ${isSel ? 'bg-amber-50 ring-1 ring-inset ring-amber-200' : ''} ${isCash && t.reconciliation_status === 'PENDING_DEPOSIT' ? 'border-l-4 border-l-amber-500' : ''}`}
                  >
                    <td className="px-4 py-3 font-mono text-slate-600">
                      {new Date(t.timestamp).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
                    </td>
                    <td className="px-4 py-3 font-medium text-slate-900">
                      {t.customer_name}{' '}
                      <span className="font-mono text-slate-500">({t.customer_code})</span>
                    </td>
                    <td className="px-4 py-3 text-slate-700">
                      {t.payment_method.replace(/_/g, ' ')}
                      {t.collected_by_staff_id && isCash ? (
                        <span className="mt-1 block text-xs text-amber-800">Agent collection</span>
                      ) : null}
                    </td>
                    <td className="px-4 py-3 font-mono text-xs text-slate-600">{t.reference_id ?? '—'}</td>
                    <td className="px-4 py-3 text-right font-mono font-bold tabular-nums text-emerald-600">+{inr(t.amount)}</td>
                    <td className="px-4 py-3">
                      <span
                        className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
                          t.reconciliation_status === 'DEPOSITED' || t.reconciliation_status === 'CONFIRMED'
                            ? 'bg-emerald-100 text-emerald-800'
                            : 'bg-amber-100 text-amber-900'
                        }`}
                      >
                        {t.reconciliation_status.replace(/_/g, ' ')}
                      </span>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>

      {selected && (
        <div className="flex flex-wrap items-center gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-sm text-slate-700">
            Selected: <strong>{selected.customer_name}</strong> · {inr(selected.amount)} · {selected.payment_method}
          </p>
          {selected.reconciliation_status === 'PENDING_DEPOSIT' && (
            <button
              type="button"
              disabled={busy}
              onClick={markDeposited}
              className="rounded-lg bg-[#004080] px-4 py-2 text-sm font-semibold text-white hover:bg-[#003366] disabled:opacity-50"
            >
              Confirmed — deposited in bank
            </button>
          )}
        </div>
      )}
    </div>
  )
}
