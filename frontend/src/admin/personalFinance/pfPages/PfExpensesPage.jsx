import { PencilSquareIcon, PlusCircleIcon, TrashIcon } from '@heroicons/react/24/solid'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useOutletContext, useSearchParams } from 'react-router-dom'
import {
  createFinanceExpense,
  deleteFinanceExpense,
  listFinanceAccounts,
  listFinanceExpenses,
  listPfExpenseCategories,
  listCreditCards,
  listPfPaymentInstruments,
  patchFinanceExpense,
  pfFetchBlob,
  setPfToken,
  triggerDownloadBlob,
} from '../api.js'
import PfExportMenu from '../PfExportMenu.jsx'
import { buildIncomeExpenseExportQuery } from '../pfExportRange.js'
import { PfCategoryIcon, categoryBadgeClass } from '../pfCategoryIcons.jsx'
import { AppButton, AppDropdown, AppInput, AppModal, AppTextarea } from '../pfDesignSystem/index.js'
import {
  btnPrimary,
  cardCls,
  inputCls,
  labelCls,
  pfActionRow,
  pfSelectCompact,
  pfTable,
  pfTableWrap,
  pfTd,
  pfTdActions,
  pfTdRight,
  pfTh,
  pfThActions,
  pfThRight,
  pfTrHover,
} from '../pfFormStyles.js'
import { formatInr } from '../pfFormat.js'
import { usePfRefresh } from '../pfRefreshContext.jsx'

function todayISODate() {
  const d = new Date()
  return d.toISOString().slice(0, 10)
}

const PAY_METHODS = [
  { value: 'cash', label: 'Cash' },
  { value: 'card', label: 'Card (debit from linked account)' },
  { value: 'credit_card', label: 'Credit card (statement)' },
  { value: 'upi', label: 'UPI / Bank UPI' },
  { value: 'bank_transfer', label: 'Bank transfer' },
]

function methodDisplayLabel(value) {
  return PAY_METHODS.find((m) => m.value === value)?.label ?? value ?? '—'
}

function payLineForRow(r) {
  const pm = (r.payment_method || '').toLowerCase()
  if (pm === 'credit_card' && r.credit_card_label) {
    return `${methodDisplayLabel(r.payment_method)} · ${r.credit_card_label}`
  }
  if (r.payment_instrument_label) {
    return `${methodDisplayLabel(r.payment_method)} · ${r.payment_instrument_label}`
  }
  return methodDisplayLabel(r.payment_method)
}

function paymentMethodForAccount(account) {
  if (!account) return 'bank_transfer'
  const t = String(account.account_type || '').toLowerCase()
  if (t.includes('cash') || t.includes('wallet') || t === 'petty' || t === 'hand') return 'cash'
  return 'bank_transfer'
}

/** Map unified "Pay with" value to API fields. */
function parsePayWith(value, accounts, instruments, creditCards = []) {
  if (!value || typeof value !== 'string') {
    return {
      accountId: null,
      paymentMethod: null,
      paymentInstrumentId: null,
      creditCardId: null,
      kind: 'none',
    }
  }
  if (value.startsWith('cc:')) {
    const id = Number(value.slice(3))
    const ok = creditCards.some((c) => c.id === id)
    if (!ok || Number.isNaN(id)) {
      return {
        accountId: null,
        paymentMethod: 'credit_card',
        paymentInstrumentId: null,
        creditCardId: null,
        kind: 'invalid',
      }
    }
    return {
      accountId: null,
      paymentMethod: 'credit_card',
      paymentInstrumentId: null,
      creditCardId: id,
      kind: 'cc',
    }
  }
  if (value.startsWith('pi:')) {
    const id = Number(value.slice(3))
    const inst = instruments.find((i) => i.id === id)
    if (!inst || inst.finance_account_id == null) {
      return {
        accountId: null,
        paymentMethod: 'card',
        paymentInstrumentId: null,
        creditCardId: null,
        kind: 'invalid',
      }
    }
    return {
      accountId: inst.finance_account_id,
      paymentMethod: inst.kind,
      paymentInstrumentId: id,
      creditCardId: null,
      kind: 'pi',
    }
  }
  if (value.startsWith('acc:')) {
    const id = Number(value.slice(4))
    const acc = accounts.find((a) => a.id === id)
    if (!acc) {
      return {
        accountId: null,
        paymentMethod: null,
        paymentInstrumentId: null,
        creditCardId: null,
        kind: 'invalid',
      }
    }
    return {
      accountId: id,
      paymentMethod: paymentMethodForAccount(acc),
      paymentInstrumentId: null,
      creditCardId: null,
      kind: 'acc',
    }
  }
  return {
    accountId: null,
    paymentMethod: null,
    paymentInstrumentId: null,
    creditCardId: null,
    kind: 'invalid',
  }
}

