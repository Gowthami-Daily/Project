import {
  BanknotesIcon,
  CalendarDaysIcon,
  ClockIcon,
  EllipsisVerticalIcon,
  ExclamationTriangleIcon,
  PlusIcon,
  TrashIcon,
  XMarkIcon,
} from '@heroicons/react/24/solid'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useOutletContext } from 'react-router-dom'
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import {
  addLoanPrincipalAmount,
  closeFinanceLoan,
  createFinanceLoan,
  createLoanPayment,
  deleteFinanceLoan,
  getFinanceLoansSummary,
  getLoanDashboardAnalytics,
  listFinanceAccounts,
  listFinanceLoans,
  listLoanPayments,
  listLoanSchedule,
  patchFinanceLoan,
  patchLoanScheduleCredit,
  payLoanEmi,
  pfFetchBlob,
  setPfToken,
  triggerDownloadBlob,
} from '../api.js'
import PfExportMenu from '../PfExportMenu.jsx'
import { AppButton, AppModal } from '../pfDesignSystem/index.js'
import {
  btnDanger,
  btnPrimary,
  btnSecondary,
  cardCls,
  inputCls,
  labelCls,
  pfActionRow,
  pfModalCloseBtn,
  pfModalHeader,
  pfModalOverlay,
  pfModalSurface,
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
  pfChartCard,
} from '../pfFormStyles.js'
import { formatInr } from '../pfFormat.js'
import { usePfRefresh } from '../pfRefreshContext.jsx'
import PfSegmentedControl from '../PfSegmentedControl.jsx'
import { PageHeader } from '../../../components/ui/PageHeader.jsx'
import { PremiumSelect } from '../../../components/ui/PremiumSelect.jsx'

const LOAN_PIE_COLORS = ['#3b82f6', '#10b981']

function todayISODate() {
  const d = new Date()
  return d.toISOString().slice(0, 10)
}

/** Open browser date picker; falls back to focus (Firefox / older Chromium). */
function openNativeDatePicker(inputEl) {
  if (!inputEl) return
  try {
    if (typeof inputEl.showPicker === 'function') {
      inputEl.showPicker()
      return
    }
  } catch {
    /* not allowed or unsupported */
  }
  inputEl.focus()
  inputEl.click()
}

/** Match backend: simple interest principal × (rate/100) × (days/365). */
function simpleAccrualPreview(principal, annualRatePct, startIso) {
  const p = Number(principal)
  const r = Number(annualRatePct)
  if (!p || p <= 0 || !r || r <= 0 || !startIso) return null
  const start = new Date(`${startIso}T12:00:00`)
  if (Number.isNaN(start.getTime())) return null
  const end = new Date()
  end.setHours(12, 0, 0, 0)
  const days = Math.max(0, Math.round((end.getTime() - start.getTime()) / 86400000))
  const accrued = p * (r / 100) * (days / 365)
  const accruedR = Math.round(accrued * 100) / 100
  const total = Math.round((p + accruedR) * 100) / 100
  return { days, accrued: accruedR, total }
}

function balanceDue(loan) {
  if (loan == null) return 0
  if (loan.balance_due != null && loan.balance_due !== '') {
    return Number(loan.balance_due)
  }
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

/** Primary “Record payment” — manual repayment or open detail to mark an EMI. */
function canPrimaryRecordLoan(loan) {
  if (!loan) return false
  if (String(loan.status || '').toUpperCase() === 'CLOSED') return false
  if (balanceDue(loan) <= 0) return false
  return canRecordPaymentFromList(loan) || loan.has_emi_schedule === true
}

function progressBarTone(pct) {
  if (pct == null) return 'bg-slate-400'
  if (pct >= 70) return 'bg-emerald-500'
  if (pct >= 30) return 'bg-amber-500'
  return 'bg-red-500'
}

function loanTypeLabel(t) {
  const m = {
    EMI: 'EMI',
    INTEREST_FREE: 'Interest-free',
    SIMPLE_INTEREST: 'Simple interest',
  }
  return m[t] || t || '—'
}

function loanTypeBadgeCls(t) {
  switch (t) {
    case 'EMI':
      return 'border border-violet-200 bg-violet-100 text-violet-900 dark:border-violet-500/35 dark:bg-violet-500/15 dark:text-violet-100'
    case 'INTEREST_FREE':
      return 'border border-slate-300 bg-slate-100 text-slate-800 dark:border-slate-500/40 dark:bg-slate-500/15 dark:text-slate-200'
    case 'SIMPLE_INTEREST':
      return 'border border-amber-200 bg-amber-100 text-amber-950 dark:border-amber-500/40 dark:bg-amber-500/15 dark:text-amber-100'
    default:
      return 'border border-slate-200 bg-slate-100 text-slate-800 dark:border-[var(--pf-border)] dark:bg-white/10 dark:text-[var(--pf-text)]'
  }
}

function displayStatusBadge(displayStatus, isOverdue) {
  const base =
    'inline-flex rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide'
  if (isOverdue || displayStatus === 'OVERDUE') {
    return (
      <span className={`${base} border border-red-300 bg-red-100 text-red-900 dark:border-red-400/45 dark:bg-red-500/15 dark:text-red-100`}>
        Overdue
      </span>
    )
  }
  if (displayStatus === 'COMPLETED') {
    return (
      <span className={`${base} border border-violet-200 bg-violet-100 text-violet-900 dark:border-violet-400/40 dark:bg-violet-500/15 dark:text-violet-100`}>
        Completed
      </span>
    )
  }
  if (displayStatus === 'CLOSED') {
    return (
      <span className={`${base} border border-emerald-200 bg-emerald-100 text-emerald-900 dark:border-emerald-400/40 dark:bg-emerald-500/15 dark:text-emerald-100`}>
        Closed
      </span>
    )
  }
  return (
    <span className={`${base} border border-sky-200 bg-sky-50 text-sky-900 dark:border-sky-400/40 dark:bg-sky-500/15 dark:text-sky-100`}>
      Active
    </span>
  )
}

function formatNextEmiDue(iso) {
  if (!iso) return null
  const d = new Date(`${String(iso).slice(0, 10)}T12:00:00`)
  if (Number.isNaN(d.getTime())) return iso
  return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
}

function formatShortDue(iso) {
  if (!iso) return '—'
  const d = new Date(`${String(iso).slice(0, 10)}T12:00:00`)
  if (Number.isNaN(d.getTime())) return String(iso)
  return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })
}

function daysFromTodayLoan(iso) {
  if (!iso) return null
  const t = new Date()
  t.setHours(12, 0, 0, 0)
  const d = new Date(`${String(iso).slice(0, 10)}T12:00:00`)
  if (Number.isNaN(d.getTime())) return null
  return Math.round((d.getTime() - t.getTime()) / 86400000)
}

function emiDisplayForLoan(l) {
  if (l?.next_emi_amount != null && Number(l.next_emi_amount) > 0) return Number(l.next_emi_amount)
  if (l?.emi_amount != null && Number(l.emi_amount) > 0) return Number(l.emi_amount)
  return null
}

function interestDisplayLoan(l) {
  if (l?.loan_type === 'INTEREST_FREE') return '0%'
  if (l?.interest_rate != null && l.interest_rate !== '') return `${l.interest_rate}%`
  return '—'
}

function tableDueCellCls(l) {
  const d = daysFromTodayLoan(l.next_emi_due)
  if (l.is_overdue || (d != null && d < 0)) return 'text-red-600 dark:text-red-400'
  if (d != null && d >= 0 && d <= 7) return 'text-amber-700 dark:text-amber-300'
  return ''
}

/** 0–100 for progress bar; null if total not known. */
function loanCollectedPercent(loan) {
  const total =
    loan.total_amount != null && loan.total_amount !== ''
      ? Number(loan.total_amount)
      : Number(loan.loan_amount) || 0
  if (total <= 0) return null
  const due = balanceDue(loan)
  return Math.min(100, Math.max(0, Math.round(((total - due) / total) * 100)))
}

/** Dropdown value for bank / cash / unset. */
function creditSelectValue(s) {
  if (s?.credit_as_cash === true) return 'cash'
  if (s?.finance_account_id != null && s.finance_account_id !== '') return String(s.finance_account_id)
  return ''
}

function loanOverviewCardShell(l) {
  if (l.is_overdue || l.display_status === 'OVERDUE') {
    return 'border-red-500/35 bg-red-500/[0.06] ring-1 ring-red-500/15 shadow-[0_8px_30px_rgba(239,68,68,0.08)]'
  }
  const dd = daysFromTodayLoan(l.next_emi_due)
  if (dd != null && dd >= 0 && dd <= 7) {
    return 'border-amber-500/35 bg-amber-500/[0.06] ring-1 ring-amber-400/15'
  }
  return 'border-[var(--pf-border)] bg-white/[0.03] ring-1 ring-[var(--pf-border)]/40 shadow-[var(--pf-shadow)] dark:bg-white/[0.03]'
}

