import { BanknotesIcon, PlusIcon, TrashIcon, XMarkIcon } from '@heroicons/react/24/solid'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useOutletContext } from 'react-router-dom'
import {
  createFinanceLoan,
  createLoanPayment,
  deleteFinanceLoan,
  listFinanceAccounts,
  listFinanceLoans,
  listLoanPayments,
  listLoanSchedule,
  patchLoanScheduleCredit,
  payLoanEmi,
  setPfToken,
} from '../api.js'
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
  pfTdSm,
  pfTdSmActions,
  pfTdSmRight,
  pfTh,
  pfThActionsWide,
  pfThRight,
  pfThSm,
  pfThSmActionCol,
  pfThSmRight,
  pfTrHover,
} from '../pfFormStyles.js'
import { formatInr } from '../pfFormat.js'
import { usePfRefresh } from '../pfRefreshContext.jsx'

function todayISODate() {
  const d = new Date()
  return d.toISOString().slice(0, 10)
}

function balanceDue(loan) {
  if (loan == null) return 0
  if (loan.remaining_amount != null && loan.remaining_amount !== '') {
    return Number(loan.remaining_amount)
  }
  return Number(loan.loan_amount) || 0
}

/** Loans without an EMI schedule can use Record payment from the list or detail view. */
function canRecordPaymentFromList(loan) {
  if (!loan) return false
  if (String(loan.status || '').toUpperCase() === 'CLOSED') return false
  if (balanceDue(loan) <= 0) return false
  if (loan.has_emi_schedule === true) return false
  return true
}

/** Dropdown value for bank / cash / unset. */
function creditSelectValue(s) {
  if (s?.credit_as_cash === true) return 'cash'
  if (s?.finance_account_id != null && s.finance_account_id !== '') return String(s.finance_account_id)
  return ''
}

