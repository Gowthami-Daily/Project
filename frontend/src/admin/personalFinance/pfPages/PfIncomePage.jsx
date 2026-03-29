import { PencilSquareIcon, PlusCircleIcon, TrashIcon } from '@heroicons/react/24/solid'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { useOutletContext } from 'react-router-dom'
import {
  createFinanceIncome,
  deleteFinanceIncome,
  listFinanceAccounts,
  listFinanceIncome,
  listPfIncomeCategories,
  patchFinanceIncome,
  setPfToken,
} from '../api.js'
import { PfCategoryIcon, categoryBadgeClass } from '../pfCategoryIcons.jsx'
import {
  btnPrimary,
  cardCls,
  inputCls,
  labelCls,
  pfActionRow,
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
  const [showAddForm, setShowAddForm] = useState(false)
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

  const formCardHeader = 'border-b border-slate-200 bg-slate-50/80 px-4 py-3 sm:px-5'
  const formSection = 'border-b border-slate-100 px-4 py-4 sm:px-5'

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-900 sm:text-2xl">Income</h1>
          <p className="mt-1 text-sm text-slate-500">
            Track salary, dairy sales, rent, and more with categories, source, and method. Credits the selected account
            for cashflow.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setShowAddForm((v) => !v)}
          className="inline-flex shrink-0 items-center justify-center gap-2 rounded-xl bg-[#004080] px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-[#003366]"
        >
          <PlusCircleIcon className="h-5 w-5" />
          {showAddForm ? 'Close add form' : 'Add income'}
        </button>
      </div>

      {error ? (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">{error}</div>
      ) : null}

      {showAddForm ? (
      <div className={`${cardCls} overflow-hidden p-0`}>
        <div className={formCardHeader}>
          <h2 className="text-base font-bold text-slate-900">Add income</h2>
        </div>
        <form onSubmit={handleSubmit}>
          <div className={`${formSection} grid gap-4 sm:grid-cols-3`}>
            <div>
              <label htmlFor="inc-amt" className={labelCls}>
                Amount (₹)
              </label>
              <input
                id="inc-amt"
                type="number"
                step="0.01"
                min="0"
                className={inputCls}
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                required
              />
            </div>
            <div>
              <label htmlFor="inc-cat" className={labelCls}>
                Category
              </label>
              <select
                id="inc-cat"
                className={inputCls}
                value={incomeCategoryId}
                onChange={(e) => setIncomeCategoryId(e.target.value)}
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
              <label htmlFor="inc-type" className={labelCls}>
                Income type
              </label>
              <input
                id="inc-type"
                className={inputCls}
                value={incomeType}
                onChange={(e) => setIncomeType(e.target.value)}
                placeholder="recurring, one-time…"
              />
            </div>
          </div>
          <div className={`${formSection} grid gap-4 sm:grid-cols-3`}>
            <div>
              <label htmlFor="inc-date" className={labelCls}>
                Received date
              </label>
              <input
                id="inc-date"
                type="date"
                className={inputCls}
                value={entryDate}
                onChange={(e) => setEntryDate(e.target.value)}
                required
              />
            </div>
            <div>
              <label htmlFor="inc-acc" className={labelCls}>
                Account
              </label>
              <select
                id="inc-acc"
                className={inputCls}
                value={accountId}
                onChange={(e) => setAccountId(e.target.value)}
              >
                <option value="">Unallocated (no balance change)</option>
                {accounts.map((a) => (
                  <option key={a.id} value={String(a.id)}>
                    {a.account_name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="inc-from" className={labelCls}>
                Received from
              </label>
              <input
                id="inc-from"
                className={inputCls}
                value={receivedFrom}
                onChange={(e) => setReceivedFrom(e.target.value)}
                placeholder="Company / person"
              />
            </div>
          </div>
          <div className={`${formSection} max-w-md`}>
            <label htmlFor="inc-method" className={labelCls}>
              Payment method
            </label>
            <select
              id="inc-method"
              className={inputCls}
              value={paymentMethod}
              onChange={(e) => setPaymentMethod(e.target.value)}
            >
              {PAY_METHODS.map((m) => (
                <option key={m.value} value={m.value}>
                  {m.label}
                </option>
              ))}
            </select>
          </div>
          <div className={formSection}>
            <label htmlFor="inc-desc" className={labelCls}>
              Description
            </label>
            <input
              id="inc-desc"
              className={inputCls}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
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
              Recurring income
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
          <div className="px-4 py-4 sm:px-5">
            <button type="submit" disabled={submitting} className={btnPrimary}>
              {submitting ? 'Saving…' : 'Add income'}
            </button>
          </div>
        </form>
      </div>
      ) : null}

      <div className={cardCls}>
        <h2 className="text-base font-bold text-sky-950">Recent income</h2>
        <div className={`${pfTableWrap} mt-4`}>
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
              ) : (
                rows.map((r) =>
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
                              className="rounded-lg bg-[#004080] px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-60"
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
                            className="inline-flex items-center gap-1 rounded-lg border border-sky-200 px-2 py-1 text-xs font-semibold text-[#004080] hover:bg-sky-50"
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
