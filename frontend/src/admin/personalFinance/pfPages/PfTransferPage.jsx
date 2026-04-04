import { XMarkIcon } from '@heroicons/react/24/solid'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useOutletContext, useSearchParams } from 'react-router-dom'
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
import { PageHeader } from '../../../components/ui/PageHeader.jsx'
import { PremiumSelect } from '../../../components/ui/PremiumSelect.jsx'
import { AppButton, AppModal } from '../pfDesignSystem/index.js'
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

const MOVEMENTS_PAGE_SIZE = 10

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
          <PremiumSelect
            id="stmt-acc"
            label="Account"
            labelClassName={labelCls}
            options={accounts.map((a) => ({ value: String(a.id), label: a.account_name }))}
            value={accountId}
            onChange={setAccountId}
            placeholder="Select…"
            searchable={accounts.length > 6}
          />
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
  const [searchParams, setSearchParams] = useSearchParams()
  const transferDeepLinkApplied = useRef(false)
  const [accounts, setAccounts] = useState([])
  const [liabilities, setLiabilities] = useState([])
  const [cards, setCards] = useState([])
  const [bills, setBills] = useState([])
  const [emiSchedule, setEmiSchedule] = useState([])
  const [history, setHistory] = useState([])
  const [movementsPage, setMovementsPage] = useState(1)
  const [movementsTotal, setMovementsTotal] = useState(0)
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
  /** When false, the movements list is primary; Add opens a modal. */
  const [movementModalOpen, setMovementModalOpen] = useState(false)

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
    [bills],
  )

  useEffect(() => {
    if (transferDeepLinkApplied.current || accounts.length === 0) return
    const from = searchParams.get('from_account_id')
    const to = searchParams.get('to_account_id')
    let changed = false
    if (from && accounts.some((a) => String(a.id) === from)) {
      setFromId(from)
      setMovementType('internal_transfer')
      setMovementModalOpen(true)
      changed = true
    }
    if (to && accounts.some((a) => String(a.id) === to)) {
      setToId(to)
      setMovementType('internal_transfer')
      setMovementModalOpen(true)
      changed = true
    }
    if (changed) {
      transferDeepLinkApplied.current = true
      const next = new URLSearchParams(searchParams)
      next.delete('from_account_id')
      next.delete('to_account_id')
      setSearchParams(next, { replace: true })
    }
  }, [accounts, searchParams, setSearchParams])

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

  const loadHistory = useCallback(
    async (overridePage) => {
      const page = overridePage != null ? overridePage : movementsPage
      setHistLoading(true)
      try {
        const skip = (page - 1) * MOVEMENTS_PAGE_SIZE
        const { items, total } = await listAccountTransferHistory({
          skip,
          limit: MOVEMENTS_PAGE_SIZE,
        })
        setHistory(Array.isArray(items) ? items : [])
        setMovementsTotal(typeof total === 'number' && !Number.isNaN(total) ? total : 0)
      } catch (e) {
        if (e.status === 401) {
          setPfToken(null)
          onSessionInvalid?.()
        }
      } finally {
        setHistLoading(false)
      }
    },
    [onSessionInvalid, movementsPage],
  )

  useEffect(() => {
    loadCore()
  }, [loadCore, tick])

  useEffect(() => {
    loadHistory()
  }, [loadHistory, tick])

  const movementsTotalPages = Math.max(1, Math.ceil(movementsTotal / MOVEMENTS_PAGE_SIZE) || 1)

  useEffect(() => {
    if (movementsPage > movementsTotalPages) {
      setMovementsPage(movementsTotalPages)
    }
  }, [movementsPage, movementsTotalPages])

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
        setMovementModalOpen(false)
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
      setMovementModalOpen(false)
      setMovementsPage(1)
      await loadCore()
      await loadHistory(1)
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
    <div className="w-full min-w-0 max-w-full space-y-6">
      <PageHeader
        title="Money movement"
        description="Internal transfers, cash in/out of accounts, card bill pay from bank, and borrowed-loan flows — all update balances and the account ledger."
        action={
          <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:flex-wrap sm:justify-end">
            <button type="button" className={btnPrimary} onClick={() => setMovementModalOpen(true)} aria-haspopup="dialog">
              Add movement
            </button>
            {accounts.length > 0 ? (
              <button type="button" className={btnSecondary} onClick={() => setStmtOpen(true)}>
                View account statement
              </button>
            ) : null}
          </div>
        }
      />

      {error ? (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-100">
          {error}
        </div>
      ) : null}

      <AppModal
        open={movementModalOpen}
        onClose={() => !submitting && setMovementModalOpen(false)}
        title="New movement"
        subtitle="Fill the form below, then save. Balances and ledger lines update immediately."
        maxWidthClass="max-w-3xl"
        footer={
          <>
            <AppButton type="button" variant="secondary" disabled={submitting} onClick={() => setMovementModalOpen(false)}>
              Cancel
            </AppButton>
            <AppButton
              type="submit"
              variant="primary"
              disabled={submitting || loading || (needTwoAccounts && !internalOk)}
              form="pf-transfer-movement-form"
            >
              {submitting ? 'Saving…' : 'Save movement'}
            </AppButton>
          </>
        }
      >
        {loading ? (
          <p className="text-sm text-[var(--pf-text-muted)]">Loading…</p>
        ) : needTwoAccounts && !internalOk ? (
          <p className="text-sm text-[var(--pf-text-muted)]">You need at least two accounts for internal transfers. Add accounts first.</p>
        ) : (
          <form id="pf-transfer-movement-form" onSubmit={handleSubmit} className="grid gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <PremiumSelect
                id="pf-mov-type"
                label="Transfer type"
                labelClassName={labelCls}
                options={MOVEMENT_TYPES.map((t) => ({ value: t.id, label: t.label }))}
                value={movementType}
                onChange={(v) => {
                  setMovementType(v)
                  setError('')
                }}
                searchable={MOVEMENT_TYPES.length > 6}
              />
            </div>

            {movementType === 'internal_transfer' ? (
              <>
                <div className="sm:col-span-2">
                  <PremiumSelect
                    id="pf-mov-from"
                    label="From account"
                    labelClassName={labelCls}
                    required
                    options={accounts.map((a) => ({
                      value: String(a.id),
                      label: `${a.account_name} (${a.account_type}) · ${formatInr(a.balance)}`,
                      disabled: String(a.id) === toId,
                    }))}
                    value={fromId}
                    onChange={setFromId}
                    placeholder="Select…"
                    searchable={accounts.length > 5}
                  />
                </div>
                <div className="sm:col-span-2">
                  <PremiumSelect
                    id="pf-mov-to"
                    label="To account"
                    labelClassName={labelCls}
                    required
                    options={accounts.map((a) => ({
                      value: String(a.id),
                      label: `${a.account_name} (${a.account_type}) · ${formatInr(a.balance)}`,
                      disabled: String(a.id) === fromId,
                    }))}
                    value={toId}
                    onChange={setToId}
                    placeholder="Select…"
                    searchable={accounts.length > 5}
                  />
                </div>
              </>
            ) : null}

            {movementType === 'external_deposit' ? (
              <>
                <div className="sm:col-span-2">
                  <PremiumSelect
                    id="pf-mov-to-ext"
                    label="To account"
                    labelClassName={labelCls}
                    required
                    options={accounts.map((a) => ({
                      value: String(a.id),
                      label: `${a.account_name} (${a.account_type})`,
                    }))}
                    value={toId}
                    onChange={setToId}
                    placeholder="Select…"
                    searchable={accounts.length > 5}
                  />
                </div>
                <div className="sm:col-span-2">
                  <PremiumSelect
                    id="pf-mov-src"
                    label="Source"
                    labelClassName={labelCls}
                    options={DEPOSIT_SOURCES.map((s) => ({ value: s, label: s }))}
                    value={depositSource}
                    onChange={setDepositSource}
                  />
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
                  <PremiumSelect
                    id="pf-mov-from-ext"
                    label="From account"
                    labelClassName={labelCls}
                    required
                    options={accounts.map((a) => ({
                      value: String(a.id),
                      label: `${a.account_name} (${a.account_type})`,
                    }))}
                    value={fromId}
                    onChange={setFromId}
                    placeholder="Select…"
                    searchable={accounts.length > 5}
                  />
                </div>
                <div className="sm:col-span-2">
                  <PremiumSelect
                    id="pf-mov-purpose"
                    label="Purpose"
                    labelClassName={labelCls}
                    options={WITHDRAW_PURPOSES.map((s) => ({ value: s, label: s }))}
                    value={withdrawPurpose}
                    onChange={setWithdrawPurpose}
                  />
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
                  <PremiumSelect
                    id="pf-mov-cc-from"
                    label="From account (bank)"
                    labelClassName={labelCls}
                    required
                    options={accounts.map((a) => ({ value: String(a.id), label: a.account_name }))}
                    value={fromId}
                    onChange={setFromId}
                    placeholder="Select…"
                    searchable={accounts.length > 6}
                  />
                </div>
                <div className="sm:col-span-2">
                  <PremiumSelect
                    id="pf-mov-bill"
                    label="Statement / bill"
                    labelClassName={labelCls}
                    required
                    options={openBills.map((b) => {
                      const card = cards.find((c) => c.id === b.card_id)
                      const due = Number(b.total_amount || 0) - Number(b.amount_paid || 0)
                      return {
                        value: String(b.id),
                        label: `${card ? card.card_name : `Card ${b.card_id}`} · due ${formatInr(due)} · ${b.due_date}`,
                      }
                    })}
                    value={ccBillId}
                    onChange={setCcBillId}
                    placeholder="Select unpaid bill…"
                    searchable={openBills.length > 5}
                  />
                  {openBills.length === 0 ? (
                    <p className="mt-1 text-xs text-[var(--pf-text-muted)]">Generate a statement on Credit cards first if nothing appears.</p>
                  ) : null}
                </div>
              </>
            ) : null}

            {movementType === 'loan_disbursement' ? (
              <>
                <div className="sm:col-span-2">
                  <PremiumSelect
                    id="pf-mov-liab"
                    label="Liability (money you owe)"
                    labelClassName={labelCls}
                    required
                    options={borrowLiabilities.map((l) => ({
                      value: String(l.id),
                      label: `${l.liability_name} · ${l.liability_type} · out ${formatInr(l.outstanding_amount)}`,
                    }))}
                    value={liabilityId}
                    onChange={setLiabilityId}
                    placeholder="Select…"
                    searchable={borrowLiabilities.length > 5}
                  />
                </div>
                <div className="sm:col-span-2">
                  <PremiumSelect
                    id="pf-mov-disb-to"
                    label="Deposit to account"
                    labelClassName={labelCls}
                    required
                    options={accounts.map((a) => ({ value: String(a.id), label: a.account_name }))}
                    value={toId}
                    onChange={setToId}
                    placeholder="Select…"
                    searchable={accounts.length > 6}
                  />
                </div>
              </>
            ) : null}

            {movementType === 'loan_emi_payment' ? (
              <>
                <div className="sm:col-span-2">
                  <PremiumSelect
                    id="pf-mov-liab-emi"
                    label="Liability"
                    labelClassName={labelCls}
                    required
                    options={borrowLiabilities.map((l) => ({
                      value: String(l.id),
                      label: `${l.liability_name} · out ${formatInr(l.outstanding_amount)}`,
                    }))}
                    value={liabilityId}
                    onChange={(v) => {
                      setLiabilityId(v)
                      setEmiNumber('')
                    }}
                    placeholder="Select…"
                    searchable={borrowLiabilities.length > 5}
                  />
                </div>
                <div className="sm:col-span-2">
                  <PremiumSelect
                    id="pf-mov-emi-from"
                    label="From account"
                    labelClassName={labelCls}
                    required
                    options={accounts.map((a) => ({ value: String(a.id), label: a.account_name }))}
                    value={fromId}
                    onChange={setFromId}
                    placeholder="Select…"
                    searchable={accounts.length > 6}
                  />
                </div>
                {emiSchedule.length > 0 ? (
                  <div className="sm:col-span-2">
                    <PremiumSelect
                      id="pf-mov-emi-n"
                      label="EMI installment"
                      labelClassName={labelCls}
                      required
                      options={emiSchedule
                        .filter((r) => String(r.payment_status || '').toLowerCase() !== 'paid')
                        .map((r) => ({
                          value: String(r.emi_number),
                          label: `#${r.emi_number} · ${r.due_date} · ${formatInr(r.emi_amount)}`,
                        }))}
                      value={emiNumber}
                      onChange={setEmiNumber}
                      placeholder="Select…"
                      searchable={emiSchedule.length > 6}
                    />
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
                <PremiumSelect
                  id="pf-mov-channel"
                  label="Channel / rail (optional)"
                  labelClassName={labelCls}
                  options={['INTERNAL', 'NEFT', 'RTGS', 'IMPS', 'UPI', 'CASH_DEPOSIT', 'OTHER'].map((m) => ({
                    value: m,
                    label: m.replace(/_/g, ' '),
                  }))}
                  value={method}
                  onChange={setMethod}
                />
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
          </form>
        )}
      </AppModal>

      <section className={cardCls} aria-label="Recent movements">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="text-lg font-semibold text-[var(--pf-text)]">Recent movements</h2>
            {!movementModalOpen ? (
              <p className="mt-0.5 text-xs text-[var(--pf-text-muted)]">Click &quot;Add movement&quot; above when you want to record a new one.</p>
            ) : null}
          </div>
          <button type="button" className={btnSecondary} onClick={() => loadHistory()} disabled={histLoading}>
            Refresh
          </button>
        </div>
        <p className="mb-3 text-xs text-[var(--pf-text-muted)]">
          {movementsTotal > 0
            ? `Showing ${(movementsPage - 1) * MOVEMENTS_PAGE_SIZE + 1}–${Math.min(movementsPage * MOVEMENTS_PAGE_SIZE, movementsTotal)} of ${movementsTotal} · ${MOVEMENTS_PAGE_SIZE} per page`
            : null}
        </p>
        {histLoading ? (
          <p className="text-sm text-[var(--pf-text-muted)]">Loading…</p>
        ) : history.length === 0 ? (
          <p className="text-sm text-[var(--pf-text-muted)]">No movements yet.</p>
        ) : (
          <>
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
            {movementsTotalPages > 1 ? (
              <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-[var(--pf-border)] pt-3">
                <p className="text-xs text-[var(--pf-text-muted)]">
                  Page {movementsPage} of {movementsTotalPages}
                </p>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    className={btnSecondary}
                    disabled={histLoading || movementsPage <= 1}
                    onClick={() => setMovementsPage((p) => Math.max(1, p - 1))}
                  >
                    Previous
                  </button>
                  <button
                    type="button"
                    className={btnSecondary}
                    disabled={histLoading || movementsPage >= movementsTotalPages}
                    onClick={() => setMovementsPage((p) => Math.min(movementsTotalPages, p + 1))}
                  >
                    Next
                  </button>
                </div>
              </div>
            ) : null}
          </>
        )}
      </section>

      {stmtOpen ? <StatementModal accounts={accounts} onClose={() => setStmtOpen(false)} onSessionInvalid={onSessionInvalid} /> : null}
    </div>
  )
}
