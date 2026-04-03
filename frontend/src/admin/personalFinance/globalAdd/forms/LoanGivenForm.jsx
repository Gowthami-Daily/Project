import { useState } from 'react'
import { createFinanceLoan, setPfToken } from '../../api.js'
import { usePfToast } from '../../notifications/pfToastContext.jsx'
import { AppInput, AppTextarea } from '../../pfDesignSystem/index.js'
import { inputCls, labelCls } from '../../pfFormStyles.js'
import { todayISODate } from '../pfToday.js'

/** Minimal “loan given” flow: interest-free (fast entry from global add). */
export default function LoanGivenForm({ formId, onSuccess, onSessionInvalid }) {
  const [borrowerName, setBorrowerName] = useState('')
  const [loanAmount, setLoanAmount] = useState('')
  const [startDate, setStartDate] = useState(todayISODate)
  const [endDate, setEndDate] = useState('')
  const [notes, setNotes] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const toast = usePfToast()

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    if (!borrowerName.trim()) {
      setError('Borrower name is required.')
      return
    }
    const amt = Number(loanAmount)
    if (!amt || amt <= 0) {
      setError('Enter a positive loan amount.')
      return
    }
    setSubmitting(true)
    try {
      await createFinanceLoan({
        borrower_name: borrowerName.trim(),
        loan_amount: amt,
        start_date: startDate,
        end_date: endDate || null,
        status: 'ACTIVE',
        loan_kind: 'interest_free',
        interest_rate: 0,
        interest_free_days: null,
        term_months: null,
        commission_percent: null,
        borrower_phone: null,
        borrower_address: null,
        notes: notes.trim() || null,
      })
      onSuccess?.()
    } catch (err) {
      if (err.status === 401) {
        setPfToken(null)
        onSessionInvalid?.()
      } else {
        const msg = err.message || 'Could not create loan'
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
        Quick add uses an interest-free loan. For EMI or interest-bearing loans, use the Loans page.
      </p>
      <div className="grid gap-4 sm:grid-cols-2">
        <AppInput
          id="pf-ge-lg-amt"
          label="Amount (₹)"
          type="number"
          inputMode="decimal"
          step="0.01"
          min="0"
          amount
          required
          value={loanAmount}
          onChange={(e) => setLoanAmount(e.target.value)}
        />
        <div>
          <label className={labelCls} htmlFor="pf-ge-lg-start">
            Start date
          </label>
          <input
            id="pf-ge-lg-start"
            type="date"
            className={inputCls}
            required
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
          />
        </div>
        <div className="sm:col-span-2">
          <AppInput
            id="pf-ge-lg-borrower"
            label="Borrower name"
            required
            value={borrowerName}
            onChange={(e) => setBorrowerName(e.target.value)}
          />
        </div>
        <div className="sm:col-span-2">
          <label className={labelCls} htmlFor="pf-ge-lg-end">
            End date (optional)
          </label>
          <input id="pf-ge-lg-end" type="date" className={inputCls} value={endDate} onChange={(e) => setEndDate(e.target.value)} />
        </div>
        <div className="sm:col-span-2">
          <AppTextarea id="pf-ge-lg-notes" label="Notes" rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
        </div>
      </div>
      {submitting ? <p className="text-sm text-[var(--pf-text-muted)]">Saving…</p> : null}
    </form>
  )
}
