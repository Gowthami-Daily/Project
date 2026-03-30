import { ArrowsRightLeftIcon, XMarkIcon } from '@heroicons/react/24/solid'
import { useCallback, useEffect, useState } from 'react'
import { useOutletContext } from 'react-router-dom'
import {
  getAccountStatement,
  listAccountTransferHistory,
  listFinanceAccounts,
  postAccountTransfer,
  setPfToken,
} from '../api.js'
import {
  btnPrimary,
  btnSecondary,
  cardCls,
  inputCls,
  labelCls,
  pfModalCloseBtn,
  pfModalHeader,
  pfModalOverlay,
  pfModalSurface,
  pfTable,
  pfTableWrap,
  pfTd,
  pfTdRight,
  pfTh,
  pfThRight,
  pfTrHover,
} from '../pfFormStyles.js'
import { formatInr } from '../pfFormat.js'
import { usePfRefresh } from '../pfRefreshContext.jsx'

const METHODS = ['INTERNAL', 'NEFT', 'RTGS', 'IMPS', 'UPI', 'CASH_DEPOSIT', 'OTHER']

function todayISO() {
  return new Date().toISOString().slice(0, 10)
}

function StatementModal({ accounts, onClose, onSessionInvalid }) {
  const [accountId, setAccountId] = useState('')
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (accountId || accounts.length === 0) return
    setAccountId(String(accounts[0].id))
  }, [accounts, accountId])

  const load = useCallback(async () => {
    const id = Number(accountId)
    if (!id) {
      setRows([])
      return
    }
    setLoading(true)
    try {
      const data = await getAccountStatement(id, { limit: 200 })
      setRows(Array.isArray(data) ? data : [])
    } catch (e) {
      if (e.status === 401) {
        setPfToken(null)
        onSessionInvalid?.()
      } else {
        setRows([])
      }
    } finally {
      setLoading(false)
    }
  }, [accountId, onSessionInvalid])

  useEffect(() => {
    load()
  }, [load])

  return (
    <div
      className={pfModalOverlay}
      role="dialog"
      aria-modal="true"
      aria-label="Account statement"
      onMouseDown={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className={`${pfModalSurface} max-w-3xl p-5 md:p-6`} onMouseDown={(e) => e.stopPropagation()}>
        <div className={pfModalHeader}>
          <h2 className="text-lg font-semibold text-[var(--pf-text)]">Account statement (ledger)</h2>
          <button type="button" className={pfModalCloseBtn} onClick={onClose} aria-label="Close">
            <XMarkIcon className="h-6 w-6" />
          </button>
        </div>
        <div className="mt-2">
          <label className={labelCls} htmlFor="stmt-acc">
            Account
          </label>
          <select id="stmt-acc" className={inputCls} value={accountId} onChange={(e) => setAccountId(e.target.value)}>
            <option value="">Select…</option>
            {accounts.map((a) => (
              <option key={a.id} value={String(a.id)}>
                {a.account_name}
              </option>
            ))}
          </select>
        </div>
        <div className="mt-4 max-h-[50vh] overflow-y-auto">
          {loading ? (
            <p className="text-sm text-[var(--pf-text-muted)]">Loading…</p>
          ) : rows.length === 0 ? (
            <p className="text-sm text-[var(--pf-text-muted)]">
              No ledger entries for this account. Transfers create TRANSFER_IN / TRANSFER_OUT rows here.
            </p>
          ) : (
            <table className={pfTable}>
              <thead>
                <tr>
                  <th className={pfTh}>Date</th>
                  <th className={pfTh}>Type</th>
                  <th className={pfThRight}>Amount</th>
                  <th className={pfTh}>Reference</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id} className={pfTrHover}>
                    <td className={pfTd}>{r.entry_date}</td>
                    <td className={pfTd}>{r.transaction_type}</td>
                    <td className={pfTdRight}>{formatInr(r.amount)}</td>
                    <td className={pfTd}>{r.reference_number || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  )
}

export default function PfTransferPage() {
  const { onSessionInvalid } = useOutletContext() || {}
  const { tick, refresh } = usePfRefresh()
  const [accounts, setAccounts] = useState([])
  const [history, setHistory] = useState([])
  const [loading, setLoading] = useState(true)
  const [histLoading, setHistLoading] = useState(true)
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [fromId, setFromId] = useState('')
  const [toId, setToId] = useState('')
  const [amount, setAmount] = useState('')
  const [transferDate, setTransferDate] = useState(todayISO)
  const [method, setMethod] = useState('INTERNAL')
  const [reference, setReference] = useState('')
  const [notes, setNotes] = useState('')
  const [file, setFile] = useState(null)
  const [stmtOpen, setStmtOpen] = useState(false)

  const loadAccounts = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const data = await listFinanceAccounts()
      setAccounts(Array.isArray(data) ? data : [])
    } catch (e) {
      if (e.status === 401) {
        setPfToken(null)
        onSessionInvalid?.()
      } else {
        setError(e.message || 'Failed to load accounts')
      }
    } finally {
      setLoading(false)
    }
  }, [onSessionInvalid])

  const loadHistory = useCallback(async () => {
    setHistLoading(true)
    try {
      const data = await listAccountTransferHistory({ limit: 100 })
      setHistory(Array.isArray(data) ? data : [])
    } catch (e) {
      if (e.status === 401) {
        setPfToken(null)
        onSessionInvalid?.()
      }
    } finally {
      setHistLoading(false)
    }
  }, [onSessionInvalid])

  useEffect(() => {
    loadAccounts()
  }, [loadAccounts, tick])

  useEffect(() => {
    loadHistory()
  }, [loadHistory, tick])

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    const fa = Number(fromId)
    const ta = Number(toId)
    const amt = Number(amount)
    if (!fa || !ta || fa === ta) {
      setError('Choose two different accounts')
      return
    }
    if (!amt || amt <= 0) {
      setError('Enter a positive amount')
      return
    }
    setSubmitting(true)
    try {
      const fd = new FormData()
      fd.set('from_account_id', String(fa))
      fd.set('to_account_id', String(ta))
      fd.set('amount', String(amt))
      fd.set('transfer_date', transferDate)
      fd.set('transfer_method', method)
      if (reference.trim()) fd.set('reference_number', reference.trim())
      if (notes.trim()) fd.set('notes', notes.trim())
      if (file) fd.set('attachment', file)
      await postAccountTransfer(fd)
      setAmount('')
      setReference('')
      setNotes('')
      setFile(null)
      setFromId('')
      setToId('')
      await loadAccounts()
      await loadHistory()
      refresh()
    } catch (err) {
      if (err.status === 401) {
        setPfToken(null)
        onSessionInvalid?.()
      } else {
        setError(err.message || 'Transfer failed')
      }
    } finally {
      setSubmitting(false)
    }
  }

  const nameById = (id) => accounts.find((a) => a.id === id)?.account_name ?? `#${id}`

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[var(--pf-primary)]/15 text-[var(--pf-primary)]">
            <ArrowsRightLeftIcon className="h-6 w-6" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-slate-900 dark:text-[var(--pf-text)]">Transfer money</h1>
            <p className="text-sm text-[var(--pf-text-muted)]">
              Move funds between your accounts (updates balances and ledger).
            </p>
          </div>
        </div>
        {accounts.length > 0 ? (
          <button type="button" className={btnSecondary} onClick={() => setStmtOpen(true)}>
            View account statement
          </button>
        ) : null}
      </div>

      {error ? (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-100">
          {error}
        </div>
      ) : null}

      <div className={`${cardCls} max-w-3xl`}>
        {loading ? (
          <p className="text-sm text-[var(--pf-text-muted)]">Loading accounts…</p>
        ) : accounts.length < 2 ? (
          <p className="text-sm text-[var(--pf-text-muted)]">You need at least two accounts to transfer. Add accounts first.</p>
        ) : (
          <form onSubmit={handleSubmit} className="grid gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <label className={labelCls} htmlFor="pf-xfer-from">
                From account
              </label>
              <select
                id="pf-xfer-from"
                className={inputCls}
                value={fromId}
                onChange={(e) => setFromId(e.target.value)}
                required
              >
                <option value="">Select…</option>
                {accounts.map((a) => (
                  <option key={a.id} value={String(a.id)} disabled={String(a.id) === toId}>
                    {a.account_name} ({a.account_type}) · {formatInr(a.balance)}
                  </option>
                ))}
              </select>
            </div>
            <div className="sm:col-span-2">
              <label className={labelCls} htmlFor="pf-xfer-to">
                To account
              </label>
              <select
                id="pf-xfer-to"
                className={inputCls}
                value={toId}
                onChange={(e) => setToId(e.target.value)}
                required
              >
                <option value="">Select…</option>
                {accounts.map((a) => (
                  <option key={a.id} value={String(a.id)} disabled={String(a.id) === fromId}>
                    {a.account_name} ({a.account_type}) · {formatInr(a.balance)}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className={labelCls} htmlFor="pf-xfer-amt">
                Amount (₹)
              </label>
              <input
                id="pf-xfer-amt"
                type="number"
                min="0.01"
                step="0.01"
                className={inputCls}
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                required
              />
            </div>
            <div>
              <label className={labelCls} htmlFor="pf-xfer-date">
                Date
              </label>
              <input
                id="pf-xfer-date"
                type="date"
                className={inputCls}
                value={transferDate}
                onChange={(e) => setTransferDate(e.target.value)}
                required
              />
            </div>
            <div className="sm:col-span-2">
              <label className={labelCls} htmlFor="pf-xfer-method">
                Transfer method
              </label>
              <select id="pf-xfer-method" className={inputCls} value={method} onChange={(e) => setMethod(e.target.value)}>
                {METHODS.map((m) => (
                  <option key={m} value={m}>
                    {m.replace(/_/g, ' ')}
                  </option>
                ))}
              </select>
            </div>
            <div className="sm:col-span-2">
              <label className={labelCls} htmlFor="pf-xfer-ref">
                Reference number <span className="font-normal text-slate-400">(optional)</span>
              </label>
              <input id="pf-xfer-ref" className={inputCls} value={reference} onChange={(e) => setReference(e.target.value)} />
            </div>
            <div className="sm:col-span-2">
              <label className={labelCls} htmlFor="pf-xfer-notes">
                Notes <span className="font-normal text-slate-400">(optional)</span>
              </label>
              <textarea id="pf-xfer-notes" rows={2} className={`${inputCls} resize-y`} value={notes} onChange={(e) => setNotes(e.target.value)} />
            </div>
            <div className="sm:col-span-2">
              <label className={labelCls} htmlFor="pf-xfer-file">
                Attachment <span className="font-normal text-slate-400">(optional, PDF or image, max 5 MB)</span>
              </label>
              <input
                id="pf-xfer-file"
                type="file"
                accept=".pdf,.png,.jpg,.jpeg,.webp,.gif"
                className={inputCls}
                onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              />
            </div>
            <div className="flex flex-wrap gap-2 sm:col-span-2">
              <button type="submit" disabled={submitting} className={btnPrimary}>
                {submitting ? 'Transferring…' : 'Transfer'}
              </button>
            </div>
          </form>
        )}
      </div>

      <section className={cardCls}>
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-lg font-semibold text-[var(--pf-text)]">Recent transfers</h2>
          <button type="button" className={btnSecondary} onClick={() => loadHistory()} disabled={histLoading}>
            Refresh
          </button>
        </div>
        {histLoading ? (
          <p className="text-sm text-[var(--pf-text-muted)]">Loading…</p>
        ) : history.length === 0 ? (
          <p className="text-sm text-[var(--pf-text-muted)]">No transfers yet.</p>
        ) : (
          <div className={pfTableWrap}>
            <table className={pfTable}>
              <thead>
                <tr>
                  <th className={pfTh}>Date</th>
                  <th className={pfTh}>From</th>
                  <th className={pfTh}>To</th>
                  <th className={pfThRight}>Amount</th>
                  <th className={pfTh}>Method</th>
                  <th className={pfTh}>Reference</th>
                </tr>
              </thead>
              <tbody>
                {history.map((r) => (
                  <tr key={r.id} className={pfTrHover}>
                    <td className={pfTd}>{r.transfer_date}</td>
                    <td className={pfTd}>{nameById(r.from_account_id)}</td>
                    <td className={pfTd}>{nameById(r.to_account_id)}</td>
                    <td className={pfTdRight}>{formatInr(r.amount)}</td>
                    <td className={pfTd}>{r.transfer_method}</td>
                    <td className={pfTd}>{r.reference_number || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {stmtOpen ? <StatementModal accounts={accounts} onClose={() => setStmtOpen(false)} onSessionInvalid={onSessionInvalid} /> : null}
    </div>
  )
}
