import { PencilSquareIcon, PlusCircleIcon, TrashIcon } from '@heroicons/react/24/solid'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useOutletContext, useSearchParams } from 'react-router-dom'
import {
  createFinanceIncome,
  deleteFinanceIncome,
  listFinanceAccounts,
  listFinanceIncome,
  listPfIncomeCategories,
  patchFinanceIncome,
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
  { value: 'bank_transfer', label: 'Bank' },
  { value: 'upi', label: 'UPI' },
  { value: 'card', label: 'Card' },
]

export default function PfIncomePage() {
  const { onSessionInvalid } = useOutletContext() || {}
  const { tick, refresh } = usePfRefresh()
  const [searchParams, setSearchParams] = useSearchParams()
  const accountDeepLinkApplied = useRef(false)
  const [addModalOpen, setAddModalOpen] = useState(false)
  const [categories, setCategories] = useState([])
  const [accounts, setAccounts] = useState([])
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [amount, setAmount] = useState('')
  const [incomeCategoryId, setIncomeCategoryId] = useState('')
  const [incomeType, setIncomeType] = useState('recurring')
  const [entryDate, setEntryDate] = useState(todayISODate)
  const [description, setDescription] = useState('')
  const [accountId, setAccountId] = useState('')
  const [receivedFrom, setReceivedFrom] = useState('')
  const [paymentMethod, setPaymentMethod] = useState('bank_transfer')
  const [isRecurring, setIsRecurring] = useState(false)
  const [recurringType, setRecurringType] = useState('monthly')

  const [editingId, setEditingId] = useState(null)
  const [editAmount, setEditAmount] = useState('')
  const [editCategoryId, setEditCategoryId] = useState('')
  const [editIncomeType, setEditIncomeType] = useState('')
  const [editEntryDate, setEditEntryDate] = useState('')
  const [editDescription, setEditDescription] = useState('')
  const [editAccountId, setEditAccountId] = useState('')
  const [editReceivedFrom, setEditReceivedFrom] = useState('')
  const [editPaymentMethod, setEditPaymentMethod] = useState('bank_transfer')
  const [editIsRecurring, setEditIsRecurring] = useState(false)
  const [editRecurringType, setEditRecurringType] = useState('monthly')
  const [savingId, setSavingId] = useState(null)
  const [deletingId, setDeletingId] = useState(null)
  const [incomeExportBusy, setIncomeExportBusy] = useState(false)
  const [incomeDateFilter, setIncomeDateFilter] = useState('month')
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

  const filteredIncomeRows = useMemo(() => {
    if (incomeDateFilter === 'all') return rows
    const t = todayISODate()
    if (incomeDateFilter === 'today') return rows.filter((r) => r.entry_date === t)
    if (incomeDateFilter === 'month') {
      const prefix = t.slice(0, 7)
      return rows.filter((r) => (r.entry_date || '').startsWith(prefix))
    }
    if (incomeDateFilter === 'week') {
      const end = new Date()
      const start = new Date(end)
      start.setDate(end.getDate() - 6)
      const startStr = start.toISOString().slice(0, 10)
      return rows.filter((r) => {
        const d = r.entry_date
        return d && d >= startStr && d <= t
      })
    }
    if (incomeDateFilter === 'custom' && filterCustomStart && filterCustomEnd) {
      return rows.filter(
        (r) => r.entry_date && r.entry_date >= filterCustomStart && r.entry_date <= filterCustomEnd,
      )
    }
    if (incomeDateFilter === 'custom') return rows
    return rows
  }, [rows, incomeDateFilter, filterCustomStart, filterCustomEnd])

  function paymentMethodLabel(v) {
    return PAY_METHODS.find((m) => m.value === v)?.label ?? v ?? '—'
  }

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const [cats, accs, inc] = await Promise.all([
        listPfIncomeCategories(),
        listFinanceAccounts(),
        listFinanceIncome(),
      ])
      const catList = Array.isArray(cats) ? cats : []
      setCategories(catList)
      const accList = Array.isArray(accs) ? accs : []
      setAccounts(accList)
      setRows(Array.isArray(inc) ? inc : [])
      setIncomeCategoryId((prev) => {
        if (prev && catList.some((c) => String(c.id) === prev)) return prev
        const sal = catList.find((c) => c.name === 'Salary')
        if (sal) return String(sal.id)
        return catList[0]?.id ? String(catList[0].id) : ''
      })
      setAccountId((prev) => {
        if (prev && accList.some((a) => String(a.id) === prev)) return prev
        if (accList[0]?.id) return String(accList[0].id)
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
    setAccountId(aid)
    setAddModalOpen(true)
    accountDeepLinkApplied.current = true
    const next = new URLSearchParams(searchParams)
    next.delete('account_id')
    setSearchParams(next, { replace: true })
  }, [accounts, searchParams, setSearchParams])

  function startEdit(r) {
    setEditingId(r.id)
    setEditAmount(String(r.amount ?? ''))
    setEditCategoryId(r.income_category_id != null ? String(r.income_category_id) : '')
    setEditIncomeType(r.income_type ?? '')
    setEditEntryDate(r.entry_date ?? '')
    setEditDescription(r.description ?? '')
    setEditAccountId(r.account_id != null ? String(r.account_id) : '')
    setEditReceivedFrom(r.received_from ?? '')
    setEditPaymentMethod(r.payment_method || 'bank_transfer')
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
    const body = {
      amount: Number(editAmount),
      income_type: (editIncomeType || 'other').trim(),
      entry_date: editEntryDate,
      description: editDescription.trim() ? editDescription.trim() : null,
      account_id: editAccountId === '' ? null : Number(editAccountId),
      income_category_id: editCategoryId === '' ? null : Number(editCategoryId),
      received_from: editReceivedFrom.trim() ? editReceivedFrom.trim() : null,
      payment_method: editPaymentMethod || null,
      is_recurring: editIsRecurring,
      recurring_type: editIsRecurring ? editRecurringType : null,
    }
    if (!body.amount || body.amount <= 0) {
      setError('Amount must be a positive number.')
      setSavingId(null)
      return
    }
    try {
      await patchFinanceIncome(id, body)
      cancelEdit()
      await load()
      refresh()
    } catch (err) {
      if (err.status === 401) {
        setPfToken(null)
        onSessionInvalid?.()
      } else {
        setError(err.message || 'Could not update income')
      }
    } finally {
      setSavingId(null)
    }
  }

  async function handleDelete(r) {
    const ok = window.confirm(
      'Delete this income entry? If it was credited to an account, that balance will be reduced by this amount.',
    )
    if (!ok) return
    setDeletingId(r.id)
    setError('')
    try {
      await deleteFinanceIncome(r.id)
      if (editingId === r.id) cancelEdit()
      await load()
      refresh()
    } catch (err) {
      if (err.status === 401) {
        setPfToken(null)
        onSessionInvalid?.()
      } else {
        setError(err.message || 'Could not delete income')
      }
    } finally {
      setDeletingId(null)
    }
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    if (categories.length === 0) {
      setError('No income categories — restart the API once so defaults are seeded.')
      return
    }
    if (!incomeCategoryId) {
      setError('Select a category.')
      return
    }
    setSubmitting(true)
    try {
      const cat = categoryById.get(Number(incomeCategoryId))
      await createFinanceIncome({
        amount: Number(amount),
        category: cat?.name || 'general',
        income_category_id: Number(incomeCategoryId),
        income_type: incomeType.trim() || 'other',
        entry_date: entryDate,
        description: description.trim() || null,
        account_id: accountId === '' ? null : Number(accountId),
        received_from: receivedFrom.trim() || null,
        payment_method: paymentMethod || null,
        is_recurring: isRecurring,
        recurring_type: isRecurring ? recurringType : null,
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
        setError(err.message || 'Could not add income')
      }
    } finally {
      setSubmitting(false)
    }
  }

  const incomeCategoryOptions = useMemo(
    () => categories.map((c) => ({ value: String(c.id), label: c.name })),
    [categories],
  )
  const incomeAccountOptions = useMemo(
    () => [
      { value: '', label: 'Unallocated', description: 'No balance change' },
      ...accounts.map((a) => ({
        value: String(a.id),
        label: a.account_name,
        description: a.account_type === 'CASH' ? 'Cash' : 'Bank / wallet',
      })),
    ],
    [accounts],
  )
  const incomePayMethodOptions = useMemo(
    () => PAY_METHODS.map((m) => ({ value: m.value, label: m.label })),
    [],
  )
  const recurringTypeOptions = useMemo(
    () => [
      { value: 'monthly', label: 'Monthly' },
      { value: 'weekly', label: 'Weekly' },
    ],
    [],
  )

  async function handleIncomeExport() {
    setIncomeExportBusy(true)
    try {
      const qs = buildIncomeExpenseExportQuery(incomeDateFilter, filterCustomStart, filterCustomEnd)
      const { blob, filename } = await pfFetchBlob(`/pf/export/income/excel${qs}`)
      triggerDownloadBlob(blob, filename || 'Income_export.xlsx')
    } catch (e) {
      if (e.status === 401) {
        setPfToken(null)
        onSessionInvalid?.()
      } else {
        window.alert(e.message || 'Export failed')
      }
    } finally {
      setIncomeExportBusy(false)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <h1 className="text-xl font-bold text-slate-900 dark:text-slate-100 sm:text-2xl">Income</h1>
        <div className="flex flex-wrap items-center gap-2 md:justify-end">
          <PfExportMenu
            busy={incomeExportBusy}
            items={[{ key: 'xlsx', label: 'Export Excel', onClick: handleIncomeExport }]}
          />
          <button
            type="button"
            onClick={() => setAddModalOpen(true)}
            className="inline-flex shrink-0 items-center justify-center gap-2 rounded-[12px] bg-[#1E3A8A] px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-[#172554] active:scale-[0.98] md:self-start dark:bg-[var(--pf-primary)] dark:hover:bg-[var(--pf-primary-hover)]"
          >
            <PlusCircleIcon className="h-5 w-5" />
            Add income
          </button>
        </div>
      </div>

      {error ? (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">{error}</div>
      ) : null}

      <AppModal
        open={addModalOpen}
        onClose={() => !submitting && setAddModalOpen(false)}
        title="Add income"
        subtitle="Record money received — credits the selected account when provided."
        footer={
          <>
            <AppButton type="button" variant="secondary" disabled={submitting} onClick={() => setAddModalOpen(false)}>
              Cancel
            </AppButton>
            <AppButton type="submit" variant="primary" disabled={submitting} form="pf-income-add-form">
              {submitting ? 'Saving…' : 'Add income'}
            </AppButton>
          </>
        }
      >
        <form id="pf-income-add-form" onSubmit={handleSubmit} className="space-y-6">
          <div className="grid gap-4 sm:grid-cols-2">
            <AppInput
              id="inc-amt"
              label="Amount (₹)"
              type="number"
              step="0.01"
              min="0"
              amount
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              required
            />
            <div>
              <label htmlFor="inc-cat-dd" className={labelCls}>
                Category
              </label>
              <AppDropdown
                id="inc-cat-dd"
                value={incomeCategoryId}
                onChange={setIncomeCategoryId}
                options={incomeCategoryOptions}
                placeholder="— Select —"
                aria-label="Income category"
              />
            </div>
            <AppInput
              id="inc-type"
              label="Income type"
              value={incomeType}
              onChange={(e) => setIncomeType(e.target.value)}
              placeholder="recurring, one-time…"
              className="sm:col-span-2"
            />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <AppInput
              id="inc-date"
              label="Received date"
              type="date"
              variant="boxed"
              value={entryDate}
              onChange={(e) => setEntryDate(e.target.value)}
              required
            />
            <div>
              <label htmlFor="inc-acc-dd" className={labelCls}>
                Account
              </label>
              <AppDropdown
                id="inc-acc-dd"
                value={accountId}
                onChange={setAccountId}
                options={incomeAccountOptions}
                placeholder="Select account"
                aria-label="Credit to account"
              />
            </div>
            <AppInput
              id="inc-from"
              label="Received from"
              value={receivedFrom}
              onChange={(e) => setReceivedFrom(e.target.value)}
              placeholder="Company / person"
              className="sm:col-span-2"
            />
          </div>
          <div>
            <label htmlFor="inc-method-dd" className={labelCls}>
              Payment method
            </label>
            <AppDropdown
              id="inc-method-dd"
              value={paymentMethod}
              onChange={setPaymentMethod}
              options={incomePayMethodOptions}
              aria-label="Payment method"
            />
          </div>
          <AppTextarea
            id="inc-desc"
            label="Description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={2}
          />
          <div className="flex flex-wrap items-center gap-4">
            <label className="flex cursor-pointer items-center gap-2 text-sm font-medium text-[var(--pf-text)]">
              <input
                type="checkbox"
                className="h-4 w-4 rounded border-[var(--pf-border)] text-[var(--pf-primary)]"
                checked={isRecurring}
                onChange={(e) => setIsRecurring(e.target.checked)}
              />
              Recurring income
            </label>
            {isRecurring ? (
              <div className="min-w-[12rem] flex-1">
                <span className={labelCls}>Cadence</span>
                <AppDropdown
                  value={recurringType}
                  onChange={setRecurringType}
                  options={recurringTypeOptions}
                  aria-label="Recurring type"
                />
              </div>
            ) : null}
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
                onClick={() => setIncomeDateFilter(id)}
                className={`rounded-full px-3 py-1.5 text-xs font-semibold transition duration-200 active:scale-[0.98] ${
                  incomeDateFilter === id
                    ? 'bg-[#1E3A8A] text-white shadow-sm'
                    : 'bg-slate-100 text-slate-700 hover:bg-slate-200/80'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
          {incomeDateFilter === 'custom' ? (
            <div className="flex flex-wrap items-center gap-2">
              <input
                type="date"
                className={`${pfSelectCompact} max-w-[10rem]`}
                value={filterCustomStart}
                onChange={(e) => setFilterCustomStart(e.target.value)}
                aria-label="From date"
              />
              <span className="text-xs text-slate-500">to</span>
              <input
                type="date"
                className={`${pfSelectCompact} max-w-[10rem]`}
                value={filterCustomEnd}
                onChange={(e) => setFilterCustomEnd(e.target.value)}
                aria-label="To date"
              />
            </div>
          ) : null}
        </div>

        {!loading && rows.length > 0 && filteredIncomeRows.length === 0 ? (
          <p className="mt-4 text-center text-sm text-slate-500">No income in this period.</p>
        ) : null}

        {!loading && filteredIncomeRows.length > 0 && editingId == null ? (
          <div className="mt-4 space-y-3 md:hidden">
            {filteredIncomeRows.map((r) => (
              <div
                key={r.id}
                className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm transition active:scale-[0.99]"
              >
                <div className="flex items-start justify-between gap-2">
                  <span className="min-w-0 flex-1 font-semibold text-slate-900">{r.category || '—'}</span>
                  <span className="shrink-0 font-mono text-base font-bold tabular-nums text-emerald-600">
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
                  <span className="rounded-full bg-slate-100 px-2 py-0.5 font-medium text-slate-600">
                    {paymentMethodLabel(r.payment_method)}
                  </span>
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
            ))}
          </div>
        ) : null}

        <div className={`${pfTableWrap} mt-4 ${editingId != null ? 'block' : 'hidden'} md:block`}>
          <table className={`${pfTable} min-w-[56rem]`}>
            <thead>
              <tr>
                <th className={pfTh}>Date</th>
                <th className={pfTh}>Category</th>
                <th className={pfTh}>Type</th>
                <th className={pfTh}>From</th>
                <th className={pfTh}>Method</th>
                <th className={pfTh}>Account</th>
                <th className={pfThRight}>Amount</th>
                <th className={`${pfThRight} ${pfThActions}`}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={8} className="px-4 py-8 text-center text-slate-500">
                    Loading…
                  </td>
                </tr>
              ) : rows.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-4 py-8 text-center text-slate-500">
                    No income rows yet.
                  </td>
                </tr>
              ) : filteredIncomeRows.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-4 py-8 text-center text-slate-500">
                    No income in this period.
                  </td>
                </tr>
              ) : (
                filteredIncomeRows.map((r) =>
                  editingId === r.id ? (
                    <tr key={r.id} className="align-top">
                      <td className="p-0" colSpan={8}>
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
                            <option value="">Category</option>
                            {categories.map((c) => (
                              <option key={c.id} value={String(c.id)}>
                                {c.name}
                              </option>
                            ))}
                          </select>
                          <input
                            className={inputCls}
                            value={editIncomeType}
                            onChange={(e) => setEditIncomeType(e.target.value)}
                            placeholder="Type"
                          />
                          <select
                            className={inputCls}
                            value={editAccountId}
                            onChange={(e) => setEditAccountId(e.target.value)}
                          >
                            <option value="">Account</option>
                            {accounts.map((a) => (
                              <option key={a.id} value={String(a.id)}>
                                {a.account_name}
                              </option>
                            ))}
                          </select>
                          <input
                            className={inputCls}
                            value={editReceivedFrom}
                            onChange={(e) => setEditReceivedFrom(e.target.value)}
                            placeholder="Received from"
                          />
                          <select
                            className={inputCls}
                            value={editPaymentMethod}
                            onChange={(e) => setEditPaymentMethod(e.target.value)}
                          >
                            {PAY_METHODS.map((m) => (
                              <option key={m.value} value={m.value}>
                                {m.label}
                              </option>
                            ))}
                          </select>
                          <input
                            type="number"
                            step="0.01"
                            min="0"
                            className={`${inputCls} font-mono`}
                            value={editAmount}
                            onChange={(e) => setEditAmount(e.target.value)}
                          />
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
                              className="rounded-[12px] bg-[#1E3A8A] px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-60"
                            >
                              {savingId === r.id ? '…' : 'Save'}
                            </button>
                            <button
                              type="button"
                              onClick={cancelEdit}
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
                      <td className={`${pfTd} text-slate-600`}>{r.entry_date}</td>
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
                      <td className={`${pfTd} text-slate-600`}>{r.income_type}</td>
                      <td className={`${pfTd} text-slate-700`}>{r.received_from || '—'}</td>
                      <td className={`${pfTd} capitalize text-slate-600`}>{r.payment_method || '—'}</td>
                      <td className={`${pfTd} text-slate-600`}>
                        {r.account_id != null ? accountNameById.get(r.account_id) ?? `#${r.account_id}` : '—'}
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
