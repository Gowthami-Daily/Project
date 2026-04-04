import {
  BanknotesIcon,
  CheckCircleIcon,
  ExclamationTriangleIcon,
  PlusIcon,
  XMarkIcon,
} from '@heroicons/react/24/solid'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link, useOutletContext } from 'react-router-dom'
import { Bar, BarChart, CartesianGrid, Cell, Legend, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import {
  addLiabilityPrincipalAmount,
  closeFinanceLiability,
  createFinanceLiability,
  createLiabilityPayment,
  deleteFinanceLiability,
  getFinanceLiability,
  getLiabilitiesSummary,
  listFinanceAccounts,
  listFinanceLiabilities,
  listLiabilityPayments,
  listLiabilitySchedule,
  patchFinanceLiability,
  patchLiabilityScheduleCredit,
  payLiabilityEmi,
  pfFetchBlob,
  setPfToken,
  triggerDownloadBlob,
} from '../api.js'
import PfExportMenu from '../PfExportMenu.jsx'
import PfSegmentedControl from '../PfSegmentedControl.jsx'
import { AppButton, AppModal, PremiumSelect } from '../pfDesignSystem/index.js'
import {
  btnDanger,
  btnPrimary,
  btnSecondary,
  cardCls,
  inputCls,
  labelCls,
  pfChartCard,
  pfModalCloseBtn,
  pfModalHeader,
  pfModalOverlay,
  pfModalSurface,
  pfTable,
  pfTableWrap,
  pfTd,
  pfTdRight,
  pfTdSm,
  pfTdSmRight,
  pfTh,
  pfThRight,
  pfThSm,
  pfThSmActionCol,
  pfThSmRight,
  pfTrHover,
} from '../pfFormStyles.js'
import { formatInr } from '../pfFormat.js'
import { usePfRefresh } from '../pfRefreshContext.jsx'
import { PageHeader } from '../../../components/ui/PageHeader.jsx'

const PIE_COLORS = ['#3b82f6', '#8b5cf6', '#f97316', '#10b981', '#64748b']

const LIABILITY_TYPES = [
  { value: 'CREDIT_CARD', label: 'Credit card' },
  { value: 'PERSONAL_LOAN_BORROWED', label: 'Personal loan (borrowed)' },
  { value: 'AGRICULTURE_LOAN', label: 'Agriculture loan' },
  { value: 'GOLD_LOAN', label: 'Gold loan' },
  { value: 'HOME_LOAN', label: 'Home loan' },
  { value: 'VEHICLE_LOAN', label: 'Vehicle loan' },
  { value: 'EMI_PURCHASE', label: 'EMI purchase' },
  { value: 'BNPL', label: 'BNPL (buy now pay later)' },
  { value: 'BORROWED_PERSON', label: 'Borrowed from person' },
  { value: 'BILLS_PAYABLE', label: 'Bills payable' },
  { value: 'OTHER', label: 'Other' },
]

const FILTER_STATUS_OPTIONS = [
  { value: 'ALL', label: 'All' },
  { value: 'ACTIVE', label: 'Active' },
  { value: 'OVERDUE', label: 'Overdue' },
  { value: 'CLOSED', label: 'Closed' },
  { value: 'PAID', label: 'Paid' },
]

const PAY_FROM_OPTIONS = [
  { value: 'CASH', label: 'Cash' },
  { value: 'BANK', label: 'Bank account' },
]

const LIABILITY_FORM_STATUS_OPTIONS = [
  { value: 'ACTIVE', label: 'Active' },
  { value: 'CLOSED', label: 'Closed' },
]

function todayISODate() {
  return new Date().toISOString().slice(0, 10)
}

function formatShortDate(iso) {
  if (!iso) return '—'
  const d = new Date(`${String(iso).slice(0, 10)}T12:00:00`)
  if (Number.isNaN(d.getTime())) return iso
  return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })
}

function typeLabel(v) {
  return LIABILITY_TYPES.find((t) => t.value === v)?.label || v || '—'
}

function liabilityEmiMethodFromApi(v) {
  const u = String(v || 'FLAT').toUpperCase().replace(/-/g, '_')
  if (u === 'REDUCING_BALANCE') return 'reducing_balance'
  if (u === 'SIMPLE_INTEREST') return 'simple_interest'
  return 'flat'
}

function liabilityEmiMethodLabelFromApi(v) {
  const m = liabilityEmiMethodFromApi(v)
  if (m === 'reducing_balance') return 'reducing balance'
  if (m === 'simple_interest') return 'simple interest'
  return 'flat'
}

function schedulePayFromLabel(s, accountNameById) {
  if (!s) return '—'
  if (s.credit_as_cash) return 'Cash'
  if (s.finance_account_id != null) {
    return accountNameById.get(s.finance_account_id) ?? `Account #${s.finance_account_id}`
  }
  return 'Not set — choose in Pay flow'
}

/** Same rules as Loans → + Add amount: manual book only, not EMI or card products. */
function liabilityAllowsAdditionalPrincipal(r) {
  if (!r || r.has_emi_schedule) return false
  if (String(r.status || '').toUpperCase() !== 'ACTIVE') return false
  const t = String(r.liability_type || '').toUpperCase()
  if (t === 'CREDIT_CARD' || t === 'CREDIT_CARD_STATEMENT') return false
  return true
}

function effectiveDueDateStr(r) {
  const a = r.next_emi_due != null ? String(r.next_emi_due).slice(0, 10) : null
  const b = r.due_date != null ? String(r.due_date).slice(0, 10) : null
  if (!a) return b
  if (!b) return a
  return a <= b ? a : b
}

function daysFromToday(iso) {
  if (!iso) return null
  const t = new Date()
  t.setHours(12, 0, 0, 0)
  const d = new Date(`${String(iso).slice(0, 10)}T12:00:00`)
  if (Number.isNaN(d.getTime())) return null
  return Math.round((d.getTime() - t.getTime()) / 86400000)
}

function groupBucketForType(t) {
  const u = String(t || '').toUpperCase()
  if (u === 'CREDIT_CARD') return 'credit'
  if (
    [
      'HOME_LOAN',
      'VEHICLE_LOAN',
      'PERSONAL_LOAN_BORROWED',
      'AGRICULTURE_LOAN',
      'GOLD_LOAN',
      'EMI_PURCHASE',
    ].includes(u)
  )
    return 'loans'
  return 'other'
}

function monthlyObligationEstimate(r) {
  if (r.has_emi_schedule && r.next_emi_amount != null && Number(r.next_emi_amount) > 0) return Number(r.next_emi_amount)
  if (r.installment_amount != null && Number(r.installment_amount) > 0) return Number(r.installment_amount)
  if (r.minimum_due != null && Number(r.minimum_due) > 0) return Number(r.minimum_due)
  return 0
}

function priorityTier(r) {
  if (r.display_status === 'OVERDUE') return 'high'
  const typ = String(r.liability_type || '').toUpperCase()
  if (typ === 'CREDIT_CARD' || typ === 'BNPL') return 'high'
  const rate = Number(r.interest_rate)
  if (!Number.isNaN(rate) && rate >= 15) return 'high'
  const dd = daysFromToday(effectiveDueDateStr(r))
  if (dd != null && dd >= 0 && dd <= 7) return 'medium'
  if (!Number.isNaN(rate) && rate >= 10) return 'medium'
  return 'low'
}

function liabilitySort(a, b) {
  const ao = a.display_status === 'OVERDUE' ? 0 : 1
  const bo = b.display_status === 'OVERDUE' ? 0 : 1
  if (ao !== bo) return ao - bo
  const rank = { high: 0, medium: 1, low: 2 }
  const pa = rank[priorityTier(a)] ?? 2
  const pb = rank[priorityTier(b)] ?? 2
  if (pa !== pb) return pa - pb
  return String(a.liability_name || '').localeCompare(String(b.liability_name || ''))
}

function payoffPercentPaid(r) {
  const total = Number(r.total_amount) || 0
  const out = Number(r.outstanding_amount) || 0
  if (total <= 0.01) return null
  return Math.min(100, Math.max(0, Math.round(((total - out) / total) * 100)))
}

function liabilityCardRiskShell(r) {
  if (r.display_status === 'OVERDUE') {
    return 'border-red-500/45 bg-red-500/[0.07] ring-1 ring-red-500/25 shadow-[0_8px_30px_rgba(239,68,68,0.12)]'
  }
  const dd = daysFromToday(effectiveDueDateStr(r))
  if (dd != null && dd >= 0 && dd <= 7) {
    return 'border-amber-500/40 bg-amber-500/[0.07] ring-1 ring-amber-400/20 shadow-[0_8px_30px_rgba(245,158,11,0.1)]'
  }
  const rate = Number(r.interest_rate)
  if (!Number.isNaN(rate) && rate >= 15) {
    return 'border-rose-500/35 bg-rose-500/[0.06] ring-1 ring-rose-500/15'
  }
  if (!Number.isNaN(rate) && rate > 0 && rate < 8) {
    return 'border-emerald-500/30 bg-emerald-500/[0.05] ring-1 ring-emerald-500/10'
  }
  return 'border-[var(--pf-border)] bg-white/[0.04] ring-1 ring-[var(--pf-border)]/40 shadow-[var(--pf-shadow)] dark:bg-white/[0.03]'
}

function PriorityRibbon({ tier }) {
  if (tier === 'low') {
    return (
      <span className="rounded-md border border-slate-400/30 bg-slate-500/10 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wide text-slate-300">
        Low priority
      </span>
    )
  }
  if (tier === 'medium') {
    return (
      <span className="rounded-md border border-amber-500/35 bg-amber-500/15 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wide text-amber-200">
        Medium
      </span>
    )
  }
  return (
    <span className="rounded-md border border-red-500/40 bg-red-500/15 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wide text-red-200">
      High priority
    </span>
  )
}

function SectionHeaderPremium({ title, subtitle }) {
  return (
    <div className="mb-4">
      <h2 className="text-xs font-bold uppercase tracking-[0.16em] text-[var(--pf-text-muted)]">{title}</h2>
      {subtitle ? <p className="mt-1 text-sm text-[var(--pf-text-muted)]">{subtitle}</p> : null}
    </div>
  )
}

