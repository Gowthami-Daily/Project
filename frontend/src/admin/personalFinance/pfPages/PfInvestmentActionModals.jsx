import { useCallback, useEffect, useState } from 'react'
import {
  createInvestmentTransaction,
  deleteInvestmentTransaction,
  getInvestmentLedger,
  setPfToken,
  updateFinanceInvestment,
} from '../api.js'
import { AppButton, AppInput, AppModal, AppTextarea } from '../pfDesignSystem/index.js'
import { labelCls } from '../pfFormStyles.js'
import { formatInr } from '../pfFormat.js'

const TXN_LABEL = {
  sip: 'SIP',
  lumpsum: 'Lump sum',
  topup: 'Top-up',
  withdraw: 'Withdraw',
  dividend: 'Dividend',
  interest: 'Interest',
}

function formatISODate(d) {
  if (!d) return '—'
  const [y, m, day] = String(d).split('-')
  if (!y || !m || !day) return d
  return `${day}-${m}-${y}`
}

function investmentPutPayload(r, patch = {}) {
  const invDate = r.investment_date ? String(r.investment_date).slice(0, 10) : new Date().toISOString().slice(0, 10)
  return {
    type: r.investment_type,
    name: r.name,
    invested_amount: Number(r.invested_amount) || 0,
    current_value: r.current_value != null && r.current_value !== '' ? Number(r.current_value) : null,
    sip_monthly_amount:
      patch.sip_monthly_amount != null
        ? patch.sip_monthly_amount
        : r.sip_monthly_amount != null && r.sip_monthly_amount !== ''
          ? Number(r.sip_monthly_amount)
          : null,
    sip_start_date: patch.sip_start_date ?? r.sip_start_date ?? null,
    sip_day_of_month: patch.sip_day_of_month ?? r.sip_day_of_month ?? null,
    sip_frequency: patch.sip_frequency ?? r.sip_frequency ?? 'MONTHLY',
    sip_auto_create: patch.sip_auto_create ?? Boolean(r.sip_auto_create),
    investment_date: invDate,
    platform: r.platform || null,
    notes: r.notes || null,
  }
}

