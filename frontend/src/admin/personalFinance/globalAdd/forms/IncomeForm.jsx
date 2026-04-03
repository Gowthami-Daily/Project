import { useMemo, useState } from 'react'
import { createFinanceIncome, setPfToken } from '../../api.js'
import { usePfToast } from '../../notifications/pfToastContext.jsx'
import { AppDropdown, AppInput, AppTextarea } from '../../pfDesignSystem/index.js'
import { inputCls, labelCls } from '../../pfFormStyles.js'
import { todayISODate } from '../pfToday.js'

const PAY_METHODS = [
  { value: 'cash', label: 'Cash' },
  { value: 'bank_transfer', label: 'Bank' },
  { value: 'upi', label: 'UPI' },
  { value: 'card', label: 'Card' },
]

export default function IncomeForm({
  formId,
  accounts,
  categories,
  categoryById,
  defaultAccountId,
  onSuccess,
  onSessionInvalid,
}) {
  const [amount, setAmount] = useState('')
  const [incomeCategoryId, setIncomeCategoryId] = useState('')
  const [incomeType, setIncomeType] = useState('recurring')
  const [entryDate, setEntryDate] = useState(todayISODate)
  const [description, setDescription] = useState('')
  const [accountId, setAccountId] = useState(defaultAccountId != null ? String(defaultAccountId) : '')
  const [receivedFrom, setReceivedFrom] = useState('')
  const [paymentMethod, setPaymentMethod] = useState('bank_transfer')
  const [isRecurring, setIsRecurring] = useState(false)
  const [recurringType, setRecurringType] = useState('monthly')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const toast = usePfToast()

  const incomeCategoryOptions = useMemo(
    () => categories.map((c) => ({ value: String(c.id), label: c.name })),
    [categories],
  )

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    if (categories.length === 0) {
      setError('No income categories.')
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
      onSuccess?.()
    } catch (err) {
      if (err.status === 401) {
        setPfToken(null)
        onSessionInvalid?.()
      } else {
        const msg = err.message || 'Could not add income'
        setError(msg)
        toast.error('Something went wrong', msg)
      }
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <form id={formId} onSubmit={handleSubmit} className="space-y-4">
      {error ? (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-100">
          {error}
        </div>
      ) : null}
      <div className="grid gap-4 sm:grid-cols-2">
        <AppInput
          id="pf-ge-inc-amt"
          label="Amount (₹)"
          type="number"
          inputMode="decimal"
          step="0.01"
          min="0"
          amount
          required
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
        />
        <div>
          <label className={labelCls} htmlFor="pf-ge-inc-date">
            Date
          </label>
          <input
            id="pf-ge-inc-date"
            type="date"
            className={inputCls}
            required
            value={entryDate}
            onChange={(e) => setEntryDate(e.target.value)}
          />
        </div>
        <div className="sm:col-span-2">
          <span className={labelCls}>Category</span>
          <div className="mt-2">
            <AppDropdown
              id="pf-ge-inc-cat"
              value={incomeCategoryId}
              onChange={setIncomeCategoryId}
              options={incomeCategoryOptions}
              placeholder="Select category…"
              aria-label="Income category"
            />
          </div>
        </div>
        <div>
          <label className={labelCls} htmlFor="pf-ge-inc-acc">
            Account
          </label>
          <select
            id="pf-ge-inc-acc"
            className={inputCls}
            value={accountId}
            onChange={(e) => setAccountId(e.target.value)}
          >
            <option value="">— None —</option>
            {accounts.map((a) => (
              <option key={a.id} value={String(a.id)}>
                {a.account_name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className={labelCls} htmlFor="pf-ge-inc-pm">
            Payment method
          </label>
          <select
            id="pf-ge-inc-pm"
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
        <AppInput id="pf-ge-inc-type" label="Income type" value={incomeType} onChange={(e) => setIncomeType(e.target.value)} />
        <AppInput id="pf-ge-inc-from" label="Received from (optional)" value={receivedFrom} onChange={(e) => setReceivedFrom(e.target.value)} />
        <div className="flex flex-col gap-2 sm:col-span-2">
          <label className="flex cursor-pointer items-center gap-2 text-sm text-[var(--pf-text)]">
            <input type="checkbox" checked={isRecurring} onChange={(e) => setIsRecurring(e.target.checked)} />
            Recurring
          </label>
          {isRecurring ? (
            <select className={inputCls} value={recurringType} onChange={(e) => setRecurringType(e.target.value)}>
              <option value="monthly">Monthly</option>
              <option value="weekly">Weekly</option>
            </select>
          ) : null}
        </div>
        <div className="sm:col-span-2">
          <AppTextarea id="pf-ge-inc-notes" label="Notes" rows={2} value={description} onChange={(e) => setDescription(e.target.value)} />
        </div>
      </div>
      {submitting ? <p className="text-sm text-[var(--pf-text-muted)]">Saving…</p> : null}
    </form>
  )
}
