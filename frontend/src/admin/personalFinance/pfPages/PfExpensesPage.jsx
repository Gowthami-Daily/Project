import { PencilSquareIcon, PlusCircleIcon, TrashIcon } from '@heroicons/react/24/solid'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { useOutletContext } from 'react-router-dom'
import {
  createFinanceExpense,
  createPfPaymentInstrument,
  deleteFinanceExpense,
  deletePfPaymentInstrument,
  listFinanceAccounts,
  listFinanceExpenses,
  listPfExpenseCategories,
  listPfPaymentInstruments,
  patchFinanceExpense,
  pfFetchBlob,
  setPfToken,
  triggerDownloadBlob,
} from '../api.js'
import PfExportMenu from '../PfExportMenu.jsx'
import { buildIncomeExpenseExportQuery } from '../pfExportRange.js'
import { PfCategoryIcon, categoryBadgeClass } from '../pfCategoryIcons.jsx'
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
  { value: 'card', label: 'Credit card' },
  { value: 'upi', label: 'UPI / Bank UPI' },
  { value: 'bank_transfer', label: 'Bank transfer' },
]

function methodDisplayLabel(value) {
  return PAY_METHODS.find((m) => m.value === value)?.label ?? value ?? '—'
}

function paymentMethodForAccount(account) {
  if (!account) return 'bank_transfer'
  const t = String(account.account_type || '').toLowerCase()
  if (t.includes('cash') || t.includes('wallet') || t === 'petty' || t === 'hand') return 'cash'
  return 'bank_transfer'
}

/** Map unified "Pay with" value to API fields. */
function parsePayWith(value, accounts, instruments) {
  if (!value || typeof value !== 'string') {
    return { accountId: null, paymentMethod: null, paymentInstrumentId: null, kind: 'none' }
  }
  if (value.startsWith('pi:')) {
    const id = Number(value.slice(3))
    const inst = instruments.find((i) => i.id === id)
    if (!inst || inst.finance_account_id == null) {
      return { accountId: null, paymentMethod: 'card', paymentInstrumentId: null, kind: 'invalid' }
    }
    return {
      accountId: inst.finance_account_id,
      paymentMethod: inst.kind,
      paymentInstrumentId: id,
      kind: 'pi',
    }
  }
  if (value.startsWith('acc:')) {
    const id = Number(value.slice(4))
    const acc = accounts.find((a) => a.id === id)
    if (!acc) {
      return { accountId: null, paymentMethod: null, paymentInstrumentId: null, kind: 'invalid' }
    }
    return {
      accountId: id,
      paymentMethod: paymentMethodForAccount(acc),
      paymentInstrumentId: null,
      kind: 'acc',
    }
  }
  return { accountId: null, paymentMethod: null, paymentInstrumentId: null, kind: 'invalid' }
}

