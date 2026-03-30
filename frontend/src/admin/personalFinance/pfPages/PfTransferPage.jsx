import { ArrowsRightLeftIcon, XMarkIcon } from '@heroicons/react/24/solid'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { useOutletContext } from 'react-router-dom'
import {
  getAccountStatement,
  listAccountTransferHistory,
  listCreditCardBills,
  listCreditCards,
  listFinanceAccounts,
  listFinanceLiabilities,
  listLiabilitySchedule,
  postAccountMovement,
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

const MOVEMENT_TYPES = [
  { id: 'internal_transfer', label: 'Internal transfer' },
  { id: 'external_deposit', label: 'External deposit' },
  { id: 'external_withdrawal', label: 'External withdrawal' },
  { id: 'credit_card_payment', label: 'Credit card payment' },
  { id: 'loan_disbursement', label: 'Loan disbursement' },
  { id: 'loan_emi_payment', label: 'Loan EMI payment' },
]

const DEPOSIT_SOURCES = ['Friend / family', 'Milk / business income', 'Bank interest', 'Cash deposit', 'Other']
const WITHDRAW_PURPOSES = ['ATM withdrawal', 'Given to someone', 'Bank charges / fees', 'Other']

function todayISO() {
  return new Date().toISOString().slice(0, 10)
}

function humanizeMovementType(t) {
  const m = MOVEMENT_TYPES.find((x) => x.id === t)
  return m ? m.label : String(t || '').replace(/_/g, ' ')
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
            <p className="text-sm text-[var(--pf-text-muted)]">No ledger entries for this account yet.</p>
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
  const [liabilities, setLiabilities] = useState([])
  const [cards, setCards] = useState([])
  const [bills, setBills] = useState([])
  const [emiSchedule, setEmiSchedule] = useState([])
  const [history, setHistory] = useState([])
  const [loading, setLoading] = useState(true)
  const [histLoading, setHistLoading] = useState(true)
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const [movementType, setMovementType] = useState('internal_transfer')
  const [fromId, setFromId] = useState('')
  const [toId, setToId] = useState('')
  const [amount, setAmount] = useState('')
  const [movementDate, setMovementDate] = useState(todayISO)
  const [reference, setReference] = useState('')
  const [notes, setNotes] = useState('')
  const [file, setFile] = useState(null)
  const [method, setMethod] = useState('INTERNAL')

  const [depositSource, setDepositSource] = useState(DEPOSIT_SOURCES[0])
  const [withdrawPurpose, setWithdrawPurpose] = useState(WITHDRAW_PURPOSES[0])
  const [linkIncome, setLinkIncome] = useState(false)
  const [linkExpense, setLinkExpense] = useState(false)

  const [liabilityId, setLiabilityId] = useState('')
  const [emiNumber, setEmiNumber] = useState('')
  const [liabilityInterest, setLiabilityInterest] = useState('')

  const [ccBillId, setCcBillId] = useState('')

  const [stmtOpen, setStmtOpen] = useState(false)

  const borrowLiabilities = useMemo(
    () =>
      (Array.isArray(liabilities) ? liabilities : []).filter(
        (l) => String(l.liability_type || '').toUpperCase() !== 'CREDIT_CARD_STATEMENT',
      ),
    [liabilities],
  )

  const openBills = useMemo(
    () =>
      (Array.isArray(bills) ? bills : []).filter((b) => {
        const s = String(b.status || '').toUpperCase()
        return s === 'PENDING' || s === 'PARTIAL'
      }),
  )

  const loadCore = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const [a, liab, cr, billR] = await Promise.all([
        listFinanceAccounts(),
        listFinanceLiabilities({ limit: 300 }),
        listCreditCards(),
        listCreditCardBills({ limit: 200 }),
      ])
      setAccounts(Array.isArray(a) ? a : [])
      setLiabilities(Array.isArray(liab) ? liab : [])
      setCards(Array.isArray(cr) ? cr : [])
      setBills(Array.isArray(billR) ? billR : [])
    } catch (e) {
      if (e.status === 401) {
        setPfToken(null)
        onSessionInvalid?.()
      } else {
        setError(e.message || 'Failed to load data')
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
    loadCore()
  }, [loadCore, tick])

  useEffect(() => {
    loadHistory()
  }, [loadHistory, tick])

  useEffect(() => {
    const lid = Number(liabilityId)
    if (!lid || movementType !== 'loan_emi_payment') {
      setEmiSchedule([])
      return
    }
    let cancelled = false
    ;(async () => {
      try {
        const rows = await listLiabilitySchedule(lid)
        if (!cancelled) setEmiSchedule(Array.isArray(rows) ? rows : [])
      } catch {
        if (!cancelled) setEmiSchedule([])
      }
    })()
    return () => {
      cancelled = true
    }
  }, [liabilityId, movementType])

  const selectedEmi = useMemo(() => {
    const n = Number(emiNumber)
    if (!n) return null
    return emiSchedule.find((r) => Number(r.emi_number) === n) ?? null
  }, [emiNumber, emiSchedule])

  useEffect(() => {
    if (selectedEmi && movementType === 'loan_emi_payment') {
      const due = Number(selectedEmi.emi_amount)
      if (due && !Number.isNaN(due)) setAmount(String(due))
    }
  }, [selectedEmi, movementType])

  function accountLabel(id) {
    if (!id) return 'Outside'
    const a = accounts.find((x) => x.id === id)
    return a ? a.account_name : `#${id}`
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    const amt = Number(amount)
    if (!amt || amt <= 0) {
      setError('Enter a positive amount')
      return
    }

    if (movementType === 'internal_transfer') {
      const fa = Number(fromId)
      const ta = Number(toId)
      if (!fa || !ta || fa === ta) {
        setError('Choose two different accounts')
        return
      }
      setSubmitting(true)
      try {
        if (file) {
          const fd = new FormData()
          fd.set('from_account_id', String(fa))
          fd.set('to_account_id', String(ta))
          fd.set('amount', String(amt))
          fd.set('transfer_date', movementDate)
          fd.set('transfer_method', method)
          if (reference.trim()) fd.set('reference_number', reference.trim())
          if (notes.trim()) fd.set('notes', notes.trim())
          fd.set('attachment', file)
          await postAccountTransfer(fd)
        } else {
          await postAccountMovement({
            movement_type: 'internal_transfer',
            amount: amt,
            movement_date: movementDate,
            from_account_id: fa,
            to_account_id: ta,
            reference_number: reference.trim() || null,
            notes: notes.trim() || null,
          })
        }
        resetFormPartial()
        await loadCore()
        await loadHistory()
        refresh()
      } catch (err) {
        if (err.status === 401) {
          setPfToken(null)
          onSessionInvalid?.()
        } else {
          setError(err.message || 'Could not record movement')
        }
      } finally {
        setSubmitting(false)
      }
      return
    }

    const body = {
      movement_type: movementType,
      amount: amt,
      movement_date: movementDate,
      reference_number: reference.trim() || null,
      notes: notes.trim() || null,
    }

    if (movementType === 'external_deposit') {
      const tid = Number(toId)
      if (!tid) {
        setError('Select account to deposit into')
        return
      }
      body.to_account_id = tid
      body.external_counterparty = depositSource
      body.create_linked_income = linkIncome
      if (linkIncome) body.income_category = depositSource
    } else if (movementType === 'external_withdrawal') {
      const fid = Number(fromId)
      if (!fid) {
        setError('Select account to withdraw from')
        return
      }
      body.from_account_id = fid
      body.external_counterparty = withdrawPurpose
      body.create_linked_expense = linkExpense
      if (linkExpense) body.expense_category = withdrawPurpose
    } else if (movementType === 'credit_card_payment') {
      const fid = Number(fromId)
      const bid = Number(ccBillId)
      if (!fid || !bid) {
        setError('Select bank account and credit card bill')
        return
      }
      body.from_account_id = fid
      body.credit_card_bill_id = bid
    } else if (movementType === 'loan_disbursement') {
      const tid = Number(toId)
      const lid = Number(liabilityId)
      if (!tid || !lid) {
        setError('Select liability and deposit account')
        return
      }
      body.to_account_id = tid
      body.liability_id = lid
    } else if (movementType === 'loan_emi_payment') {
      const fid = Number(fromId)
      const lid = Number(liabilityId)
      if (!fid || !lid) {
        setError('Select liability and bank account')
        return
      }
      body.from_account_id = fid
      body.liability_id = lid
      const hasEmi = emiSchedule.length > 0
      if (hasEmi) {
        const en = Number(emiNumber)
        if (!en) {
          setError('Select EMI installment')
          return
        }
        body.emi_number = en
      } else {
        const raw = liabilityInterest.trim()
        const ip = raw === '' ? 0 : Number(raw)
        if (Number.isNaN(ip) || ip < 0) {
          setError('Interest paid must be empty or a non-negative number')
          return
        }
        body.liability_interest_paid = ip
      }
    }

    setSubmitting(true)
    try {
      await postAccountMovement(body)
      resetFormPartial()
      await loadCore()
      await loadHistory()
      refresh()
    } catch (err) {
      if (err.status === 401) {
        setPfToken(null)
        onSessionInvalid?.()
      } else {
        setError(err.message || 'Could not record movement')
      }
    } finally {
      setSubmitting(false)
    }
  }

  function resetFormPartial() {
    setAmount('')
    setReference('')
    setNotes('')
    setFile(null)
    setFromId('')
    setToId('')
    setLiabilityId('')
    setEmiNumber('')
    setCcBillId('')
    setLiabilityInterest('')
  }

  const showInternalMethod = movementType === 'internal_transfer'
  const needTwoAccounts = movementType === 'internal_transfer'
  const internalOk = accounts.length >= 2

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[var(--pf-primary)]/15 text-[var(--pf-primary)]">
            <ArrowsRightLeftIcon className="h-6 w-6" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-slate-900 dark:text-[var(--pf-text)]">Money movement</h1>
            <p className="text-sm text-[var(--pf-text-muted)]">
              Internal transfers, cash in/out of accounts, card bill pay from bank, and borrowed-loan flows — all update balances and the account ledger.
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
          <p className="text-sm text-[var(--pf-text-muted)]">Loading…</p>
        ) : needTwoAccounts && !internalOk ? (
          <p className="text-sm text-[var(--pf-text-muted)]">You need at least two accounts for internal transfers. Add accounts first.</p>
        ) : (
          <form onSubmit={handleSubmit} className="grid gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <label className={labelCls} htmlFor="pf-mov-type">
                Transfer type
              </label>
              <select
                id="pf-mov-type"
                className={inputCls}
                value={movementType}
                onChange={(e) => {
                  setMovementType(e.target.value)
                  setError('')
                }}
              >
                {MOVEMENT_TYPES.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.label}
                  </option>
                ))}
              </select>
            </div>

            {movementType === 'internal_transfer' ? (
              <>
                <div className="sm:col-span-2">
                  <label className={labelCls} htmlFor="pf-mov-from">
                    From account
                  </label>
                  <select
                    id="pf-mov-from"
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
                  <label className={labelCls} htmlFor="pf-mov-to">
                    To account
                  </label>
                  <select
                    id="pf-mov-to"
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
              </>
            ) : null}

            {movementType === 'external_deposit' ? (
              <>
                <div className="sm:col-span-2">
                  <label className={labelCls} htmlFor="pf-mov-to-ext">
                    To account
                  </label>
                  <select
                    id="pf-mov-to-ext"
                    className={inputCls}
                    value={toId}
                    onChange={(e) => setToId(e.target.value)}
                    required
                  >
                    <option value="">Select…</option>
                    {accounts.map((a) => (
                      <option key={a.id} value={String(a.id)}>
                        {a.account_name} ({a.account_type})
                      </option>
                    ))}
                  </select>
                </div>
                <div className="sm:col-span-2">
                  <label className={labelCls} htmlFor="pf-mov-src">
                    Source
                  </label>
                  <select id="pf-mov-src" className={inputCls} value={depositSource} onChange={(e) => setDepositSource(e.target.value)}>
                    {DEPOSIT_SOURCES.map((s) => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="flex items-center gap-2 sm:col-span-2">
                  <input id="pf-mov-lk-inc" type="checkbox" checked={linkIncome} onChange={(e) => setLinkIncome(e.target.checked)} />
                  <label htmlFor="pf-mov-lk-inc" className="text-sm text-[var(--pf-text)]">
                    Also create income entry (for dashboards / reports)
                  </label>
                </div>
              </>
            ) : null}

            {movementType === 'external_withdrawal' ? (
              <>
                <div className="sm:col-span-2">
                  <label className={labelCls} htmlFor="pf-mov-from-ext">
                    From account
                  </label>
                  <select
                    id="pf-mov-from-ext"
                    className={inputCls}
                    value={fromId}
                    onChange={(e) => setFromId(e.target.value)}
                    required
                  >
                    <option value="">Select…</option>
                    {accounts.map((a) => (
                      <option key={a.id} value={String(a.id)}>
                        {a.account_name} ({a.account_type})
                      </option>
                    ))}
                  </select>
                </div>
                <div className="sm:col-span-2">
                  <label className={labelCls} htmlFor="pf-mov-purpose">
                    Purpose
                  </label>
                  <select id="pf-mov-purpose" className={inputCls} value={withdrawPurpose} onChange={(e) => setWithdrawPurpose(e.target.value)}>
                    {WITHDRAW_PURPOSES.map((s) => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="flex items-center gap-2 sm:col-span-2">
                  <input id="pf-mov-lk-exp" type="checkbox" checked={linkExpense} onChange={(e) => setLinkExpense(e.target.checked)} />
                  <label htmlFor="pf-mov-lk-exp" className="text-sm text-[var(--pf-text)]">
                    Also create expense entry (for dashboards / reports)
                  </label>
                </div>
              </>
            ) : null}

            {movementType === 'credit_card_payment' ? (
              <>
                <div className="sm:col-span-2">
                  <label className={labelCls} htmlFor="pf-mov-cc-from">
                    From account (bank)
                  </label>
                  <select
                    id="pf-mov-cc-from"
                    className={inputCls}
                    value={fromId}
                    onChange={(e) => setFromId(e.target.value)}
                    required
                  >
                    <option value="">Select…</option>
                    {accounts.map((a) => (
                      <option key={a.id} value={String(a.id)}>
                        {a.account_name}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="sm:col-span-2">
                  <label className={labelCls} htmlFor="pf-mov-bill">
                    Statement / bill
                  </label>
                  <select id="pf-mov-bill" className={inputCls} value={ccBillId} onChange={(e) => setCcBillId(e.target.value)} required>
                    <option value="">Select unpaid bill…</option>
                    {openBills.map((b) => {
                      const card = cards.find((c) => c.id === b.card_id)
                      const due = Number(b.total_amount || 0) - Number(b.amount_paid || 0)
                      return (
                        <option key={b.id} value={String(b.id)}>
                          {card ? card.card_name : `Card ${b.card_id}`} · due {formatInr(due)} · {b.due_date}
                        </option>
                      )
                    })}
                  </select>
                  {openBills.length === 0 ? (
                    <p className="mt-1 text-xs text-[var(--pf-text-muted)]">Generate a statement on Credit cards first if nothing appears.</p>
                  ) : null}
                </div>
              </>
            ) : null}

            {movementType === 'loan_disbursement' ? (
              <>
                <div className="sm:col-span-2">
                  <label className={labelCls} htmlFor="pf-mov-liab">
                    Liability (money you owe)
                  </label>
                  <select
                    id="pf-mov-liab"
                    className={inputCls}
                    value={liabilityId}
                    onChange={(e) => setLiabilityId(e.target.value)}
                    required
                  >
                    <option value="">Select…</option>
                    {borrowLiabilities.map((l) => (
                      <option key={l.id} value={String(l.id)}>
                        {l.liability_name} · {l.liability_type} · out {formatInr(l.outstanding_amount)}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="sm:col-span-2">
                  <label className={labelCls} htmlFor="pf-mov-disb-to">
                    Deposit to account
                  </label>
                  <select
                    id="pf-mov-disb-to"
                    className={inputCls}
                    value={toId}
                    onChange={(e) => setToId(e.target.value)}
                    required
                  >
                    <option value="">Select…</option>
                    {accounts.map((a) => (
                      <option key={a.id} value={String(a.id)}>
                        {a.account_name}
                      </option>
                    ))}
                  </select>
                </div>
              </>
            ) : null}

            {movementType === 'loan_emi_payment' ? (
              <>
                <div className="sm:col-span-2">
                  <label className={labelCls} htmlFor="pf-mov-liab-emi">
                    Liability
                  </label>
                  <select
                    id="pf-mov-liab-emi"
                    className={inputCls}
                    value={liabilityId}
                    onChange={(e) => {
                      setLiabilityId(e.target.value)
                      setEmiNumber('')
                    }}
                    required
                  >
                    <option value="">Select…</option>
                    {borrowLiabilities.map((l) => (
                      <option key={l.id} value={String(l.id)}>
                        {l.liability_name} · out {formatInr(l.outstanding_amount)}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="sm:col-span-2">
                  <label className={labelCls} htmlFor="pf-mov-emi-from">
                    From account
                  </label>
                  <select
                    id="pf-mov-emi-from"
                    className={inputCls}
                    value={fromId}
                    onChange={(e) => setFromId(e.target.value)}
                    required
                  >
                    <option value="">Select…</option>
                    {accounts.map((a) => (
                      <option key={a.id} value={String(a.id)}>
                        {a.account_name}
                      </option>
                    ))}
                  </select>
                </div>
                {emiSchedule.length > 0 ? (
                  <div className="sm:col-span-2">
                    <label className={labelCls} htmlFor="pf-mov-emi-n">
                      EMI installment
                    </label>
                    <select id="pf-mov-emi-n" className={inputCls} value={emiNumber} onChange={(e) => setEmiNumber(e.target.value)} required>
                      <option value="">Select…</option>
                      {emiSchedule
                        .filter((r) => String(r.payment_status || '').toLowerCase() !== 'paid')
                        .map((r) => (
                          <option key={r.emi_number} value={String(r.emi_number)}>
                            #{r.emi_number} · {r.due_date} · {formatInr(r.emi_amount)}
                          </option>
                        ))}
                    </select>
                  </div>
                ) : (
                  <div className="sm:col-span-2">
                    <label className={labelCls} htmlFor="pf-mov-emi-int">
                      Interest portion (optional, rest treated as principal)
                    </label>
                    <input
                      id="pf-mov-emi-int"
                      className={inputCls}
                      type="number"
                      min="0"
                      step="0.01"
                      value={liabilityInterest}
                      onChange={(e) => setLiabilityInterest(e.target.value)}
                      placeholder="0"
                    />
                    <p className="mt-1 text-xs text-[var(--pf-text-muted)]">
                      For liabilities without an EMI schedule, enter payment amount above and interest split here if you track it.
                    </p>
                  </div>
                )}
              </>
            ) : null}

            <div>
              <label className={labelCls} htmlFor="pf-mov-amt">
                Amount (₹)
              </label>
              <input
                id="pf-mov-amt"
                type="number"
                min="0.01"
                step="0.01"
                className={inputCls}
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                required
                disabled={movementType === 'loan_emi_payment' && emiSchedule.length > 0}
              />
            </div>
            <div>
              <label className={labelCls} htmlFor="pf-mov-date">
                Date
              </label>
              <input id="pf-mov-date" type="date" className={inputCls} value={movementDate} onChange={(e) => setMovementDate(e.target.value)} required />
            </div>

            {showInternalMethod ? (
              <div className="sm:col-span-2">
                <label className={labelCls} htmlFor="pf-mov-channel">
                  Channel / rail (optional)
                </label>
                <select id="pf-mov-channel" className={inputCls} value={method} onChange={(e) => setMethod(e.target.value)}>
                  {['INTERNAL', 'NEFT', 'RTGS', 'IMPS', 'UPI', 'CASH_DEPOSIT', 'OTHER'].map((m) => (
                    <option key={m} value={m}>
                      {m.replace(/_/g, ' ')}
                    </option>
                  ))}
                </select>
              </div>
            ) : null}

            <div className="sm:col-span-2">
              <label className={labelCls} htmlFor="pf-mov-ref">
                Reference number <span className="font-normal text-slate-400">(optional)</span>
              </label>
              <input id="pf-mov-ref" className={inputCls} value={reference} onChange={(e) => setReference(e.target.value)} />
            </div>
            <div className="sm:col-span-2">
              <label className={labelCls} htmlFor="pf-mov-notes">
                Notes <span className="font-normal text-slate-400">(optional)</span>
              </label>
              <textarea id="pf-mov-notes" rows={2} className={`${inputCls} resize-y`} value={notes} onChange={(e) => setNotes(e.target.value)} />
            </div>
            {movementType === 'internal_transfer' ? (
              <div className="sm:col-span-2">
                <label className={labelCls} htmlFor="pf-mov-file">
                  Attachment <span className="font-normal text-slate-400">(optional, PDF or image, max 5 MB)</span>
                </label>
                <input
                  id="pf-mov-file"
                  type="file"
                  accept=".pdf,.png,.jpg,.jpeg,.webp,.gif"
                  className={inputCls}
                  onChange={(e) => setFile(e.target.files?.[0] ?? null)}
                />
              </div>
            ) : null}
            <div className="flex flex-wrap gap-2 sm:col-span-2">
              <button type="submit" disabled={submitting} className={btnPrimary}>
                {submitting ? 'Saving…' : 'Save movement'}
              </button>
            </div>
          </form>
        )}
      </div>

      <section className={cardCls}>
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-lg font-semibold text-[var(--pf-text)]">Recent movements</h2>
          <button type="button" className={btnSecondary} onClick={() => loadHistory()} disabled={histLoading}>
            Refresh
          </button>
        </div>
        {histLoading ? (
          <p className="text-sm text-[var(--pf-text-muted)]">Loading…</p>
        ) : history.length === 0 ? (
          <p className="text-sm text-[var(--pf-text-muted)]">No movements yet.</p>
        ) : (
          <div className={pfTableWrap}>
            <table className={pfTable}>
              <thead>
                <tr>
                  <th className={pfTh}>Date</th>
                  <th className={pfTh}>Type</th>
                  <th className={pfTh}>From</th>
                  <th className={pfTh}>To</th>
                  <th className={pfThRight}>Amount</th>
                  <th className={pfTh}>Reference</th>
                </tr>
              </thead>
              <tbody>
                {history.map((r) => (
                  <tr key={r.id} className={pfTrHover}>
                    <td className={pfTd}>{r.movement_date}</td>
                    <td className={pfTd}>{humanizeMovementType(r.movement_type)}</td>
                    <td className={pfTd}>{accountLabel(r.from_account_id)}</td>
                    <td className={pfTd}>{accountLabel(r.to_account_id)}</td>
                    <td className={pfTdRight}>{formatInr(r.amount)}</td>
                    <td className={pfTd}>{r.reference_number || r.external_counterparty || '—'}</td>
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