function LoanOverviewCard({ l, onView, onRecord, recordEnabled, onDelete, deletingId }) {
  const pct = loanCollectedPercent(l)
  const emiAmt = emiDisplayForLoan(l)
  const dueIso = l.next_emi_due
  const dueDays = daysFromTodayLoan(dueIso)
  const dueCls =
    l.is_overdue || (dueDays != null && dueDays < 0)
      ? 'font-bold text-red-400'
      : dueDays != null && dueDays <= 7
        ? 'font-bold text-amber-300'
        : 'font-semibold text-[var(--pf-text)]'

  return (
    <div
      className={`flex flex-col rounded-2xl border p-5 backdrop-blur-md transition hover:-translate-y-0.5 hover:shadow-lg ${loanOverviewCardShell(l)}`}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <h3 className="truncate text-base font-bold text-[var(--pf-text)]">{l.borrower_name}</h3>
          <div className="mt-1 flex flex-wrap items-center gap-1.5">
            <span
              className={`inline-flex rounded-full px-2 py-0.5 text-[9px] font-bold uppercase tracking-wide ${loanTypeBadgeCls(l.loan_type)}`}
            >
              {loanTypeLabel(l.loan_type)}
            </span>
            {displayStatusBadge(l.display_status, l.is_overdue)}
          </div>
        </div>
      </div>
      <p className="mt-3 font-mono text-xl font-bold tabular-nums tracking-tight text-[var(--pf-text)]">
        {formatInr(balanceDue(l))}
        <span className="ml-2 text-xs font-normal text-[var(--pf-text-muted)]">outstanding</span>
      </p>
      <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-sm">
        {emiAmt != null ? (
          <p>
            <span className="text-[var(--pf-text-muted)]">EMI: </span>
            <span className="font-mono font-semibold tabular-nums text-sky-300 dark:text-sky-200">{formatInr(emiAmt)}</span>
          </p>
        ) : (
          <p className="text-[var(--pf-text-muted)]">EMI: —</p>
        )}
        <p className={dueCls}>
          <span className="text-[var(--pf-text-muted)]">Next due: </span>
          {dueIso ? formatShortDue(dueIso) : '—'}
          {dueDays != null && dueDays >= 0 ? (
            <span className="ml-1 text-xs font-normal text-[var(--pf-text-muted)]">({dueDays}d)</span>
          ) : null}
          {dueDays != null && dueDays < 0 ? <span className="ml-1 text-xs">(late)</span> : null}
        </p>
        <p>
          <span className="text-[var(--pf-text-muted)]">Interest: </span>
          <span className="font-semibold">{interestDisplayLoan(l)}</span>
        </p>
      </div>
      {pct != null ? (
        <div className="mt-4">
          <div className="mb-1 flex justify-between text-[10px] font-semibold uppercase tracking-wide text-[var(--pf-text-muted)]">
            <span>Collected</span>
            <span className="tabular-nums">{pct}%</span>
          </div>
          <div className="h-3 w-full overflow-hidden rounded-full bg-black/15 dark:bg-white/10">
            <div
              className={`h-full rounded-full transition-all duration-500 ${progressBarTone(pct)}`}
              style={{ width: `${pct}%` }}
            />
          </div>
        </div>
      ) : (
        <p className="mt-3 text-xs text-[var(--pf-text-muted)]">No amortization baseline for progress.</p>
      )}
      <div className="mt-5 flex flex-wrap gap-2 border-t border-[var(--pf-border)]/60 pt-4">
        <button
          type="button"
          disabled={!recordEnabled}
          title={recordEnabled ? 'Record a repayment' : 'Nothing to record'}
          className={`${btnPrimary} inline-flex min-w-[7rem] flex-1 items-center justify-center gap-1.5 px-3 py-2 text-xs disabled:opacity-50`}
          onClick={onRecord}
        >
          <BanknotesIcon className="h-4 w-4 shrink-0" />
          Record payment
        </button>
        <button
          type="button"
          className={`${btnSecondary} min-w-[5rem] flex-1 justify-center px-3 py-2 text-xs`}
          onClick={onView}
        >
          View
        </button>
        {onDelete ? (
          <button
            type="button"
            disabled={deletingId === l.id}
            className={`${btnDanger} inline-flex items-center justify-center px-3 py-2 text-xs`}
            onClick={onDelete}
            title="Delete loan"
          >
            <TrashIcon className="h-4 w-4" />
          </button>
        ) : null}
      </div>
    </div>
  )
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
  const [loanKind, setLoanKind] = useState('emi_schedule')
  const [emiInterestMethod, setEmiInterestMethod] = useState('flat')
  const [emiSettlement, setEmiSettlement] = useState('receipt')
  const [showRecordPaymentForm, setShowRecordPaymentForm] = useState(false)
  const [showAddAmountForm, setShowAddAmountForm] = useState(false)
  const [showBorrowerProfileForm, setShowBorrowerProfileForm] = useState(false)
  const [loanExportBusy, setLoanExportBusy] = useState(false)
  const [loanSummary, setLoanSummary] = useState(null)
  const [loanAnalytics, setLoanAnalytics] = useState(null)
  const [analyticsYear, setAnalyticsYear] = useState(() => new Date().getFullYear())
  const [actionsMenuLoanId, setActionsMenuLoanId] = useState(null)
  const [filterLoanType, setFilterLoanType] = useState('ALL')
  const [filterStatus, setFilterStatus] = useState('ACTIVE')
  const [searchBorrower, setSearchBorrower] = useState('')
  const [searchDebounced, setSearchDebounced] = useState('')
  const [borrowerPhone, setBorrowerPhone] = useState('')
  const [borrowerAddress, setBorrowerAddress] = useState('')
  const [loanNotesField, setLoanNotesField] = useState('')
  const [detailPhone, setDetailPhone] = useState('')
  const [detailAddress, setDetailAddress] = useState('')
  const [detailNotes, setDetailNotes] = useState('')
  const [savingBorrowerMeta, setSavingBorrowerMeta] = useState(false)
  const [addDisburseDate, setAddDisburseDate] = useState(todayISODate)
  const [addDisburseAmount, setAddDisburseAmount] = useState('')
  const [addDisburseNotes, setAddDisburseNotes] = useState('')
  const [addDisburseAccountId, setAddDisburseAccountId] = useState('')
  const [submittingAddAmount, setSubmittingAddAmount] = useState(false)
  const [closingLoan, setClosingLoan] = useState(false)
  const recordPaymentSectionRef = useRef(null)
  const addAmountSectionRef = useRef(null)
  const scheduleSectionRef = useRef(null)
  const newLoanStartDateRef = useRef(null)
  const newLoanEndDateRef = useRef(null)

  const accountNameById = useMemo(() => {
    const m = new Map()
    for (const a of accounts) m.set(a.id, a.account_name)
    return m
  }, [accounts])

  const loanQueryParams = useMemo(
    () => ({
      loan_type: filterLoanType === 'ALL' ? undefined : filterLoanType,
      status: filterStatus === 'ALL' ? undefined : filterStatus,
      search: searchDebounced.trim() || undefined,
    }),
    [filterLoanType, filterStatus, searchDebounced],
  )

  useEffect(() => {
    const t = window.setTimeout(() => setSearchDebounced(searchBorrower), 400)
    return () => window.clearTimeout(t)
  }, [searchBorrower])

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const [loanData, summaryData, accData] = await Promise.all([
        listFinanceLoans(loanQueryParams),
        getFinanceLoansSummary().catch(() => null),
        listFinanceAccounts(),
      ])
      setLoans(Array.isArray(loanData) ? loanData : [])
      setLoanSummary(summaryData && typeof summaryData === 'object' ? summaryData : null)
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
  }, [onSessionInvalid, loanQueryParams])

  useEffect(() => {
    load()
  }, [load, tick])

  useEffect(() => {
    let cancelled = false
    getLoanDashboardAnalytics(analyticsYear)
      .then((d) => {
        if (!cancelled) setLoanAnalytics(d && typeof d === 'object' ? d : null)
      })
      .catch(() => {
        if (!cancelled) setLoanAnalytics(null)
      })
    return () => {
      cancelled = true
    }
  }, [analyticsYear, tick])

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
    if (!viewLoan) return
    setDetailPhone(viewLoan.borrower_phone ?? '')
    setDetailAddress(viewLoan.borrower_address ?? '')
    setDetailNotes(viewLoan.notes ?? '')
    setShowBorrowerProfileForm(false)
  }, [
    viewLoan?.id,
    viewLoan?.borrower_phone,
    viewLoan?.borrower_address,
    viewLoan?.notes,
  ])

  useEffect(() => {
    if (!viewLoan?.id) return
    setRecordPaymentDate(todayISODate())
    setRecordAmount('')
    setRecordInterest('')
    setRecordReceiveMode('cash')
    setRecordAccountId(accounts[0]?.id != null ? String(accounts[0].id) : '')
    setAddDisburseDate(todayISODate())
    setAddDisburseAmount('')
    setAddDisburseNotes('')
    setAddDisburseAccountId(accounts[0]?.id != null ? String(accounts[0].id) : '')
  }, [viewLoan?.id, accounts])

  useEffect(() => {
    if (!showRecordPaymentForm || !viewLoan || detailLoading) return
    const hasSched = detailSchedule.length > 0
    const can =
      !hasSched &&
      String(viewLoan.status || '').toUpperCase() !== 'CLOSED' &&
      balanceDue(viewLoan) > 0
    if (!can) return
    const t = window.setTimeout(() => {
      recordPaymentSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
    }, 120)
    return () => window.clearTimeout(t)
  }, [showRecordPaymentForm, viewLoan, detailLoading, detailSchedule.length])

  useEffect(() => {
    if (!showAddAmountForm || !viewLoan) return
    const t = window.setTimeout(() => {
      addAmountSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
    }, 120)
    return () => window.clearTimeout(t)
  }, [showAddAmountForm, viewLoan])

  useEffect(() => {
    if (!showNewLoanModal && !viewLoan) return
    const onKey = (e) => {
      if (e.key === 'Escape') {
        setShowNewLoanModal(false)
        setShowRecordPaymentForm(false)
        setShowAddAmountForm(false)
        setViewLoan(null)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [showNewLoanModal, viewLoan])

  function resetNewLoanForm() {
    setBorrowerName('')
    setBorrowerPhone('')
    setBorrowerAddress('')
    setLoanNotesField('')
    setLoanAmount('')
    setInterestRate('')
    setInterestFreeDays('')
    setEndDate('')
    setTermMonths('')
    setCommissionPct('')
    setStartDate(todayISODate())
    setStatus('ACTIVE')
    setLoanKind('emi_schedule')
    setEmiInterestMethod('flat')
    setEmiSettlement('receipt')
  }

  const accrualPreview = useMemo(() => {
    if (loanKind !== 'simple_accrual') return null
    return simpleAccrualPreview(loanAmount, interestRate, startDate)
  }, [loanKind, loanAmount, interestRate, startDate])

  async function refreshDetail() {
    if (!viewLoan?.id) return
    try {
      const [sch, pay] = await Promise.all([
        listLoanSchedule(viewLoan.id),
        listLoanPayments(viewLoan.id),
      ])
      setDetailSchedule(Array.isArray(sch) ? sch : [])
      setDetailPayments(Array.isArray(pay) ? pay : [])
      const data = await listFinanceLoans(loanQueryParams)
      setLoans(Array.isArray(data) ? data : [])
      const updated = (Array.isArray(data) ? data : []).find((x) => x.id === viewLoan.id)
      if (updated) setViewLoan(updated)
    } catch {
      /* ignore */
    }
  }

  async function handleLoanExport(kind) {
    if (!viewLoan?.id) return
    setLoanExportBusy(true)
    try {
      const path =
        kind === 'pdf' ? `/pf/export/loans/${viewLoan.id}/pdf` : `/pf/export/loans/${viewLoan.id}/excel`
      const { blob, filename } = await pfFetchBlob(path)
      const base = String(viewLoan.borrower_name || 'borrower').replace(/\s+/g, '_')
      const fallback = kind === 'pdf' ? `Loan_${base}.pdf` : `Loan_${base}.xlsx`
      triggerDownloadBlob(blob, filename || fallback)
    } catch (e) {
      if (e.status === 401) {
        setPfToken(null)
        onSessionInvalid?.()
      } else {
        window.alert(e.message || 'Export failed')
      }
    } finally {
      setLoanExportBusy(false)
    }
  }

  async function handleLoanSubmit(e) {
    e.preventDefault()
    setSubmittingLoan(true)
    setError('')
    try {
      const base = {
        borrower_name: borrowerName.trim(),
        loan_amount: Number(loanAmount),
        start_date: startDate,
        end_date: endDate || null,
        status: status.trim() || 'ACTIVE',
        loan_kind: loanKind,
        borrower_phone: borrowerPhone.trim() || null,
        borrower_address: borrowerAddress.trim() || null,
        notes: loanNotesField.trim() || null,
      }
      let payload
      if (loanKind === 'interest_free') {
        payload = {
          ...base,
          interest_rate: 0,
          interest_free_days: null,
          term_months: null,
          commission_percent: null,
        }
      } else if (loanKind === 'simple_accrual') {
        const r = Number(interestRate)
        if (!r || r <= 0 || Number.isNaN(r)) {
          setError('Enter annual interest % for simple interest loans.')
          setSubmittingLoan(false)
          return
        }
        payload = {
          ...base,
          interest_rate: r,
          interest_free_days: null,
          term_months: null,
          commission_percent: null,
        }
      } else {
        const tm = termMonths === '' ? null : Number(termMonths)
        const cp = commissionPct === '' ? null : Number(commissionPct)
        const ifd =
          interestFreeDays === '' || interestFreeDays == null
            ? null
            : Math.max(0, Math.floor(Number(interestFreeDays)))
        payload = {
          ...base,
          interest_rate: interestRate === '' ? null : Number(interestRate),
          interest_free_days: ifd != null && !Number.isNaN(ifd) && ifd > 0 ? ifd : null,
          term_months: tm && tm > 0 ? tm : null,
          commission_percent: cp != null && !Number.isNaN(cp) && cp > 0 ? cp : null,
          emi_interest_method: emiInterestMethod,
          emi_settlement: emiSettlement,
        }
      }
      await createFinanceLoan(payload)
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

  async function handleAddAmountSubmit(e) {
    e.preventDefault()
    if (!viewLoan?.id) return
    const amt = Number(addDisburseAmount)
    if (!amt || amt <= 0 || Number.isNaN(amt)) {
      setError('Enter a valid amount to add.')
      return
    }
    const acc = Number(addDisburseAccountId)
    if (!acc || Number.isNaN(acc)) {
      setError('Select the bank account the funds are paid from.')
      return
    }
    setSubmittingAddAmount(true)
    setError('')
    try {
      await addLoanPrincipalAmount(viewLoan.id, {
        amount: amt,
        disbursement_date: addDisburseDate,
        finance_account_id: acc,
        notes: addDisburseNotes,
      })
      setShowAddAmountForm(false)
      await refreshDetail()
      refresh()
    } catch (err) {
      if (err.status === 401) {
        setPfToken(null)
        onSessionInvalid?.()
      } else {
        setError(err.message || 'Could not add amount')
      }
    } finally {
      setSubmittingAddAmount(false)
    }
  }

  async function handleCloseLoan() {
    if (!viewLoan?.id) return
    const ok = window.confirm(
      'Close this loan? It only works when there is no outstanding balance (all EMIs paid or manual balance cleared).',
    )
    if (!ok) return
    setClosingLoan(true)
    setError('')
    try {
      await closeFinanceLoan(viewLoan.id)
      setViewLoan(null)
      setShowRecordPaymentForm(false)
      setShowAddAmountForm(false)
      await load()
      refresh()
    } catch (err) {
      if (err.status === 401) {
        setPfToken(null)
        onSessionInvalid?.()
      } else {
        setError(err.message || 'Could not close loan')
      }
    } finally {
      setClosingLoan(false)
    }
  }

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
      setShowRecordPaymentForm(false)
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

  async function handleSaveBorrowerMeta(e) {
    e.preventDefault()
    if (!viewLoan?.id) return
    setSavingBorrowerMeta(true)
    setError('')
    try {
      const updated = await patchFinanceLoan(viewLoan.id, {
        borrower_phone: detailPhone.trim() || null,
        borrower_address: detailAddress.trim() || null,
        notes: detailNotes.trim() || null,
      })
      setViewLoan(updated)
      await load()
      refresh()
    } catch (err) {
      if (err.status === 401) {
        setPfToken(null)
        onSessionInvalid?.()
      } else {
        setError(err.message || 'Could not save borrower details')
      }
    } finally {
      setSavingBorrowerMeta(false)
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

  function openRecordFlow(l) {
    setShowAddAmountForm(false)
    setViewLoan(l)
    setShowRecordPaymentForm(canRecordPaymentFromList(l))
  }

  const loanAlerts = useMemo(() => {
    if (!loanSummary) return []
    const items = []
    const seen = new Set()
    const push = (tier, label, borrower, amount, due, loanId, emiNum) => {
      const k = `${loanId}-${emiNum ?? 'na'}-${String(due || '').slice(0, 10)}-${tier}`
      if (seen.has(k)) return
      seen.add(k)
      items.push({ tier, label, borrower, amount, due, loanId })
    }
    for (const r of loanSummary.reminders || []) {
      let tier = 'soon'
      let label = r.kind || 'REMINDER'
      if (r.kind === 'OVERDUE') {
        tier = 'overdue'
        label = 'OVERDUE'
      } else if (r.kind === 'DUE_TODAY') {
        tier = 'soon'
        label = 'DUE TODAY'
      } else if (r.kind === 'DUE_TOMORROW') {
        tier = 'soon'
        label = 'DUE TOMORROW'
      }
      push(tier, label, r.borrower_name, r.emi_amount, r.due_date, r.loan_id, r.emi_number)
    }
    for (const u of loanSummary.upcoming_emis_this_week || []) {
      const dueStr = String(u.due_date).slice(0, 10)
      const d = daysFromTodayLoan(dueStr)
      let tier = 'week'
      let label = 'THIS WEEK'
      if (d != null && d < 0) {
        tier = 'overdue'
        label = 'OVERDUE'
      } else if (d === 0) {
        tier = 'soon'
        label = 'DUE TODAY'
      } else if (d === 1) {
        tier = 'soon'
        label = 'DUE TOMORROW'
      }
      push(tier, label, u.borrower_name, u.emi_amount, u.due_date, u.loan_id, u.emi_number)
    }
    const rank = { overdue: 0, soon: 1, week: 2 }
    items.sort(
      (a, b) =>
        (rank[a.tier] ?? 9) - (rank[b.tier] ?? 9) ||
        String(a.due || '').localeCompare(String(b.due || '')),
    )
    return items
  }, [loanSummary])

  const kpiGlass =
    'rounded-2xl border p-4 shadow-[var(--pf-shadow)] backdrop-blur-md transition dark:border-[var(--pf-border)] dark:bg-white/[0.04]'
  const chartTitle = 'text-sm font-bold text-slate-900 dark:text-[var(--pf-text)]'
  const chartSub = 'mt-0.5 text-xs text-slate-500 dark:text-[var(--pf-text-muted)]'

  const modalPanelPb =
    'pb-[max(1.5rem,calc(5.5rem+env(safe-area-inset-bottom)))]'

  return (
    <div className="space-y-10">
      <PageHeader
        title="Loans"
        description="Lending status, collections, and who owes you next — a loan manager view, not just a ledger table."
        action={
          <button
            type="button"
            onClick={() => {
              resetNewLoanForm()
              setShowNewLoanModal(true)
            }}
            className={`${btnPrimary} inline-flex gap-2`}
          >
            <PlusIcon className="h-5 w-5" />
            New loan
          </button>
        }
      />

      {error ? (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:border-amber-900/40 dark:bg-amber-950/30 dark:text-amber-100">
          {error}
        </div>
      ) : null}

      {loanSummary ? (
        <section aria-label="Summary" className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          {[
            { label: 'Total lent', value: formatInr(loanSummary.total_given) },
            { label: 'Total collected', value: formatInr(loanSummary.total_received) },
            { label: 'Total outstanding', value: formatInr(loanSummary.total_outstanding) },
            {
              label: 'Overdue amount',
              value: formatInr(loanSummary.overdue_amount),
              warn: Number(loanSummary.overdue_amount) > 0,
            },
            { label: 'Interest earned', value: formatInr(loanSummary.interest_earned_lifetime) },
          ].map((c) => (
            <div
              key={c.label}
              className={`${kpiGlass} ${c.warn ? 'border-red-500/30 bg-red-500/[0.04]' : ''}`}
            >
              <p className="text-[11px] font-bold uppercase tracking-wider text-[var(--pf-text-muted)]">{c.label}</p>
              <p className="mt-2 font-mono text-lg font-bold tabular-nums text-[var(--pf-text)] sm:text-xl">{c.value}</p>
            </div>
          ))}
        </section>
      ) : null}

      {loanAlerts.length > 0 ? (
        <section aria-label="Alerts" className="space-y-3">
          <div>
            <h2 className="text-xs font-bold uppercase tracking-[0.16em] text-[var(--pf-text-muted)]">
              EMI &amp; collections
            </h2>
            <p className="mt-1 text-sm text-[var(--pf-text-muted)]">What needs attention first.</p>
          </div>
          <div className="grid gap-2 sm:grid-cols-2">
            {loanAlerts.slice(0, 16).map((a, idx) => {
              const shell =
                a.tier === 'overdue'
                  ? 'border-red-500/40 bg-red-500/[0.08]'
                  : a.tier === 'soon'
                    ? 'border-amber-500/40 bg-amber-500/[0.08]'
                    : 'border-sky-500/35 bg-sky-500/[0.06]'
              const IconCmp =
                a.tier === 'overdue' ? ExclamationTriangleIcon : a.tier === 'soon' ? ClockIcon : CalendarDaysIcon
              return (
                <div
                  key={`${a.loanId}-${idx}-${a.label}`}
                  className={`flex gap-3 rounded-xl border p-4 backdrop-blur-sm ${shell}`}
                >
                  <IconCmp
                    className={`h-6 w-6 shrink-0 ${
                      a.tier === 'overdue' ? 'text-red-400' : a.tier === 'soon' ? 'text-amber-400' : 'text-sky-400'
                    }`}
                    aria-hidden
                  />
                  <div className="min-w-0 flex-1">
                    <p className="text-[10px] font-bold uppercase tracking-wide text-[var(--pf-text-muted)]">{a.label}</p>
                    <p className="mt-1 font-semibold text-[var(--pf-text)]">{a.borrower}</p>
                    <p className="mt-0.5 text-sm text-[var(--pf-text-muted)]">
                      <span className="font-mono font-semibold text-[var(--pf-text)]">
                        {a.amount != null ? formatInr(a.amount) : '—'}
                      </span>
                      {a.due ? (
                        <>
                          {' '}
                          · Due {formatShortDue(a.due)}
                        </>
                      ) : null}
                    </p>
                    <button
                      type="button"
                      className="mt-2 text-xs font-semibold text-[var(--pf-primary)] hover:underline"
                      onClick={() => {
                        const ln = loans.find((x) => x.id === a.loanId)
                        if (ln) {
                          setShowRecordPaymentForm(false)
                          setShowAddAmountForm(false)
                          setViewLoan(ln)
                        }
                      }}
                    >
                      Open loan →
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        </section>
      ) : null}

      <div className={`${cardCls} flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end`}>
        <div className="min-w-[10rem] flex-1">
          <PremiumSelect
            id="pf-loan-filter-type"
            label="Loan type"
            labelClassName={labelCls}
            className="w-full sm:w-auto"
            value={filterLoanType}
            onChange={setFilterLoanType}
            options={[
              { value: 'ALL', label: 'All types' },
              { value: 'EMI', label: 'EMI' },
              { value: 'INTEREST_FREE', label: 'Interest-free' },
              { value: 'SIMPLE_INTEREST', label: 'Simple interest' },
            ]}
          />
        </div>
        <div className="min-w-[10rem] flex-1">
          <PremiumSelect
            id="pf-loan-filter-status"
            label="Status"
            labelClassName={labelCls}
            className="w-full sm:w-auto"
            value={filterStatus}
            onChange={setFilterStatus}
            options={[
              { value: 'ALL', label: 'All' },
              { value: 'ACTIVE', label: 'Active' },
              { value: 'CLOSED', label: 'Closed' },
              { value: 'OVERDUE', label: 'Overdue' },
              { value: 'COMPLETED', label: 'Completed' },
            ]}
          />
        </div>
        <div className="min-w-[12rem] flex-[2]">
          <label className={labelCls} htmlFor="pf-loan-search">
            Search borrower
          </label>
          <input
            id="pf-loan-search"
            type="search"
            placeholder="Name…"
            className={inputCls}
            value={searchBorrower}
            onChange={(e) => setSearchBorrower(e.target.value)}
            autoComplete="off"
          />
        </div>
      </div>

      <div className={cardCls}>
        <div>
          <h2 className="text-base font-bold text-[var(--pf-text)]">Loan portfolio</h2>
          <p className="mt-1 text-sm text-[var(--pf-text-muted)]">
            Overview cards and the register — outstanding, EMI, and due dates first.
          </p>
        </div>
        {loading ? (
          <p className="mt-4 text-sm text-[var(--pf-text-muted)]">Loading…</p>
        ) : loans.length === 0 ? (
          <p className="mt-4 text-sm text-[var(--pf-text-muted)]">No loans yet — use New loan.</p>
        ) : (
          <>
            <div className="mt-6 hidden gap-4 md:grid md:grid-cols-2 xl:grid-cols-3">
              {loans.map((l) => (
                <LoanOverviewCard
                  key={`overview-${l.id}`}
                  l={l}
                  onView={() => {
                    setShowRecordPaymentForm(false)
                    setShowAddAmountForm(false)
                    setViewLoan(l)
                  }}
                  onRecord={() => openRecordFlow(l)}
                  recordEnabled={canPrimaryRecordLoan(l)}
                />
              ))}
            </div>
            <div className="mt-4 space-y-4 md:hidden">
              {loans.map((l) => (
                <LoanOverviewCard
                  key={l.id}
                  l={l}
                  onView={() => {
                    setShowRecordPaymentForm(false)
                    setShowAddAmountForm(false)
                    setViewLoan(l)
                  }}
                  onRecord={() => openRecordFlow(l)}
                  recordEnabled={canPrimaryRecordLoan(l)}
                  onDelete={() => handleDeleteLoan(l)}
                  deletingId={deletingId}
                />
              ))}
            </div>
            <div className="mt-8">
              <h3 className="text-sm font-bold text-[var(--pf-text)]">All loans</h3>
              <p className="mt-0.5 text-xs text-[var(--pf-text-muted)]">Full register for quick scanning.</p>
            </div>
            <div className={`${pfTableWrap} mt-3 hidden md:block`}>
              <table className={`${pfTable} min-w-[1000px]`}>
                <thead>
                  <tr>
                    <th className={pfTh}>Borrower</th>
                    <th className={pfThRight}>Outstanding</th>
                    <th className={pfThRight}>EMI</th>
                    <th className={pfThRight}>Next due</th>
                    <th className={pfThRight}>Interest</th>
                    <th className={pfTh}>Progress</th>
                    <th className={pfTh}>Status</th>
                    <th className={`${pfThRight} ${pfThActionsWide}`}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {loans.map((l) => {
                    const pct = loanCollectedPercent(l)
                    const emiN = emiDisplayForLoan(l)
                    const rowTint =
                      l.is_overdue || l.display_status === 'OVERDUE'
                        ? 'bg-red-500/[0.06] dark:bg-red-950/25'
                        : ''
                    return (
                      <tr key={l.id} className={`${pfTrHover} ${rowTint}`}>
                        <td className={`${pfTd} max-w-[12rem]`}>
                          <div className="font-bold text-[var(--pf-text)]">{l.borrower_name}</div>
                          <div className="mt-1">
                            <span
                              className={`inline-flex rounded-full px-2 py-0.5 text-[9px] font-bold uppercase tracking-wide ${loanTypeBadgeCls(l.loan_type)}`}
                            >
                              {loanTypeLabel(l.loan_type)}
                            </span>
                          </div>
                        </td>
                        <td className={`${pfTdRight} font-mono text-sm font-semibold tabular-nums text-[var(--pf-text)]`}>
                          {formatInr(balanceDue(l))}
                        </td>
                        <td className={`${pfTdRight} font-mono text-sm tabular-nums text-[var(--pf-text)]`}>
                          {emiN != null ? formatInr(emiN) : '—'}
                        </td>
                        <td className={`${pfTdRight} text-sm font-medium ${tableDueCellCls(l)}`}>
                          {l.next_emi_due ? formatShortDue(l.next_emi_due) : '—'}
                        </td>
                        <td className={`${pfTdRight} text-sm font-medium text-[var(--pf-text)]`}>
                          {interestDisplayLoan(l)}
                        </td>
                        <td className={`${pfTd} max-w-[9rem]`}>
                          {pct != null ? (
                            <>
                              <div className="text-[10px] font-semibold tabular-nums text-[var(--pf-text-muted)]">
                                {pct}%
                              </div>
                              <div className="mt-1 h-3 w-full overflow-hidden rounded-full bg-black/10 dark:bg-white/10">
                                <div
                                  className={`h-full rounded-full transition-[width] duration-500 ease-out ${progressBarTone(pct)}`}
                                  style={{ width: `${pct}%` }}
                                />
                              </div>
                            </>
                          ) : (
                            <span className="text-xs text-[var(--pf-text-muted)]">—</span>
                          )}
                        </td>
                        <td className={pfTd}>{displayStatusBadge(l.display_status, l.is_overdue)}</td>
                        <td className={pfTdActions}>
                          <div className={`${pfActionRow} relative`}>
                            <button
                              type="button"
                              disabled={!canPrimaryRecordLoan(l)}
                              onClick={() => openRecordFlow(l)}
                              className={`${btnPrimary} inline-flex items-center gap-1 px-3 py-1.5 text-xs disabled:opacity-50`}
                            >
                              <BanknotesIcon className="h-3.5 w-3.5" />
                              Record
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                setShowRecordPaymentForm(false)
                                setShowAddAmountForm(false)
                                setViewLoan(l)
                              }}
                              className={`${btnSecondary} px-3 py-1.5 text-xs`}
                            >
                              View
                            </button>
                            <div className="relative">
                              <button
                                type="button"
                                className={`${btnSecondary} inline-flex items-center px-2 py-1.5 text-xs`}
                                aria-label="More actions"
                                onClick={(e) => {
                                  e.stopPropagation()
                                  setActionsMenuLoanId((id) => (id === l.id ? null : l.id))
                                }}
                              >
                                <EllipsisVerticalIcon className="h-5 w-5" />
                              </button>
                              {actionsMenuLoanId === l.id ? (
                                <div
                                  className="absolute right-0 z-20 mt-1 min-w-[10rem] rounded-xl border border-[var(--pf-border)] bg-[var(--pf-card)] py-1 shadow-lg"
                                  onClick={(e) => e.stopPropagation()}
                                >
                                  <button
                                    type="button"
                                    className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-red-600 hover:bg-red-500/10 dark:text-red-400"
                                    onClick={() => {
                                      setActionsMenuLoanId(null)
                                      handleDeleteLoan(l)
                                    }}
                                  >
                                    <TrashIcon className="h-4 w-4 shrink-0" />
                                    Delete loan
                                  </button>
                                </div>
                              ) : null}
                            </div>
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>

      {loanAnalytics ? (
        <section className="space-y-4" aria-label="Loan analytics">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h2 className="text-sm font-bold text-[var(--pf-text)]">Loan analytics</h2>
              <p className="mt-0.5 text-xs text-[var(--pf-text-muted)]">
                Collections and interest by month ({analyticsYear}). Snapshot KPIs from your book.
              </p>
            </div>
            <div className="flex flex-col sm:items-end">
              <PremiumSelect
                label="Year"
                labelClassName="text-xs font-medium text-[var(--pf-text-muted)]"
                className="mt-0 sm:min-w-[5.5rem]"
                value={String(analyticsYear)}
                onChange={(v) => setAnalyticsYear(Number(v))}
                options={(() => {
                  const cy = new Date().getFullYear()
                  return Array.from({ length: 7 }, (_, i) => cy - 5 + i).map((y) => ({
                    value: String(y),
                    label: String(y),
                  }))
                })()}
              />
            </div>
          </div>
          <div className="grid gap-6 lg:grid-cols-2">
            <div className={`${pfChartCard} min-h-[280px]`}>
              <p className={chartTitle}>Collections by month</p>
              <p className={chartSub}>Total received per month</p>
              <div className="mt-4 h-[220px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart
                    data={(loanAnalytics.collections_by_month ?? []).map((r) => ({
                      month: r.month,
                      amount: Number(r.amount) || 0,
                    }))}
                    margin={{ top: 8, right: 8, left: 0, bottom: 0 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" className="stroke-[var(--pf-border)] opacity-40" />
                    <XAxis dataKey="month" tick={{ fontSize: 10 }} stroke="var(--pf-text-muted)" />
                    <YAxis tick={{ fontSize: 10 }} tickFormatter={(v) => formatInr(v)} width={72} />
                    <Tooltip
                      formatter={(v) => formatInr(v)}
                      contentStyle={{
                        background: 'var(--pf-card)',
                        border: '1px solid var(--pf-border)',
                        borderRadius: '12px',
                      }}
                    />
                    <Line
                      type="monotone"
                      dataKey="amount"
                      name="Collected"
                      stroke="var(--pf-primary)"
                      strokeWidth={2.5}
                      dot
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>
            <div className={`${pfChartCard} min-h-[280px]`}>
              <p className={chartTitle}>Interest collected by month</p>
              <p className={chartSub}>From repayment records</p>
              <div className="mt-4 h-[220px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart
                    data={(loanAnalytics.interest_profit_by_month ?? []).map((r) => ({
                      month: r.month,
                      amount: Number(r.amount) || 0,
                    }))}
                    margin={{ top: 8, right: 8, left: 0, bottom: 0 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" className="stroke-[var(--pf-border)] opacity-40" />
                    <XAxis dataKey="month" tick={{ fontSize: 10 }} stroke="var(--pf-text-muted)" />
                    <YAxis tick={{ fontSize: 10 }} tickFormatter={(v) => formatInr(v)} width={72} />
                    <Tooltip
                      formatter={(v) => formatInr(v)}
                      contentStyle={{
                        background: 'var(--pf-card)',
                        border: '1px solid var(--pf-border)',
                        borderRadius: '12px',
                      }}
                    />
                    <Line
                      type="monotone"
                      dataKey="amount"
                      name="Interest"
                      stroke="#a855f7"
                      strokeWidth={2.5}
                      dot
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>
            <div className={`${pfChartCard} min-h-[260px]`}>
              <p className={chartTitle}>Given vs collected vs outstanding</p>
              <p className={chartSub}>Book snapshot</p>
              <div className="mt-4 h-[200px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={[
                      {
                        name: 'Position',
                        given: Number(loanAnalytics.given_vs_collected_vs_remaining?.given) || 0,
                        collected: Number(loanAnalytics.given_vs_collected_vs_remaining?.collected) || 0,
                        remaining: Number(loanAnalytics.given_vs_collected_vs_remaining?.remaining) || 0,
                      },
                    ]}
                    margin={{ top: 8, right: 8, left: 8, bottom: 0 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" className="stroke-[var(--pf-border)] opacity-40" />
                    <XAxis dataKey="name" tick={{ fontSize: 10 }} />
                    <YAxis tick={{ fontSize: 10 }} tickFormatter={(v) => formatInr(v)} width={72} />
                    <Tooltip
                      formatter={(v) => formatInr(v)}
                      contentStyle={{
                        background: 'var(--pf-card)',
                        border: '1px solid var(--pf-border)',
                        borderRadius: '12px',
                      }}
                    />
                    <Legend />
                    <Bar dataKey="given" name="Lent (principal)" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="collected" name="Collected" fill="#10b981" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="remaining" name="Outstanding" fill="#f59e0b" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
            <div className={`${pfChartCard} min-h-[260px]`}>
              <p className={chartTitle}>Risk & EMI (snapshot)</p>
              <p className={chartSub}>From analytics API — use alerts above for action items</p>
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                <div className="rounded-xl border border-[var(--pf-border)] bg-white/5 px-4 py-3 dark:bg-white/[0.03]">
                  <p className="text-xs text-[var(--pf-text-muted)]">Overdue EMI (amount)</p>
                  <p className="mt-1 font-mono text-lg font-bold tabular-nums text-red-600 dark:text-red-400">
                    {formatInr(loanAnalytics.overdue_emi_amount ?? 0)}
                  </p>
                </div>
                <div className="rounded-xl border border-[var(--pf-border)] bg-white/5 px-4 py-3 dark:bg-white/[0.03]">
                  <p className="text-xs text-[var(--pf-text-muted)]">EMI due this month</p>
                  <p className="mt-1 font-mono text-lg font-bold tabular-nums text-[var(--pf-text)]">
                    {formatInr(loanAnalytics.emi_due_this_month ?? 0)}
                  </p>
                </div>
              </div>
            </div>
          </div>
          <div className={`${pfChartCard} min-h-[260px]`}>
            <p className={chartTitle}>Active vs closed loans</p>
            <p className={chartSub}>Loan count</p>
            <div className="mt-4 h-[200px] w-full">
              {(() => {
                const pieLoan = (loanAnalytics.active_vs_closed_pie ?? []).filter((x) => Number(x.value) > 0)
                return pieLoan.length === 0 ? (
                  <p className="flex h-[180px] items-center justify-center text-sm text-[var(--pf-text-muted)]">
                    No data
                  </p>
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={pieLoan}
                        dataKey="value"
                        nameKey="name"
                        cx="50%"
                        cy="50%"
                        outerRadius={78}
                        label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                      >
                        {pieLoan.map((_, i) => (
                          <Cell key={i} fill={LOAN_PIE_COLORS[i % LOAN_PIE_COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip />
                      <Legend />
                    </PieChart>
                  </ResponsiveContainer>
                )
              })()}
            </div>
          </div>
        </section>
      ) : null}

      <AppModal
        open={showNewLoanModal}
        onClose={() => !submittingLoan && setShowNewLoanModal(false)}
        title="New loan"
        subtitle="Create a loan you’ve given — EMI schedule, interest-free, or simple accrual."
        maxWidthClass="max-w-2xl"
        footer={
          <>
            <AppButton type="button" variant="secondary" disabled={submittingLoan} onClick={() => setShowNewLoanModal(false)}>
              Cancel
            </AppButton>
            <AppButton type="submit" variant="primary" disabled={submittingLoan} form="pf-new-loan-form">
              {submittingLoan ? 'Saving…' : 'Create loan'}
            </AppButton>
          </>
        }
      >
            <form id="pf-new-loan-form" onSubmit={handleLoanSubmit} className="grid gap-4 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Loan type</p>
                <PfSegmentedControl
                  className="mt-2 w-full"
                  options={[
                    { id: 'emi_schedule', label: 'EMI schedule' },
                    { id: 'interest_free', label: 'Interest-free' },
                    { id: 'simple_accrual', label: 'Simple interest' },
                  ]}
                  value={loanKind}
                  onChange={setLoanKind}
                />
                {loanKind === 'interest_free' ? (
                  <p className="mt-2 rounded-xl bg-sky-50 px-3 py-2 text-xs text-sky-950">
                    For friends: no interest. Amount they owe stays equal to principal until they repay (no EMI table).
                  </p>
                ) : null}
                {loanKind === 'simple_accrual' ? (
                  <p className="mt-2 rounded-xl bg-amber-50 px-3 py-2 text-xs text-amber-950">
                    Ongoing loan: interest builds by the day from <strong>start date</strong> through <strong>today</strong> (365-day simple interest). A future start date means ₹0 interest until then.
                  </p>
                ) : null}
              </div>
              {loanKind === 'emi_schedule' ? (
                <div className="sm:col-span-2 grid gap-3 rounded-xl border border-slate-200 bg-slate-50/90 p-3 dark:border-slate-600 dark:bg-slate-900/40">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                      EMI interest method
                    </p>
                    <PfSegmentedControl
                      className="mt-2 w-full"
                      options={[
                        { id: 'flat', label: 'Flat interest' },
                        { id: 'reducing_balance', label: 'Reducing balance' },
                      ]}
                      value={emiInterestMethod}
                      onChange={setEmiInterestMethod}
                    />
                    <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                      <strong className="font-medium text-slate-600 dark:text-slate-300">Flat:</strong> interest = P×r×years,
                      EMI = (principal + interest) ÷ months.{' '}
                      <strong className="font-medium text-slate-600 dark:text-slate-300">Reducing:</strong> standard
                      amortization (monthly rate = annual % ÷ 12). Interest-free days apply only to flat interest.
                    </p>
                  </div>
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                      When EMI is marked paid
                    </p>
                    <PfSegmentedControl
                      className="mt-2 w-full"
                      options={[
                        { id: 'receipt', label: 'Receipt (money in)' },
                        { id: 'payment', label: 'Payment (expense)' },
                      ]}
                      value={emiSettlement}
                      onChange={setEmiSettlement}
                    />
                    <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                      Receipt credits your bank when you assign an account. Payment logs an expense and debits the bank
                      (use for EMIs you pay).
                    </p>
                  </div>
                </div>
              ) : null}
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
                <label htmlFor="ln-phone" className={labelCls}>
                  Borrower phone <span className="font-normal text-slate-400">(optional)</span>
                </label>
                <input
                  id="ln-phone"
                  className={inputCls}
                  value={borrowerPhone}
                  onChange={(e) => setBorrowerPhone(e.target.value)}
                  inputMode="tel"
                  autoComplete="tel"
                />
              </div>
              <div>
                <label htmlFor="ln-addr" className={labelCls}>
                  Borrower address <span className="font-normal text-slate-400">(optional)</span>
                </label>
                <input id="ln-addr" className={inputCls} value={borrowerAddress} onChange={(e) => setBorrowerAddress(e.target.value)} />
              </div>
              <div className="sm:col-span-2">
                <label htmlFor="ln-notes" className={labelCls}>
                  Notes <span className="font-normal text-slate-400">(optional)</span>
                </label>
                <textarea
                  id="ln-notes"
                  rows={2}
                  className={`${inputCls} resize-y`}
                  value={loanNotesField}
                  onChange={(e) => setLoanNotesField(e.target.value)}
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
              {loanKind === 'interest_free' ? (
                <div className="flex flex-col justify-end rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5">
                  <p className="text-xs font-semibold text-slate-600">Interest</p>
                  <p className="mt-0.5 text-sm font-bold text-slate-800">0% — principal only</p>
                </div>
              ) : (
                <div>
                  <label htmlFor="ln-rate" className={labelCls}>
                    Interest % {loanKind === 'simple_accrual' ? '(required)' : '(optional)'}
                  </label>
                  <input
                    id="ln-rate"
                    type="number"
                    step="0.01"
                    min="0"
                    className={inputCls}
                    value={interestRate}
                    onChange={(e) => setInterestRate(e.target.value)}
                    required={loanKind === 'simple_accrual'}
                  />
                </div>
              )}
              {loanKind === 'emi_schedule' ? (
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
                    With <strong className="font-medium text-slate-600">flat EMI</strong> and term + rate, total interest is
                    reduced as if accrual starts after this many days (ignored for reducing-balance EMI).
                  </p>
                </div>
              ) : (
                <div aria-hidden className="hidden sm:block" />
              )}
              <div>
                <label htmlFor="ln-start" className={labelCls}>
                  Start date
                </label>
                <div className="relative mt-1 flex items-center gap-2">
                  <input
                    ref={newLoanStartDateRef}
                    id="ln-start"
                    type="date"
                    className={`${inputCls} pf-date-with-btn !mt-0 min-w-0 flex-1 pr-2`}
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    required
                  />
                  <button
                    type="button"
                    className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-[10px] border border-[var(--pf-border)] bg-[var(--pf-input-bg)] text-[var(--pf-primary)] shadow-sm transition hover:bg-[var(--pf-card-hover)] active:scale-[0.97]"
                    aria-label="Open calendar for start date"
                    onClick={() => openNativeDatePicker(newLoanStartDateRef.current)}
                  >
                    <CalendarDaysIcon className="h-5 w-5" aria-hidden />
                  </button>
                </div>
              </div>
              <div>
                <label htmlFor="ln-end" className={labelCls}>
                  End date (optional)
                </label>
                <div className="relative mt-1 flex items-center gap-2">
                  <input
                    ref={newLoanEndDateRef}
                    id="ln-end"
                    type="date"
                    className={`${inputCls} pf-date-with-btn !mt-0 min-w-0 flex-1 pr-2`}
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                  />
                  <button
                    type="button"
                    className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-[10px] border border-[var(--pf-border)] bg-[var(--pf-input-bg)] text-[var(--pf-primary)] shadow-sm transition hover:bg-[var(--pf-card-hover)] active:scale-[0.97]"
                    aria-label="Open calendar for end date"
                    onClick={() => openNativeDatePicker(newLoanEndDateRef.current)}
                  >
                    <CalendarDaysIcon className="h-5 w-5" aria-hidden />
                  </button>
                </div>
              </div>
              <div>
                <label htmlFor="ln-status" className={labelCls}>
                  Status
                </label>
                <input id="ln-status" className={inputCls} value={status} onChange={(e) => setStatus(e.target.value)} />
              </div>
              {loanKind === 'emi_schedule' ? (
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
              ) : (
                <div aria-hidden className="hidden sm:block" />
              )}
              {loanKind === 'emi_schedule' ? (
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
              ) : null}
              {loanKind === 'simple_accrual' && accrualPreview ? (
                <div className="sm:col-span-2 rounded-xl border border-amber-200 bg-amber-50/90 px-3 py-3 text-sm text-amber-950">
                  <p className="font-semibold">Estimated through today</p>
                  <p className="mt-1 tabular-nums">
                    {accrualPreview.days} day{accrualPreview.days === 1 ? '' : 's'} since start · Accrued{' '}
                    {formatInr(accrualPreview.accrued)} · <strong>Total due {formatInr(accrualPreview.total)}</strong>
                  </p>
                  <p className="mt-1 text-xs text-amber-900/85">
                    Same 365-day simple formula is applied when you create the loan (principal + accrued interest).
                  </p>
                </div>
              ) : null}
              {loanKind === 'simple_accrual' && loanAmount && interestRate && startDate && !accrualPreview ? (
                <p className="sm:col-span-2 text-xs text-slate-500">Enter valid principal, rate, and start date to preview total due.</p>
              ) : null}
            </form>
      </AppModal>

      {viewLoan ? (
        <div
          className={pfModalOverlay}
          role="dialog"
          aria-modal="true"
          aria-labelledby="pf-schedule-title"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) {
              setShowRecordPaymentForm(false)
              setShowAddAmountForm(false)
              setViewLoan(null)
            }
          }}
        >
          <div
            className={`${pfModalSurface} max-w-5xl p-5 md:p-6 ${modalPanelPb}`}
            onMouseDown={(e) => e.stopPropagation()}
          >
            <div className={`${pfModalHeader} flex-wrap`}>
              <div className="min-w-0 flex-1">
                <h2 id="pf-schedule-title" className="text-lg font-semibold text-[var(--pf-text)]">
                  {viewLoan.borrower_name}
                </h2>
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <span
                    className={`inline-flex rounded-full px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-wide ${loanTypeBadgeCls(viewLoan.loan_type)}`}
                  >
                    {loanTypeLabel(viewLoan.loan_type)}
                  </span>
                  {displayStatusBadge(viewLoan.display_status, viewLoan.is_overdue)}
                </div>
                {viewLoan.has_emi_schedule ? (
                  <p className="mt-1.5 text-[11px] text-slate-500 dark:text-slate-400">
                    Method:{' '}
                    <span className="font-semibold text-slate-600 dark:text-slate-300">
                      {String(viewLoan.emi_interest_method || 'FLAT')
                        .toLowerCase()
                        .replace(/_/g, ' ')}
                    </span>
                    {' · '}
                    Settlement:{' '}
                    <span className="font-semibold text-slate-600 dark:text-slate-300">
                      {String(viewLoan.emi_settlement || 'RECEIPT').toLowerCase() === 'payment'
                        ? 'payment (expense)'
                        : 'receipt'}
                    </span>
                  </p>
                ) : null}
                <div className="mt-2 grid gap-2 text-xs text-slate-600 dark:text-slate-400 sm:grid-cols-2 lg:grid-cols-3">
                  <p>
                    <span className="font-semibold text-slate-700 dark:text-slate-300">Given</span>{' '}
                    {formatInr(viewLoan.loan_amount)}
                  </p>
                  <p>
                    <span className="font-semibold text-slate-700 dark:text-slate-300">Balance due</span>{' '}
                    {formatInr(balanceDue(viewLoan))}
                  </p>
                  <p>
                    <span className="font-semibold text-slate-700 dark:text-slate-300">Interest collected</span>{' '}
                    {formatInr(viewLoan.interest_collected_lifetime ?? 0)}
                  </p>
                  <p>
                    <span className="font-semibold text-slate-700 dark:text-slate-300">Next EMI</span>{' '}
                    {viewLoan.next_emi_due ? formatNextEmiDue(viewLoan.next_emi_due) : '—'}
                    {viewLoan.next_emi_amount != null ? ` · ${formatInr(viewLoan.next_emi_amount)}` : ''}
                  </p>
                  <p className="sm:col-span-2">
                    {viewLoan.start_date ? `Start ${viewLoan.start_date}` : ''}
                    {viewLoan.end_date ? ` → ${viewLoan.end_date}` : ''}
                    {viewLoan.interest_rate != null ? ` · ${viewLoan.interest_rate}%` : ''}
                  </p>
                </div>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <PfExportMenu
                  busy={loanExportBusy}
                  items={[
                    { key: 'pdf', label: 'Export PDF', onClick: () => handleLoanExport('pdf') },
                    { key: 'xlsx', label: 'Export Excel', onClick: () => handleLoanExport('excel') },
                  ]}
                />
                <button
                  type="button"
                  onClick={() => {
                    setShowRecordPaymentForm(false)
                    setShowAddAmountForm(false)
                    setShowBorrowerProfileForm(false)
                    setViewLoan(null)
                  }}
                  className={pfModalCloseBtn}
                  aria-label="Close"
                >
                  <XMarkIcon className="h-6 w-6" />
                </button>
              </div>
            </div>

            {!detailLoading ? (
              <div className="mt-4 flex flex-wrap gap-2">
                <button
                  type="button"
                  className={`${btnSecondary} text-xs`}
                  onClick={() => setShowBorrowerProfileForm((v) => !v)}
                >
                  {showBorrowerProfileForm ? 'Hide borrower profile' : 'Edit borrower profile'}
                </button>
                {hasEmiSchedule && String(viewLoan.status || '').toUpperCase() !== 'CLOSED' ? (
                  <button
                    type="button"
                    className={btnSecondary}
                    onClick={() =>
                      scheduleSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
                    }
                  >
                    Record payment
                  </button>
                ) : null}
                {canRecordManualPayment ? (
                  <button
                    type="button"
                    className={btnSecondary}
                    onClick={() => {
                      setShowAddAmountForm(false)
                      setShowRecordPaymentForm((v) => !v)
                    }}
                  >
                    {showRecordPaymentForm ? 'Hide record payment' : '+ Record payment'}
                  </button>
                ) : null}
                {!hasEmiSchedule && String(viewLoan.status || '').toUpperCase() === 'ACTIVE' ? (
                  <button
                    type="button"
                    className={btnSecondary}
                    onClick={() => {
                      setShowRecordPaymentForm(false)
                      setShowAddAmountForm((v) => !v)
                    }}
                  >
                    {showAddAmountForm ? 'Hide add amount' : '+ Add amount'}
                  </button>
                ) : null}
                {String(viewLoan.status || '').toUpperCase() !== 'CLOSED' ? (
                  <button type="button" className={btnDanger} disabled={closingLoan} onClick={handleCloseLoan}>
                    {closingLoan ? '…' : 'Close loan'}
                  </button>
                ) : null}
              </div>
            ) : null}

            {showBorrowerProfileForm ? (
              <form
                onSubmit={handleSaveBorrowerMeta}
                className="mt-4 rounded-xl border border-sky-100 bg-sky-50/40 p-4 dark:border-[var(--pf-border)] dark:bg-[var(--pf-card)]/80"
              >
                <p className="text-xs font-bold uppercase tracking-wide text-sky-900 dark:text-sky-200">Borrower profile</p>
                <div className="mt-3 grid gap-3 sm:grid-cols-2">
                  <div>
                    <label className={labelCls} htmlFor="pf-d-phone">
                      Phone
                    </label>
                    <input
                      id="pf-d-phone"
                      className={inputCls}
                      value={detailPhone}
                      onChange={(e) => setDetailPhone(e.target.value)}
                      inputMode="tel"
                    />
                  </div>
                  <div className="sm:col-span-2">
                    <label className={labelCls} htmlFor="pf-d-addr">
                      Address
                    </label>
                    <input id="pf-d-addr" className={inputCls} value={detailAddress} onChange={(e) => setDetailAddress(e.target.value)} />
                  </div>
                  <div className="sm:col-span-2">
                    <label className={labelCls} htmlFor="pf-d-notes">
                      Notes
                    </label>
                    <textarea
                      id="pf-d-notes"
                      rows={2}
                      className={`${inputCls} resize-y`}
                      value={detailNotes}
                      onChange={(e) => setDetailNotes(e.target.value)}
                    />
                  </div>
                </div>
                <button type="submit" disabled={savingBorrowerMeta} className={`${btnSecondary} mt-3 text-xs`}>
                  {savingBorrowerMeta ? 'Saving…' : 'Save borrower details'}
                </button>
              </form>
            ) : null}

            <div ref={scheduleSectionRef} className="mt-2">
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
                              <PremiumSelect
                                className="max-w-[12rem]"
                                disabled={patchingKey === pk}
                                value={creditSelectValue(s)}
                                onChange={(v) => onCreditChange(viewLoan.id, s.emi_number, v)}
                                aria-label="Cash or bank for this EMI"
                                placeholder="— Not set —"
                                options={[
                                  { value: '', label: '— Not set —' },
                                  { value: 'cash', label: 'Cash' },
                                  ...accounts.map((a) => ({ value: String(a.id), label: a.account_name })),
                                ]}
                                searchable={accounts.length + 2 > 6}
                              />
                            )}
                          </td>
                          <td className={pfTdSm}>
                            <span
                              className={
                                paid
                                  ? 'rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-semibold text-emerald-800'
                                  : 'rounded-full bg-red-100 px-2 py-0.5 text-xs font-semibold text-red-800'
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
                                className="rounded-[12px] bg-[#1E3A8A] px-2 py-1 text-xs font-semibold text-white hover:bg-[#172554] disabled:opacity-60"
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
            </div>

            {!detailLoading && hasEmiSchedule ? (
              <p className="mt-4 rounded-lg border border-sky-100 bg-sky-50/80 px-3 py-2 text-xs text-sky-950">
                This loan uses an EMI schedule — record each collection with <strong className="font-medium">Mark paid</strong> in
                the table. Manual “Record payment” is only for loans without a schedule.
              </p>
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

            {!detailLoading && viewLoan && !hasEmiSchedule && String(viewLoan.status || '').toUpperCase() !== 'CLOSED' && balanceDue(viewLoan) <= 0 ? (
              <p className="mt-4 text-sm text-slate-500">Nothing due — loan balance is cleared.</p>
            ) : null}

            {!detailLoading && showRecordPaymentForm && canRecordManualPayment ? (
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
                        <PremiumSelect
                          className="max-w-md"
                          value={recordAccountId}
                          onChange={setRecordAccountId}
                          aria-label="Bank account to credit"
                          placeholder="— Select account —"
                          options={[
                            { value: '', label: '— Select account —' },
                            ...accounts.map((a) => ({ value: String(a.id), label: a.account_name })),
                          ]}
                          searchable={accounts.length > 6}
                        />
                      ) : null}
                    </div>
                  </div>
                  <div className="sm:col-span-2 lg:col-span-4">
                    <button type="submit" disabled={submittingRecordPayment} className={btnPrimary}>
                      {submittingRecordPayment ? 'Saving…' : 'Save payment'}
                    </button>
                  </div>
                </form>
              </div>
            ) : null}

            {!detailLoading &&
            showAddAmountForm &&
            !hasEmiSchedule &&
            String(viewLoan.status || '').toUpperCase() === 'ACTIVE' ? (
              <div
                ref={addAmountSectionRef}
                className="mt-6 rounded-[16px] border border-sky-200/70 bg-sky-50/40 p-4 ring-1 ring-sky-100/50"
              >
                <h3 className="text-sm font-bold text-sky-950">Add more amount</h3>
                <p className="mt-0.5 text-xs text-slate-600">
                  Increases principal for this borrower. Funds are debited from the bank you select (not available for EMI-schedule
                  loans).
                </p>
                <form onSubmit={handleAddAmountSubmit} className="mt-3 grid gap-3 sm:grid-cols-2">
                  <div>
                    <label htmlFor="pf-add-date" className={labelCls}>
                      Date
                    </label>
                    <input
                      id="pf-add-date"
                      type="date"
                      className={`${inputCls} mt-1`}
                      value={addDisburseDate}
                      onChange={(e) => setAddDisburseDate(e.target.value)}
                      required
                    />
                  </div>
                  <div>
                    <label htmlFor="pf-add-amt" className={labelCls}>
                      Amount (₹)
                    </label>
                    <input
                      id="pf-add-amt"
                      type="number"
                      step="0.01"
                      min="0.01"
                      className={`${inputCls} mt-1`}
                      value={addDisburseAmount}
                      onChange={(e) => setAddDisburseAmount(e.target.value)}
                      required
                    />
                  </div>
                  <div className="sm:col-span-2">
                    <PremiumSelect
                      id="pf-add-acc"
                      label="Given from account"
                      labelClassName={labelCls}
                      value={addDisburseAccountId}
                      onChange={setAddDisburseAccountId}
                      required
                      placeholder="— Select account —"
                      options={[
                        { value: '', label: '— Select account —' },
                        ...accounts.map((a) => ({ value: String(a.id), label: a.account_name })),
                      ]}
                      searchable={accounts.length > 6}
                    />
                  </div>
                  <div className="sm:col-span-2">
                    <label htmlFor="pf-add-notes" className={labelCls}>
                      Notes (optional)
                    </label>
                    <input
                      id="pf-add-notes"
                      className={`${inputCls} mt-1`}
                      value={addDisburseNotes}
                      onChange={(e) => setAddDisburseNotes(e.target.value)}
                      placeholder="e.g. Top-up, second tranche"
                    />
                  </div>
                  <div className="sm:col-span-2">
                    <button type="submit" disabled={submittingAddAmount} className={btnPrimary}>
                      {submittingAddAmount ? 'Saving…' : 'Add amount'}
                    </button>
                  </div>
                </form>
              </div>
            ) : null}
          </div>
        </div>
      ) : null}
    </div>
  )
}
