import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  listLiabilitySchedule,
  listLoanSchedule,
  payLiabilityEmi,
  payLoanEmi,
  setPfToken,
} from '../../api.js'
import { PremiumSelect } from '../../../../components/ui/PremiumSelect.jsx'
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
            <PremiumSelect
              id="pf-ge-emi-loan"
              label="Loan"
              labelClassName={labelCls}
              required
              options={(loans || []).map((r) => ({
                value: String(r.id),
                label: `${r.borrower_name} · ${formatInr(r.outstanding_amount ?? r.loan_amount)}`,
              }))}
              value={loanId}
              onChange={setLoanId}
              placeholder="Select…"
              searchable
            />
          </div>
        ) : (
          <div className="sm:col-span-2">
            <PremiumSelect
              id="pf-ge-emi-liab"
              label="Liability"
              labelClassName={labelCls}
              required
              options={borrowLiabilities.map((r) => ({
                value: String(r.id),
                label: `${r.liability_name} · ${formatInr(r.outstanding_amount)}`,
              }))}
              value={liabilityId}
              onChange={setLiabilityId}
              placeholder="Select…"
              searchable
            />
          </div>
        )}
        <div className="sm:col-span-2">
          <PremiumSelect
            id="pf-ge-emi-num"
            label="EMI # (unpaid)"
            labelClassName={labelCls}
            required
            options={scheduleRows.map((s) => ({
              value: String(s.emi_number),
              label: `#${s.emi_number} · due ${s.due_date} · ${formatInr(s.emi_amount)}`,
            }))}
            value={emiNumber}
            onChange={setEmiNumber}
            placeholder={schedLoading ? 'Loading…' : 'Select…'}
            disabled={schedLoading}
            searchable={scheduleRows.length > 6}
          />
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
        <PremiumSelect
          id="pf-ge-emi-acc"
          label="Bank account (optional)"
          labelClassName={labelCls}
          options={[
            { value: '', label: '— Default / cash —' },
            ...accounts.map((a) => ({ value: String(a.id), label: a.account_name })),
          ]}
          value={financeAccountId}
          onChange={setFinanceAccountId}
          searchable={accounts.length > 6}
        />
      </div>
      {submitting ? <p className="text-sm text-[var(--pf-text-muted)]">Saving…</p> : null}
    </form>
  )
}