export default function PfLoansPage() {
  const { onSessionInvalid } = useOutletContext() || {}
  const { tick, refresh } = usePfRefresh()
  const [loans, setLoans] = useState([])
  const [accounts, setAccounts] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [submittingLoan, setSubmittingLoan] = useState(false)
  const [showNewLoanModal, setShowNewLoanModal] = useState(false)
  const [viewLoan, setViewLoan] = useState(null)
  const [detailSchedule, setDetailSchedule] = useState([])
  const [detailPayments, setDetailPayments] = useState([])
  const [detailLoading, setDetailLoading] = useState(false)
  const [payingKey, setPayingKey] = useState('')
  const [patchingKey, setPatchingKey] = useState('')
  const [deletingId, setDeletingId] = useState(null)
  const [recordPaymentDate, setRecordPaymentDate] = useState(todayISODate)
  const [recordAmount, setRecordAmount] = useState('')
  const [recordInterest, setRecordInterest] = useState('')
  const [recordReceiveMode, setRecordReceiveMode] = useState('cash')
  const [recordAccountId, setRecordAccountId] = useState('')
  const [submittingRecordPayment, setSubmittingRecordPayment] = useState(false)

  const [borrowerName, setBorrowerName] = useState('')
  const [loanAmount, setLoanAmount] = useState('')
  const [interestRate, setInterestRate] = useState('')
  const [startDate, setStartDate] = useState(todayISODate)
  const [endDate, setEndDate] = useState('')
  const [status, setStatus] = useState('ACTIVE')
  const [termMonths, setTermMonths] = useState('')
  const [commissionPct, setCommissionPct] = useState('')
  const [interestFreeDays, setInterestFreeDays] = useState('')
  const [openRecordPaymentAfterDetail, setOpenRecordPaymentAfterDetail] = useState(false)
  const recordPaymentSectionRef = useRef(null)

  const accountNameById = useMemo(() => {
    const m = new Map()
    for (const a of accounts) m.set(a.id, a.account_name)
    return m
  }, [accounts])

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const [loanData, accData] = await Promise.all([listFinanceLoans(), listFinanceAccounts()])
      setLoans(Array.isArray(loanData) ? loanData : [])
      setAccounts(Array.isArray(accData) ? accData : [])
    } catch (e) {
      if (e.status === 401) {
        setPfToken(null)
        onSessionInvalid?.()
      } else {
        setError(e.message || 'Failed to load loans')
      }
    } finally {
      setLoading(false)
    }
  }, [onSessionInvalid])

  useEffect(() => {
    load()
  }, [load, tick])

  useEffect(() => {
    if (!viewLoan?.id) {
      setDetailSchedule([])
      setDetailPayments([])
      return
    }
    let cancelled = false
    ;(async () => {
      setDetailLoading(true)
      try {
        const [sch, pay] = await Promise.all([
          listLoanSchedule(viewLoan.id),
          listLoanPayments(viewLoan.id),
        ])
        if (!cancelled) {
          setDetailSchedule(Array.isArray(sch) ? sch : [])
          setDetailPayments(Array.isArray(pay) ? pay : [])
        }
      } catch (e) {
        if (!cancelled && e.status !== 401) {
          setError(e.message || 'Failed to load schedule')
        }
      } finally {
        if (!cancelled) setDetailLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [viewLoan?.id, tick])

  useEffect(() => {
    if (!viewLoan?.id) return
    setRecordPaymentDate(todayISODate())
    setRecordAmount('')
    setRecordInterest('')
    setRecordReceiveMode('cash')
    setRecordAccountId(accounts[0]?.id != null ? String(accounts[0].id) : '')
  }, [viewLoan?.id, accounts])

  useEffect(() => {
    if (!viewLoan || !openRecordPaymentAfterDetail || detailLoading) return
    const hasSched = detailSchedule.length > 0
    const can =
      !hasSched &&
      String(viewLoan.status || '').toUpperCase() !== 'CLOSED' &&
      balanceDue(viewLoan) > 0
    if (!can) {
      setOpenRecordPaymentAfterDetail(false)
      return
    }
    const t = window.setTimeout(() => {
      recordPaymentSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
      setOpenRecordPaymentAfterDetail(false)
    }, 80)
    return () => window.clearTimeout(t)
  }, [viewLoan, openRecordPaymentAfterDetail, detailLoading, detailSchedule.length])

  useEffect(() => {
    if (!showNewLoanModal && !viewLoan) return
    const onKey = (e) => {
      if (e.key === 'Escape') {
        setShowNewLoanModal(false)
        setViewLoan(null)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [showNewLoanModal, viewLoan])

  function resetNewLoanForm() {
    setBorrowerName('')
    setLoanAmount('')
    setInterestRate('')
    setInterestFreeDays('')
    setEndDate('')
    setTermMonths('')
    setCommissionPct('')
    setStartDate(todayISODate)
    setStatus('ACTIVE')
  }

  async function refreshDetail() {
    if (!viewLoan?.id) return
    try {
      const [sch, pay] = await Promise.all([
        listLoanSchedule(viewLoan.id),
        listLoanPayments(viewLoan.id),
      ])
      setDetailSchedule(Array.isArray(sch) ? sch : [])
      setDetailPayments(Array.isArray(pay) ? pay : [])
      const data = await listFinanceLoans()
      setLoans(Array.isArray(data) ? data : [])
      const updated = (Array.isArray(data) ? data : []).find((x) => x.id === viewLoan.id)
      if (updated) setViewLoan(updated)
    } catch {
      /* ignore */
    }
  }

  async function handleLoanSubmit(e) {
    e.preventDefault()
    setSubmittingLoan(true)
    setError('')
    try {
      const tm = termMonths === '' ? null : Number(termMonths)
      const cp = commissionPct === '' ? null : Number(commissionPct)
      const ifd =
        interestFreeDays === '' || interestFreeDays == null
          ? null
          : Math.max(0, Math.floor(Number(interestFreeDays)))
      await createFinanceLoan({
        borrower_name: borrowerName.trim(),
        loan_amount: Number(loanAmount),
        interest_rate: interestRate === '' ? null : Number(interestRate),
        interest_free_days: ifd != null && !Number.isNaN(ifd) && ifd > 0 ? ifd : null,
        start_date: startDate,
        end_date: endDate || null,
        status: status.trim() || 'ACTIVE',
        term_months: tm && tm > 0 ? tm : null,
        commission_percent: cp != null && !Number.isNaN(cp) && cp > 0 ? cp : null,
      })
      resetNewLoanForm()
      setShowNewLoanModal(false)
      await load()
      refresh()
    } catch (err) {
      if (err.status === 401) {
        setPfToken(null)
        onSessionInvalid?.()
      } else {
        setError(err.message || 'Could not create loan')
      }
    } finally {
      setSubmittingLoan(false)
    }
  }

  async function onCreditChange(loanId, emiNumber, value) {
    const pk = `${loanId}-${emiNumber}`
    setPatchingKey(pk)
    setError('')
    try {
      if (value === '' || value == null) {
        await patchLoanScheduleCredit(loanId, emiNumber, { creditAsCash: false, financeAccountId: null })
      } else if (value === 'cash') {
        await patchLoanScheduleCredit(loanId, emiNumber, { creditAsCash: true, financeAccountId: null })
      } else {
        await patchLoanScheduleCredit(loanId, emiNumber, {
          creditAsCash: false,
          financeAccountId: Number(value),
        })
      }
      await refreshDetail()
      refresh()
    } catch (err) {
      if (err.status === 401) {
        setPfToken(null)
        onSessionInvalid?.()
      } else {
        setError(err.message || 'Could not update payout method')
      }
    } finally {
      setPatchingKey('')
    }
  }

  const hasEmiSchedule = detailSchedule.length > 0
  const canRecordManualPayment =
    viewLoan &&
    !detailLoading &&
    hasEmiSchedule === false &&
    String(viewLoan.status || '').toUpperCase() !== 'CLOSED' &&
    balanceDue(viewLoan) > 0

  async function handleRecordPayment(e) {
    e.preventDefault()
    if (!viewLoan?.id) return
    const total = Number(recordAmount)
    const interest = recordInterest.trim() === '' ? 0 : Number(recordInterest)
    if (!total || total <= 0 || Number.isNaN(total)) {
      setError('Enter a valid payment amount.')
      return
    }
    if (interest < 0 || Number.isNaN(interest)) {
      setError('Interest must be zero or positive.')
      return
    }
    if (interest > total) {
      setError('Interest cannot exceed total payment.')
      return
    }
    const principal = total - interest
    const creditAsCash = recordReceiveMode === 'cash'
    const financeAccountId =
      creditAsCash || !recordAccountId ? null : Number(recordAccountId)
    if (!creditAsCash && (financeAccountId == null || Number.isNaN(financeAccountId))) {
      setError('Select a bank account, or choose Cash.')
      return
    }
    setSubmittingRecordPayment(true)
    setError('')
    try {
      await createLoanPayment(viewLoan.id, {
        payment_date: recordPaymentDate,
        total_paid: total,
        principal_paid: principal,
        interest_paid: interest,
        credit_as_cash: creditAsCash,
        finance_account_id: financeAccountId,
      })
      setRecordAmount('')
      setRecordInterest('')
      await refreshDetail()
      refresh()
    } catch (err) {
      if (err.status === 401) {
        setPfToken(null)
        onSessionInvalid?.()
      } else {
        setError(err.message || 'Could not record payment')
      }
    } finally {
      setSubmittingRecordPayment(false)
    }
  }

  async function handleDeleteLoan(l) {
    const ok = window.confirm(
      `Delete loan for “${l.borrower_name}”?\n\nThis removes the loan, EMI schedule, and all payment history. This cannot be undone.`,
    )
    if (!ok) return
    setDeletingId(l.id)
    setError('')
    try {
      await deleteFinanceLoan(l.id)
      if (viewLoan?.id === l.id) setViewLoan(null)
      await load()
      refresh()
    } catch (err) {
      if (err.status === 401) {
        setPfToken(null)
        onSessionInvalid?.()
      } else {
        setError(err.message || 'Could not delete loan')
      }
    } finally {
      setDeletingId(null)
    }
  }

  const modalBackdrop =
    'fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-sm'

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-900 sm:text-2xl">Loans</h1>
            <p className="mt-1 text-sm text-slate-500">
            <strong className="font-medium text-slate-700">EMI schedule:</strong> choose Cash or bank per installment, then{' '}
            <strong className="font-medium text-slate-700">Mark paid</strong>.{' '}
            <strong className="font-medium text-slate-700">No schedule:</strong> use <strong className="font-medium text-slate-700">Record payment</strong> on the row or in the loan
            detail — when the balance reaches zero the loan is marked complete. Bank receipts credit that account; cash does not.
          </p>
        </div>
        <button
          type="button"
          onClick={() => {
            resetNewLoanForm()
            setShowNewLoanModal(true)
          }}
          className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#004080] px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-[#003366]"
        >
          <PlusIcon className="h-5 w-5" />
          New loan
        </button>
      </div>

      {error ? (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">{error}</div>
      ) : null}

      <div className={cardCls}>
        <h2 className="text-base font-bold text-sky-950">Borrowers</h2>
        {loading ? (
          <p className="mt-4 text-sm text-slate-500">Loading…</p>
        ) : loans.length === 0 ? (
          <p className="mt-4 text-sm text-slate-500">No borrowers yet — use New loan to add one.</p>
        ) : (
          <div className={`${pfTableWrap} mt-4`}>
            <table className={`${pfTable} min-w-[480px]`}>
              <thead>
                <tr>
                  <th className={pfTh}>Borrower</th>
                  <th className={pfThRight}>Balance due</th>
                  <th className={`${pfThRight} ${pfThActionsWide}`}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {loans.map((l) => (
                  <tr key={l.id} className={pfTrHover}>
                    <td className={`${pfTd} font-medium text-slate-900`}>{l.borrower_name}</td>
                    <td className={pfTdRight}>{formatInr(balanceDue(l))}</td>
                    <td className={pfTdActions}>
                      <div className={pfActionRow}>
                        <button
                          type="button"
                          onClick={() => {
                            setOpenRecordPaymentAfterDetail(false)
                            setViewLoan(l)
                          }}
                          className="rounded-lg border border-sky-200 bg-white px-3 py-1.5 text-xs font-semibold text-[#004080] hover:bg-sky-50"
                        >
                          View
                        </button>
                        {canRecordPaymentFromList(l) ? (
                          <button
                            type="button"
                            onClick={() => {
                              setViewLoan(l)
                              setOpenRecordPaymentAfterDetail(true)
                            }}
                            className="inline-flex items-center gap-1 rounded-lg border border-emerald-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-emerald-800 hover:bg-emerald-50"
                            title="Record a repayment; loan closes when balance is zero"
                          >
                            <BanknotesIcon className="h-3.5 w-3.5" />
                            Record
                          </button>
                        ) : null}
                        <button
                          type="button"
                          disabled={deletingId === l.id}
                          onClick={() => handleDeleteLoan(l)}
                          className="inline-flex items-center gap-1 rounded-lg border border-red-200 px-2.5 py-1.5 text-xs font-semibold text-red-700 hover:bg-red-50 disabled:opacity-60"
                          title="Delete loan"
                        >
                          <TrashIcon className="h-3.5 w-3.5" />
                          {deletingId === l.id ? '…' : 'Delete'}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {showNewLoanModal ? (
        <div
          className={modalBackdrop}
          role="dialog"
          aria-modal="true"
          aria-labelledby="pf-new-loan-title"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) setShowNewLoanModal(false)
          }}
        >
          <div
            className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl bg-white p-6 shadow-xl"
            onMouseDown={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-4">
              <h2 id="pf-new-loan-title" className="text-lg font-bold text-slate-900">
                New loan
              </h2>
              <button
                type="button"
                onClick={() => setShowNewLoanModal(false)}
                className="rounded-lg p-1 text-slate-500 hover:bg-slate-100"
                aria-label="Close"
              >
                <XMarkIcon className="h-6 w-6" />
              </button>
            </div>
            <form onSubmit={handleLoanSubmit} className="mt-4 grid gap-4 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <label htmlFor="ln-borrower" className={labelCls}>
                  Borrower / label
                </label>
                <input
                  id="ln-borrower"
                  className={inputCls}
                  value={borrowerName}
                  onChange={(e) => setBorrowerName(e.target.value)}
                  required
                />
              </div>
              <div>
                <label htmlFor="ln-amt" className={labelCls}>
                  Loan amount (₹)
                </label>
                <input
                  id="ln-amt"
                  type="number"
                  step="0.01"
                  min="0"
                  className={inputCls}
                  value={loanAmount}
                  onChange={(e) => setLoanAmount(e.target.value)}
                  required
                />
              </div>
              <div>
                <label htmlFor="ln-rate" className={labelCls}>
                  Interest % (optional)
                </label>
                <input
                  id="ln-rate"
                  type="number"
                  step="0.01"
                  min="0"
                  className={inputCls}
                  value={interestRate}
                  onChange={(e) => setInterestRate(e.target.value)}
                />
              </div>
              <div>
                <label htmlFor="ln-grace" className={labelCls}>
                  Interest-free days (optional)
                </label>
                <input
                  id="ln-grace"
                  type="number"
                  min="0"
                  step="1"
                  className={inputCls}
                  value={interestFreeDays}
                  onChange={(e) => setInterestFreeDays(e.target.value)}
                  placeholder="0"
                />
                <p className="mt-1 text-xs text-slate-500">
                  With <strong className="font-medium text-slate-600">term + interest %</strong>, total interest is reduced as if accrual starts after this many days (no interest for that period).
                </p>
              </div>
              <div>
                <label htmlFor="ln-start" className={labelCls}>
                  Start date
                </label>
                <input
                  id="ln-start"
                  type="date"
                  className={inputCls}
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  required
                />
              </div>
              <div>
                <label htmlFor="ln-end" className={labelCls}>
                  End date (optional)
                </label>
                <input id="ln-end" type="date" className={inputCls} value={endDate} onChange={(e) => setEndDate(e.target.value)} />
              </div>
              <div>
                <label htmlFor="ln-status" className={labelCls}>
                  Status
                </label>
                <input id="ln-status" className={inputCls} value={status} onChange={(e) => setStatus(e.target.value)} />
              </div>
              <div>
                <label htmlFor="ln-term" className={labelCls}>
                  Term (months) — EMI schedule
                </label>
                <input
                  id="ln-term"
                  type="number"
                  min="1"
                  className={inputCls}
                  value={termMonths}
                  onChange={(e) => setTermMonths(e.target.value)}
                  placeholder="Needs interest %"
                />
              </div>
              <div>
                <label htmlFor="ln-comm" className={labelCls}>
                  Commission % (optional)
                </label>
                <input
                  id="ln-comm"
                  type="number"
                  step="0.01"
                  min="0"
                  className={inputCls}
                  value={commissionPct}
                  onChange={(e) => setCommissionPct(e.target.value)}
                />
              </div>
              <div className="flex flex-wrap gap-2 sm:col-span-2">
                <button type="submit" disabled={submittingLoan} className={btnPrimary}>
                  {submittingLoan ? 'Saving…' : 'Create loan'}
                </button>
                <button
                  type="button"
                  onClick={() => setShowNewLoanModal(false)}
                  className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}

      {viewLoan ? (
        <div
          className={modalBackdrop}
          role="dialog"
          aria-modal="true"
          aria-labelledby="pf-schedule-title"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) setViewLoan(null)
          }}
        >
          <div
            className="max-h-[90vh] w-full max-w-5xl overflow-y-auto rounded-2xl bg-white p-6 shadow-xl"
            onMouseDown={(e) => e.stopPropagation()}
          >
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <h2 id="pf-schedule-title" className="text-lg font-bold text-slate-900">
                  {viewLoan.borrower_name}
                </h2>
                <p className="mt-1 text-xs text-slate-500">
                  Principal {formatInr(viewLoan.loan_amount)}
                  {viewLoan.start_date ? ` · ${viewLoan.start_date}` : ''}
                  {viewLoan.end_date ? ` → ${viewLoan.end_date}` : ''} · {viewLoan.status}
                  {viewLoan.interest_rate != null ? ` · ${viewLoan.interest_rate}%` : ''}
                  {Number(viewLoan.interest_free_days) > 0
                    ? ` · ${viewLoan.interest_free_days}d interest-free`
                    : ''}
                  {viewLoan.emi_amount != null ? ` · EMI ${formatInr(viewLoan.emi_amount)}` : ''}
                  {viewLoan.remaining_amount != null ? ` · Due ${formatInr(viewLoan.remaining_amount)}` : ''}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setViewLoan(null)}
                className="rounded-lg p-1 text-slate-500 hover:bg-slate-100"
                aria-label="Close"
              >
                <XMarkIcon className="h-6 w-6" />
              </button>
            </div>

            {detailLoading ? (
              <p className="mt-6 text-sm text-slate-500">Loading schedule…</p>
            ) : detailSchedule.length > 0 ? (
              <div className={pfTableWrap}>
                <table className={`${pfTable} min-w-[56rem] text-xs sm:text-sm`}>
                  <thead>
                    <tr>
                      <th className={pfThSm}>#</th>
                      <th className={pfThSm}>Due</th>
                      <th className={pfThSmRight}>EMI</th>
                      <th className={pfThSmRight}>Principal</th>
                      <th className={pfThSmRight}>Interest</th>
                      <th className={`${pfThSm} min-w-[11rem]`}>Receive as</th>
                      <th className={pfThSm}>Status</th>
                      <th className={`${pfThSmRight} ${pfThSmActionCol}`}> </th>
                    </tr>
                  </thead>
                  <tbody>
                    {detailSchedule.map((s) => {
                      const paid = String(s.payment_status).toLowerCase() === 'paid'
                      const pk = `${viewLoan.id}-${s.emi_number}`
                      const accLabel =
                        s.finance_account_id != null
                          ? accountNameById.get(s.finance_account_id) ?? `#${s.finance_account_id}`
                          : null
                      const paidAsLabel = s.credit_as_cash ? 'Cash' : accLabel ?? '—'
                      return (
                        <tr key={s.id} className={pfTrHover}>
                          <td className={pfTdSm}>{s.emi_number}</td>
                          <td className={`${pfTdSm} text-slate-600`}>{s.due_date}</td>
                          <td className={pfTdSmRight}>{formatInr(s.emi_amount)}</td>
                          <td className={`${pfTdSmRight} text-slate-600`}>{formatInr(s.principal_amount)}</td>
                          <td className={`${pfTdSmRight} text-slate-600`}>{formatInr(s.interest_amount)}</td>
                          <td className={pfTdSm}>
                            {paid ? (
                              <span className="text-slate-700">{paidAsLabel}</span>
                            ) : (
                              <select
                                className={`${inputCls} py-1 text-xs max-w-[12rem]`}
                                disabled={patchingKey === pk}
                                value={creditSelectValue(s)}
                                onChange={(e) => onCreditChange(viewLoan.id, s.emi_number, e.target.value)}
                                aria-label="Cash or bank for this EMI"
                              >
                                <option value="">— Not set —</option>
                                <option value="cash">Cash</option>
                                {accounts.map((a) => (
                                  <option key={a.id} value={String(a.id)}>
                                    {a.account_name}
                                  </option>
                                ))}
                              </select>
                            )}
                          </td>
                          <td className={pfTdSm}>
                            <span
                              className={
                                paid
                                  ? 'rounded-full bg-emerald-100 px-2 py-0.5 text-emerald-800'
                                  : 'rounded-full bg-amber-100 px-2 py-0.5 text-amber-900'
                              }
                            >
                              {s.payment_status}
                            </span>
                          </td>
                          <td className={pfTdSmActions}>
                            {!paid ? (
                              <div className={pfActionRow}>
                              <button
                                type="button"
                                disabled={payingKey === pk}
                                onClick={async () => {
                                  setPayingKey(pk)
                                  setError('')
                                  try {
                                    await payLoanEmi(viewLoan.id, s.emi_number)
                                    await refreshDetail()
                                    refresh()
                                  } catch (err) {
                                    if (err.status === 401) {
                                      setPfToken(null)
                                      onSessionInvalid?.()
                                    } else {
                                      setError(err.message || 'Could not mark EMI paid')
                                    }
                                  } finally {
                                    setPayingKey('')
                                  }
                                }}
                                className="rounded-lg bg-[#004080] px-2 py-1 text-xs font-semibold text-white hover:bg-[#003366] disabled:opacity-60"
                              >
                                {payingKey === pk ? '…' : 'Mark paid'}
                              </button>
                              </div>
                            ) : null}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="mt-4 text-sm text-slate-500">
                No EMI schedule for this loan (add <strong className="font-medium">term (months)</strong> and{' '}
                <strong className="font-medium">interest %</strong> when creating a loan). Payments appear below if any
                were recorded earlier.
              </p>
            )}

            {!detailLoading && hasEmiSchedule ? (
              <p className="mt-4 rounded-lg border border-sky-100 bg-sky-50/80 px-3 py-2 text-xs text-sky-950">
                This loan uses an EMI schedule — record each collection with <strong className="font-medium">Mark paid</strong> in
                the table. Manual “Record payment” is only for loans without a schedule.
              </p>
            ) : null}

            {!detailLoading && canRecordManualPayment ? (
              <div
                ref={recordPaymentSectionRef}
                className="mt-6 rounded-xl border border-sky-200/70 bg-sky-50/40 p-4 ring-1 ring-sky-100/50"
              >
                <h3 className="text-sm font-bold text-sky-950">Record payment</h3>
                <p className="mt-0.5 text-xs text-slate-600">
                  Amount due now: <span className="font-semibold text-slate-800">{formatInr(balanceDue(viewLoan))}</span>. Pay the
                  full amount in one go to <span className="font-medium text-slate-800">close the loan</span>. Bank credits the
                  selected account; cash does not change account balances.
                </p>
                <div className="mt-2">
                  <button
                    type="button"
                    onClick={() => setRecordAmount(String(balanceDue(viewLoan)))}
                    className="rounded-lg border border-sky-300 bg-white px-3 py-1.5 text-xs font-semibold text-[#004080] hover:bg-sky-50"
                  >
                    Fill full balance due
                  </button>
                </div>
                <form onSubmit={handleRecordPayment} className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                  <div>
                    <label htmlFor="pf-rec-date" className={labelCls}>
                      Payment date
                    </label>
                    <input
                      id="pf-rec-date"
                      type="date"
                      className={`${inputCls} mt-1`}
                      value={recordPaymentDate}
                      onChange={(e) => setRecordPaymentDate(e.target.value)}
                      required
                    />
                  </div>
                  <div>
                    <label htmlFor="pf-rec-amt" className={labelCls}>
                      Total received (₹)
                    </label>
                    <input
                      id="pf-rec-amt"
                      type="number"
                      step="0.01"
                      min="0.01"
                      className={`${inputCls} mt-1`}
                      value={recordAmount}
                      onChange={(e) => setRecordAmount(e.target.value)}
                      required
                    />
                  </div>
                  <div>
                    <label htmlFor="pf-rec-int" className={labelCls}>
                      Of which interest (₹, optional)
                    </label>
                    <input
                      id="pf-rec-int"
                      type="number"
                      step="0.01"
                      min="0"
                      className={`${inputCls} mt-1`}
                      value={recordInterest}
                      onChange={(e) => setRecordInterest(e.target.value)}
                      placeholder="0"
                    />
                  </div>
                  <div className="sm:col-span-2 lg:col-span-4">
                    <span className={labelCls}>Received as</span>
                    <div className="mt-2 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end">
                      <label className="flex cursor-pointer items-center gap-2 text-sm text-slate-700">
                        <input
                          type="radio"
                          name="pf-rec-mode"
                          checked={recordReceiveMode === 'cash'}
                          onChange={() => setRecordReceiveMode('cash')}
                        />
                        Cash
                      </label>
                      <label className="flex cursor-pointer items-center gap-2 text-sm text-slate-700">
                        <input
                          type="radio"
                          name="pf-rec-mode"
                          checked={recordReceiveMode === 'bank'}
                          onChange={() => setRecordReceiveMode('bank')}
                        />
                        Bank account
                      </label>
                      {recordReceiveMode === 'bank' ? (
                        <select
                          className={`${inputCls} max-w-md`}
                          value={recordAccountId}
                          onChange={(e) => setRecordAccountId(e.target.value)}
                          aria-label="Bank account to credit"
                        >
                          <option value="">— Select account —</option>
                          {accounts.map((a) => (
                            <option key={a.id} value={String(a.id)}>
                              {a.account_name}
                            </option>
                          ))}
                        </select>
                      ) : null}
                    </div>
                  </div>
                  <div className="sm:col-span-2 lg:col-span-4">
                    <button
                      type="submit"
                      disabled={submittingRecordPayment}
                      className="rounded-xl bg-[#004080] px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-[#003366] disabled:opacity-60"
                    >
                      {submittingRecordPayment ? 'Saving…' : 'Save payment'}
                    </button>
                  </div>
                </form>
              </div>
            ) : null}

            {!detailLoading && viewLoan && !hasEmiSchedule && String(viewLoan.status || '').toUpperCase() !== 'CLOSED' && balanceDue(viewLoan) <= 0 ? (
              <p className="mt-4 text-sm text-slate-500">Nothing due — loan balance is cleared.</p>
            ) : null}

            <div className="mt-6">
              <h3 className="text-sm font-bold text-slate-900">Payment history</h3>
              <div className={`${pfTableWrap} mt-2`}>
                <table className={`${pfTable} min-w-[400px] text-xs sm:text-sm`}>
                  <thead>
                    <tr>
                      <th className={pfTh}>Date</th>
                      <th className={pfTh}>Received as</th>
                      <th className={pfThRight}>Total</th>
                      <th className={pfThRight}>Balance</th>
                    </tr>
                  </thead>
                  <tbody>
                    {detailPayments.length === 0 ? (
                      <tr>
                        <td colSpan={4} className="px-4 py-4 text-center text-slate-500">
                          No payments yet.
                        </td>
                      </tr>
                    ) : (
                      detailPayments.map((p) => (
                        <tr key={p.id} className={pfTrHover}>
                          <td className={`${pfTd} text-slate-600`}>{p.payment_date}</td>
                          <td className={`${pfTd} text-slate-700`}>
                            {p.credit_as_cash
                              ? 'Cash'
                              : p.finance_account_id != null
                                ? accountNameById.get(p.finance_account_id) ?? `#${p.finance_account_id}`
                                : '—'}
                          </td>
                          <td className={pfTdRight}>{formatInr(p.total_paid)}</td>
                          <td className={pfTdRight}>{formatInr(p.balance_remaining)}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}
