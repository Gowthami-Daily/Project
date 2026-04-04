import { useMemo, useState } from 'react'
import { createFinanceExpense, setPfToken } from '../../api.js'
import { usePfToast } from '../../notifications/pfToastContext.jsx'
import { PremiumSelect } from '../../../../components/ui/PremiumSelect.jsx'
import { AppDropdown, AppInput, AppTextarea } from '../../pfDesignSystem/index.js'
import { inputCls, labelCls } from '../../pfFormStyles.js'
import { buildExpensePayWithGroups, parsePayWith } from '../pfPayWithHelpers.js'
import { todayISODate } from '../pfToday.js'

const PAYMENT_STATUS_OPTIONS = [
  { value: 'PAID', label: 'Paid' },
  { value: 'PENDING', label: 'Pending' },
]

const RECURRING_TYPE_OPTIONS = [
  { value: 'monthly', label: 'Monthly' },
  { value: 'weekly', label: 'Weekly' },
]

export default function ExpenseForm({
  formId,
  accounts,
  instruments,
  creditCards,
  categories,
  categoryById,
  defaultPayWith,
  onSuccess,
  onSessionInvalid,
}) {
  const [amount, setAmount] = useState('')
  const [expenseCategoryId, setExpenseCategoryId] = useState('')
  const [entryDate, setEntryDate] = useState(todayISODate)
  const [description, setDescription] = useState('')
  const [payWith, setPayWith] = useState(defaultPayWith || '')
  const [paidBy, setPaidBy] = useState('')
  const [paymentStatus, setPaymentStatus] = useState('PAID')
  const [isRecurring, setIsRecurring] = useState(false)
  const [recurringType, setRecurringType] = useState('monthly')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const toast = usePfToast()

  const expenseCategoryOptions = useMemo(
    () => categories.map((c) => ({ value: String(c.id), label: c.name })),
    [categories],
  )

  const expensePayWithGroups = useMemo(
    () => buildExpensePayWithGroups(accounts, creditCards, paymentStatus),
    [accounts, creditCards, paymentStatus],
  )

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    if (categories.length === 0) {
      setError('No expense categories — open Expenses once or restart the API.')
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
        setError('Select an account or credit card, or set status to Pending.')
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
      onSuccess?.()
    } catch (err) {
      if (err.status === 401) {
        setPfToken(null)
        onSessionInvalid?.()
      } else {
        const msg = err.message || 'Could not add expense'
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
          id="pf-ge-exp-amt"
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
          <label className={labelCls} htmlFor="pf-ge-exp-date">
            Date
          </label>
          <input
            id="pf-ge-exp-date"
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
              id="pf-ge-exp-cat"
              value={expenseCategoryId}
              onChange={setExpenseCategoryId}
              options={expenseCategoryOptions}
              placeholder="Select category…"
              aria-label="Expense category"
            />
          </div>
        </div>
        <PremiumSelect
          id="pf-ge-exp-paystat"
          label="Payment status"
          labelClassName={labelCls}
          options={PAYMENT_STATUS_OPTIONS}
          value={paymentStatus}
          onChange={setPaymentStatus}
        />
        <div className="sm:col-span-2">
          <span className={labelCls}>Pay with</span>
          <div className="mt-2">
            <AppDropdown
              id="pf-ge-exp-pay"
              value={payWith}
              onChange={setPayWith}
              placeholder={paymentStatus === 'PENDING' ? 'Optional while pending…' : 'Select account or card…'}
              groups={expensePayWithGroups}
              aria-label="Pay with"
            />
          </div>
        </div>
        <AppInput id="pf-ge-exp-paidby" label="Paid by (optional)" value={paidBy} onChange={(e) => setPaidBy(e.target.value)} />
        <div className="flex flex-col gap-2 sm:col-span-2">
          <label className="flex cursor-pointer items-center gap-2 text-sm text-[var(--pf-text)]">
            <input type="checkbox" checked={isRecurring} onChange={(e) => setIsRecurring(e.target.checked)} />
            Recurring
          </label>
          {isRecurring ? (
            <PremiumSelect
              options={RECURRING_TYPE_OPTIONS}
              value={recurringType}
              onChange={setRecurringType}
              aria-label="Recurring frequency"
            />
          ) : null}
        </div>
        <div className="sm:col-span-2">
          <AppTextarea id="pf-ge-exp-notes" label="Notes" rows={2} value={description} onChange={(e) => setDescription(e.target.value)} />
        </div>
      </div>
      {submitting ? <p className="text-sm text-[var(--pf-text-muted)]">Saving…</p> : null}
    </form>
  )
}