function expenseRowToPayWithValue(r, instruments) {
  const pm = (r.payment_method || '').toLowerCase()
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
  const [showAddForm, setShowAddForm] = useState(false)
  const [categories, setCategories] = useState([])
  const [accounts, setAccounts] = useState([])
  const [instruments, setInstruments] = useState([])
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [addingInstrument, setAddingInstrument] = useState(false)
  const [newInstrumentKind, setNewInstrumentKind] = useState('card')
  const [newInstrumentLabel, setNewInstrumentLabel] = useState('')
  const [newInstrumentAccountId, setNewInstrumentAccountId] = useState('')
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

  const instrumentsMissingAccount = useMemo(
    () => instruments.filter((i) => i.finance_account_id == null),
    [instruments],
  )

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
      const [cats, accs, inst, exp] = await Promise.all([
        listPfExpenseCategories(),
        listFinanceAccounts(),
        listPfPaymentInstruments(),
        listFinanceExpenses(),
      ])
      const catList = Array.isArray(cats) ? cats : []
      setCategories(catList)
      const accList = Array.isArray(accs) ? accs : []
      const instList = Array.isArray(inst) ? inst : []
      setAccounts(accList)
      setInstruments(instList)
      setRows(Array.isArray(exp) ? exp : [])
      setExpenseCategoryId((prev) => {
        if (prev && catList.some((c) => String(c.id) === prev)) return prev
        if (catList[0]?.id) return String(catList[0].id)
        return ''
      })
      setNewInstrumentAccountId((prev) => {
        if (prev && accList.some((a) => String(a.id) === prev)) return prev
        if (accList[0]?.id) return String(accList[0].id)
        return ''
      })
      setPayWith((prev) => {
        const validPrev =
          prev &&
          ((prev.startsWith('acc:') && accList.some((a) => String(a.id) === prev.slice(4))) ||
            (prev.startsWith('pi:') &&
              instList.some((i) => String(i.id) === prev.slice(3) && i.finance_account_id != null)))
        if (validPrev) return prev
        if (accList[0]?.id) return `acc:${accList[0].id}`
        const firstPi = instList.find((i) => i.finance_account_id != null)
        return firstPi ? `pi:${firstPi.id}` : ''
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

  async function handleAddSavedInstrument(e) {
    e?.preventDefault?.()
    const label = newInstrumentLabel.trim()
    if (!label) {
      setError('Enter a name for this card or UPI.')
      return
    }
    if (!newInstrumentAccountId) {
      setError('Select which bank or cash account this card or UPI draws from.')
      return
    }
    setAddingInstrument(true)
    setError('')
    try {
      await createPfPaymentInstrument({
        kind: newInstrumentKind,
        label,
        finance_account_id: Number(newInstrumentAccountId),
      })
      setNewInstrumentLabel('')
      const list = await listPfPaymentInstruments()
      setInstruments(Array.isArray(list) ? list : [])
      refresh()
    } catch (err) {
      if (err.status === 401) {
        setPfToken(null)
        onSessionInvalid?.()
      } else {
        setError(err.message || 'Could not save payment method')
      }
    } finally {
      setAddingInstrument(false)
    }
  }

  async function handleDeleteInstrument(id, e) {
    e?.stopPropagation?.()
    if (!window.confirm('Remove this saved card/UPI? Past expenses stay; new entries won’t list it.')) return
    try {
      await deletePfPaymentInstrument(id)
      setPayWith((prev) => (prev === `pi:${id}` ? (accounts[0]?.id ? `acc:${accounts[0].id}` : '') : prev))
      const list = await listPfPaymentInstruments()
      setInstruments(Array.isArray(list) ? list : [])
      refresh()
    } catch (err) {
      if (err.status === 401) {
        setPfToken(null)
        onSessionInvalid?.()
      } else {
        setError(err.message || 'Could not delete')
      }
    }
  }

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
        ? { accountId: null, paymentMethod: null, paymentInstrumentId: null, kind: 'none' }
        : parsePayWith(editPayWith, accounts, instruments)
    const body = {
      amount: Number(editAmount),
      entry_date: editEntryDate,
      description: editDescription.trim() ? editDescription.trim() : null,
      account_id: parsed.accountId,
      expense_category_id: editCategoryId === '' ? null : Number(editCategoryId),
      paid_by: editPaidBy.trim() ? editPaidBy.trim() : null,
      payment_method: parsed.paymentMethod,
      payment_instrument_id: parsed.paymentInstrumentId,
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
        setError('Select how you paid (account, card, or UPI).')
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
        ? { accountId: null, paymentMethod: null, paymentInstrumentId: null, kind: 'none' }
        : parsePayWith(payWith, accounts, instruments)
    if (paymentStatus === 'PAID') {
      if (!payWith || parsed.kind === 'invalid') {
        setError('Select how you paid (account, card, or UPI), or set status to Pending.')
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
        is_recurring: isRecurring,
        recurring_type: isRecurring ? recurringType : null,
        payment_status: paymentStatus,
      })
      setAmount('')
      setDescription('')
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

  const formCardHeader = 'border-b border-slate-200 bg-slate-50/80 px-4 py-3 sm:px-5'
  const formSection = 'border-b border-slate-100 px-4 py-4 sm:px-5'

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
            onClick={() => setShowAddForm((v) => !v)}
            className="inline-flex shrink-0 items-center justify-center gap-2 rounded-[12px] bg-[#1E3A8A] px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-[#172554] active:scale-[0.98] md:self-start"
          >
            <PlusCircleIcon className="h-5 w-5" />
            {showAddForm ? 'Close add form' : 'Add expense'}
          </button>
        </div>
      </div>

      {error ? (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">{error}</div>
      ) : null}

      {showAddForm ? (
      <div className={`${cardCls} overflow-hidden p-0`}>
        <div className={formCardHeader}>
          <h2 className="text-base font-bold text-slate-900">Add expense</h2>
          <p className="mt-0.5 text-xs text-slate-500">
            <strong className="font-medium text-slate-700">Pay with</strong> combines account and method (cards/UPIs must be saved with a linked account below).
          </p>
        </div>
        <form onSubmit={handleSubmit}>
          <div className={`${formSection} grid gap-4 sm:grid-cols-3`}>
            <div>
              <label htmlFor="exp-amt" className={labelCls}>
                Amount (₹)
              </label>
              <input
                id="exp-amt"
                type="number"
                inputMode="decimal"
                step="0.01"
                min="0"
                className={inputCls}
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                required
              />
            </div>
            <div>
              <label htmlFor="exp-cat" className={labelCls}>
                Category
              </label>
              <select
                id="exp-cat"
                className={inputCls}
                value={expenseCategoryId}
                onChange={(e) => setExpenseCategoryId(e.target.value)}
                required
              >
                <option value="">— Select —</option>
                {categories.map((c) => (
                  <option key={c.id} value={String(c.id)}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="exp-date" className={labelCls}>
                Date
              </label>
              <input
                id="exp-date"
                type="date"
                className={inputCls}
                value={entryDate}
                onChange={(e) => setEntryDate(e.target.value)}
                required
              />
            </div>
          </div>
          <div className={`${formSection} grid gap-4 sm:grid-cols-3`}>
            <div className="sm:col-span-2">
              <label htmlFor="exp-paywith" className={labelCls}>
                Pay with
              </label>
              <select
                id="exp-paywith"
                className={inputCls}
                value={payWith}
                onChange={(e) => setPayWith(e.target.value)}
              >
                {paymentStatus === 'PENDING' ? (
                  <option value="">— Optional while pending —</option>
                ) : null}
                {accounts.length ? (
                  <optgroup label="Accounts (cash or bank)">
                    {accounts.map((a) => {
                      const sub = paymentMethodForAccount(a) === 'cash' ? 'Cash' : 'Bank / transfer'
                      return (
                        <option key={`acc-${a.id}`} value={`acc:${a.id}`}>
                          {a.account_name} · {sub}
                        </option>
                      )
                    })}
                  </optgroup>
                ) : null}
                {instruments.some((i) => i.finance_account_id != null) ? (
                  <optgroup label="Saved cards & UPI">
                    {instruments
                      .filter((i) => i.finance_account_id != null)
                      .map((i) => {
                        const kindLabel = i.kind === 'card' ? 'Credit card' : 'UPI'
                        const accNm =
                          accountNameById.get(i.finance_account_id) ?? `#${i.finance_account_id}`
                        return (
                          <option key={`pi-${i.id}`} value={`pi:${i.id}`}>
                            {kindLabel}: {i.label} · {accNm}
                          </option>
                        )
                      })}
                  </optgroup>
                ) : null}
              </select>
              {paymentStatus === 'PAID' && accounts.length === 0 && !instruments.some((i) => i.finance_account_id != null) ? (
                <p className="mt-1 text-xs text-amber-800">Add a finance account or a saved card/UPI first.</p>
              ) : null}
              {instrumentsMissingAccount.length > 0 ? (
                <p className="mt-1 text-xs text-amber-800">
                  {instrumentsMissingAccount.length} saved card/UPI
                  {instrumentsMissingAccount.length > 1 ? 's' : ''} missing a linked account — delete and save again with an account below.
                </p>
              ) : null}
            </div>
            <div>
              <label htmlFor="exp-paid" className={labelCls}>
                Paid by
              </label>
              <input
                id="exp-paid"
                className={inputCls}
                value={paidBy}
                onChange={(e) => setPaidBy(e.target.value)}
                placeholder="e.g. Satya, Brother"
              />
            </div>
          </div>
          <div className={`${formSection} space-y-3`}>
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Save cards & UPIs for reuse</p>
            <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end">
              <div className="min-w-[8rem]">
                <label htmlFor="exp-new-kind" className={labelCls}>
                  Type
                </label>
                <select
                  id="exp-new-kind"
                  className={inputCls}
                  value={newInstrumentKind}
                  onChange={(e) => setNewInstrumentKind(e.target.value)}
                >
                  <option value="card">Credit card</option>
                  <option value="upi">UPI</option>
                </select>
              </div>
              <div className="min-w-[10rem]">
                <label htmlFor="exp-new-acc" className={labelCls}>
                  Draws from account
                </label>
                <select
                  id="exp-new-acc"
                  className={inputCls}
                  value={newInstrumentAccountId}
                  onChange={(e) => setNewInstrumentAccountId(e.target.value)}
                >
                  <option value="">— Select —</option>
                  {accounts.map((a) => (
                    <option key={`ni-${a.id}`} value={String(a.id)}>
                      {a.account_name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="min-w-[12rem] flex-1">
                <label htmlFor="exp-new-label" className={labelCls}>
                  Name (e.g. HDFC Regalia, GPay personal)
                </label>
                <input
                  id="exp-new-label"
                  className={inputCls}
                  value={newInstrumentLabel}
                  onChange={(e) => setNewInstrumentLabel(e.target.value)}
                  placeholder="Short label"
                />
              </div>
              <button
                type="button"
                disabled={addingInstrument}
                onClick={handleAddSavedInstrument}
                className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-800 hover:bg-slate-50 disabled:opacity-60"
              >
                {addingInstrument ? 'Saving…' : 'Save'}
              </button>
            </div>
            {instruments.length > 0 ? (
              <ul className="flex flex-wrap gap-2 text-xs">
                {instruments.map((i) => (
                  <li
                    key={i.id}
                    className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-1 text-slate-700"
                  >
                    <span className="font-medium capitalize text-slate-500">{i.kind}:</span>
                    {i.label}
                    <button
                      type="button"
                      className="ml-0.5 rounded p-0.5 text-red-600 hover:bg-red-50"
                      title="Remove"
                      onClick={(e) => handleDeleteInstrument(i.id, e)}
                    >
                      ×
                    </button>
                  </li>
                ))}
              </ul>
            ) : null}
          </div>
          <div className={formSection}>
            <label htmlFor="exp-desc" className={labelCls}>
              Description
            </label>
            <input
              id="exp-desc"
              className={inputCls}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Notes"
            />
          </div>
          <div className={`${formSection} flex flex-wrap items-center gap-4`}>
            <label className="flex cursor-pointer items-center gap-2 text-sm font-medium text-slate-700">
              <input
                type="checkbox"
                className="h-4 w-4 rounded border-slate-300"
                checked={isRecurring}
                onChange={(e) => setIsRecurring(e.target.checked)}
              />
              Recurring expense
            </label>
            {isRecurring ? (
              <select
                className={`${inputCls} max-w-[12rem]`}
                value={recurringType}
                onChange={(e) => setRecurringType(e.target.value)}
                aria-label="Recurring type"
              >
                <option value="monthly">Monthly</option>
                <option value="weekly">Weekly</option>
              </select>
            ) : null}
          </div>
          <div className={`${formSection} flex flex-wrap items-center gap-4`}>
            <div>
              <span className={labelCls}>Status</span>
              <div className="mt-1 flex gap-3 text-sm">
                <label className="flex items-center gap-1.5">
                  <input
                    type="radio"
                    name="pay-st"
                    checked={paymentStatus === 'PAID'}
                    onChange={() => setPaymentStatus('PAID')}
                  />
                  Paid
                </label>
                <label className="flex items-center gap-1.5">
                  <input
                    type="radio"
                    name="pay-st"
                    checked={paymentStatus === 'PENDING'}
                    onChange={() => setPaymentStatus('PENDING')}
                  />
                  Pending
                </label>
              </div>
            </div>
          </div>
          <div className="px-4 py-4 sm:px-5">
            <button type="submit" disabled={submitting} className={btnPrimary}>
              {submitting ? 'Saving…' : 'Add expense'}
            </button>
          </div>
        </form>
      </div>
      ) : null}

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
              const payLine = r.payment_instrument_label
                ? `${methodDisplayLabel(r.payment_method)} · ${r.payment_instrument_label}`
                : methodDisplayLabel(r.payment_method)
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
                              <optgroup label="Cards & UPI">
                                {instruments
                                  .filter((i) => i.finance_account_id != null)
                                  .map((i) => {
                                    const kindLabel = i.kind === 'card' ? 'Credit card' : 'UPI'
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
