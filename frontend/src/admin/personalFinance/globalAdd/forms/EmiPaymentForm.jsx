import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  listLiabilitySchedule,
  listLoanSchedule,
  payLiabilityEmi,
  payLoanEmi,
  setPfToken,
} from '../../api.js'
import { usePfToast } from '../../notifications/pfToastContext.jsx'
import { inputCls, labelCls } from '../../pfFormStyles.js'
import { formatInr } from '../../pfFormat.js'
import { todayISODate } from '../pfToday.js'

function isUnpaid(row) {
  return String(row.payment_status || '').toLowerCase() !== 'paid'
}

export default function EmiPaymentForm({ formId, loans, liabilities, accounts, defaultAccountId, onSuccess, onSessionInvalid }) {
  const [kind, setKind] = useState('liability')
  const [loanId, setLoanId] = useState('')
  const [liabilityId, setLiabilityId] = useState('')
  const [emiNumber, setEmiNumber] = useState('')
  const [paymentDate, setPaymentDate] = useState(todayISODate)
  const [financeAccountId, setFinanceAccountId] = useState(defaultAccountId != null ? String(defaultAccountId) : '')
  const [scheduleRows, setScheduleRows] = useState([])
  const [schedLoading, setSchedLoading] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const toast = usePfToast()

  const borrowLiabilities = useMemo(
    () =>
      (Array.isArray(liabilities) ? liabilities : []).filter(
        (l) => String(l.liability_type || '').toUpperCase() !== 'CREDIT_CARD_STATEMENT',
      ),
    [liabilities],
  )

  const loadSchedule = useCallback(async () => {
    setError('')
    setScheduleRows([])
    setEmiNumber('')
    const lid = kind === 'loan' ? Number(loanId) : Number(liabilityId)
    if (!lid) return
    setSchedLoading(true)
    try {
      const rows =
        kind === 'loan' ? await listLoanSchedule(lid) : await listLiabilitySchedule(lid)
      const list = Array.isArray(rows) ? rows : []
      setScheduleRows(list.filter(isUnpaid))
    } catch (err) {
      if (err.status === 401) {
        setPfToken(null)
        onSessionInvalid?.()
      } else {
        const msg = err.message || 'Could not load schedule'
        setError(msg)
        toast.error('Something went wrong', msg)
      }
    } finally {
      setSchedLoading(false)
    }
  }, [kind, loanId, liabilityId, onSessionInvalid])

  useEffect(() => {
    loadSchedule()
  }, [loadSchedule])

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    const emi = Number(emiNumber)
    const acc = financeAccountId === '' ? undefined : Number(financeAccountId)
    if (!emiNumber || !emi) {
      setError('Select an unpaid EMI.')
      return
    }
    if (kind === 'loan') {
      const id = Number(loanId)
      if (!id) {
        setError('Select a loan.')
        return
      }
    } else {
      const id = Number(liabilityId)
      if (!id) {
        setError('Select a liability.')
        return
      }
    }
    setSubmitting(true)
    try {
      if (kind === 'loan') {
        await payLoanEmi(Number(loanId), emi, {
          paymentDate,
          financeAccountId: acc,
        })
      } else {
        await payLiabilityEmi(Number(liabilityId), emi, {
          paymentDate,
          financeAccountId: acc,
        })
      }
      onSuccess?.()
    } catch (err) {
      if (err.status === 401) {
        setPfToken(null)
        onSessionInvalid?.()
      } else {
        const msg = err.message || 'Could not record EMI'
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
        <div className="sm:col-span-2">
          <span className={labelCls}>EMI for</span>
          <div className="mt-2 flex flex-wrap gap-4 text-sm text-[var(--pf-text)]">
            <label className="flex items-center gap-2">
              <input type="radio" name="pf-ge-emi-kind" checked={kind === 'liability'} onChange={() => setKind('liability')} />
              Borrowed liability (you pay)
            </label>
            <label className="flex items-center gap-2">
              <input type="radio" name="pf-ge-emi-kind" checked={kind === 'loan'} onChange={() => setKind('loan')} />
              Loan given (borrower paid you)
            </label>
          </div>
        </div>
        {kind === 'loan' ? (
          <div className="sm:col-span-2">
            <label className={labelCls} htmlFor="pf-ge-emi-loan">
              Loan
            </label>
            <select id="pf-ge-emi-loan" className={inputCls} value={loanId} onChange={(e) => setLoanId(e.target.value)} required>
              <option value="">Select…</option>
              {(loans || []).map((r) => (
                <option key={r.id} value={String(r.id)}>
                  {r.borrower_name} · {formatInr(r.outstanding_amount ?? r.loan_amount)}
                </option>
              ))}
            </select>
          </div>
        ) : (
          <div className="sm:col-span-2">
            <label className={labelCls} htmlFor="pf-ge-emi-liab">
              Liability
            </label>
            <select
              id="pf-ge-emi-liab"
              className={inputCls}
              value={liabilityId}
              onChange={(e) => setLiabilityId(e.target.value)}
              required
            >
              <option value="">Select…</option>
              {borrowLiabilities.map((r) => (
                <option key={r.id} value={String(r.id)}>
                  {r.liability_name} · {formatInr(r.outstanding_amount)}
                </option>
              ))}
            </select>
          </div>
        )}
        <div className="sm:col-span-2">
          <label className={labelCls} htmlFor="pf-ge-emi-num">
            EMI # (unpaid)
          </label>
          <select
            id="pf-ge-emi-num"
            className={inputCls}
            value={emiNumber}
            onChange={(e) => setEmiNumber(e.target.value)}
            required
            disabled={schedLoading}
          >
            <option value="">{schedLoading ? 'Loading…' : 'Select…'}</option>
            {scheduleRows.map((s) => (
              <option key={s.emi_number} value={String(s.emi_number)}>
                #{s.emi_number} · due {s.due_date} · {formatInr(s.emi_amount)}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className={labelCls} htmlFor="pf-ge-emi-date">
            Payment date
          </label>
          <input
            id="pf-ge-emi-date"
            type="date"
            className={inputCls}
            required
            value={paymentDate}
            onChange={(e) => setPaymentDate(e.target.value)}
          />
        </div>
        <div>
          <label className={labelCls} htmlFor="pf-ge-emi-acc">
            Bank account (optional)
          </label>
          <select
            id="pf-ge-emi-acc"
            className={inputCls}
            value={financeAccountId}
            onChange={(e) => setFinanceAccountId(e.target.value)}
          >
            <option value="">— Default / cash —</option>
            {accounts.map((a) => (
              <option key={a.id} value={String(a.id)}>
                {a.account_name}
              </option>
            ))}
          </select>
        </div>
      </div>
      {submitting ? <p className="text-sm text-[var(--pf-text-muted)]">Saving…</p> : null}
    </form>
  )
}