function expenseRowToPayWithValue(r, instruments) {
  const pm = (r.payment_method || '').toLowerCase()
  if (pm === 'credit_card' && r.credit_card_id != null) {
    return `cc:${r.credit_card_id}`
  }
  if (r.payment_instrument_id != null && (pm === 'card' || pm === 'upi')) {
    const inst = instruments.find((i) => i.id === r.payment_instrument_id)
    if (inst?.finance_account_id != null) return `pi:${r.payment_instrument_id}`
  }
  if (r.account_id != null) return `acc:${r.account_id}`
  return ''
}

export default function PfExpensesPage() {
  const { onSessionInvalid } = useOutletContext() || {}
  const { tick, refresh } = usePfRefresh()
  const [searchParams, setSearchParams] = useSearchParams()
  const accountDeepLinkApplied = useRef(false)
  const [addModalOpen, setAddModalOpen] = useState(false)
  const [categories, setCategories] = useState([])
  const [accounts, setAccounts] = useState([])
  const [instruments, setInstruments] = useState([])
  const [creditCards, setCreditCards] = useState([])
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [amount, setAmount] = useState('')
  const [expenseCategoryId, setExpenseCategoryId] = useState('')
  const [entryDate, setEntryDate] = useState(todayISODate)
  const [description, setDescription] = useState('')
  const [payWith, setPayWith] = useState('')
  const [paidBy, setPaidBy] = useState('')
  const [paymentStatus, setPaymentStatus] = useState('PAID')
  const [isRecurring, setIsRecurring] = useState(false)
  const [recurringType, setRecurringType] = useState('monthly')

  const [editingId, setEditingId] = useState(null)
  const [editAmount, setEditAmount] = useState('')
  const [editCategoryId, setEditCategoryId] = useState('')
  const [editEntryDate, setEditEntryDate] = useState('')
  const [editDescription, setEditDescription] = useState('')
  const [editPayWith, setEditPayWith] = useState('')
  const [editPaidBy, setEditPaidBy] = useState('')
  const [editPaymentStatus, setEditPaymentStatus] = useState('PAID')
  const [editIsRecurring, setEditIsRecurring] = useState(false)
  const [editRecurringType, setEditRecurringType] = useState('monthly')
  const [savingId, setSavingId] = useState(null)
  const [deletingId, setDeletingId] = useState(null)
  const [expenseExportBusy, setExpenseExportBusy] = useState(false)
  const [expenseDateFilter, setExpenseDateFilter] = useState('all')
  const [filterCustomStart, setFilterCustomStart] = useState('')
  const [filterCustomEnd, setFilterCustomEnd] = useState('')

  const categoryById = useMemo(() => {
    const m = new Map()
    for (const c of categories) m.set(c.id, c)
    return m
  }, [categories])

  const accountNameById = useMemo(() => {
    const m = new Map()
    for (const a of accounts) m.set(a.id, a.account_name)
    return m
  }, [accounts])

  const filteredExpenseRows = useMemo(() => {
    if (expenseDateFilter === 'all') return rows
    const t = todayISODate()
    if (expenseDateFilter === 'today') return rows.filter((r) => r.entry_date === t)
    if (expenseDateFilter === 'month') {
      const prefix = t.slice(0, 7)
      return rows.filter((r) => (r.entry_date || '').startsWith(prefix))
    }
    if (expenseDateFilter === 'week') {
      const end = new Date()
      const start = new Date(end)
      start.setDate(end.getDate() - 6)
      const startStr = start.toISOString().slice(0, 10)
      return rows.filter((r) => {
        const d = r.entry_date
        return d && d >= startStr && d <= t
      })
    }
    if (expenseDateFilter === 'custom' && filterCustomStart && filterCustomEnd) {
      return rows.filter(
        (r) => r.entry_date && r.entry_date >= filterCustomStart && r.entry_date <= filterCustomEnd,
      )
    }
    if (expenseDateFilter === 'custom') return rows
    return rows
  }, [rows, expenseDateFilter, filterCustomStart, filterCustomEnd])

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const [cats, accs, inst, exp, ccList] = await Promise.all([
        listPfExpenseCategories(),
        listFinanceAccounts(),
        listPfPaymentInstruments(),
        listFinanceExpenses(),
        listCreditCards(),
      ])
      const catList = Array.isArray(cats) ? cats : []
      setCategories(catList)
      const accList = Array.isArray(accs) ? accs : []
      const instList = Array.isArray(inst) ? inst : []
      const ccards = Array.isArray(ccList) ? ccList : []
      setAccounts(accList)
      setInstruments(instList)
      setCreditCards(ccards)
      setRows(Array.isArray(exp) ? exp : [])
      setExpenseCategoryId((prev) => {
        if (prev && catList.some((c) => String(c.id) === prev)) return prev
        if (catList[0]?.id) return String(catList[0].id)
        return ''
      })
      setPayWith((prev) => {
        const validPrev =
          prev &&
          ((prev.startsWith('acc:') && accList.some((a) => String(a.id) === prev.slice(4))) ||
            (prev.startsWith('pi:') &&
              instList.some((i) => String(i.id) === prev.slice(3) && i.finance_account_id != null)) ||
            (prev.startsWith('cc:') && ccards.some((c) => String(c.id) === prev.slice(3))))
        if (validPrev) return prev
        if (accList[0]?.id) return `acc:${accList[0].id}`
        if (ccards[0]?.id) return `cc:${ccards[0].id}`
        return ''
      })
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

  useEffect(() => {
    load()
  }, [load, tick])

  useEffect(() => {
    if (accountDeepLinkApplied.current || accounts.length === 0) return
    const aid = searchParams.get('account_id')
    if (!aid || !accounts.some((a) => String(a.id) === aid)) return
    setPayWith(`acc:${aid}`)
    setAddModalOpen(true)
    accountDeepLinkApplied.current = true
    const next = new URLSearchParams(searchParams)
    next.delete('account_id')
    setSearchParams(next, { replace: true })
  }, [accounts, searchParams, setSearchParams])

  const payWithSelectedCard = useMemo(() => {
    if (!payWith || !payWith.startsWith('cc:')) return null
    const id = Number(payWith.slice(3))
    if (Number.isNaN(id)) return null
    return creditCards.find((c) => c.id === id) ?? null
  }, [payWith, creditCards])

  function startEdit(r) {
    setEditingId(r.id)
    setEditAmount(String(r.amount ?? ''))
    setEditCategoryId(r.expense_category_id != null ? String(r.expense_category_id) : '')
    setEditEntryDate(r.entry_date ?? '')
    setEditDescription(r.description ?? '')
    setEditPayWith(expenseRowToPayWithValue(r, instruments))
    setEditPaidBy(r.paid_by ?? '')
    setEditPaymentStatus((r.payment_status || 'PAID').toUpperCase())
    setEditIsRecurring(Boolean(r.is_recurring))
    setEditRecurringType(r.recurring_type || 'monthly')
  }

  function cancelEdit() {
    setEditingId(null)
    setSavingId(null)
  }

  async function saveEdit(id) {
    setSavingId(id)
    setError('')
    const parsed =
      editPaymentStatus === 'PENDING' && !editPayWith
        ? { accountId: null, paymentMethod: null, paymentInstrumentId: null, creditCardId: null, kind: 'none' }
        : parsePayWith(editPayWith, accounts, instruments, creditCards)
    const body = {
      amount: Number(editAmount),
      entry_date: editEntryDate,
      description: editDescription.trim() ? editDescription.trim() : null,
      account_id: parsed.accountId,
      expense_category_id: editCategoryId === '' ? null : Number(editCategoryId),
      paid_by: editPaidBy.trim() ? editPaidBy.trim() : null,
      payment_method: parsed.paymentMethod,
      payment_instrument_id: parsed.paymentInstrumentId,
      credit_card_id: parsed.creditCardId ?? null,
      payment_status: editPaymentStatus,
      is_recurring: editIsRecurring,
      recurring_type: editIsRecurring ? editRecurringType : null,
    }
    if (!body.amount || body.amount <= 0) {
      setError('Amount must be a positive number.')
      setSavingId(null)
      return
    }
    if (editPaymentStatus === 'PAID') {
      if (!editPayWith || parsed.kind === 'invalid') {
        setError('Select a bank/cash account or a registered credit card.')
        setSavingId(null)
        return
      }
    }
    try {
      await patchFinanceExpense(id, body)
      cancelEdit()
      await load()
      refresh()
    } catch (err) {
      if (err.status === 401) {
        setPfToken(null)
        onSessionInvalid?.()
      } else {
        setError(err.message || 'Could not update expense')
      }
    } finally {
      setSavingId(null)
    }
  }

  async function handleDelete(r) {
    const ok = window.confirm(
      'Delete this expense? If it was paid from an account, that balance will be increased by this amount.',
    )
    if (!ok) return
    setDeletingId(r.id)
    setError('')
    try {
      await deleteFinanceExpense(r.id)
      if (editingId === r.id) cancelEdit()
      await load()
      refresh()
    } catch (err) {
      if (err.status === 401) {
        setPfToken(null)
        onSessionInvalid?.()
      } else {
        setError(err.message || 'Could not delete expense')
      }
    } finally {
      setDeletingId(null)
    }
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    if (categories.length === 0) {
      setError('No expense categories — restart the API once so defaults are seeded.')
      return
    }
    if (!expenseCategoryId) {
      setError('Select a category.')
      return
    }
    const parsed =
      paymentStatus === 'PENDING' && !payWith
        ? { accountId: null, paymentMethod: null, paymentInstrumentId: null, creditCardId: null, kind: 'none' }
        : parsePayWith(payWith, accounts, instruments, creditCards)
    if (paymentStatus === 'PAID') {
      if (!payWith || parsed.kind === 'invalid') {
        setError('Select a bank/cash account or a registered credit card, or set status to Pending.')
        return
      }
    }
    setSubmitting(true)
    try {
      const cat = categoryById.get(Number(expenseCategoryId))
      await createFinanceExpense({
        amount: Number(amount),
        category: cat?.name || 'general',
        expense_category_id: Number(expenseCategoryId),
        entry_date: entryDate,
        description: description.trim() || null,
        account_id: parsed.accountId,
        paid_by: paidBy.trim() || null,
        payment_method: parsed.paymentMethod,
        payment_instrument_id: parsed.paymentInstrumentId,
        credit_card_id: parsed.creditCardId ?? null,
        is_recurring: isRecurring,
        recurring_type: isRecurring ? recurringType : null,
        payment_status: paymentStatus,
      })
      setAmount('')
      setDescription('')
      setAddModalOpen(false)
      await load()
      refresh()
    } catch (err) {
      if (err.status === 401) {
        setPfToken(null)
        onSessionInvalid?.()
      } else {
        setError(err.message || 'Could not add expense')
      }
    } finally {
      setSubmitting(false)
    }
  }

  const expenseCategoryOptions = useMemo(
    () => categories.map((c) => ({ value: String(c.id), label: c.name })),
    [categories],
  )
  const expensePayWithGroups = useMemo(() => {
    const groups = []
    if (paymentStatus === 'PENDING') {
      groups.push({
        label: 'While pending',
        options: [{ value: '', label: 'Not specified', description: 'Optional until paid' }],
      })
    }
    if (accounts.length) {
      groups.push({
        label: 'Accounts (cash or bank)',
        options: accounts.map((a) => ({
          value: `acc:${a.id}`,
          label: a.account_name,
          description: paymentMethodForAccount(a) === 'cash' ? 'Cash' : 'Bank / transfer',
        })),
      })
    }
    if (creditCards.length) {
      groups.push({
        label: 'Credit cards',
        options: creditCards.map((c) => ({
          value: `cc:${c.id}`,
          label: c.card_name,
          description: c.bank_name || 'Statement balance',
        })),
      })
    }
    if (groups.length === 0) {
      groups.push({
        label: '—',
        options: [{ value: '', label: 'No accounts or cards', description: 'Add them under Accounts / Credit cards', disabled: true }],
      })
    }
    return groups
  }, [accounts, creditCards, paymentStatus])
  const recurringTypeExpenseOptions = useMemo(
    () => [
      { value: 'monthly', label: 'Monthly' },
      { value: 'weekly', label: 'Weekly' },
    ],
    [],
  )

  async function handleExpenseExport() {
    setExpenseExportBusy(true)
    try {
      const qs = buildIncomeExpenseExportQuery(expenseDateFilter, filterCustomStart, filterCustomEnd)
      const { blob, filename } = await pfFetchBlob(`/pf/export/expenses/excel${qs}`)
      triggerDownloadBlob(blob, filename || 'Expenses_export.xlsx')
    } catch (e) {
      if (e.status === 401) {
        setPfToken(null)
        onSessionInvalid?.()
      } else {
        window.alert(e.message || 'Export failed')
      }
    } finally {
      setExpenseExportBusy(false)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <h1 className="text-xl font-bold text-slate-900 dark:text-slate-100 sm:text-2xl">Expenses</h1>
        <div className="flex flex-wrap items-center gap-2 md:justify-end">
          <PfExportMenu
            busy={expenseExportBusy}
            items={[{ key: 'xlsx', label: 'Export Excel', onClick: handleExpenseExport }]}
          />
          <button
            type="button"
            onClick={() => setAddModalOpen(true)}
            className="inline-flex shrink-0 items-center justify-center gap-2 rounded-[12px] bg-[#1E3A8A] px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-[#172554] active:scale-[0.98] md:self-start dark:bg-[var(--pf-primary)] dark:hover:bg-[var(--pf-primary-hover)]"
          >
            <PlusCircleIcon className="h-5 w-5" />
            Add expense
          </button>
        </div>
      </div>

      {error ? (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">{error}</div>
      ) : null}

      <AppModal
        open={addModalOpen}
        onClose={() => !submitting && setAddModalOpen(false)}
        title="Add expense"
        subtitle="Record spend — debits the selected account or posts to a card’s unbilled charges."
        maxWidthClass="max-w-lg"
        footer={
          <>
            <AppButton type="button" variant="secondary" disabled={submitting} onClick={() => setAddModalOpen(false)}>
              Cancel
            </AppButton>
            <AppButton type="submit" variant="primary" disabled={submitting} form="pf-expense-add-form">
              {submitting ? 'Saving…' : 'Add expense'}
            </AppButton>
          </>
        }
      >
        <form id="pf-expense-add-form" onSubmit={handleSubmit} className="space-y-6">
          <div className="grid gap-4 sm:grid-cols-3">
            <AppInput
              id="exp-amt"
              label="Amount (₹)"
              type="number"
              inputMode="decimal"
              step="0.01"
              min="0"
              amount
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              required
            />
            <div>
              <label htmlFor="exp-cat-dd" className={labelCls}>
                Category
              </label>
              <AppDropdown
                id="exp-cat-dd"
                value={expenseCategoryId}
                onChange={setExpenseCategoryId}
                options={expenseCategoryOptions}
                placeholder="— Select —"
                aria-label="Expense category"
              />
            </div>
            <AppInput
              id="exp-date"
              label="Date"
              type="date"
              variant="boxed"
              value={entryDate}
              onChange={(e) => setEntryDate(e.target.value)}
              required
            />
          </div>
          <div className="grid gap-4 sm:grid-cols-3">
            <div className="sm:col-span-2">
              <label htmlFor="exp-paywith-dd" className={labelCls}>
                Pay with
              </label>
              <AppDropdown
                id="exp-paywith-dd"
                value={payWith}
                onChange={setPayWith}
                groups={expensePayWithGroups}
                placeholder="Select funding source"
                aria-label="Pay with"
              />
              {paymentStatus === 'PAID' && accounts.length === 0 && creditCards.length === 0 ? (
                <p className="mt-1 text-xs text-amber-800 dark:text-amber-200">
                  Add at least one finance account (Accounts) or register a credit card (Credit cards) first.
                </p>
              ) : null}
              {paymentStatus === 'PAID' && payWith.startsWith('acc:') ? (
                <p className="mt-1 text-xs text-sky-800 dark:text-sky-200">
                  This amount will be <strong>debited</strong> from the selected bank or cash account balance.
                </p>
              ) : null}
              {paymentStatus === 'PAID' && payWithSelectedCard ? (
                <p className="mt-1 text-xs text-sky-800 dark:text-sky-200">
                  Credit card: this amount is added to <strong>unbilled charges</strong> on this card (your used limit / available limit updates on the
                  Credit cards page). The bank account is <strong>not</strong> debited until you record a statement payment.
                  {payWithSelectedCard.card_limit != null && Number(payWithSelectedCard.card_limit) > 0 ? (
                    <>
                      {' '}
                      Registered limit: <strong>{formatInr(payWithSelectedCard.card_limit)}</strong>.
                    </>
                  ) : null}
                </p>
              ) : null}
            </div>
            <AppInput id="exp-paid" label="Paid by" value={paidBy} onChange={(e) => setPaidBy(e.target.value)} placeholder="e.g. Satya, Brother" />
          </div>
          <AppTextarea id="exp-desc" label="Description" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Notes" rows={2} />
          <div className="flex flex-wrap items-center gap-4">
            <label className="flex cursor-pointer items-center gap-2 text-sm font-medium text-[var(--pf-text)]">
              <input
                type="checkbox"
                className="h-4 w-4 rounded border-[var(--pf-border)] text-[var(--pf-primary)]"
                checked={isRecurring}
                onChange={(e) => setIsRecurring(e.target.checked)}
              />
              Recurring expense
            </label>
            {isRecurring ? (
              <div className="min-w-[12rem] flex-1">
                <span className={labelCls}>Cadence</span>
                <AppDropdown
                  value={recurringType}
                  onChange={setRecurringType}
                  options={recurringTypeExpenseOptions}
                  aria-label="Recurring type"
                />
              </div>
            ) : null}
          </div>
          <div>
            <span className={labelCls}>Status</span>
            <div className="mt-2 flex gap-4 text-sm text-[var(--pf-text)]">
              <label className="flex items-center gap-2">
                <input type="radio" name="pay-st" checked={paymentStatus === 'PAID'} onChange={() => setPaymentStatus('PAID')} />
                Paid
              </label>
              <label className="flex items-center gap-2">
                <input type="radio" name="pay-st" checked={paymentStatus === 'PENDING'} onChange={() => setPaymentStatus('PENDING')} />
                Pending
              </label>
            </div>
          </div>
        </form>
      </AppModal>

      <div className={cardCls}>
        <h2 className="text-base font-bold text-slate-900">Transactions</h2>
        <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
          <div className="flex flex-wrap gap-1.5">
            {[
              { id: 'all', label: 'All' },
              { id: 'today', label: 'Today' },
              { id: 'week', label: 'Week' },
              { id: 'month', label: 'Month' },
              { id: 'custom', label: 'Custom' },
            ].map(({ id, label }) => (
              <button
                key={id}
                type="button"
                onClick={() => setExpenseDateFilter(id)}
                className={`rounded-full px-3 py-1.5 text-xs font-semibold transition duration-200 active:scale-[0.98] ${
                  expenseDateFilter === id
                    ? 'bg-[#1E3A8A] text-white shadow-sm'
                    : 'bg-slate-100 text-slate-700 hover:bg-slate-200/80'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
          {expenseDateFilter === 'custom' ? (
            <div className="flex flex-wrap items-center gap-2">
              <input
                type="date"
                className={`${pfSelectCompact} max-w-[10rem]`}
                value={filterCustomStart}
                onChange={(e) => setFilterCustomStart(e.target.value)}
                aria-label="Filter from date"
              />
              <span className="text-xs text-slate-500">to</span>
              <input
                type="date"
                className={`${pfSelectCompact} max-w-[10rem]`}
                value={filterCustomEnd}
                onChange={(e) => setFilterCustomEnd(e.target.value)}
                aria-label="Filter to date"
              />
            </div>
          ) : null}
        </div>

        {!loading && rows.length > 0 && filteredExpenseRows.length === 0 ? (
          <p className="mt-4 text-center text-sm text-slate-500">No expenses in this period.</p>
        ) : null}

        {!loading && filteredExpenseRows.length > 0 && editingId == null ? (
          <div className="mt-4 space-y-3 md:hidden">
            {filteredExpenseRows.map((r) => {
              const payLine = payLineForRow(r)
              return (
                <div
                  key={r.id}
                  className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm transition active:scale-[0.99]"
                >
                  <div className="flex items-start justify-between gap-2">
                    <span className="min-w-0 flex-1 font-semibold text-slate-900">{r.category || '—'}</span>
                    <span className="shrink-0 font-mono text-base font-bold tabular-nums text-[#EF4444]">
                      {formatInr(r.amount)}
                    </span>
                  </div>
                  <div className="mt-2 flex items-center justify-between text-xs text-slate-500">
                    <span className="tabular-nums">
                      {r.entry_date
                        ? new Date(`${r.entry_date}T12:00:00`).toLocaleDateString('en-IN', {
                            day: 'numeric',
                            month: 'short',
                            year: 'numeric',
                          })
                        : '—'}
                    </span>
                    <span className="rounded-full bg-slate-100 px-2 py-0.5 font-medium text-slate-600">{payLine}</span>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2 border-t border-slate-100 pt-3">
                    <button
                      type="button"
                      onClick={() => startEdit(r)}
                      className="rounded-[12px] border border-slate-200 px-3 py-1.5 text-xs font-semibold text-[#1E3A8A]"
                    >
                      Edit
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDelete(r)}
                      disabled={deletingId === r.id}
                      className="rounded-[12px] border border-red-200 px-3 py-1.5 text-xs font-semibold text-red-700 disabled:opacity-50"
                    >
                      {deletingId === r.id ? '…' : 'Delete'}
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        ) : null}

        <div className={`${pfTableWrap} mt-4 ${editingId != null ? 'block' : 'hidden'} md:block`}>
          <table className={`${pfTable} min-w-[48rem]`}>
            <thead>
              <tr>
                <th className={pfTh}>Date</th>
                <th className={pfTh}>Category</th>
                <th className={pfTh}>Paid by</th>
                <th className={pfTh}>Paid with</th>
                <th className={pfTh}>Status</th>
                <th className={pfThRight}>Amount</th>
                <th className={`${pfThRight} ${pfThActions}`}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-slate-500">
                    Loading…
                  </td>
                </tr>
              ) : rows.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-slate-500">
                    No expenses yet.
                  </td>
                </tr>
              ) : filteredExpenseRows.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-slate-500">
                    No expenses in this period — try another filter.
                  </td>
                </tr>
              ) : (
                filteredExpenseRows.map((r) =>
                  editingId === r.id ? (
                    <tr key={r.id} className="align-top">
                      <td className="p-0" colSpan={7}>
                        <div className="grid gap-3 rounded-xl border border-sky-200/70 bg-sky-50/40 p-3 sm:grid-cols-2 lg:grid-cols-3">
                          <input
                            type="date"
                            className={inputCls}
                            value={editEntryDate}
                            onChange={(e) => setEditEntryDate(e.target.value)}
                          />
                          <select
                            className={inputCls}
                            value={editCategoryId}
                            onChange={(e) => setEditCategoryId(e.target.value)}
                          >
                            <option value="">Category…</option>
                            {categories.map((c) => (
                              <option key={c.id} value={String(c.id)}>
                                {c.name}
                              </option>
                            ))}
                          </select>
                          <input
                            type="number"
                            inputMode="decimal"
                            step="0.01"
                            min="0"
                            className={`${inputCls} font-mono`}
                            value={editAmount}
                            onChange={(e) => setEditAmount(e.target.value)}
                          />
                          <select
                            className={`${inputCls} sm:col-span-2`}
                            value={editPayWith}
                            onChange={(e) => setEditPayWith(e.target.value)}
                          >
                            {editPaymentStatus === 'PENDING' ? (
                              <option value="">— Optional while pending —</option>
                            ) : null}
                            {accounts.length ? (
                              <optgroup label="Accounts">
                                {accounts.map((a) => {
                                  const sub = paymentMethodForAccount(a) === 'cash' ? 'Cash' : 'Bank / transfer'
                                  return (
                                    <option key={`e-acc-${a.id}`} value={`acc:${a.id}`}>
                                      {a.account_name} · {sub}
                                    </option>
                                  )
                                })}
                              </optgroup>
                            ) : null}
                            {instruments.some((i) => i.finance_account_id != null) ? (
                              <optgroup label="Saved card/UPI (legacy — old expenses only)">
                                {instruments
                                  .filter((i) => i.finance_account_id != null)
                                  .map((i) => {
                                    const kindLabel = i.kind === 'card' ? 'Card' : 'UPI'
                                    const accNm =
                                      accountNameById.get(i.finance_account_id) ?? `#${i.finance_account_id}`
                                    return (
                                      <option key={`e-pi-${i.id}`} value={`pi:${i.id}`}>
                                        {kindLabel}: {i.label} · {accNm}
                                      </option>
                                    )
                                  })}
                              </optgroup>
                            ) : null}
                            {creditCards.length ? (
                              <optgroup label="Registered credit cards (statement)">
                                {creditCards.map((c) => (
                                  <option key={`e-cc-${c.id}`} value={`cc:${c.id}`}>
                                    {c.card_name}
                                    {c.bank_name ? ` · ${c.bank_name}` : ''}
                                  </option>
                                ))}
                              </optgroup>
                            ) : null}
                          </select>
                          <input
                            className={inputCls}
                            value={editPaidBy}
                            onChange={(e) => setEditPaidBy(e.target.value)}
                            placeholder="Paid by"
                          />
                          <select
                            className={inputCls}
                            value={editPaymentStatus}
                            onChange={(e) => setEditPaymentStatus(e.target.value)}
                          >
                            <option value="PAID">Paid</option>
                            <option value="PENDING">Pending</option>
                          </select>
                          <label className="flex items-center gap-2 text-sm">
                            <input
                              type="checkbox"
                              checked={editIsRecurring}
                              onChange={(e) => setEditIsRecurring(e.target.checked)}
                            />
                            Recurring
                          </label>
                          {editIsRecurring ? (
                            <select
                              className={inputCls}
                              value={editRecurringType}
                              onChange={(e) => setEditRecurringType(e.target.value)}
                            >
                              <option value="monthly">Monthly</option>
                              <option value="weekly">Weekly</option>
                            </select>
                          ) : null}
                          <input
                            className={`${inputCls} sm:col-span-2`}
                            value={editDescription}
                            onChange={(e) => setEditDescription(e.target.value)}
                            placeholder="Description"
                          />
                          <div className="flex flex-wrap gap-2 sm:col-span-3">
                            <button
                              type="button"
                              onClick={() => saveEdit(r.id)}
                              disabled={savingId === r.id}
                              className="rounded-[12px] bg-[#1E3A8A] px-3 py-1.5 text-xs font-semibold text-white hover:bg-[#172554] disabled:opacity-60"
                            >
                              {savingId === r.id ? '…' : 'Save'}
                            </button>
                            <button
                              type="button"
                              onClick={cancelEdit}
                              disabled={savingId === r.id}
                              className="rounded-lg border border-sky-200 px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-sky-50"
                            >
                              Cancel
                            </button>
                          </div>
                        </div>
                      </td>
                    </tr>
                  ) : (
                    <tr key={r.id} className={pfTrHover}>
                      <td className={`${pfTd} whitespace-nowrap text-slate-600`}>{r.entry_date}</td>
                      <td className={pfTd}>
                        <span
                          className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold ring-1 ring-inset ${categoryBadgeClass(r.category_color)}`}
                        >
                          <PfCategoryIcon name={r.category_icon} className="h-3.5 w-3.5 shrink-0 opacity-90" />
                          {r.category}
                        </span>
                        {r.is_recurring ? (
                          <span className="ml-1 text-[10px] font-semibold uppercase text-sky-600">
                            · {r.recurring_type || 'recurring'}
                          </span>
                        ) : null}
                      </td>
                      <td className={`${pfTd} text-slate-700`}>{r.paid_by || '—'}</td>
                      <td className={`${pfTd} text-slate-600`}>
                        <span>{methodDisplayLabel(r.payment_method)}</span>
                        {r.credit_card_label ? (
                          <span className="mt-0.5 block text-xs font-medium text-slate-500">
                            → {r.credit_card_label}
                          </span>
                        ) : null}
                        {r.payment_instrument_label ? (
                          <span className="mt-0.5 block text-xs font-medium text-slate-500">
                            → {r.payment_instrument_label}
                          </span>
                        ) : null}
                        {r.account_id != null ? (
                          <span className="mt-0.5 block text-xs text-slate-500">
                            {accountNameById.get(r.account_id) ?? `#${r.account_id}`}
                          </span>
                        ) : null}
                      </td>
                      <td className={pfTd}>
                        <span
                          className={
                            (r.payment_status || 'PAID').toUpperCase() === 'PENDING'
                              ? 'rounded-full bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-900'
                              : 'rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-semibold text-emerald-900'
                          }
                        >
                          {(r.payment_status || 'PAID').toUpperCase() === 'PENDING' ? 'Pending' : 'Paid'}
                        </span>
                      </td>
                      <td className={pfTdRight}>{formatInr(r.amount)}</td>
                      <td className={pfTdActions}>
                        <div className={pfActionRow}>
                          <button
                            type="button"
                            onClick={() => startEdit(r)}
                            className="inline-flex items-center gap-1 rounded-[12px] border border-slate-200 px-2 py-1 text-xs font-semibold text-[#1E3A8A] hover:bg-slate-50"
                          >
                            <PencilSquareIcon className="h-4 w-4" />
                            Edit
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDelete(r)}
                            disabled={deletingId === r.id}
                            className="inline-flex items-center gap-1 rounded-lg border border-red-200 px-2 py-1 text-xs font-semibold text-red-700 hover:bg-red-50 disabled:opacity-60"
                          >
                            <TrashIcon className="h-4 w-4" />
                            {deletingId === r.id ? '…' : 'Delete'}
                          </button>
                        </div>
                      </td>
                    </tr>
                  ),
                )
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