function LiabilityPremiumCard({ r, onView, onEdit, onPay, onPayFull, onAddAmount }) {
  const due = effectiveDueDateStr(r)
  const days = daysFromToday(due)
  const tier = priorityTier(r)
  const paidPct = payoffPercentPaid(r)
  const emi =
    r.has_emi_schedule && r.next_emi_amount != null
      ? r.next_emi_amount
      : r.installment_amount != null
        ? r.installment_amount
        : r.minimum_due

  const dueCls =
    days != null && days < 0
      ? 'font-bold text-red-400'
      : days != null && days <= 7
        ? 'font-bold text-amber-300'
        : 'font-semibold text-[var(--pf-text)]'

  const shell = liabilityCardRiskShell(r)
  const closed = String(r.status).toUpperCase() === 'CLOSED' || Number(r.outstanding_amount) <= 0.01
  const emiScheduleBlocksFullPayoff = r.has_emi_schedule === true

  return (
    <div
      className={`flex flex-col rounded-2xl border p-5 backdrop-blur-md transition hover:-translate-y-0.5 hover:shadow-lg ${shell}`}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <h3 className="truncate text-base font-bold text-[var(--pf-text)]">{r.liability_name}</h3>
          <p className="mt-0.5 text-xs text-[var(--pf-text-muted)]">{typeLabel(r.liability_type)}</p>
        </div>
        <div className="flex shrink-0 flex-col items-end gap-1">
          {statusBadge(r.display_status)}
          <PriorityRibbon tier={tier} />
        </div>
      </div>

      <p className="mt-4 font-mono text-2xl font-bold tabular-nums tracking-tight text-[var(--pf-text)]">
        {formatInr(r.outstanding_amount)}
        <span className="ml-2 text-xs font-normal text-[var(--pf-text-muted)]">outstanding</span>
      </p>

      <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-sm">
        {emi != null && Number(emi) > 0 ? (
          <p className="text-[var(--pf-text)]">
            <span className="text-[var(--pf-text-muted)]">EMI / due line: </span>
            <span className="font-mono font-semibold tabular-nums text-sky-300 dark:text-sky-200">{formatInr(emi)}</span>
          </p>
        ) : null}
        <p className={dueCls}>
          <span className="text-[var(--pf-text-muted)]">Due: </span>
          {due ? formatShortDate(due) : '—'}
          {days != null && days >= 0 ? <span className="ml-1 text-xs font-normal text-[var(--pf-text-muted)]">({days}d)</span> : null}
          {days != null && days < 0 ? <span className="ml-1 text-xs">(overdue)</span> : null}
        </p>
        {r.interest_rate != null ? (
          <p className="text-[var(--pf-text)]">
            <span className="text-[var(--pf-text-muted)]">Interest: </span>
            <span className="font-semibold">{r.interest_rate}%</span>
          </p>
        ) : null}
      </div>

      {paidPct != null ? (
        <div className="mt-4">
          <div className="mb-1 flex justify-between text-[10px] font-semibold uppercase tracking-wide text-[var(--pf-text-muted)]">
            <span>Payoff progress</span>
            <span>{paidPct}% paid</span>
          </div>
          <div className="h-2.5 w-full overflow-hidden rounded-full bg-black/10 dark:bg-white/10">
            <div
              className="pf-motion-progress-fill h-full rounded-full bg-gradient-to-r from-[var(--pf-primary)] to-sky-400"
              style={{ width: `${paidPct}%` }}
            />
          </div>
          <p className="mt-1 text-[10px] text-[var(--pf-text-muted)]">{100 - paidPct}% of original principal remaining (book)</p>
        </div>
      ) : (
        <p className="mt-3 text-xs text-[var(--pf-text-muted)]">No principal baseline — add total amount to show payoff progress.</p>
      )}

      <div className="mt-5 flex flex-wrap gap-2 border-t border-[var(--pf-border)]/60 pt-4">
        {r.has_emi_schedule ? (
          <button
            type="button"
            className={`${btnSecondary} flex-1 min-w-[5.5rem] justify-center px-2 py-2 text-xs`}
            onClick={() => onView(r)}
          >
            Pay EMI
          </button>
        ) : (
          <button
            type="button"
            disabled={closed}
            className={`${btnSecondary} flex-1 min-w-[5.5rem] justify-center px-2 py-2 text-xs disabled:opacity-50`}
            onClick={() => onPay(r)}
          >
            Pay
          </button>
        )}
        <button
          type="button"
          disabled={closed || emiScheduleBlocksFullPayoff}
          className={`${btnSecondary} flex-1 min-w-[5.5rem] justify-center px-2 py-2 text-xs disabled:opacity-50`}
          onClick={() => onPayFull(r)}
          title={
            emiScheduleBlocksFullPayoff
              ? 'Loans with an EMI schedule: pay each installment from the schedule.'
              : 'Open payoff flow with outstanding prefilled'
          }
        >
          Pay full
        </button>
        <button type="button" className={`${btnSecondary} flex-1 min-w-[5.5rem] justify-center px-2 py-2 text-xs`} onClick={() => onView(r)}>
          Schedule
        </button>
        {liabilityAllowsAdditionalPrincipal(r) ? (
          <button
            type="button"
            className={`${btnSecondary} flex-1 min-w-[5.5rem] justify-center px-2 py-2 text-xs`}
            onClick={() => onAddAmount?.(r)}
          >
            Add amount
          </button>
        ) : null}
        <Link
          to="/personal-finance/monthly-statements?tab=ledger"
          className={`${btnSecondary} inline-flex flex-1 min-w-[5.5rem] items-center justify-center px-2 py-2 text-xs`}
        >
          Ledger
        </Link>
        <button type="button" className={`${btnSecondary} flex-1 min-w-[5.5rem] justify-center px-2 py-2 text-xs`} onClick={() => onEdit(r)}>
          Edit
        </button>
      </div>
    </div>
  )
}

function statusBadge(displayStatus) {
  const base =
    'inline-flex rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wide'
  if (displayStatus === 'OVERDUE') {
    return (
      <span className={`${base} border border-red-300 bg-red-100 text-red-900 dark:border-red-700 dark:bg-red-950/50 dark:text-red-200`}>
        Overdue
      </span>
    )
  }
  if (displayStatus === 'PAID' || displayStatus === 'CLOSED') {
    return (
      <span
        className={`${base} border border-slate-200 bg-slate-100 text-slate-700 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-300`}
      >
        {displayStatus === 'PAID' ? 'Paid' : 'Closed'}
      </span>
    )
  }
  return (
    <span className={`${base} border border-sky-200 bg-sky-50 text-sky-900 dark:border-sky-800 dark:bg-sky-950/40 dark:text-sky-200`}>
      Active
    </span>
  )
}

function emptyForm() {
  return {
    liability_name: '',
    liability_type: 'CREDIT_CARD',
    total_amount: '',
    outstanding_amount: '',
    interest_rate: '',
    minimum_due: '',
    installment_amount: '',
    due_date: '',
    billing_cycle_day: '',
    lender_name: '',
    notes: '',
    status: 'ACTIVE',
    build_emi_schedule: false,
    emi_interest_method: 'flat',
    term_months: '',
    emi_schedule_start_date: '',
    interest_free_days: '',
  }
}

