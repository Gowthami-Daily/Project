import { useState } from 'react'
import { createFinanceLiability, setPfToken } from '../../api.js'
import { usePfToast } from '../../notifications/pfToastContext.jsx'
import { AppInput, AppTextarea } from '../../pfDesignSystem/index.js'
import { inputCls, labelCls } from '../../pfFormStyles.js'

const LIABILITY_TYPES = [
  { value: 'PERSONAL_LOAN_BORROWED', label: 'Personal loan' },
  { value: 'HOME_LOAN', label: 'Home loan' },
  { value: 'VEHICLE_LOAN', label: 'Vehicle loan' },
  { value: 'CREDIT_CARD', label: 'Credit card' },
  { value: 'OTHER', label: 'Other' },
]

export default function LoanTakenForm({ formId, onSuccess, onSessionInvalid }) {
  const [liabilityName, setLiabilityName] = useState('')
  const [liabilityType, setLiabilityType] = useState('PERSONAL_LOAN_BORROWED')
  const [totalAmount, setTotalAmount] = useState('')
  const [outstandingAmount, setOutstandingAmount] = useState('')
  const [lenderName, setLenderName] = useState('')
  const [dueDate, setDueDate] = useState('')
  const [notes, setNotes] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const toast = usePfToast()

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    if (!liabilityName.trim()) {
      setError('Name is required.')
      return
    }
    const total = Number(totalAmount)
    if (!total || total <= 0) {
      setError('Enter total amount.')
      return
    }
    setSubmitting(true)
    try {
      await createFinanceLiability({
        liability_name: liabilityName.trim(),
        liability_type: liabilityType,
        total_amount: total,
        outstanding_amount: outstandingAmount === '' ? undefined : Math.max(0, Number(outstandingAmount)),
        interest_rate: null,
        minimum_due: null,
        installment_amount: null,
        due_date: dueDate || null,
        billing_cycle_day: null,
        lender_name: lenderName.trim() || null,
        notes: notes.trim() || null,
        status: 'ACTIVE',
      })
      onSuccess?.()
    } catch (err) {
      if (err.status === 401) {
        setPfToken(null)
        onSessionInvalid?.()
      } else {
        const msg = err.message || 'Could not save liability'
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
      <p className="text-xs text-[var(--pf-text-muted)]">
        For EMI schedules and edits, use the Liabilities page.
      </p>
      <div className="grid gap-4 sm:grid-cols-2">
        <AppInput
          id="pf-ge-lt-amt"
          label="Total amount (₹)"
          type="number"
          inputMode="decimal"
          step="0.01"
          min="0"
          amount
          required
          value={totalAmount}
          onChange={(e) => setTotalAmount(e.target.value)}
        />
        <AppInput
          id="pf-ge-lt-out"
          label="Outstanding (₹, optional)"
          type="number"
          inputMode="decimal"
          step="0.01"
          min="0"
          amount
          value={outstandingAmount}
          onChange={(e) => setOutstandingAmount(e.target.value)}
        />
        <div className="sm:col-span-2">
          <AppInput
            id="pf-ge-lt-name"
            label="Liability name"
            required
            value={liabilityName}
            onChange={(e) => setLiabilityName(e.target.value)}
          />
        </div>
        <div>
          <label className={labelCls} htmlFor="pf-ge-lt-type">
            Type
          </label>
          <select
            id="pf-ge-lt-type"
            className={inputCls}
            value={liabilityType}
            onChange={(e) => setLiabilityType(e.target.value)}
          >
            {LIABILITY_TYPES.map((t) => (
              <option key={t.value} value={t.value}>
                {t.label}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className={labelCls} htmlFor="pf-ge-lt-due">
            Due date (optional)
          </label>
          <input id="pf-ge-lt-due" type="date" className={inputCls} value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
        </div>
        <div className="sm:col-span-2">
          <AppInput id="pf-ge-lt-lender" label="Lender (optional)" value={lenderName} onChange={(e) => setLenderName(e.target.value)} />
        </div>
        <div className="sm:col-span-2">
          <AppTextarea id="pf-ge-lt-notes" label="Notes" rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
        </div>
      </div>
      {submitting ? <p className="text-sm text-[var(--pf-text-muted)]">Saving…</p> : null}
    </form>
  )
}