export function InvestmentStatementModal({ open, investment, onClose, onSessionInvalid, onChanged }) {
  const [loading, setLoading] = useState(false)
  const [ledger, setLedger] = useState(null)
  const [err, setErr] = useState('')
  const [deletingId, setDeletingId] = useState(null)

  const load = useCallback(async () => {
    if (!investment?.id) return
    setLoading(true)
    setErr('')
    try {
      const data = await getInvestmentLedger(investment.id)
      setLedger(data)
    } catch (e) {
      if (e.status === 401) {
        setPfToken(null)
        onSessionInvalid?.()
      } else {
        setErr(e.message || 'Could not load statement')
      }
    } finally {
      setLoading(false)
    }
  }, [investment?.id, onSessionInvalid])

  useEffect(() => {
    if (open && investment?.id) load()
  }, [open, investment?.id, load])

  async function handleDeleteTxn(t) {
    if (!window.confirm('Remove this ledger row? Totals will be recalculated.')) return
    setDeletingId(t.id)
    try {
      await deleteInvestmentTransaction(investment.id, t.id)
      await load()
      onChanged?.()
    } catch (e) {
      if (e.status === 401) {
        setPfToken(null)
        onSessionInvalid?.()
      } else {
        window.alert(e.message || 'Delete failed')
      }
    } finally {
      setDeletingId(null)
    }
  }

  const s = ledger?.summary
  const txs = ledger?.transactions || []

  return (
    <AppModal
      open={open}
      onClose={() => !loading && onClose()}
      title={investment ? `Statement — ${investment.name}` : 'Statement'}
      subtitle="Ledger, totals, and return metrics."
      maxWidthClass="max-w-4xl"
      footer={
        <AppButton type="button" variant="ghost" onClick={onClose}>
          Close
        </AppButton>
      }
    >
      {err ? (
        <p className="text-sm text-red-600 dark:text-red-400">{err}</p>
      ) : loading ? (
        <p className="text-sm text-[var(--pf-text-muted)]">Loading…</p>
      ) : (
        <div className="space-y-4">
          {s ? (
            <div className="grid gap-2 rounded-xl border border-[var(--pf-border)] bg-[var(--pf-card)] p-4 text-sm sm:grid-cols-2 lg:grid-cols-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-[var(--pf-text-muted)]">
                  Total invested
                </p>
                <p className="mt-1 font-mono font-bold tabular-nums">{formatInr(s.total_invested)}</p>
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-[var(--pf-text-muted)]">
                  Current value
                </p>
                <p className="mt-1 font-mono font-bold tabular-nums text-sky-600 dark:text-sky-300">
                  {formatInr(s.current_value)}
                </p>
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-[var(--pf-text-muted)]">
                  Profit / loss
                </p>
                <p
                  className={`mt-1 font-mono font-bold tabular-nums ${
                    Number(s.profit) >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'
                  }`}
                >
                  {Number(s.profit) >= 0 ? '+' : ''}
                  {formatInr(s.profit)}
                  {s.return_pct != null ? ` (${s.return_pct >= 0 ? '+' : ''}${Number(s.return_pct).toFixed(2)}%)` : ''}
                </p>
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-[var(--pf-text-muted)]">XIRR</p>
                <p className="mt-1 font-mono font-bold tabular-nums">
                  {s.xirr_percent != null ? `${Number(s.xirr_percent).toFixed(2)}%` : '—'}
                </p>
              </div>
              {s.units_balance != null ? (
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-[var(--pf-text-muted)]">Units</p>
                  <p className="mt-1 font-mono tabular-nums">{String(s.units_balance)}</p>
                </div>
              ) : null}
            </div>
          ) : null}

          <div className="max-h-[min(420px,55vh)] overflow-auto rounded-xl border border-[var(--pf-border)]">
            <table className="w-full min-w-[640px] border-collapse text-left text-sm">
              <thead className="sticky top-0 z-[1] bg-[var(--pf-bg)]">
                <tr className="border-b border-[var(--pf-border)]">
                  <th className="px-3 py-2 text-xs font-bold uppercase text-[var(--pf-text-muted)]">Date</th>
                  <th className="px-3 py-2 text-xs font-bold uppercase text-[var(--pf-text-muted)]">Type</th>
                  <th className="px-3 py-2 text-right text-xs font-bold uppercase text-[var(--pf-text-muted)]">
                    Amount
                  </th>
                  <th className="px-3 py-2 text-right text-xs font-bold uppercase text-[var(--pf-text-muted)]">
                    Units
                  </th>
                  <th className="px-3 py-2 text-right text-xs font-bold uppercase text-[var(--pf-text-muted)]">NAV</th>
                  <th className="px-3 py-2 text-right text-xs font-bold uppercase text-[var(--pf-text-muted)]">
                    Total value
                  </th>
                  <th className="px-3 py-2 text-xs font-bold uppercase text-[var(--pf-text-muted)]">Notes</th>
                  <th className="px-3 py-2" />
                </tr>
              </thead>
              <tbody>
                {txs.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="px-3 py-8 text-center text-[var(--pf-text-muted)]">
                      No transactions yet.
                    </td>
                  </tr>
                ) : (
                  txs.map((t) => (
                    <tr key={t.id} className="border-b border-[var(--pf-border)]/60">
                      <td className="px-3 py-2 whitespace-nowrap">{formatISODate(t.txn_date)}</td>
                      <td className="px-3 py-2">{TXN_LABEL[t.txn_type] || t.txn_type}</td>
                      <td
                        className={`px-3 py-2 text-right font-mono tabular-nums ${
                          Number(t.amount) < 0 ? 'text-red-600 dark:text-red-400' : ''
                        }`}
                      >
                        {Number(t.amount) < 0 ? '-' : ''}
                        {formatInr(Math.abs(Number(t.amount)))}
                      </td>
                      <td className="px-3 py-2 text-right font-mono text-xs tabular-nums">
                        {t.units != null ? String(t.units) : '—'}
                      </td>
                      <td className="px-3 py-2 text-right font-mono text-xs tabular-nums">
                        {t.nav != null ? String(t.nav) : '—'}
                      </td>
                      <td className="px-3 py-2 text-right font-mono tabular-nums">
                        {t.total_value != null ? formatInr(t.total_value) : '—'}
                      </td>
                      <td className="max-w-[140px] truncate px-3 py-2 text-xs text-[var(--pf-text-muted)]">
                        {t.notes || '—'}
                      </td>
                      <td className="px-2 py-2">
                        <button
                          type="button"
                          disabled={deletingId === t.id}
                          className="text-xs font-semibold text-red-600 hover:underline disabled:opacity-50 dark:text-red-400"
                          onClick={() => handleDeleteTxn(t)}
                        >
                          {deletingId === t.id ? '…' : 'Delete'}
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </AppModal>
  )
}

export function InvestmentAddMoneyModal({
  open,
  investment,
  onClose,
  onSessionInvalid,
  onSaved,
  defaultTab = 'topup',
}) {
  const [tab, setTab] = useState(defaultTab)
  const [amount, setAmount] = useState('')
  const [txnDate, setTxnDate] = useState(() => new Date().toISOString().slice(0, 10))
  const [startDate, setStartDate] = useState(() => new Date().toISOString().slice(0, 10))
  const [nav, setNav] = useState('')
  const [totalValue, setTotalValue] = useState('')
  const [notes, setNotes] = useState('')
  const [attachmentUrl, setAttachmentUrl] = useState('')
  const [autoCreate, setAutoCreate] = useState(false)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (open && investment) {
      setTab(defaultTab)
      setAmount('')
      setTxnDate(new Date().toISOString().slice(0, 10))
      setStartDate(new Date().toISOString().slice(0, 10))
      setNav('')
      setTotalValue('')
      setNotes('')
      setAttachmentUrl('')
      setAutoCreate(false)
    }
  }, [open, investment, defaultTab])

  async function submit(e) {
    e.preventDefault()
    if (!investment?.id) return
    const amt = Number(amount)
    if (!Number.isFinite(amt) || amt <= 0) return
    const n = nav === '' ? null : Number(nav)
    const tv = totalValue === '' ? null : Number(totalValue)
    setBusy(true)
    try {
      const type = tab === 'sip' ? 'sip' : tab === 'lumpsum' ? 'lumpsum' : 'topup'
      const dateForTxn = tab === 'sip' ? startDate : txnDate
      await createInvestmentTransaction(investment.id, {
        txn_type: type,
        txn_date: dateForTxn,
        amount: amt,
        nav: n != null && !Number.isNaN(n) && n > 0 ? n : null,
        total_value: tv != null && !Number.isNaN(tv) && tv >= 0 ? tv : null,
        notes: notes.trim() || null,
        attachment_url: attachmentUrl.trim() || null,
      })
      if (tab === 'sip') {
        const d = new Date(`${startDate}T12:00:00`)
        const dom = Number.isFinite(d.getTime()) ? d.getDate() : null
        await updateFinanceInvestment(investment.id, {
          ...investmentPutPayload(investment, {
            sip_monthly_amount: amt,
            sip_start_date: startDate,
            sip_day_of_month: dom,
            sip_frequency: 'MONTHLY',
            sip_auto_create: autoCreate,
          }),
        })
      }
      onSaved?.()
      onClose()
    } catch (err) {
      if (err.status === 401) {
        setPfToken(null)
        onSessionInvalid?.()
      } else {
        window.alert(err.message || 'Could not save')
      }
    } finally {
      setBusy(false)
    }
  }

  return (
    <AppModal
      open={open}
      onClose={() => !busy && onClose()}
      title="Add investment"
      subtitle={investment ? `Fund: ${investment.name}` : ''}
      maxWidthClass="max-w-lg"
      footer={
        <>
          <AppButton type="button" variant="ghost" disabled={busy} onClick={onClose}>
            Cancel
          </AppButton>
          <AppButton type="submit" variant="primary" disabled={busy} form="pf-inv-add-money">
            {busy ? 'Saving…' : 'Save'}
          </AppButton>
        </>
      }
    >
      <form id="pf-inv-add-money" className="space-y-4" onSubmit={submit}>
        <fieldset className="space-y-2">
          <legend className={`${labelCls} mb-2`}>Type</legend>
          <label className="flex cursor-pointer items-center gap-2 text-sm">
            <input type="radio" name="add-type" checked={tab === 'sip'} onChange={() => setTab('sip')} />
            SIP (records installment + updates SIP plan on the fund)
          </label>
          <label className="flex cursor-pointer items-center gap-2 text-sm">
            <input type="radio" name="add-type" checked={tab === 'lumpsum'} onChange={() => setTab('lumpsum')} />
            Lump sum
          </label>
          <label className="flex cursor-pointer items-center gap-2 text-sm">
            <input type="radio" name="add-type" checked={tab === 'topup'} onChange={() => setTab('topup')} />
            Top-up
          </label>
        </fieldset>

        {tab === 'sip' ? (
          <>
            <AppInput
              label="SIP amount (₹)"
              type="number"
              min="0"
              step="0.01"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              required
              variant="boxed"
            />
            <AppInput
              label="Start date"
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              required
              variant="boxed"
            />
            <p className="text-xs text-[var(--pf-text-muted)]">Frequency: monthly (SIP plan stored on the fund).</p>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={autoCreate}
                onChange={(e) => setAutoCreate(e.target.checked)}
              />
              Flag auto-create (for future automation / reminders)
            </label>
          </>
        ) : (
          <>
            <AppInput
              label="Amount (₹)"
              type="number"
              min="0"
              step="0.01"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              required
              variant="boxed"
            />
            <AppInput
              label="Date"
              type="date"
              value={txnDate}
              onChange={(e) => setTxnDate(e.target.value)}
              required
              variant="boxed"
            />
          </>
        )}

        <AppInput
          label="NAV (optional)"
          hint="If set, units are derived as amount ÷ NAV"
          type="number"
          min="0"
          step="0.000001"
          value={nav}
          onChange={(e) => setNav(e.target.value)}
          variant="boxed"
        />
        <AppInput
          label="Total value after txn (optional)"
          type="number"
          min="0"
          step="0.01"
          value={totalValue}
          onChange={(e) => setTotalValue(e.target.value)}
          variant="boxed"
        />
        <AppTextarea label="Notes" rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} variant="boxed" />
        <AppInput
          label="Statement / attachment URL (optional)"
          value={attachmentUrl}
          onChange={(e) => setAttachmentUrl(e.target.value)}
          variant="boxed"
        />
      </form>
    </AppModal>
  )
}

export function InvestmentWithdrawModal({ open, investment, onClose, onSessionInvalid, onSaved }) {
  const [amount, setAmount] = useState('')
  const [txnDate, setTxnDate] = useState(() => new Date().toISOString().slice(0, 10))
  const [nav, setNav] = useState('')
  const [totalValue, setTotalValue] = useState('')
  const [notes, setNotes] = useState('')
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (open) {
      setAmount('')
      setTxnDate(new Date().toISOString().slice(0, 10))
      setNav('')
      setTotalValue('')
      setNotes('')
    }
  }, [open])

  async function submit(e) {
    e.preventDefault()
    if (!investment?.id) return
    const amt = Number(amount)
    if (!Number.isFinite(amt) || amt <= 0) return
    const n = nav === '' ? null : Number(nav)
    const tv = totalValue === '' ? null : Number(totalValue)
    setBusy(true)
    try {
      await createInvestmentTransaction(investment.id, {
        txn_type: 'withdraw',
        txn_date: txnDate,
        amount: amt,
        nav: n != null && !Number.isNaN(n) && n > 0 ? n : null,
        total_value: tv != null && !Number.isNaN(tv) && tv >= 0 ? tv : null,
        notes: notes.trim() || null,
      })
      onSaved?.()
      onClose()
    } catch (err) {
      if (err.status === 401) {
        setPfToken(null)
        onSessionInvalid?.()
      } else {
        window.alert(err.message || 'Could not save')
      }
    } finally {
      setBusy(false)
    }
  }

  return (
    <AppModal
      open={open}
      onClose={() => !busy && onClose()}
      title="Withdraw / redeem"
      subtitle={investment ? investment.name : ''}
      maxWidthClass="max-w-lg"
      footer={
        <>
          <AppButton type="button" variant="ghost" disabled={busy} onClick={onClose}>
            Cancel
          </AppButton>
          <AppButton type="submit" variant="primary" disabled={busy} form="pf-inv-withdraw">
            {busy ? 'Saving…' : 'Record withdraw'}
          </AppButton>
        </>
      }
    >
      <form id="pf-inv-withdraw" className="space-y-4" onSubmit={submit}>
        <p className="text-xs text-[var(--pf-text-muted)]">
          Enter the redemption amount as a positive number; it is stored as a withdrawal in the ledger.
        </p>
        <AppInput
          label="Amount (₹)"
          type="number"
          min="0"
          step="0.01"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          required
          variant="boxed"
        />
        <AppInput
          label="Date"
          type="date"
          value={txnDate}
          onChange={(e) => setTxnDate(e.target.value)}
          required
          variant="boxed"
        />
        <AppInput
          label="NAV (optional)"
          type="number"
          min="0"
          step="0.000001"
          value={nav}
          onChange={(e) => setNav(e.target.value)}
          variant="boxed"
        />
        <AppInput
          label="Total value after redeem (optional)"
          type="number"
          min="0"
          step="0.01"
          value={totalValue}
          onChange={(e) => setTotalValue(e.target.value)}
          variant="boxed"
        />
        <AppTextarea label="Notes" rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} variant="boxed" />
      </form>
    </AppModal>
  )
}