export default function PfLiabilitiesPage() {
  const { onSessionInvalid } = useOutletContext() || {}
  const { tick, refresh } = usePfRefresh()
  const [rows, setRows] = useState([])
  const [summary, setSummary] = useState(null)
  const [accounts, setAccounts] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [filterType, setFilterType] = useState('ALL')
  const [filterStatus, setFilterStatus] = useState('ACTIVE')
  const [filterDueMonth, setFilterDueMonth] = useState(false)
  const [search, setSearch] = useState('')
  const [searchDebounced, setSearchDebounced] = useState('')

  const [showAddModal, setShowAddModal] = useState(false)
  const [editId, setEditId] = useState(null)
  const [form, setForm] = useState(emptyForm)
  const [submitting, setSubmitting] = useState(false)

  const [viewId, setViewId] = useState(null)
  const [viewRow, setViewRow] = useState(null)
  const [payments, setPayments] = useState([])
  const [detailLoading, setDetailLoading] = useState(false)
  const [exportBusy, setExportBusy] = useState(false)

  const [payId, setPayId] = useState(null)
  const [payDate, setPayDate] = useState(todayISODate)
  const [payAmount, setPayAmount] = useState('')
  const [payInterest, setPayInterest] = useState('')
  const [payMode, setPayMode] = useState('CASH')
  const [payAccountId, setPayAccountId] = useState('')
  const [payNotes, setPayNotes] = useState('')
  const [paySubmitting, setPaySubmitting] = useState(false)
  const [closingId, setClosingId] = useState(null)
  const [detailSchedule, setDetailSchedule] = useState([])
  const [payIntent, setPayIntent] = useState('record')
  const [emiPayScheduleRow, setEmiPayScheduleRow] = useState(null)
  const [payEmiDate, setPayEmiDate] = useState('')
  const [payEmiMode, setPayEmiMode] = useState('BANK')
  const [payEmiAccountId, setPayEmiAccountId] = useState('')
  const [emiPaySubmitting, setEmiPaySubmitting] = useState(false)
  const payAmountInputRef = useRef(null)

  const [showAddAmountForm, setShowAddAmountForm] = useState(false)
  const [addDrawDate, setAddDrawDate] = useState(todayISODate)
  const [addDrawAmount, setAddDrawAmount] = useState('')
  const [addDrawNotes, setAddDrawNotes] = useState('')
  const [addDrawAccountId, setAddDrawAccountId] = useState('')
  const [submittingAddAmount, setSubmittingAddAmount] = useState(false)

  const accountNameById = useMemo(() => {
    const m = new Map()
    for (const a of accounts) m.set(a.id, a.account_name)
    return m
  }, [accounts])

  const filterTypeOptions = useMemo(() => [{ value: 'ALL', label: 'All types' }, ...LIABILITY_TYPES], [])

  const accountSelectOptions = useMemo(
    () => accounts.map((a) => ({ value: String(a.id), label: a.account_name })),
    [accounts],
  )

  const queryParams = useMemo(
    () => ({
      liability_type: filterType === 'ALL' ? undefined : filterType,
      status: filterStatus === 'ALL' ? undefined : filterStatus,
      due_this_month: filterDueMonth || undefined,
      search: searchDebounced.trim() || undefined,
    }),
    [filterType, filterStatus, filterDueMonth, searchDebounced],
  )

  useEffect(() => {
    const t = window.setTimeout(() => setSearchDebounced(search), 350)
    return () => window.clearTimeout(t)
  }, [search])

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const [data, sum, acc] = await Promise.all([
        listFinanceLiabilities(queryParams),
        getLiabilitiesSummary().catch(() => null),
        listFinanceAccounts(),
      ])
      setRows(Array.isArray(data) ? data : [])
      setSummary(sum && typeof sum === 'object' ? sum : null)
      setAccounts(Array.isArray(acc) ? acc : [])
    } catch (e) {
      if (e.status === 401) {
        setPfToken(null)
        onSessionInvalid?.()
      } else {
        setError(e.message || 'Failed to load liabilities')
      }
    } finally {
      setLoading(false)
    }
  }, [onSessionInvalid, queryParams])

  useEffect(() => {
    load()
  }, [load, tick])

  useEffect(() => {
    if (!viewId) {
      setViewRow(null)
      setPayments([])
      setDetailSchedule([])
      setEmiPayScheduleRow(null)
      setShowAddAmountForm(false)
      return
    }
    let cancelled = false
    ;(async () => {
      setDetailLoading(true)
      try {
        const [ln, pay, sch] = await Promise.all([
          getFinanceLiability(viewId),
          listLiabilityPayments(viewId),
          listLiabilitySchedule(viewId).catch(() => []),
        ])
        if (!cancelled) {
          setViewRow(ln)
          setPayments(Array.isArray(pay) ? pay : [])
          setDetailSchedule(Array.isArray(sch) ? sch : [])
        }
      } catch (e) {
        if (!cancelled && e.status !== 401) setError(e.message || 'Failed to load liability')
      } finally {
        if (!cancelled) setDetailLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [viewId, tick])

  function openAdd() {
    setEditId(null)
    setForm(emptyForm())
    setShowAddModal(true)
  }

  function openEdit(r) {
    setEditId(r.id)
    setForm({
      liability_name: r.liability_name ?? '',
      liability_type: r.liability_type ?? 'OTHER',
      total_amount: String(r.total_amount ?? ''),
      outstanding_amount: String(r.outstanding_amount ?? ''),
      interest_rate: r.interest_rate != null ? String(r.interest_rate) : '',
      minimum_due: r.minimum_due != null ? String(r.minimum_due) : '',
      installment_amount: r.installment_amount != null ? String(r.installment_amount) : '',
      due_date: r.due_date ? String(r.due_date).slice(0, 10) : '',
      billing_cycle_day: r.billing_cycle_day != null ? String(r.billing_cycle_day) : '',
      lender_name: r.lender_name ?? '',
      notes: r.notes ?? '',
      status: r.status ?? 'ACTIVE',
      build_emi_schedule: false,
      emi_interest_method: liabilityEmiMethodFromApi(r.emi_interest_method),
      term_months: r.term_months != null ? String(r.term_months) : '',
      emi_schedule_start_date: r.emi_schedule_start_date ? String(r.emi_schedule_start_date).slice(0, 10) : '',
      interest_free_days: r.interest_free_days != null ? String(r.interest_free_days) : '',
    })
    setShowAddModal(true)
  }

  async function handleSaveForm(e) {
    e.preventDefault()
    setSubmitting(true)
    setError('')
    const body = {
      liability_name: form.liability_name.trim(),
      liability_type: form.liability_type,
      total_amount: Number(form.total_amount),
      outstanding_amount:
        form.outstanding_amount === '' ? undefined : Math.max(0, Number(form.outstanding_amount)),
      interest_rate: form.interest_rate === '' ? null : Number(form.interest_rate),
      minimum_due: form.minimum_due === '' ? null : Number(form.minimum_due),
      installment_amount: form.installment_amount === '' ? null : Number(form.installment_amount),
      due_date: form.due_date || null,
      billing_cycle_day:
        form.billing_cycle_day === '' || form.billing_cycle_day == null
          ? null
          : Math.min(31, Math.max(1, Number(form.billing_cycle_day))),
      lender_name: form.lender_name.trim() || null,
      notes: form.notes.trim() || null,
      status: form.status || 'ACTIVE',
    }
    // For new liabilities, optionally build an EMI schedule.
    // For edits, we never send `build_emi_schedule` (backend update schema forbids this field).
    if (!editId && form.build_emi_schedule) {
      const tm = Number(form.term_months)
      if (!form.emi_schedule_start_date) {
        setError('Choose an EMI schedule start date (same rule as loans: first due is one month after).')
        setSubmitting(false)
        return
      }
      if (!tm || tm < 1 || Number.isNaN(tm)) {
        setError('Enter term (months) for the EMI schedule.')
        setSubmitting(false)
        return
      }
      const ir = form.interest_rate === '' ? NaN : Number(form.interest_rate)
      if (!ir || ir <= 0 || Number.isNaN(ir)) {
        setError('Interest % is required to build an EMI schedule.')
        setSubmitting(false)
        return
      }
      body.build_emi_schedule = true
      body.emi_interest_method = form.emi_interest_method
      body.term_months = tm
      body.emi_schedule_start_date = form.emi_schedule_start_date
      body.interest_free_days =
        form.emi_interest_method === 'simple_interest'
          ? null
          : form.interest_free_days === '' || form.interest_free_days == null
            ? null
            : Math.max(0, Math.floor(Number(form.interest_free_days)))
      body.installment_amount = null
      body.due_date = null
    }
    try {
      if (editId) {
        await patchFinanceLiability(editId, body)
      } else {
        await createFinanceLiability(body)
      }
      setShowAddModal(false)
      setEditId(null)
      await load()
      refresh()
      if (viewId && editId === viewId) {
        const ln = await getFinanceLiability(viewId)
        setViewRow(ln)
      }
    } catch (err) {
      if (err.status === 401) {
        setPfToken(null)
        onSessionInvalid?.()
      } else {
        setError(err.message || 'Could not save')
      }
    } finally {
      setSubmitting(false)
    }
  }

  async function handleDelete(r) {
    if (!window.confirm(`Delete liability “${r.liability_name}” and all its payments?`)) return
    try {
      await deleteFinanceLiability(r.id)
      if (viewId === r.id) setViewId(null)
      await load()
      refresh()
    } catch (err) {
      if (err.status === 401) {
        setPfToken(null)
        onSessionInvalid?.()
      } else {
        setError(err.message || 'Delete failed')
      }
    }
  }

  function openAddAmountFor(r) {
    setAddDrawDate(todayISODate())
    setAddDrawAmount('')
    setAddDrawNotes('')
    setAddDrawAccountId(accounts[0]?.id != null ? String(accounts[0].id) : '')
    setShowAddAmountForm(true)
    setViewId(r.id)
  }

  function openPay(r, opts = {}) {
    setShowAddAmountForm(false)
    const payoff = Boolean(opts.prefillOutstanding)
    setPayIntent(payoff ? 'payoff' : 'record')
    setPayId(r.id)
    setPayDate(todayISODate())
    const out = Number(r.outstanding_amount)
    setPayAmount(payoff && out > 0 ? String(out) : '')
    setPayInterest('')
    setPayMode('CASH')
    setPayAccountId(accounts[0]?.id != null ? String(accounts[0].id) : '')
    setPayNotes('')
  }

  function openEmiPaymentModal(s) {
    if (!viewId) return
    setPayEmiDate(s.due_date ? String(s.due_date).slice(0, 10) : todayISODate())
    setPayEmiMode(s.credit_as_cash ? 'CASH' : 'BANK')
    setPayEmiAccountId(
      s.finance_account_id != null && s.finance_account_id !== ''
        ? String(s.finance_account_id)
        : accounts[0]?.id != null
          ? String(accounts[0].id)
          : '',
    )
    setEmiPayScheduleRow(s)
  }

  function closeEmiPaymentModal() {
    if (emiPaySubmitting) return
    setEmiPayScheduleRow(null)
  }

  async function handlePaySubmit(e) {
    e.preventDefault()
    if (!payId || !payRow) return
    if (payRow.has_emi_schedule) {
      setError('This liability has an EMI schedule — use Pay on the installment row (opens confirmation).')
      return
    }
    const amt = Number(payAmount)
    const intr = payInterest === '' ? 0 : Number(payInterest)
    if (!amt || amt <= 0) {
      setError('Enter amount paid')
      return
    }
    if (intr < 0 || intr > amt) {
      setError('Interest paid must be between 0 and amount paid')
      return
    }
    const out = Number(payRow.outstanding_amount) || 0
    const principal = amt - intr
    if (principal > out + 0.02) {
      setError('Principal portion cannot exceed outstanding balance')
      return
    }
    const mode = payMode === 'BANK' ? 'BANK' : 'CASH'
    const acc = mode === 'BANK' ? Number(payAccountId) : null
    if (mode === 'BANK' && (!acc || Number.isNaN(acc))) {
      setError('Select bank account')
      return
    }
    setPaySubmitting(true)
    setError('')
    const savedPayId = payId
    const savedViewId = viewId
    try {
      await createLiabilityPayment(savedPayId, {
        payment_date: payDate,
        amount_paid: amt,
        interest_paid: intr,
        payment_mode: mode,
        finance_account_id: mode === 'BANK' ? acc : null,
        notes: payNotes.trim() || null,
      })
      setPayId(null)
      await load()
      refresh()
      if (savedViewId === savedPayId) {
        setPayments(await listLiabilityPayments(savedViewId))
        setViewRow(await getFinanceLiability(savedViewId))
      }
    } catch (err) {
      if (err.status === 401) {
        setPfToken(null)
        onSessionInvalid?.()
      } else {
        setError(err.message || 'Payment failed')
      }
    } finally {
      setPaySubmitting(false)
    }
  }

  async function handleAddAmountSubmit(e) {
    e.preventDefault()
    if (!viewId) return
    const amt = Number(addDrawAmount)
    if (!amt || amt <= 0 || Number.isNaN(amt)) {
      setError('Enter a valid amount to add.')
      return
    }
    const acc = Number(addDrawAccountId)
    if (!acc || Number.isNaN(acc)) {
      setError('Select the bank account that received the funds.')
      return
    }
    setSubmittingAddAmount(true)
    setError('')
    const savedViewId = viewId
    try {
      await addLiabilityPrincipalAmount(viewId, {
        amount: amt,
        disbursement_date: addDrawDate,
        finance_account_id: acc,
        notes: addDrawNotes,
      })
      setShowAddAmountForm(false)
      await load()
      refresh()
      setViewRow(await getFinanceLiability(savedViewId))
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

  async function handleConfirmEmiPay(e) {
    e?.preventDefault?.()
    if (!viewId || !emiPayScheduleRow) return
    const emiNum = emiPayScheduleRow.emi_number
    setEmiPaySubmitting(true)
    setError('')
    try {
      if (payEmiMode === 'BANK') {
        const acc = Number(payEmiAccountId)
        if (!acc || Number.isNaN(acc)) {
          setError('Select a bank account to debit')
          setEmiPaySubmitting(false)
          return
        }
        await patchLiabilityScheduleCredit(viewId, emiNum, { creditAsCash: false, financeAccountId: acc })
        await payLiabilityEmi(viewId, emiNum, { paymentDate: payEmiDate, financeAccountId: acc })
      } else {
        await patchLiabilityScheduleCredit(viewId, emiNum, { creditAsCash: true, financeAccountId: null })
        await payLiabilityEmi(viewId, emiNum, { paymentDate: payEmiDate })
      }
      setEmiPayScheduleRow(null)
      const [sch, ln, pay] = await Promise.all([
        listLiabilitySchedule(viewId),
        getFinanceLiability(viewId),
        listLiabilityPayments(viewId),
      ])
      setDetailSchedule(Array.isArray(sch) ? sch : [])
      setViewRow(ln)
      setPayments(Array.isArray(pay) ? pay : [])
      await load()
      refresh()
    } catch (err) {
      if (err.status === 401) {
        setPfToken(null)
        onSessionInvalid?.()
      } else {
        setError(err.message || 'EMI payment failed')
      }
    } finally {
      setEmiPaySubmitting(false)
    }
  }

  async function handleCloseLiability(id) {
    if (!window.confirm('Close this liability? Outstanding must be zero.')) return
    setClosingId(id)
    setError('')
    try {
      await closeFinanceLiability(id)
      setViewId(null)
      await load()
      refresh()
    } catch (err) {
      if (err.status === 401) {
        setPfToken(null)
        onSessionInvalid?.()
      } else {
        setError(err.message || 'Could not close')
      }
    } finally {
      setClosingId(null)
    }
  }

  async function handleStatementExport(liaId, kind) {
    setExportBusy(true)
    try {
      const path = kind === 'pdf' ? `/pf/export/liabilities/${liaId}/pdf` : `/pf/export/liabilities/${liaId}/excel`
      const { blob, filename } = await pfFetchBlob(path)
      triggerDownloadBlob(blob, filename || `Liability.${kind === 'pdf' ? 'pdf' : 'xlsx'}`)
    } catch (e) {
      if (e.status === 401) {
        setPfToken(null)
        onSessionInvalid?.()
      } else {
        window.alert(e.message || 'Export failed')
      }
    } finally {
      setExportBusy(false)
    }
  }

  async function handlePortfolioExport() {
    setExportBusy(true)
    try {
      const { blob, filename } = await pfFetchBlob('/pf/export/liabilities/excel')
      triggerDownloadBlob(blob, filename || 'Liabilities.xlsx')
    } catch (e) {
      if (e.status === 401) {
        setPfToken(null)
        onSessionInvalid?.()
      } else {
        window.alert(e.message || 'Export failed')
      }
    } finally {
      setExportBusy(false)
    }
  }

  const rowsForKpi = useMemo(
    () => rows.filter((r) => String(r.status).toUpperCase() === 'ACTIVE' && Number(r.outstanding_amount) > 0.01),
    [rows],
  )

  const kpiEmiMonth = useMemo(() => rowsForKpi.reduce((s, r) => s + monthlyObligationEstimate(r), 0), [rowsForKpi])

  const weightedAvgInterest = useMemo(() => {
    let wSum = 0
    let wTot = 0
    for (const r of rowsForKpi) {
      const o = Number(r.outstanding_amount)
      if (r.interest_rate == null) continue
      const rate = Number(r.interest_rate)
      if (Number.isNaN(rate) || o <= 0.01) continue
      wSum += o * rate
      wTot += o
    }
    if (wTot <= 0) return null
    return wSum / wTot
  }, [rowsForKpi])

  const groupedRows = useMemo(() => {
    const g = { credit: [], loans: [], other: [] }
    for (const r of rows) {
      g[groupBucketForType(r.liability_type)].push(r)
    }
    g.credit.sort(liabilitySort)
    g.loans.sort(liabilitySort)
    g.other.sort(liabilitySort)
    return g
  }, [rows])

  const alertItems = useMemo(() => {
    const items = []
    const pushUnique = (kind, title, detail, liabilityId) => {
      items.push({ kind, title, detail, liabilityId })
    }
    if (summary && Number(summary.overdue_amount) > 0) {
      pushUnique('danger', 'Overdue obligations', `${formatInr(summary.overdue_amount)} total outstanding past due`)
    }
    const warnedIds = new Set()
    for (const r of rowsForKpi) {
      if (r.display_status === 'OVERDUE') {
        pushUnique('danger', r.liability_name, `Overdue · ${formatInr(r.outstanding_amount)}`, r.id)
        warnedIds.add(r.id)
      }
    }
    for (const r of rowsForKpi) {
      if (r.display_status === 'OVERDUE') continue
      const dd = daysFromToday(effectiveDueDateStr(r))
      if (dd != null && dd >= 0 && dd <= 7) {
        const em = monthlyObligationEstimate(r)
        pushUnique(
          'warn',
          r.liability_name,
          `Due in ${dd} day(s)${em > 0 ? ` · ~${formatInr(em)}` : ''}`,
          r.id,
        )
        warnedIds.add(r.id)
      }
    }
    if (Array.isArray(summary?.due_this_week)) {
      for (const d of summary.due_this_week) {
        if (warnedIds.has(d.liability_id)) continue
        const due = d.due_date ? String(d.due_date).slice(0, 10) : ''
        const daysLeft = daysFromToday(due)
        if (daysLeft != null && daysLeft >= 0 && daysLeft <= 7) {
          pushUnique(
            'warn',
            d.liability_name,
            `Due ${formatShortDate(due)} · ${formatInr(d.minimum_due ?? d.outstanding_amount)}`,
            d.liability_id,
          )
          warnedIds.add(d.liability_id)
        }
      }
    }
    const stressful = items.filter((i) => i.kind === 'danger' || i.kind === 'warn')
    if (stressful.length === 0) {
      items.push({ kind: 'ok', title: 'No overdue payments', detail: 'Nothing late is showing on your book. Check upcoming dues in the cards below.' })
    }
    return items
  }, [rowsForKpi, summary])

  const chartByGroup = useMemo(() => {
    const g = { credit: 0, loans: 0, other: 0 }
    for (const r of rowsForKpi) {
      g[groupBucketForType(r.liability_type)] += Number(r.outstanding_amount) || 0
    }
    return [
      { name: 'Credit cards', value: Math.round(g.credit * 100) / 100 },
      { name: 'Loans', value: Math.round(g.loans * 100) / 100 },
      { name: 'Other', value: Math.round(g.other * 100) / 100 },
    ].filter((x) => x.value > 0)
  }, [rowsForKpi])

  const chartTopOutstanding = useMemo(
    () =>
      [...rowsForKpi]
        .sort((a, b) => Number(b.outstanding_amount) - Number(a.outstanding_amount))
        .slice(0, 10)
        .map((r) => ({
          name: r.liability_name.length > 14 ? `${r.liability_name.slice(0, 12)}…` : r.liability_name,
          fullName: r.liability_name,
          outstanding: Math.round(Number(r.outstanding_amount) * 100) / 100,
        })),
    [rowsForKpi],
  )

  const payRow = useMemo(() => (payId ? rows.find((r) => r.id === payId) ?? null : null), [rows, payId])

  const paymentPreview = useMemo(() => {
    if (!payId || !payRow) return null
    const amt = Number(payAmount)
    const intr = payInterest === '' ? 0 : Number(payInterest)
    if (payAmount === '' || payAmount == null) return { empty: true }
    if (!Number.isFinite(amt) || amt <= 0) return { error: 'Enter a valid amount' }
    if (!Number.isFinite(intr) || intr < 0) return { error: 'Invalid interest portion' }
    if (intr > amt + 1e-9) return { error: 'Interest cannot exceed amount paid' }
    const out = Number(payRow.outstanding_amount) || 0
    const principal = amt - intr
    const remaining = Math.max(0, Math.round((out - principal) * 100) / 100)
    return { amount: amt, interest: intr, principal, remaining, outstanding: out }
  }, [payId, payRow, payAmount, payInterest])

  useEffect(() => {
    if (!payId) return
    const id = window.requestAnimationFrame(() => payAmountInputRef.current?.focus())
    return () => window.cancelAnimationFrame(id)
  }, [payId])

  const chartTitle = 'text-sm font-bold text-slate-900 dark:text-[var(--pf-text)]'
  const chartSub = 'mt-0.5 text-xs text-slate-500 dark:text-[var(--pf-text-muted)]'

  const kpiGlass =
    'rounded-2xl border p-4 shadow-[var(--pf-shadow)] backdrop-blur-md transition dark:border-[var(--pf-border)] dark:bg-white/[0.04]'

  return (
    <div className="space-y-10">
      <PageHeader
        title="Liabilities"
        description="How much you owe, what is due soon, and what to pay first — not just a list of balances."
        action={
          <PfExportMenu
            busy={exportBusy}
            items={[{ key: 'xlsx', label: 'Export all (Excel)', onClick: handlePortfolioExport }]}
          />
        }
      />

      {error ? (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:border-amber-900/40 dark:bg-amber-950/30 dark:text-amber-100">
          {error}
        </div>
      ) : null}

      {summary ? (
        <section aria-label="Summary" className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
          <div className={kpiGlass}>
            <p className="text-[11px] font-bold uppercase tracking-wider text-[var(--pf-text-muted)]">Total outstanding</p>
            <p className="mt-2 font-mono text-xl font-bold tabular-nums text-[var(--pf-text)] sm:text-2xl">
              {formatInr(summary.total_outstanding)}
            </p>
            <p className="mt-1 text-xs text-[var(--pf-text-muted)]">Active book balance owed</p>
          </div>
          <div className={kpiGlass}>
            <p className="text-[11px] font-bold uppercase tracking-wider text-[var(--pf-text-muted)]">EMI / month (est.)</p>
            <p className="mt-2 font-mono text-xl font-bold tabular-nums text-sky-600 dark:text-sky-300 sm:text-2xl">
              {formatInr(kpiEmiMonth)}
            </p>
            <p className="mt-1 text-xs text-[var(--pf-text-muted)]">Next EMI or installment line per liability</p>
          </div>
          <div className={kpiGlass}>
            <p className="text-[11px] font-bold uppercase tracking-wider text-[var(--pf-text-muted)]">Due this month</p>
            <p className="mt-2 font-mono text-xl font-bold tabular-nums text-amber-700 dark:text-amber-300 sm:text-2xl">
              {formatInr(summary.due_this_month_amount)}
            </p>
            <p className="mt-1 text-xs text-[var(--pf-text-muted)]">By statement due date (calendar month)</p>
          </div>
          <div className={`${kpiGlass} border-red-500/25 bg-red-500/[0.04]`}>
            <p className="text-[11px] font-bold uppercase tracking-wider text-red-800 dark:text-red-300">Overdue</p>
            <p className="mt-2 font-mono text-xl font-bold tabular-nums text-red-700 dark:text-red-400 sm:text-2xl">
              {formatInr(summary.overdue_amount)}
            </p>
            <p className="mt-1 text-xs text-red-800/80 dark:text-red-200/80">Past due date & still outstanding</p>
          </div>
          <div className={kpiGlass}>
            <p className="text-[11px] font-bold uppercase tracking-wider text-[var(--pf-text-muted)]">Avg interest (weighted)</p>
            <p className="mt-2 font-mono text-xl font-bold tabular-nums text-[var(--pf-text)] sm:text-2xl">
              {weightedAvgInterest != null ? `${weightedAvgInterest.toFixed(1)}%` : '—'}
            </p>
            <p className="mt-1 text-xs text-[var(--pf-text-muted)]">By outstanding × rate on visible active rows</p>
          </div>
        </section>
      ) : null}

      {!loading && summary ? (
        <section aria-label="Alerts" className="space-y-3">
          <SectionHeaderPremium title="Alerts & upcoming dues" subtitle="What needs attention first." />
          <div className="grid gap-2 sm:grid-cols-2">
            {alertItems.map((a, idx) => (
              <div
                key={`${a.kind}-${a.title}-${idx}`}
                className={[
                  'flex gap-3 rounded-xl border p-4 backdrop-blur-sm',
                  a.kind === 'danger'
                    ? 'border-red-500/40 bg-red-500/[0.08]'
                    : a.kind === 'warn'
                      ? 'border-amber-500/40 bg-amber-500/[0.08]'
                      : 'border-emerald-500/35 bg-emerald-500/[0.06]',
                ].join(' ')}
              >
                {a.kind === 'ok' ? (
                  <CheckCircleIcon className="h-6 w-6 shrink-0 text-emerald-500" />
                ) : (
                  <ExclamationTriangleIcon
                    className={`h-6 w-6 shrink-0 ${a.kind === 'danger' ? 'text-red-400' : 'text-amber-400'}`}
                  />
                )}
                <div className="min-w-0">
                  <p className="font-semibold text-[var(--pf-text)]">{a.title}</p>
                  <p className="mt-0.5 text-sm text-[var(--pf-text-muted)]">{a.detail}</p>
                  {a.liabilityId ? (
                    <button
                      type="button"
                      className="mt-2 text-xs font-semibold text-[var(--pf-primary)] hover:underline"
                      onClick={() => setViewId(a.liabilityId)}
                    >
                      Open liability →
                    </button>
                  ) : null}
                </div>
              </div>
            ))}
          </div>
        </section>
      ) : null}

      <div className={`${cardCls} flex flex-col gap-4 sm:flex-row sm:flex-wrap sm:items-end`}>
        <div className="w-full min-w-0 sm:w-auto sm:min-w-[15.5rem]">
          <PremiumSelect
            id="lia-f-type"
            label="Type"
            searchable
            searchFromCount={6}
            options={filterTypeOptions}
            value={filterType}
            onChange={setFilterType}
            placeholder="All types"
          />
        </div>
        <div className="w-full min-w-0 sm:w-auto sm:min-w-[10.5rem]">
          <PremiumSelect
            id="lia-f-st"
            label="Status"
            options={FILTER_STATUS_OPTIONS}
            value={filterStatus}
            onChange={setFilterStatus}
            placeholder="Status"
          />
        </div>
        <div className="flex items-center gap-2.5 rounded-xl border border-sky-200/60 bg-white/80 px-3 py-2.5 dark:border-[var(--pf-border)] dark:bg-[var(--pf-input-bg)]/80 sm:pt-0">
          <input
            id="lia-f-due"
            type="checkbox"
            className="h-4 w-4 rounded border-sky-300 text-[var(--pf-primary)] focus:ring-[var(--pf-primary)]/30 dark:border-[var(--pf-border)] dark:bg-[var(--pf-card)]"
            checked={filterDueMonth}
            onChange={(e) => setFilterDueMonth(e.target.checked)}
          />
          <label htmlFor="lia-f-due" className="cursor-pointer text-sm font-medium text-slate-700 dark:text-[var(--pf-text)]">
            Due this month
          </label>
        </div>
        <div className="min-w-0 flex-1 sm:min-w-[12rem]">
          <label className={labelCls} htmlFor="lia-f-search">
            Search
          </label>
          <input
            id="lia-f-search"
            type="search"
            className={`${inputCls} rounded-xl shadow-[var(--pf-shadow)] transition-shadow hover:shadow-[var(--pf-shadow-hover)]`}
            placeholder="Name…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </div>

      <div className="flex flex-wrap gap-3">
        <button type="button" onClick={openAdd} className={`${btnPrimary} inline-flex items-center gap-2`}>
          <PlusIcon className="h-5 w-5" />
          Add liability
        </button>
      </div>

      {loading ? (
        <p className="text-sm text-[var(--pf-text-muted)]">Loading…</p>
      ) : rows.length === 0 ? (
        <p className="text-sm text-[var(--pf-text-muted)]">No liabilities match your filters.</p>
      ) : (
        <div className="space-y-12">
          {groupedRows.credit.length ? (
            <section>
              <SectionHeaderPremium title="Credit cards" subtitle="Revolving / statement-style dues." />
              <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                {groupedRows.credit.map((r) => (
                  <LiabilityPremiumCard
                    key={r.id}
                    r={r}
                    onView={(x) => setViewId(x.id)}
                    onEdit={openEdit}
                    onPay={(x) => openPay(x)}
                    onPayFull={(x) => openPay(x, { prefillOutstanding: true })}
                    onAddAmount={openAddAmountFor}
                  />
                ))}
              </div>
            </section>
          ) : null}
          {groupedRows.loans.length ? (
            <section>
              <SectionHeaderPremium title="Loans" subtitle="Home, vehicle, personal, and EMI-tied borrowing." />
              <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                {groupedRows.loans.map((r) => (
                  <LiabilityPremiumCard
                    key={r.id}
                    r={r}
                    onView={(x) => setViewId(x.id)}
                    onEdit={openEdit}
                    onPay={(x) => openPay(x)}
                    onPayFull={(x) => openPay(x, { prefillOutstanding: true })}
                    onAddAmount={openAddAmountFor}
                  />
                ))}
              </div>
            </section>
          ) : null}
          {groupedRows.other.length ? (
            <section>
              <SectionHeaderPremium title="Other liabilities" subtitle="BNPL, friends & family, bills payable, misc." />
              <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                {groupedRows.other.map((r) => (
                  <LiabilityPremiumCard
                    key={r.id}
                    r={r}
                    onView={(x) => setViewId(x.id)}
                    onEdit={openEdit}
                    onPay={(x) => openPay(x)}
                    onPayFull={(x) => openPay(x, { prefillOutstanding: true })}
                    onAddAmount={openAddAmountFor}
                  />
                ))}
              </div>
            </section>
          ) : null}
        </div>
      )}

      {!loading && rowsForKpi.length > 0 && (chartByGroup.length > 0 || chartTopOutstanding.length > 0) ? (
        <section className="space-y-6" aria-label="Debt analytics">
          <SectionHeaderPremium
            title="Debt analytics"
            subtitle="Where balances concentrate and which obligations dominate — from your current filters."
          />
          <div className="grid gap-6 lg:grid-cols-2">
            {chartByGroup.length > 0 ? (
              <div className={`${pfChartCard} min-h-[280px]`}>
                <p className={chartTitle}>Outstanding by group</p>
                <p className={chartSub}>Share of active debt across category buckets</p>
                <div className="mt-4 h-[220px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie data={chartByGroup} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={78} label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}>
                        {chartByGroup.map((_, i) => (
                          <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip
                        formatter={(value) => formatInr(value)}
                        contentStyle={{
                          background: 'var(--pf-card)',
                          border: '1px solid var(--pf-border)',
                          borderRadius: '12px',
                        }}
                      />
                      <Legend />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              </div>
            ) : null}
            {chartTopOutstanding.length > 0 ? (
              <div className={`${pfChartCard} min-h-[280px]`}>
                <p className={chartTitle}>Largest balances</p>
                <p className={chartSub}>Top active liabilities by outstanding amount</p>
                <div className="mt-4 h-[220px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={chartTopOutstanding} layout="vertical" margin={{ left: 8, right: 8 }}>
                      <CartesianGrid strokeDasharray="3 3" className="stroke-[var(--pf-border)] opacity-40" />
                      <XAxis type="number" tickFormatter={(v) => formatInr(v)} className="text-[10px]" />
                      <YAxis type="category" dataKey="name" width={100} tick={{ fontSize: 10 }} />
                      <Tooltip
                        formatter={(value, _n, item) => [formatInr(value), item?.payload?.fullName ?? 'Outstanding']}
                        contentStyle={{
                          background: 'var(--pf-card)',
                          border: '1px solid var(--pf-border)',
                          borderRadius: '12px',
                        }}
                      />
                      <Bar dataKey="outstanding" fill="var(--pf-primary)" radius={[0, 6, 6, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            ) : null}
          </div>
          {summary ? (
            <p className="text-center text-xs text-[var(--pf-text-muted)]">
              Interest paid (lifetime, all liabilities):{' '}
              <span className="font-mono font-semibold text-[var(--pf-text)]">{formatInr(summary.interest_paid_lifetime)}</span>
              {' · '}
              <Link to="/personal-finance/monthly-statements" className="font-semibold text-[var(--pf-primary)] hover:underline">
                Open financial statements
              </Link>{' '}
              for income / cash-flow context (debt-to-income from reports).
            </p>
          ) : null}
        </section>
      ) : null}

      <AppModal
        open={showAddModal}
        onClose={() => !submitting && setShowAddModal(false)}
        title={editId ? 'Edit liability' : 'Add liability'}
        subtitle="Structured fields — matches how banks show loan details."
        maxWidthClass="max-w-2xl"
        footer={
          <>
            <AppButton type="button" variant="ghost" disabled={submitting} onClick={() => setShowAddModal(false)}>
              Cancel
            </AppButton>
            <AppButton type="submit" variant="primary" form="pf-liability-form" disabled={submitting}>
              {submitting ? 'Saving…' : editId ? 'Save changes' : 'Save liability'}
            </AppButton>
          </>
        }
      >
            <form id="pf-liability-form" onSubmit={handleSaveForm} className="grid gap-5 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-[var(--pf-text-muted)]">
                  Loan details
                </p>
                <div className="mt-3 grid gap-3 sm:grid-cols-2">
                  <div className="sm:col-span-2">
                    <label className={labelCls} htmlFor="fm-name">
                      Name
                    </label>
                    <input id="fm-name" className={inputCls} value={form.liability_name} onChange={(e) => setForm((f) => ({ ...f, liability_name: e.target.value }))} required />
                  </div>
                  <div className="sm:col-span-2">
                    <PremiumSelect
                      id="fm-type"
                      label="Type"
                      searchable
                      searchFromCount={6}
                      options={LIABILITY_TYPES}
                      value={form.liability_type}
                      onChange={(v) => setForm((f) => ({ ...f, liability_type: v }))}
                      placeholder="Choose type"
                    />
                  </div>
                  <div className="sm:col-span-2">
                    <label className={labelCls} htmlFor="fm-lender">
                      Lender
                    </label>
                    <input id="fm-lender" className={inputCls} value={form.lender_name} onChange={(e) => setForm((f) => ({ ...f, lender_name: e.target.value }))} />
                  </div>
                </div>
              </div>

              <div className="sm:col-span-2 border-t border-[var(--pf-border)] pt-5">
                <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-[var(--pf-text-muted)]">
                  Amounts
                </p>
                <div className="mt-3 grid gap-3 sm:grid-cols-2">
                  <div>
                    <label className={labelCls} htmlFor="fm-tot">
                      Total amount (₹)
                    </label>
                    <input id="fm-tot" type="number" min="0" step="0.01" className={`${inputCls} text-right font-mono tabular-nums`} value={form.total_amount} onChange={(e) => setForm((f) => ({ ...f, total_amount: e.target.value }))} required />
                  </div>
                  <div>
                    <label className={labelCls} htmlFor="fm-out">
                      Outstanding (₹)
                    </label>
                    <input id="fm-out" type="number" min="0" step="0.01" className={`${inputCls} text-right font-mono tabular-nums`} value={form.outstanding_amount} onChange={(e) => setForm((f) => ({ ...f, outstanding_amount: e.target.value }))} placeholder="Defaults to total" />
                  </div>
                  <div>
                    <label className={labelCls} htmlFor="fm-rate">
                      Interest % (optional)
                    </label>
                    <input id="fm-rate" type="number" step="0.01" className={`${inputCls} text-right font-mono tabular-nums`} value={form.interest_rate} onChange={(e) => setForm((f) => ({ ...f, interest_rate: e.target.value }))} />
                  </div>
                  <div>
                    <label className={labelCls} htmlFor="fm-min">
                      Minimum due (₹)
                    </label>
                    <input id="fm-min" type="number" min="0" step="0.01" className={`${inputCls} text-right font-mono tabular-nums`} value={form.minimum_due} onChange={(e) => setForm((f) => ({ ...f, minimum_due: e.target.value }))} />
                  </div>
                </div>
              </div>

              <div className="sm:col-span-2 border-t border-[var(--pf-border)] pt-5">
                <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-[var(--pf-text-muted)]">
                  Schedule &amp; billing
                </p>
                <div className="mt-3 grid gap-3 sm:grid-cols-2">
                  <div>
                    <label className={labelCls} htmlFor="fm-ins">
                      EMI / installment (₹)
                    </label>
                    <input id="fm-ins" type="number" min="0" step="0.01" className={`${inputCls} text-right font-mono tabular-nums`} value={form.installment_amount} onChange={(e) => setForm((f) => ({ ...f, installment_amount: e.target.value }))} />
                  </div>
                  <div>
                    <label className={labelCls} htmlFor="fm-due">
                      Due date
                    </label>
                    <input id="fm-due" type="date" className={inputCls} value={form.due_date} onChange={(e) => setForm((f) => ({ ...f, due_date: e.target.value }))} />
                  </div>
                  <div>
                    <label className={labelCls} htmlFor="fm-cycle">
                      Billing cycle day (1–31)
                    </label>
                    <input id="fm-cycle" type="number" min="1" max="31" className={inputCls} value={form.billing_cycle_day} onChange={(e) => setForm((f) => ({ ...f, billing_cycle_day: e.target.value }))} />
                  </div>
                </div>
              </div>

              <div className="sm:col-span-2">
                <label className={labelCls} htmlFor="fm-notes">
                  Notes
                </label>
                <textarea id="fm-notes" rows={3} className={`${inputCls} resize-y`} value={form.notes} onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))} placeholder="Optional context…" />
              </div>
              {!editId ? (
                <div className="sm:col-span-2 rounded-xl border border-slate-200 bg-slate-50/90 p-3 dark:border-slate-600 dark:bg-slate-900/40">
                  <label className="flex cursor-pointer items-center gap-2 text-sm font-medium text-slate-800 dark:text-slate-200">
                    <input
                      type="checkbox"
                      className="h-4 w-4 rounded border-slate-300 text-[#1E3A8A]"
                      checked={form.build_emi_schedule}
                      onChange={(e) => setForm((f) => ({ ...f, build_emi_schedule: e.target.checked }))}
                    />
                    Build EMI schedule (flat, simple interest, or reducing balance)
                  </label>
                  {form.build_emi_schedule ? (
                    <div className="mt-3 grid gap-3">
                      <div>
                        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                          Interest method
                        </p>
                        <PfSegmentedControl
                          className="mt-2 w-full"
                          options={[
                            { id: 'flat', label: 'Flat interest' },
                            { id: 'simple_interest', label: 'Simple interest' },
                            { id: 'reducing_balance', label: 'Reducing balance' },
                          ]}
                          value={form.emi_interest_method}
                          onChange={(v) => setForm((f) => ({ ...f, emi_interest_method: v }))}
                        />
                        {form.emi_interest_method === 'simple_interest' ? (
                          <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
                            Interest on the full principal for the whole term:{' '}
                            <span className="font-medium text-slate-600 dark:text-slate-300">P × rate% × (term ÷ 12)</span>
                            . Equal principal and interest each month (same schedule shape as flat, without interest-free
                            days).
                          </p>
                        ) : null}
                      </div>
                      <div className="grid gap-2 sm:grid-cols-2">
                        <div>
                          <label className={labelCls} htmlFor="fm-em-tm">
                            Term (months)
                          </label>
                          <input
                            id="fm-em-tm"
                            type="number"
                            min="1"
                            className={inputCls}
                            value={form.term_months}
                            onChange={(e) => setForm((f) => ({ ...f, term_months: e.target.value }))}
                          />
                        </div>
                        <div>
                          <label className={labelCls} htmlFor="fm-em-start">
                            Schedule start
                          </label>
                          <input
                            id="fm-em-start"
                            type="date"
                            className={inputCls}
                            value={form.emi_schedule_start_date}
                            onChange={(e) => setForm((f) => ({ ...f, emi_schedule_start_date: e.target.value }))}
                          />
                        </div>
                      </div>
                      {form.emi_interest_method === 'flat' ? (
                        <div>
                          <label className={labelCls} htmlFor="fm-em-grace">
                            Interest-free days (optional)
                          </label>
                          <input
                            id="fm-em-grace"
                            type="number"
                            min="0"
                            step="1"
                            className={inputCls}
                            value={form.interest_free_days}
                            onChange={(e) => setForm((f) => ({ ...f, interest_free_days: e.target.value }))}
                            placeholder="0"
                          />
                        </div>
                      ) : null}
                      <p className="text-xs text-slate-500 dark:text-slate-400">
                        <strong className="font-medium text-slate-600 dark:text-slate-300">Outstanding</strong> above is
                        treated as principal. First EMI due is one month after schedule start (same as loans). Paying an
                        EMI logs an expense and debits the selected bank account.
                      </p>
                    </div>
                  ) : null}
                </div>
              ) : null}
              {editId ? (
                <div className="sm:col-span-2 border-t border-[var(--pf-border)] pt-5">
                  <PremiumSelect
                    id="fm-st"
                    label="Status"
                    options={LIABILITY_FORM_STATUS_OPTIONS}
                    value={form.status}
                    onChange={(v) => setForm((f) => ({ ...f, status: v }))}
                  />
                </div>
              ) : null}
            </form>
      </AppModal>

      <AppModal
        open={Boolean(payId)}
        onClose={() => !paySubmitting && setPayId(null)}
        title={
          payIntent === 'payoff' ? 'Close liability' : payRow?.has_emi_schedule ? 'Record EMI payment' : 'Record payment'
        }
        subtitle={payRow ? `${payRow.liability_name} · ${typeLabel(payRow.liability_type)}` : undefined}
        maxWidthClass="max-w-[520px]"
        footer={
          <>
            <AppButton type="button" variant="ghost" disabled={paySubmitting} onClick={() => setPayId(null)}>
              Cancel
            </AppButton>
            <AppButton
              type="submit"
              form="pf-liability-pay-form"
              variant="primary"
              disabled={
                paySubmitting ||
                !paymentPreview ||
                paymentPreview.empty ||
                Boolean(paymentPreview.error) ||
                (payMode === 'BANK' && (!payAccountId || accounts.length === 0)) ||
                payRow?.has_emi_schedule === true
              }
              className={
                payIntent === 'payoff'
                  ? '!border-none !bg-orange-600 !shadow-md hover:!bg-orange-700 focus-visible:!ring-orange-500'
                  : ''
              }
            >
              {paySubmitting ? 'Saving…' : payIntent === 'payoff' ? 'Pay & close loan' : 'Record payment'}
            </AppButton>
          </>
        }
      >
        <form id="pf-liability-pay-form" onSubmit={handlePaySubmit} className="space-y-5">
          {payRow?.has_emi_schedule ? (
            <div className="rounded-xl border border-amber-500/35 bg-amber-500/[0.07] px-4 py-3 text-sm text-amber-950 dark:text-amber-100">
              This book uses an <strong>EMI schedule</strong>. Record each installment with <strong>Pay</strong> on the
              schedule row — manual ledger payments are disabled here.
            </div>
          ) : null}

          {payIntent === 'payoff' && payRow && !payRow.has_emi_schedule ? (
            <div className="flex gap-3 rounded-xl border border-orange-500/40 bg-orange-500/[0.08] px-4 py-3 text-sm text-orange-950 dark:text-orange-100">
              <ExclamationTriangleIcon className="h-6 w-6 shrink-0 text-orange-600 dark:text-orange-300" aria-hidden />
              <div>
                <p className="font-semibold">You are about to pay off this liability</p>
                <p className="mt-1 text-xs opacity-90">
                  Confirm the amount and interest split below. When outstanding reaches zero, the liability can be marked closed from the detail view.
                </p>
              </div>
            </div>
          ) : null}

          {payRow ? (
            <div className="rounded-xl border border-[var(--pf-border)] bg-white/[0.03] p-4 shadow-inner shadow-black/5 backdrop-blur-sm dark:bg-white/[0.04]">
              <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-[var(--pf-text-muted)]">
                {payIntent === 'payoff' ? 'Payoff summary' : 'Loan summary'}
              </p>
              <dl className="mt-3 grid gap-3 sm:grid-cols-2">
                <div>
                  <dt className="text-xs text-[var(--pf-text-muted)]">Outstanding</dt>
                  <dd className="mt-0.5 font-mono text-base font-semibold tabular-nums text-[var(--pf-text)]">
                    {formatInr(payRow.outstanding_amount)}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs text-[var(--pf-text-muted)]">EMI / installment line</dt>
                  <dd className="mt-0.5 font-mono text-base font-semibold tabular-nums text-sky-600 dark:text-sky-300">
                    {(() => {
                      const em = monthlyObligationEstimate(payRow)
                      return em > 0 ? formatInr(em) : '—'
                    })()}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs text-[var(--pf-text-muted)]">Due date</dt>
                  <dd className="mt-0.5 text-sm font-semibold text-[var(--pf-text)]">
                    {effectiveDueDateStr(payRow) ? formatShortDate(effectiveDueDateStr(payRow)) : '—'}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs text-[var(--pf-text-muted)]">Interest rate</dt>
                  <dd className="mt-0.5 text-sm font-semibold text-[var(--pf-text)]">
                    {payRow.interest_rate != null ? `${payRow.interest_rate}%` : '—'}
                  </dd>
                </div>
              </dl>
              {payIntent === 'payoff' ? (
                <div className="mt-3 border-t border-[var(--pf-border)] pt-3 text-xs text-[var(--pf-text-muted)]">
                  <p>
                    <span className="text-[var(--pf-text-muted)]">Book outstanding: </span>
                    <span className="font-mono font-semibold text-[var(--pf-text)]">{formatInr(payRow.outstanding_amount)}</span>
                  </p>
                </div>
              ) : null}
            </div>
          ) : null}

          <div>
            <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-[var(--pf-text-muted)]">Payment details</p>
            <div className="mt-3 grid gap-3">
              <div>
                <label className={labelCls} htmlFor="pf-pay-date">
                  Payment date
                </label>
                <input
                  id="pf-pay-date"
                  type="date"
                  className={inputCls}
                  value={payDate}
                  onChange={(e) => setPayDate(e.target.value)}
                  required
                />
              </div>
              <div>
                <label className={labelCls} htmlFor="pf-pay-amt">
                  Amount paid (₹)
                </label>
                <input
                  ref={payAmountInputRef}
                  id="pf-pay-amt"
                  type="number"
                  min="0"
                  step="0.01"
                  className={`${inputCls} text-right font-mono tabular-nums`}
                  value={payAmount}
                  onChange={(e) => setPayAmount(e.target.value)}
                  required
                  placeholder="0.00"
                />
              </div>
              <div>
                <label className={labelCls} htmlFor="pf-pay-int">
                  Interest portion (₹)
                </label>
                <input
                  id="pf-pay-int"
                  type="number"
                  min="0"
                  step="0.01"
                  className={`${inputCls} text-right font-mono tabular-nums`}
                  value={payInterest}
                  onChange={(e) => setPayInterest(e.target.value)}
                  placeholder="0"
                />
              </div>
              <div>
                <PremiumSelect
                  id="pf-pay-mode"
                  label="Pay from"
                  options={PAY_FROM_OPTIONS}
                  value={payMode}
                  onChange={setPayMode}
                />
              </div>
              {payMode === 'BANK' ? (
                <div>
                  <PremiumSelect
                    id="pf-pay-acc"
                    label="Account"
                    searchable
                    options={accountSelectOptions}
                    value={payAccountId}
                    onChange={setPayAccountId}
                    placeholder="Select account"
                  />
                </div>
              ) : null}
              <div>
                <label className={labelCls} htmlFor="pf-pay-notes">
                  Notes
                </label>
                <textarea
                  id="pf-pay-notes"
                  rows={2}
                  className={`${inputCls} resize-y`}
                  value={payNotes}
                  onChange={(e) => setPayNotes(e.target.value)}
                  placeholder="Optional — reference, receipt, etc."
                />
              </div>
            </div>
          </div>

          {paymentPreview && !paymentPreview.empty && !paymentPreview.error ? (
            <div className="rounded-xl border border-[var(--pf-border)] bg-gradient-to-b from-white/[0.04] to-transparent px-4 py-3 dark:from-white/[0.06]">
              <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-[var(--pf-text-muted)]">Payment preview</p>
              <ul className="mt-3 space-y-2 font-mono text-sm tabular-nums text-[var(--pf-text)]">
                <li className="flex justify-between gap-4">
                  <span className="text-[var(--pf-text-muted)]">Amount paid</span>
                  <span className="font-semibold">{formatInr(paymentPreview.amount)}</span>
                </li>
                <li className="flex justify-between gap-4">
                  <span className="text-[var(--pf-text-muted)]">Interest</span>
                  <span className="font-semibold">{formatInr(paymentPreview.interest)}</span>
                </li>
                <li className="flex justify-between gap-4 border-t border-[var(--pf-border)]/60 pt-2">
                  <span className="text-[var(--pf-text-muted)]">Principal</span>
                  <span className="font-semibold">{formatInr(paymentPreview.principal)}</span>
                </li>
                <li className="flex justify-between gap-4">
                  <span className="font-semibold text-sky-600 dark:text-sky-300">Remaining balance</span>
                  <span className="font-bold">{formatInr(paymentPreview.remaining)}</span>
                </li>
              </ul>
            </div>
          ) : paymentPreview?.error ? (
            <p className="text-sm text-red-600 dark:text-red-300">{paymentPreview.error}</p>
          ) : null}
        </form>
      </AppModal>

      <AppModal
        open={Boolean(emiPayScheduleRow && viewRow)}
        onClose={closeEmiPaymentModal}
        title="Record EMI payment"
        subtitle={
          emiPayScheduleRow && viewRow
            ? `${viewRow.liability_name} · Installment #${emiPayScheduleRow.emi_number}`
            : undefined
        }
        maxWidthClass="max-w-[520px]"
        footer={
          <>
            <AppButton type="button" variant="ghost" disabled={emiPaySubmitting} onClick={closeEmiPaymentModal}>
              Cancel
            </AppButton>
            <AppButton
              type="submit"
              form="pf-emipay-form"
              variant="primary"
              disabled={emiPaySubmitting || (payEmiMode === 'BANK' && (!payEmiAccountId || accounts.length === 0))}
            >
              {emiPaySubmitting ? 'Recording…' : 'Record payment'}
            </AppButton>
          </>
        }
      >
        {emiPayScheduleRow ? (
          <form id="pf-emipay-form" onSubmit={handleConfirmEmiPay} className="space-y-5">
            <div className="rounded-xl border border-[var(--pf-border)] bg-white/[0.03] p-4 backdrop-blur-sm dark:bg-white/[0.04]">
              <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-[var(--pf-text-muted)]">Installment breakdown</p>
              <dl className="mt-3 grid gap-3 sm:grid-cols-2">
                <div>
                  <dt className="text-xs text-[var(--pf-text-muted)]">EMI amount</dt>
                  <dd className="mt-0.5 font-mono text-lg font-bold tabular-nums text-[var(--pf-text)]">
                    {formatInr(emiPayScheduleRow.emi_amount)}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs text-[var(--pf-text-muted)]">Due</dt>
                  <dd className="mt-0.5 text-sm font-semibold text-[var(--pf-text)]">
                    {emiPayScheduleRow.due_date ? formatShortDate(String(emiPayScheduleRow.due_date).slice(0, 10)) : '—'}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs text-[var(--pf-text-muted)]">Principal</dt>
                  <dd className="mt-0.5 font-mono text-sm font-semibold tabular-nums text-[var(--pf-text)]">
                    {formatInr(emiPayScheduleRow.principal_amount)}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs text-[var(--pf-text-muted)]">Interest</dt>
                  <dd className="mt-0.5 font-mono text-sm font-semibold tabular-nums text-[var(--pf-text)]">
                    {formatInr(emiPayScheduleRow.interest_amount)}
                  </dd>
                </div>
              </dl>
            </div>

            <div>
              <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-[var(--pf-text-muted)]">Debit source</p>
              <div className="mt-3 grid gap-3">
                <div>
                  <label className={labelCls} htmlFor="pf-emipay-date">
                    Payment date
                  </label>
                  <input
                    id="pf-emipay-date"
                    type="date"
                    className={inputCls}
                    value={payEmiDate}
                    onChange={(e) => setPayEmiDate(e.target.value)}
                    required
                  />
                </div>
                <div>
                  <PremiumSelect
                    id="pf-emipay-mode"
                    label="Pay from"
                    options={PAY_FROM_OPTIONS}
                    value={payEmiMode}
                    onChange={setPayEmiMode}
                  />
                </div>
                {payEmiMode === 'BANK' ? (
                  <div>
                    <PremiumSelect
                      id="pf-emipay-acc"
                      label="Account"
                      searchable
                      options={accountSelectOptions}
                      value={payEmiAccountId}
                      onChange={setPayEmiAccountId}
                      placeholder="Select account"
                    />
                  </div>
                ) : null}
              </div>
            </div>

            <div className="rounded-xl border border-[var(--pf-border)] bg-gradient-to-b from-white/[0.04] to-transparent px-4 py-3 dark:from-white/[0.06]">
              <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-[var(--pf-text-muted)]">Preview</p>
              <ul className="mt-2 space-y-1.5 font-mono text-sm tabular-nums text-[var(--pf-text)]">
                <li className="flex justify-between gap-4">
                  <span className="text-[var(--pf-text-muted)]">Total debit</span>
                  <span className="font-bold">{formatInr(emiPayScheduleRow.emi_amount)}</span>
                </li>
                <li className="flex justify-between gap-4 text-xs text-[var(--pf-text-muted)]">
                  <span>After confirm, EMI #{emiPayScheduleRow.emi_number} is marked paid and your books update.</span>
                </li>
              </ul>
            </div>
          </form>
        ) : null}
      </AppModal>

      {viewId && viewRow ? (
        <div
          className={pfModalOverlay}
          role="dialog"
          aria-modal="true"
          onMouseDown={(e) => e.target === e.currentTarget && setViewId(null)}
        >
          <div
            className={`${pfModalSurface} max-w-3xl p-5 md:p-6`}
            onMouseDown={(ev) => ev.stopPropagation()}
          >
            <div className={`${pfModalHeader} flex-wrap`}>
              <div>
                <h2 className="text-lg font-semibold text-[var(--pf-text)]">{viewRow.liability_name}</h2>
                <p className="text-xs text-[var(--pf-text-muted)]">{typeLabel(viewRow.liability_type)}</p>
                <div className="mt-2">{statusBadge(viewRow.display_status)}</div>
              </div>
              <div className="flex items-center gap-2">
                <PfExportMenu
                  busy={exportBusy}
                  items={[
                    { key: 'pdf', label: 'Export PDF', onClick: () => handleStatementExport(viewId, 'pdf') },
                    { key: 'xlsx', label: 'Export Excel', onClick: () => handleStatementExport(viewId, 'excel') },
                  ]}
                />
                <button type="button" className={pfModalCloseBtn} onClick={() => setViewId(null)} aria-label="Close">
                  <XMarkIcon className="h-6 w-6" />
                </button>
              </div>
            </div>

            {detailLoading ? (
              <p className="mt-4 text-sm text-[var(--pf-text-muted)]">Loading…</p>
            ) : (
              <>
                <div className="mt-4 grid gap-2 text-sm sm:grid-cols-2">
                  <p>
                    Total: <span className="font-semibold tabular-nums">{formatInr(viewRow.total_amount)}</span>
                  </p>
                  <p>
                    Outstanding: <span className="font-semibold tabular-nums">{formatInr(viewRow.outstanding_amount)}</span>
                  </p>
                  <p>Interest paid (history): {formatInr(viewRow.interest_paid_lifetime)}</p>
                  <p>Due date: {formatShortDate(viewRow.due_date)}</p>
                  {viewRow.lender_name ? <p>Lender: {viewRow.lender_name}</p> : null}
                  {viewRow.notes ? <p className="sm:col-span-2 text-slate-600 dark:text-slate-400">{viewRow.notes}</p> : null}
                </div>
                {viewRow.has_emi_schedule ? (
                  <p className="mt-2 text-[11px] text-slate-500 dark:text-slate-400">
                    EMI method:{' '}
                    <span className="font-semibold text-slate-600 dark:text-slate-300">
                      {liabilityEmiMethodLabelFromApi(viewRow.emi_interest_method)}
                    </span>
                    {viewRow.term_months != null ? ` · ${viewRow.term_months} mo` : ''}
                    {viewRow.next_emi_due ? (
                      <>
                        {' · '}
                        Next: {formatShortDate(viewRow.next_emi_due)}
                        {viewRow.next_emi_amount != null ? ` · ${formatInr(viewRow.next_emi_amount)}` : ''}
                      </>
                    ) : null}
                  </p>
                ) : null}
                <div className="mt-4 flex flex-wrap gap-2">
                  <button
                    type="button"
                    disabled={viewRow.has_emi_schedule === true}
                    title={viewRow.has_emi_schedule ? 'Use EMI rows below' : undefined}
                    className={`${btnSecondary} inline-flex items-center gap-1 text-xs disabled:opacity-50`}
                    onClick={() => openPay(viewRow)}
                  >
                    <BanknotesIcon className="h-4 w-4" />
                    Record payment
                  </button>
                  {liabilityAllowsAdditionalPrincipal(viewRow) ? (
                    <button
                      type="button"
                      className={`${btnSecondary} text-xs`}
                      onClick={() => {
                        setAddDrawDate(todayISODate())
                        setAddDrawAmount('')
                        setAddDrawNotes('')
                        setAddDrawAccountId(accounts[0]?.id != null ? String(accounts[0].id) : '')
                        setShowAddAmountForm((v) => !v)
                      }}
                    >
                      {showAddAmountForm ? 'Hide add amount' : '+ Add amount'}
                    </button>
                  ) : null}
                  <button
                    type="button"
                    disabled={closingId === viewId || Number(viewRow.outstanding_amount) > 0.01}
                    className={`${btnDanger} text-xs`}
                    onClick={() => handleCloseLiability(viewId)}
                  >
                    {closingId === viewId ? '…' : 'Close liability'}
                  </button>
                  <button type="button" className={`${btnDanger} text-xs`} onClick={() => handleDelete(viewRow)}>
                    Delete
                  </button>
                </div>
                {!detailLoading && showAddAmountForm && liabilityAllowsAdditionalPrincipal(viewRow) ? (
                  <div className="mt-6 rounded-[16px] border border-sky-200/70 bg-sky-50/40 p-4 ring-1 ring-sky-100/50 dark:border-[var(--pf-border)] dark:bg-[var(--pf-card)]/80">
                    <h3 className="text-sm font-bold text-sky-950 dark:text-sky-200">Add more amount</h3>
                    <p className="mt-0.5 text-xs text-slate-600 dark:text-slate-400">
                      Increases principal and outstanding. Funds are credited to the bank you select (not available for
                      EMI-schedule liabilities).
                    </p>
                    <form onSubmit={handleAddAmountSubmit} className="mt-3 grid gap-3 sm:grid-cols-2">
                      <div>
                        <label htmlFor="pf-liab-add-date" className={labelCls}>
                          Date
                        </label>
                        <input
                          id="pf-liab-add-date"
                          type="date"
                          className={`${inputCls} mt-1`}
                          value={addDrawDate}
                          onChange={(e) => setAddDrawDate(e.target.value)}
                          required
                        />
                      </div>
                      <div>
                        <label htmlFor="pf-liab-add-amt" className={labelCls}>
                          Amount (₹)
                        </label>
                        <input
                          id="pf-liab-add-amt"
                          type="number"
                          step="0.01"
                          min="0.01"
                          className={`${inputCls} mt-1`}
                          value={addDrawAmount}
                          onChange={(e) => setAddDrawAmount(e.target.value)}
                          required
                        />
                      </div>
                      <div className="sm:col-span-2">
                        <PremiumSelect
                          id="pf-liab-add-acc"
                          label="Received into account"
                          labelClassName={labelCls}
                          value={addDrawAccountId}
                          onChange={setAddDrawAccountId}
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
                        <label htmlFor="pf-liab-add-notes" className={labelCls}>
                          Notes (optional)
                        </label>
                        <input
                          id="pf-liab-add-notes"
                          className={`${inputCls} mt-1`}
                          value={addDrawNotes}
                          onChange={(e) => setAddDrawNotes(e.target.value)}
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
                {detailSchedule.length > 0 ? (
                  <div className="mt-6">
                    <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">EMI schedule</h3>
                    <p className="mt-1 text-[11px] text-[var(--pf-text-muted)]">
                      Use <strong>Pay</strong> on a due row to open the confirmation dialog (debit source is chosen there).
                    </p>
                    <div className={`${pfTableWrap} mt-2`}>
                      <table className={`${pfTable} min-w-[48rem] text-xs`}>
                        <thead>
                          <tr>
                            <th className={pfThSm}>#</th>
                            <th className={pfThSm}>Due</th>
                            <th className={pfThSmRight}>EMI</th>
                            <th className={pfThSmRight}>Principal</th>
                            <th className={pfThSmRight}>Interest</th>
                            <th className={`${pfThSm} min-w-[9rem]`}>Debit source</th>
                            <th className={pfThSm}>Status</th>
                            <th className={`${pfThSmRight} ${pfThSmActionCol}`}>Action</th>
                          </tr>
                        </thead>
                        <tbody>
                          {detailSchedule.map((s) => {
                            const paid = String(s.payment_status).toLowerCase() === 'paid'
                            return (
                              <tr key={s.id} className={pfTrHover}>
                                <td className={pfTdSm}>{s.emi_number}</td>
                                <td className={`${pfTdSm} text-slate-600 dark:text-slate-400`}>{s.due_date}</td>
                                <td className={pfTdSmRight}>{formatInr(s.emi_amount)}</td>
                                <td className={`${pfTdSmRight} text-slate-600 dark:text-slate-400`}>
                                  {formatInr(s.principal_amount)}
                                </td>
                                <td className={`${pfTdSmRight} text-slate-600 dark:text-slate-400`}>
                                  {formatInr(s.interest_amount)}
                                </td>
                                <td className={pfTdSm}>
                                  <span className="text-slate-700 dark:text-slate-300" title="Adjust when you open Pay">
                                    {schedulePayFromLabel(s, accountNameById)}
                                  </span>
                                </td>
                                <td className={pfTdSm}>
                                  <span
                                    className={
                                      paid
                                        ? 'rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-semibold text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-200'
                                        : 'rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold text-amber-900 dark:bg-amber-950/40 dark:text-amber-200'
                                    }
                                  >
                                    {paid ? 'Paid' : 'Due'}
                                  </span>
                                </td>
                                <td className={`${pfTdSmRight} ${pfThSmActionCol}`}>
                                  {paid ? null : (
                                    <button
                                      type="button"
                                      disabled={emiPaySubmitting}
                                      className="rounded-[10px] bg-[#1E3A8A] px-3 py-1.5 text-[11px] font-semibold text-white shadow-sm hover:bg-[#172554] disabled:opacity-60 dark:bg-sky-700"
                                      onClick={() => openEmiPaymentModal(s)}
                                    >
                                      Pay
                                    </button>
                                  )}
                                </td>
                              </tr>
                            )
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                ) : null}
                <h3 className="mt-6 text-sm font-bold text-slate-900 dark:text-slate-100">Payment history</h3>
                <div className={`${pfTableWrap} mt-2`}>
                  <table className={`${pfTable} min-w-[420px] text-xs`}>
                    <thead>
                      <tr>
                        <th className={pfTh}>Date</th>
                        <th className={pfThRight}>Amount</th>
                        <th className={pfThRight}>Interest</th>
                        <th className={pfTh}>Mode</th>
                      </tr>
                    </thead>
                    <tbody>
                      {payments.length === 0 ? (
                        <tr>
                          <td colSpan={4} className="px-3 py-6 text-center text-slate-500">
                            No payments yet.
                          </td>
                        </tr>
                      ) : (
                        payments.map((p) => (
                          <tr key={p.id} className={pfTrHover}>
                            <td className={pfTd}>{p.payment_date}</td>
                            <td className={pfTdRight}>{formatInr(p.amount_paid)}</td>
                            <td className={pfTdRight}>{formatInr(p.interest_paid)}</td>
                            <td className={pfTd}>{p.payment_mode}</td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </>
            )}
          </div>
        </div>
      ) : null}
    </div>
  )
}
