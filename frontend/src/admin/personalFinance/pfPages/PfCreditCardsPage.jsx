import {
  ArrowPathRoundedSquareIcon,
  BanknotesIcon,
  ChartBarIcon,
  CreditCardIcon,
  PlusIcon,
  ShoppingBagIcon,
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
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import {
  assignCreditCardTransactionToBill,
  createCreditCard,
  createCreditCardStandaloneTransaction,
  deleteCreditCard,
  deleteCreditCardTransaction,
  generateCreditCardBill,
  getCreditCardBilledVsPaid,
  getCreditCardBillPreview,
  getCreditCardBillStatement,
  getCreditCardCardUtilization,
  getCreditCardDashboardSummary,
  getCreditCardInterestTrend,
  getCreditCardMonthlySpend,
  getCreditCardOutstanding,
  getCreditCardOutstandingTrend,
  getCreditCardSpendByCategory,
  getCreditCardYearlySpend,
  listCreditCardBills,
  listCreditCardTransactions,
  listCreditCards,
  listFinanceAccounts,
  markCreditCardBillOverdue,
  listPfExpenseCategories,
  patchCreditCardTransaction,
  payCreditCardBill,
  setPfToken,
  updateCreditCard,
} from '../api.js'
import {
  btnPrimary,
  btnSecondary,
  cardCls,
  inputCls,
  labelCls,
  pfChartCard,
  pfSelectCompact,
  pfTable,
  pfTableWrap,
  pfTd,
  pfTdRight,
  pfTh,
  pfThRight,
  pfTrHover,
} from '../pfFormStyles.js'
import { formatInr } from '../pfFormat.js'
import { usePfRefresh } from '../pfRefreshContext.jsx'
import { PageHeader } from '../../../components/ui/PageHeader.jsx'
import { AppButton, AppModal } from '../pfDesignSystem/index.js'

function todayISODate() {
  return new Date().toISOString().slice(0, 10)
}

const chartTitle = 'text-base font-bold text-sky-950 dark:text-[var(--pf-text)]'
const chartSub = 'mt-0.5 text-xs text-slate-500 dark:text-[var(--pf-text-muted)]'

const CATEGORY_PIE_COLORS = ['#0ea5e9', '#22c55e', '#a855f7', '#f97316', '#eab308', '#64748b', '#ef4444']
const BILLS_BAR_COLORS = ['#38bdf8', '#6366f1', '#22c55e', '#f59e0b', '#ef4444']

function utilizationBadgeClass(pct) {
  if (pct == null || Number.isNaN(pct)) return 'text-[var(--pf-text-muted)] border-[var(--pf-border)]'
  if (pct < 30) return 'text-emerald-600 dark:text-emerald-400 border-emerald-500/50 bg-emerald-500/10'
  if (pct < 50) return 'text-amber-700 dark:text-amber-300 border-amber-500/50 bg-amber-500/10'
  if (pct < 75) return 'text-orange-700 dark:text-orange-300 border-orange-500/50 bg-orange-500/10'
  return 'text-red-700 dark:text-red-300 border-red-500/50 bg-red-500/10'
}

function utilizationBarColorClass(pct) {
  const p = Number(pct) || 0
  if (p < 30) return 'bg-emerald-500'
  if (p < 50) return 'bg-yellow-400'
  if (p < 75) return 'bg-orange-500'
  return 'bg-red-500'
}

function ledgerRowAccentClass(status) {
  const s = String(status || '').toLowerCase()
  if (s === 'unbilled') return 'border-l-4 border-sky-500 bg-sky-500/5'
  if (s === 'billed') return 'border-l-4 border-amber-500 bg-amber-500/5'
  if (s === 'paid') return 'border-l-4 border-emerald-500 bg-emerald-500/5'
  if (s === 'overdue') return 'border-l-4 border-red-500 bg-red-500/5'
  if (s === 'refunded') return 'border-l-4 border-teal-500 bg-teal-500/5'
  if (s === 'emi') return 'border-l-4 border-purple-600 bg-purple-500/5'
  return 'border-l-4 border-transparent'
}

/** Pill styling for `display_status` on statements (Bills & pay table). */
function billStatusPillClass(displayStatus) {
  const s = String(displayStatus || '').toLowerCase()
  if (s === 'unbilled') return 'text-sky-800 dark:text-sky-200 bg-sky-500/15 border-sky-500/40'
  if (s === 'billed') return 'text-amber-900 dark:text-amber-200 bg-amber-500/15 border-amber-500/40'
  if (s === 'partial') return 'text-yellow-900 dark:text-yellow-100 bg-yellow-400/20 border-yellow-500/40'
  if (s === 'paid' || s === 'closed') return 'text-emerald-900 dark:text-emerald-200 bg-emerald-500/15 border-emerald-500/40'
  if (s === 'overdue') return 'text-red-900 dark:text-red-200 bg-red-500/15 border-red-500/40'
  return 'text-[var(--pf-text-muted)] bg-[var(--pf-card-hover)] border-[var(--pf-border)]'
}

/** Ledger row status — match app-wide CC palette (blue / orange / green / red / purple / teal). */
function ledgerStatusBadgeClass(status) {
  const s = String(status || '').toLowerCase()
  if (s === 'unbilled') return 'border-sky-500/50 bg-sky-500/15 text-sky-800 dark:text-sky-200'
  if (s === 'billed') return 'border-amber-500/50 bg-amber-500/15 text-amber-900 dark:text-amber-200'
  if (s === 'paid') return 'border-emerald-500/50 bg-emerald-500/15 text-emerald-900 dark:text-emerald-200'
  if (s === 'overdue') return 'border-red-500/50 bg-red-500/15 text-red-900 dark:text-red-200'
  if (s === 'emi') return 'border-purple-500/50 bg-purple-500/15 text-purple-900 dark:text-purple-200'
  if (s === 'refunded') return 'border-teal-500/50 bg-teal-500/15 text-teal-900 dark:text-teal-200'
  return 'border-[var(--pf-border)] bg-[var(--pf-card-hover)] text-[var(--pf-text-muted)]'
}

function txTypeIcon(transactionType, isEmi) {
  const t = String(transactionType || '').toLowerCase()
  const cls = 'h-4 w-4 shrink-0'
  if (isEmi || t === 'emi') return <CreditCardIcon className={`${cls} text-purple-500`} title="EMI" />
  if (t === 'refund') return <ArrowPathRoundedSquareIcon className={`${cls} text-teal-500`} title="Refund" />
  if (t === 'fee' || t === 'interest') return <ChartBarIcon className={`${cls} text-amber-500`} title={t} />
  if (t === 'swipe') return <ShoppingBagIcon className={`${cls} text-sky-500`} title="Swipe" />
  return <BanknotesIcon className={`${cls} text-[var(--pf-text-muted)]`} title={t} />
}

function ledgerAmountClass(r) {
  const t = String(r.transaction_type || '').toLowerCase()
  const amt = Number(r.amount) || 0
  if (t === 'refund' || amt < 0) return 'text-emerald-600 dark:text-emerald-400'
  return 'text-red-600 dark:text-red-400'
}

function formatShortDate(iso) {
  if (!iso) return '—'
  const d = new Date(`${String(iso).slice(0, 10)}T12:00:00`)
  if (Number.isNaN(d.getTime())) return iso
  return d.toLocaleString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
}

function billingCycleLabelFromInputs(isoDate, closingDay) {
  if (!isoDate) return '—'
  const cd = closingDay == null || closingDay === '' ? null : Number(closingDay)
  const d = new Date(`${isoDate}T12:00:00`)
  const y = d.getFullYear()
  const m = d.getMonth()
  const day = d.getDate()
  let cy = y
  let cm = m
  if (cd != null && !Number.isNaN(cd) && day > cd) {
    if (m === 11) {
      cy = y + 1
      cm = 0
    } else {
      cm = m + 1
    }
  }
  return new Date(cy, cm, 1).toLocaleString(undefined, { month: 'short', year: 'numeric' })
}

function downloadCsv(filename, content) {
  const text = Array.isArray(content) ? content.join('\n') : content
  const blob = new Blob([text], { type: 'text/csv;charset=utf-8;' })
  const link = document.createElement('a')
  link.href = URL.createObjectURL(blob)
  link.download = filename
  link.click()
  URL.revokeObjectURL(link.href)
}

function creditHealthBadgeClass(health) {
  const h = String(health || '').toUpperCase()
  if (h === 'EXCELLENT') return 'border-emerald-500/60 bg-emerald-500/15 text-emerald-700 dark:text-emerald-300'
  if (h === 'GOOD') return 'border-sky-500/60 bg-sky-500/15 text-sky-800 dark:text-sky-200'
  if (h === 'WARNING') return 'border-amber-500/60 bg-amber-500/15 text-amber-800 dark:text-amber-200'
  if (h === 'DANGER') return 'border-red-500/60 bg-red-500/15 text-red-800 dark:text-red-200'
  return 'border-[var(--pf-border)] bg-[var(--pf-card-hover)] text-[var(--pf-text)]'
}

export default function PfCreditCardsPage() {
  const { onSessionInvalid } = useOutletContext() || {}
  const { tick, refresh } = usePfRefresh()
  const [swipeModalOpen, setSwipeModalOpen] = useState(false)
  const [payModalOpen, setPayModalOpen] = useState(false)
  const [addCardModalOpen, setAddCardModalOpen] = useState(false)
  const [expandedAnalytics, setExpandedAnalytics] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [cards, setCards] = useState([])
  const [accounts, setAccounts] = useState([])
  const [outstanding, setOutstanding] = useState(null)
  const [dash, setDash] = useState(null)
  const [tx, setTx] = useState([])
  const [txSummary, setTxSummary] = useState(null)
  const [txFilterStatus, setTxFilterStatus] = useState('')
  const [txFilterDateFrom, setTxFilterDateFrom] = useState('')
  const [txFilterDateTo, setTxFilterDateTo] = useState('')
  const [txFilterCardId, setTxFilterCardId] = useState('')
  const [txFilterCategoryId, setTxFilterCategoryId] = useState('')
  const [bills, setBills] = useState([])

  const [cardName, setCardName] = useState('')
  const [bankName, setBankName] = useState('')
  const [cardLimit, setCardLimit] = useState('')
  const [billStart, setBillStart] = useState('')
  const [billEnd, setBillEnd] = useState('')
  const [genCardId, setGenCardId] = useState('')
  const [payBillId, setPayBillId] = useState('')
  const [payAmount, setPayAmount] = useState('')
  const [payFromAcc, setPayFromAcc] = useState('')
  const [payRef, setPayRef] = useState('')
  const [busy, setBusy] = useState(false)
  const [categories, setCategories] = useState([])
  const [txCardId, setTxCardId] = useState('')
  const [txAmount, setTxAmount] = useState('')
  const [txDate, setTxDate] = useState(() => todayISODate())
  const [txCategoryId, setTxCategoryId] = useState('')
  const [txDesc, setTxDesc] = useState('')
  const [txType, setTxType] = useState('swipe')
  const [txMerchant, setTxMerchant] = useState('')
  const [txNotes, setTxNotes] = useState('')
  const [txAttachmentUrl, setTxAttachmentUrl] = useState('')
  const [txIsEmiForm, setTxIsEmiForm] = useState(false)
  const [txEdit, setTxEdit] = useState(null)
  const [txAssign, setTxAssign] = useState(null)
  const [txAssignBillPick, setTxAssignBillPick] = useState('')
  const [closingDay, setClosingDay] = useState('')
  const [dueDay, setDueDay] = useState('')
  const [cardNetwork, setCardNetwork] = useState('')
  const [cardType, setCardType] = useState('')
  const [interestRate, setInterestRate] = useState('')
  const [annualFee, setAnnualFee] = useState('')
  const [currency, setCurrency] = useState('INR')
  const [isActiveAdd, setIsActiveAdd] = useState(true)
  const [cardsFilter, setCardsFilter] = useState('all')
  const [pendingTxCardId, setPendingTxCardId] = useState(null)
  const [editForm, setEditForm] = useState(null)
  const [yearlySpend, setYearlySpend] = useState([])
  const [selectedYear, setSelectedYear] = useState(() => new Date().getFullYear())
  const [selectedCardId, setSelectedCardId] = useState('')
  const [monthlySpend, setMonthlySpend] = useState([])
  const [yearlyChartYear, setYearlyChartYear] = useState(() => new Date().getFullYear())
  const [monthlyCategoryFilter, setMonthlyCategoryFilter] = useState('')
  const [cardUtilization, setCardUtilization] = useState([])
  const [spendByCategory, setSpendByCategory] = useState([])
  const [billedVsPaid, setBilledVsPaid] = useState([])
  const [outstandingTrend, setOutstandingTrend] = useState([])
  const [interestTrend, setInterestTrend] = useState([])
  const [billPreview, setBillPreview] = useState(null)
  const [billPreviewErr, setBillPreviewErr] = useState('')
  const [previewLoading, setPreviewLoading] = useState(false)
  const [statementDetail, setStatementDetail] = useState(null)
  const previewTimerRef = useRef(null)

  const [payPaymentDate, setPayPaymentDate] = useState(() => todayISODate())
  const [payPaymentType, setPayPaymentType] = useState('custom')
  const [payNotes, setPayNotes] = useState('')

  const period = useMemo(() => {
    const d = new Date()
    return { y: d.getFullYear(), m: d.getMonth() + 1 }
  }, [tick])

  const usageTotals = useMemo(() => {
    if (!dash) return null
    const totalLimit = Number(dash.total_credit_limit) || 0
    const used = Number(dash.used_limit) || 0
    const available = Math.max(0, totalLimit - used)
    return { totalLimit, used, available }
  }, [dash])

  const usagePieData = useMemo(
    () =>
      usageTotals
        ? [
            { name: 'Used', value: usageTotals.used },
            { name: 'Available', value: usageTotals.available },
          ]
        : [],
    [usageTotals],
  )

  const billsBarData = useMemo(
    () =>
      !dash
        ? []
        : [
            { name: 'Unbilled', value: Number(dash.unbilled_charges) || 0 },
            { name: 'Billed', value: Number(dash.billed_outstanding) || 0 },
            { name: 'Paid', value: Number(dash.paid_this_month) || 0 },
            { name: 'Due this month', value: Number(dash.due_this_month) || 0 },
            { name: 'Overdue', value: Number(dash.overdue_amount) || 0 },
          ],
    [dash],
  )

  const yearlyYears = useMemo(() => {
    const ys = new Set()
    for (const row of yearlySpend) {
      if (row.year) ys.add(row.year)
    }
    return Array.from(ys).sort((a, b) => a - b)
  }, [yearlySpend])

  const yearlySpendForYear = useMemo(() => {
    const rows = yearlySpend.filter((r) => r.year === yearlyChartYear)
    return rows.map((r) => ({
      name: r.card_name,
      amount: Number(r.total_spent) || 0,
    }))
  }, [yearlySpend, yearlyChartYear])

  const yearlySpendYearTotal = useMemo(
    () => yearlySpendForYear.reduce((s, r) => s + r.amount, 0),
    [yearlySpendForYear],
  )

  const yearlySpendHighest = useMemo(() => {
    if (!yearlySpendForYear.length) return null
    return [...yearlySpendForYear].sort((a, b) => b.amount - a.amount)[0]
  }, [yearlySpendForYear])

  const yearlySpendLowest = useMemo(() => {
    if (!yearlySpendForYear.length) return null
    return [...yearlySpendForYear].sort((a, b) => a.amount - b.amount)[0]
  }, [yearlySpendForYear])

  const categoryPieData = useMemo(
    () =>
      (spendByCategory || []).map((row) => ({
        name: row.category || 'Other',
        value: Number(row.total_spent) || 0,
      })),
    [spendByCategory],
  )

  const billedVsPaidChart = useMemo(
    () =>
      (billedVsPaid || []).map((row) => {
        const d = new Date(row.month_start)
        return {
          label: d.toLocaleString(undefined, { month: 'short', year: '2-digit' }),
          billed: Number(row.billed) || 0,
          paid: Number(row.paid) || 0,
        }
      }),
    [billedVsPaid],
  )

  /** Portfolio-wide monthly spend from loaded ledger (swipe, EMI, fee, interest; excludes refunds). */
  const portfolioMonthlySpendChart = useMemo(() => {
    const bucket = new Map()
    const now = new Date()
    const cutoff = new Date(now.getFullYear(), now.getMonth() - 11, 1)
    for (const r of tx) {
      const raw = String(r.transaction_date || '').slice(0, 10)
      if (!raw) continue
      const d = new Date(`${raw}T12:00:00`)
      if (d < cutoff) continue
      const typ = String(r.transaction_type || '').toLowerCase()
      const amt = Number(r.amount) || 0
      if (typ === 'refund' || amt <= 0) continue
      if (!['swipe', 'emi', 'fee', 'interest'].includes(typ)) continue
      const key = raw.slice(0, 7)
      bucket.set(key, (bucket.get(key) || 0) + amt)
    }
    return [...bucket.keys()]
      .sort()
      .map((k) => {
        const [y, m] = k.split('-').map(Number)
        const label = new Date(y, m - 1, 1).toLocaleString(undefined, { month: 'short', year: '2-digit' })
        return { key: k, label, amount: Math.round((bucket.get(k) || 0) * 100) / 100 }
      })
  }, [tx])

  const outstandingBalanceChart = useMemo(
    () =>
      (outstandingTrend || []).map((row) => ({
        label: row.month_label || `${row.year}-${String(row.month).padStart(2, '0')}`,
        outstanding: Number(row.outstanding) || 0,
      })),
    [outstandingTrend],
  )

  const interestTrendChart = useMemo(
    () =>
      (interestTrend || []).map((row) => ({
        label: row.month_label || `${row.year}-${String(row.month).padStart(2, '0')}`,
        interest: Number(row.interest_and_fees) || 0,
      })),
    [interestTrend],
  )

  const billsPageSummary = useMemo(() => {
    const list = bills || []
    let totalBilled = 0
    let totalPaid = 0
    let totalOutstanding = 0
    let totalInterest = 0
    let totalLateFees = 0
    for (const b of list) {
      totalBilled += Number(b.total_amount) || 0
      totalPaid += Number(b.amount_paid) || 0
      const rem =
        b.remaining != null ? Number(b.remaining) : Number(b.total_amount) - Number(b.amount_paid)
      totalOutstanding += Math.max(0, rem)
      totalInterest += Number(b.interest) || 0
      totalLateFees += Number(b.late_fee) || 0
    }
    return { totalBilled, totalPaid, totalOutstanding, totalInterest, totalLateFees }
  }, [bills])

  const billsPageAlerts = useMemo(() => {
    const alerts = []
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const msDay = 86400000

    for (const b of bills || []) {
      const st = String(b.display_status || b.status || '').toLowerCase()
      if (st === 'paid') continue
      const dueRaw = b.due_date
      if (!dueRaw) continue
      const due = new Date(`${String(dueRaw).slice(0, 10)}T12:00:00`)
      due.setHours(0, 0, 0, 0)
      const days = Math.round((due.getTime() - today.getTime()) / msDay)
      const cardName = cards.find((c) => c.id === b.card_id)?.card_name || `Card #${b.card_id}`
      if (days >= 0 && days <= 3) {
        alerts.push({
          key: `due-${b.id}`,
          level: 'warn',
          text: `${cardName} bill due in ${days === 0 ? 'today' : `${days} day${days === 1 ? '' : 's'}`}`,
        })
      }
      const minDue = Number(b.minimum_due) || 0
      const paid = Number(b.amount_paid) || 0
      if (minDue > 0.01 && paid + 0.01 < minDue && days >= 0) {
        alerts.push({
          key: `min-${b.id}`,
          level: 'warn',
          text: `${cardName} minimum due not yet covered (min ${formatInr(minDue)}, paid ${formatInr(paid)})`,
        })
      }
    }

    const utilPct = Number(dash?.utilization_pct)
    if (!Number.isNaN(utilPct) && utilPct > 50) {
      alerts.push({
        key: 'util',
        level: 'warn',
        text: `Credit utilization is ${utilPct}% (> 50%)`,
      })
    }

    return alerts
  }, [bills, cards, dash])

  const insights = useMemo(() => {
    if (!dash) return []
    const out = []
    const pct = dash.utilization_pct ?? 0
    const health = (dash.credit_health || 'GOOD').replace(/_/g, ' ')
    out.push(`Utilization is ${pct}% — credit health: ${health}.`)
    if (dash.highest_spend_card_this_month) {
      out.push(
        `Top spend this month: ${dash.highest_spend_card_this_month} (${formatInr(dash.highest_spend_amount_this_month)}).`,
      )
    }
    if (dash.last_month_spend != null) {
      out.push(`Last month's card spend: ${formatInr(dash.last_month_spend)}.`)
    }
    if (dash.next_due_date) {
      out.push(`Next statement payment due: ${dash.next_due_date}.`)
    }
    if ((dash.interest_fees_due_month || 0) < 0.01) {
      out.push('No interest or late fees recorded on statements due this month.')
    } else {
      out.push(`Interest + late fees (due this month): ${formatInr(dash.interest_fees_due_month)}.`)
    }
    if ((dash.paid_this_month || 0) > 0) {
      out.push(`Paid toward statements this month: ${formatInr(dash.paid_this_month)}.`)
    }
    return out
  }, [dash])

  const enrichedCards = useMemo(() => {
    const byId = new Map((cardUtilization || []).map((r) => [r.card_id, r]))
    return (cards || []).map((c) => {
      const u = byId.get(c.id) || {}
      const lim = Number(c.card_limit) || 0
      const used = u.used_amount ?? 0
      return {
        ...c,
        used_amount: used,
        available_credit: u.available_credit ?? Math.max(0, lim - used),
        unbilled_charges: u.unbilled_charges ?? 0,
        billed_outstanding: u.billed_outstanding ?? 0,
        utilization_pct: u.utilization_pct ?? 0,
        utilization_status: u.utilization_status ?? 'Good',
        next_due_date: u.next_due_date ?? null,
        overdue_amount: u.overdue_amount ?? 0,
      }
    })
  }, [cards, cardUtilization])

  const filteredCards = useMemo(() => {
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const weekMs = 7 * 86400000
    return enrichedCards.filter((row) => {
      const active = row.is_active !== false
      const pct = Number(row.utilization_pct) || 0
      const overdue = Number(row.overdue_amount) > 0.01
      let dueSoon = false
      if (row.next_due_date && !overdue) {
        const d = new Date(row.next_due_date)
        d.setHours(0, 0, 0, 0)
        if (d >= today && d.getTime() - today.getTime() <= weekMs) dueSoon = true
      }
      if (cardsFilter === 'all') return true
      if (cardsFilter === 'active') return active
      if (cardsFilter === 'high_util') return pct >= 50
      if (cardsFilter === 'due_soon') return dueSoon
      if (cardsFilter === 'overdue') return overdue
      return true
    })
  }, [enrichedCards, cardsFilter])

  const cardsTabSummary = useMemo(() => {
    const rows = filteredCards
    const n = rows.length
    let totalLimit = 0
    let totalUsed = 0
    let totalDue = 0
    let utilSum = 0
    let utilN = 0
    for (const r of rows) {
      const lim = Number(r.card_limit) || 0
      const used = Number(r.used_amount) || 0
      totalLimit += lim
      totalUsed += used
      totalDue += Number(r.billed_outstanding) || 0
      if (lim > 0.01) {
        utilSum += (used / lim) * 100
        utilN += 1
      }
    }
    const avgUtil = utilN ? Math.round((utilSum / utilN) * 10) / 10 : 0
    return { n, totalLimit, totalUsed, avgUtil, totalDue }
  }, [filteredCards])

  const txFormCard = useMemo(() => cards.find((c) => String(c.id) === String(txCardId)), [cards, txCardId])
  const txBillingCyclePreview = billingCycleLabelFromInputs(txDate, txFormCard?.closing_day)

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const [
        c,
        a,
        o,
        billR,
        dsum,
        cats,
        ySpend,
        utilRows,
        catSpend,
        billPay,
        outTrend,
        intTrend,
      ] = await Promise.all([
        listCreditCards(),
        listFinanceAccounts(),
        getCreditCardOutstanding(),
        listCreditCardBills({ limit: 100 }),
        getCreditCardDashboardSummary(period.y, period.m),
        listPfExpenseCategories(),
        getCreditCardYearlySpend(),
        getCreditCardCardUtilization(),
        getCreditCardSpendByCategory(yearlyChartYear),
        getCreditCardBilledVsPaid(period.y, period.m, 12),
        getCreditCardOutstandingTrend(period.y, period.m, 12),
        getCreditCardInterestTrend(period.y, period.m, 12),
      ])
      const txR = await listCreditCardTransactions({
        limit: 500,
        skip: 0,
        cardId: txFilterCardId || undefined,
        categoryId: txFilterCategoryId || undefined,
        dateFrom: txFilterDateFrom || undefined,
        dateTo: txFilterDateTo || undefined,
        status: txFilterStatus || undefined,
      })
      setCards(Array.isArray(c) ? c : [])
      setCategories(Array.isArray(cats) ? cats : [])
      setAccounts(Array.isArray(a) ? a : [])
      setOutstanding(o && typeof o === 'object' ? o : null)
      if (txR && typeof txR === 'object' && Array.isArray(txR.transactions)) {
        setTx(txR.transactions)
        setTxSummary(txR.summary && typeof txR.summary === 'object' ? txR.summary : null)
      } else {
        setTx([])
        setTxSummary(null)
      }
      setBills(Array.isArray(billR) ? billR : [])
      setDash(dsum && typeof dsum === 'object' ? dsum : null)
      setYearlySpend(Array.isArray(ySpend) ? ySpend : [])
      setCardUtilization(Array.isArray(utilRows) ? utilRows : [])
      setSpendByCategory(Array.isArray(catSpend) ? catSpend : [])
      setBilledVsPaid(Array.isArray(billPay) ? billPay : [])
      setOutstandingTrend(Array.isArray(outTrend) ? outTrend : [])
      setInterestTrend(Array.isArray(intTrend) ? intTrend : [])
    } catch (e) {
      if (e.status === 401) {
        setPfToken(null)
        onSessionInvalid?.()
      } else {
        setError(e.message || 'Could not load credit cards')
      }
    } finally {
      setLoading(false)
    }
  }, [
    onSessionInvalid,
    period.m,
    period.y,
    yearlyChartYear,
    txFilterCardId,
    txFilterCategoryId,
    txFilterDateFrom,
    txFilterDateTo,
    txFilterStatus,
  ])

  useEffect(() => {
    if (!selectedCardId && cards.length) {
      setSelectedCardId(String(cards[0].id))
    }
    if (!selectedYear && yearlyYears.length) {
      setSelectedYear(yearlyYears[yearlyYears.length - 1])
    }
  }, [cards, yearlyYears, selectedCardId, selectedYear])

  useEffect(() => {
    async function loadMonthly() {
      if (!selectedCardId || !selectedYear) {
        setMonthlySpend([])
        return
      }
      try {
        const data = await getCreditCardMonthlySpend(
          Number(selectedCardId),
          Number(selectedYear),
          monthlyCategoryFilter || undefined,
        )
        setMonthlySpend(Array.isArray(data) ? data : [])
      } catch {
        setMonthlySpend([])
      }
    }
    loadMonthly()
  }, [selectedCardId, selectedYear, monthlyCategoryFilter])

  const monthlyLineData = useMemo(
    () =>
      (monthlySpend || []).map((row) => {
        const d = new Date(row.month)
        return {
          monthLabel: d.toLocaleString(undefined, { month: 'short' }),
          amount: Number(row.total_spent) || 0,
        }
      }),
    [monthlySpend],
  )

  const monthlyStats = useMemo(() => {
    if (!monthlyLineData.length) return { avg: 0, hi: null, lo: null }
    const amounts = monthlyLineData.map((r) => r.amount)
    const sum = amounts.reduce((a, b) => a + b, 0)
    const avg = sum / amounts.length
    let hi = monthlyLineData[0]
    let lo = monthlyLineData[0]
    for (const row of monthlyLineData) {
      if (row.amount > hi.amount) hi = row
      if (row.amount < lo.amount) lo = row
    }
    return { avg, hi, lo }
  }, [monthlyLineData])

  useEffect(() => {
    load()
  }, [load, tick])

  useEffect(() => {
    if (pendingTxCardId != null) {
      setTxCardId(String(pendingTxCardId))
      setTxType('swipe')
      setTxIsEmiForm(false)
      setSwipeModalOpen(true)
      setPendingTxCardId(null)
    }
  }, [pendingTxCardId])

  function openLedgerModal(kind) {
    if (kind === 'emi') {
      setTxType('emi')
      setTxIsEmiForm(true)
    } else {
      setTxType('swipe')
      setTxIsEmiForm(false)
    }
    setSwipeModalOpen(true)
  }

  useEffect(() => {
    if (yearlyYears.length && !yearlyYears.includes(yearlyChartYear)) {
      setYearlyChartYear(yearlyYears[yearlyYears.length - 1])
    }
  }, [yearlyYears, yearlyChartYear])

  async function handleAddCard(e) {
    e.preventDefault()
    setBusy(true)
    setError('')
    try {
      await createCreditCard({
        card_name: cardName.trim(),
        bank_name: bankName.trim() || null,
        card_limit: Number(cardLimit) || 0,
        billing_cycle_start: 1,
        due_days: 15,
        closing_day: closingDay === '' ? null : Number(closingDay),
        due_day: dueDay === '' ? null : Number(dueDay),
        interest_rate: interestRate === '' ? 0 : Number(interestRate),
        annual_fee: annualFee === '' ? 0 : Number(annualFee),
        card_network: cardNetwork.trim() || null,
        card_type: cardType.trim() || null,
        currency: (currency || 'INR').trim().toUpperCase() || 'INR',
        is_active: isActiveAdd,
      })
      setCardName('')
      setBankName('')
      setCardLimit('')
      setClosingDay('')
      setDueDay('')
      setCardNetwork('')
      setCardType('')
      setInterestRate('')
      setAnnualFee('')
      setCurrency('INR')
      setIsActiveAdd(true)
      setAddCardModalOpen(false)
      await load()
      refresh()
    } catch (err) {
      if (err.status === 401) {
        setPfToken(null)
        onSessionInvalid?.()
      } else {
        setError(err.message || 'Could not save card')
      }
    } finally {
      setBusy(false)
    }
  }

  async function handleGenerateBill(e) {
    e.preventDefault()
    if (!genCardId || !billStart || !billEnd) {
      setError('Select card and statement date range.')
      return
    }
    setBusy(true)
    setError('')
    try {
      await generateCreditCardBill({
        card_id: Number(genCardId),
        bill_start_date: billStart,
        bill_end_date: billEnd,
      })
      await load()
      refresh()
    } catch (err) {
      setError(err.message || 'Could not generate bill')
    } finally {
      setBusy(false)
    }
  }

  async function handlePayBill(e) {
    e.preventDefault()
    if (!payBillId || !payAmount || !payFromAcc) {
      setError('Bill, amount, and bank account required.')
      return
    }
    setBusy(true)
    setError('')
    try {
      await payCreditCardBill({
        bill_id: Number(payBillId),
        amount: Number(payAmount),
        payment_date: payPaymentDate || todayISODate(),
        from_account_id: Number(payFromAcc),
        reference_number: payRef.trim() || null,
      })
      setPayAmount('')
      setPayRef('')
      setPayModalOpen(false)
      await load()
      refresh()
    } catch (err) {
      setError(err.message || 'Payment failed')
    } finally {
      setBusy(false)
    }
  }

  async function handleManualSwipe(e) {
    e.preventDefault()
    if (!txCardId || !txAmount) {
      setError('Select a card and enter an amount.')
      return
    }
    const cat = categories.find((x) => String(x.id) === txCategoryId)
    setBusy(true)
    setError('')
    try {
      await createCreditCardStandaloneTransaction({
        card_id: Number(txCardId),
        transaction_type: txType,
        amount: Number(txAmount),
        transaction_date: txDate,
        expense_category_id: txCategoryId === '' ? null : Number(txCategoryId),
        category: cat?.name || 'general',
        description: txDesc.trim() || txMerchant.trim() || null,
        merchant: txMerchant.trim() || null,
        notes: txNotes.trim() || null,
        attachment_url: txAttachmentUrl.trim() || null,
        is_emi: txIsEmiForm,
        paid_by: null,
      })
      setTxAmount('')
      setTxDesc('')
      setTxMerchant('')
      setTxNotes('')
      setTxAttachmentUrl('')
      setTxIsEmiForm(false)
      setTxType('swipe')
      setSwipeModalOpen(false)
      await load()
      refresh()
    } catch (err) {
      setError(err.message || 'Could not add transaction')
    } finally {
      setBusy(false)
    }
  }

  function openTxEdit(row) {
    setTxEdit({
      id: row.id,
      transaction_date: row.transaction_date,
      transaction_type: row.transaction_type || 'swipe',
      amount: String(Math.abs(Number(row.amount) || 0)),
      category_id: row.category_id != null ? String(row.category_id) : '',
      description: row.description ?? '',
      merchant: row.merchant ?? '',
      notes: row.notes ?? '',
      attachment_url: row.attachment_url ?? '',
      is_emi: !!row.is_emi,
    })
  }

  async function handleSaveTxEdit(e) {
    e.preventDefault()
    if (!txEdit?.id) return
    setBusy(true)
    setError('')
    try {
      await patchCreditCardTransaction(txEdit.id, {
        transaction_date: txEdit.transaction_date,
        transaction_type: txEdit.transaction_type,
        amount: Number(txEdit.amount),
        category_id: txEdit.category_id === '' ? null : Number(txEdit.category_id),
        description: txEdit.description.trim() || null,
        merchant: txEdit.merchant.trim() || null,
        notes: txEdit.notes.trim() || null,
        attachment_url: txEdit.attachment_url.trim() || null,
        is_emi: txEdit.is_emi,
      })
      setTxEdit(null)
      await load()
      refresh()
    } catch (err) {
      setError(err.message || 'Could not update transaction')
    } finally {
      setBusy(false)
    }
  }

  async function handleDeleteTx(row) {
    if (!window.confirm('Delete this ledger line?')) return
    setBusy(true)
    setError('')
    try {
      await deleteCreditCardTransaction(row.id)
      await load()
      refresh()
    } catch (err) {
      setError(err.message || 'Could not delete')
    } finally {
      setBusy(false)
    }
  }

  async function handleConvertEmi(row) {
    setBusy(true)
    setError('')
    try {
      await patchCreditCardTransaction(row.id, { is_emi: true, transaction_type: 'emi' })
      await load()
      refresh()
    } catch (err) {
      setError(err.message || 'Could not convert to EMI')
    } finally {
      setBusy(false)
    }
  }

  async function handleConfirmAssignBill(e) {
    e.preventDefault()
    if (!txAssign?.id || !txAssignBillPick) return
    setBusy(true)
    setError('')
    try {
      await assignCreditCardTransactionToBill(txAssign.id, Number(txAssignBillPick))
      setTxAssign(null)
      setTxAssignBillPick('')
      await load()
      refresh()
    } catch (err) {
      setError(err.message || 'Could not assign bill')
    } finally {
      setBusy(false)
    }
  }

  function exportLedgerCsv(label) {
    const esc = (s) => String(s || '').replace(/"/g, '""')
    const header = [
      'Date',
      'Card',
      'Merchant',
      'Category',
      'Type',
      'Amount',
      'Status',
      'Balance',
      'Bill',
    ]
    const lines = [header.join(',')]
    for (const r of tx) {
      lines.push(
        [
          r.transaction_date,
          `"${esc(r.card_name)}"`,
          `"${esc(r.merchant)}"`,
          `"${esc(r.category_name)}"`,
          r.transaction_type,
          r.amount,
          r.ledger_status,
          r.running_balance,
          r.bill_id ?? '',
        ].join(','),
      )
    }
    const bom = '\uFEFF'
    downloadCsv(`${label}.csv`, bom + lines.join('\n'))
  }

  function openCardEditor(row) {
    setEditForm({
      id: row.id,
      card_name: row.card_name,
      bank_name: row.bank_name ?? '',
      card_limit: String(row.card_limit ?? ''),
      card_network: row.card_network ?? '',
      card_type: row.card_type ?? '',
      interest_rate: String(row.interest_rate ?? '0'),
      annual_fee: String(row.annual_fee ?? '0'),
      currency: row.currency || 'INR',
      is_active: row.is_active !== false,
      closing_day: row.closing_day != null ? String(row.closing_day) : '',
      due_day: row.due_day != null ? String(row.due_day) : '',
    })
  }

  async function handleSaveEdit(e) {
    e.preventDefault()
    if (!editForm?.id) return
    setBusy(true)
    setError('')
    try {
      await updateCreditCard(editForm.id, {
        card_name: editForm.card_name.trim(),
        bank_name: editForm.bank_name.trim() || null,
        card_limit: Number(editForm.card_limit) || 0,
        interest_rate: editForm.interest_rate === '' ? 0 : Number(editForm.interest_rate),
        annual_fee: editForm.annual_fee === '' ? 0 : Number(editForm.annual_fee),
        card_network: editForm.card_network.trim() || null,
        card_type: editForm.card_type.trim() || null,
        currency: (editForm.currency || 'INR').trim().toUpperCase() || 'INR',
        is_active: editForm.is_active,
        closing_day: editForm.closing_day === '' ? null : Number(editForm.closing_day),
        due_day: editForm.due_day === '' ? null : Number(editForm.due_day),
      })
      setEditForm(null)
      await load()
      refresh()
    } catch (err) {
      if (err.status === 401) {
        setPfToken(null)
        onSessionInvalid?.()
      } else {
        setError(err.message || 'Could not update card')
      }
    } finally {
      setBusy(false)
    }
  }

  async function handleDeleteCard(row) {
    if (
      !window.confirm(
        `Delete card "${row.card_name}"? Statements and swipes for this card will be removed.`,
      )
    ) {
      return
    }
    setBusy(true)
    setError('')
    try {
      await deleteCreditCard(row.id)
      if (editForm?.id === row.id) setEditForm(null)
      await load()
      refresh()
    } catch (err) {
      if (err.status === 401) {
        setPfToken(null)
        onSessionInvalid?.()
      } else {
        setError(err.message || 'Could not delete card')
      }
    } finally {
      setBusy(false)
    }
  }

  const kpiGlass =
    'rounded-2xl border border-[var(--pf-border)] bg-white/[0.03] p-4 shadow-[var(--pf-shadow)] backdrop-blur-md dark:bg-white/[0.04]'

  return (
    <div className="mx-auto max-w-[1400px] space-y-8 pb-16">
      <PageHeader
        title="Credit cards"
        description="Swipe → unbilled → statement → paid. Track limits, utilization, and spend like a modern card app."
        action={
          <div className="flex flex-col items-stretch gap-2 sm:flex-row sm:flex-wrap sm:justify-end">
            {dash ? (
              <span
                className={`inline-flex items-center justify-center rounded-full border px-3 py-1.5 text-[11px] font-bold uppercase tracking-wide ${creditHealthBadgeClass(dash.credit_health)}`}
              >
                {String(dash.credit_health || '—').replace(/_/g, ' ')}
              </span>
            ) : null}
            <button
              type="button"
              className={`${btnPrimary} inline-flex items-center justify-center gap-2`}
              onClick={() => openLedgerModal('swipe')}
            >
              <PlusIcon className="h-5 w-5 shrink-0" />
              Swipe
            </button>
            <button
              type="button"
              className={`${btnSecondary} inline-flex items-center justify-center gap-2`}
              onClick={() => setPayModalOpen(true)}
            >
              Record payment
            </button>
            <button
              type="button"
              className={`${btnSecondary} inline-flex items-center justify-center gap-2`}
              onClick={() => setAddCardModalOpen(true)}
            >
              Add card
            </button>
            <button
              type="button"
              className={`${btnSecondary} inline-flex items-center justify-center gap-2`}
              onClick={() => openLedgerModal('emi')}
            >
              EMI conversion
            </button>
          </div>
        }
      />

      {error ? (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-100">
          {error}
        </div>
      ) : null}

      {loading && !cards.length ? (
        <div className="animate-pulse rounded-2xl bg-slate-200/60 p-8 dark:bg-slate-700/40">Loading…</div>
      ) : null}

      {dash ? (
        <>
          <section className="space-y-3" aria-label="Portfolio summary">
            <h2 className="text-xs font-bold uppercase tracking-[0.16em] text-[var(--pf-text-muted)]">
              Portfolio · {period.y}-{String(period.m).padStart(2, '0')}
            </h2>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
              <div className={kpiGlass}>
                <p className="text-[11px] font-bold uppercase tracking-wider text-[var(--pf-text-muted)]">
                  Total outstanding
                </p>
                <p className="mt-2 font-mono text-lg font-bold tabular-nums text-[var(--pf-text)]">
                  {formatInr(dash.total_outstanding ?? dash.used_limit)}
                </p>
                <p className="mt-1 text-[10px] text-[var(--pf-text-muted)]">Unbilled + billed due</p>
              </div>
              <div className={`${kpiGlass} border-sky-500/25 bg-sky-500/[0.04]`}>
                <p className="text-[11px] font-bold uppercase tracking-wider text-[var(--pf-text-muted)]">Unbilled</p>
                <p className="mt-2 font-mono text-lg font-bold tabular-nums text-sky-700 dark:text-sky-300">
                  {formatInr(dash.unbilled_charges)}
                </p>
              </div>
              <div className={`${kpiGlass} border-amber-500/25 bg-amber-500/[0.04]`}>
                <p className="text-[11px] font-bold uppercase tracking-wider text-[var(--pf-text-muted)]">
                  Due this month
                </p>
                <p className="mt-2 font-mono text-lg font-bold tabular-nums text-amber-800 dark:text-amber-200">
                  {formatInr(dash.due_this_month)}
                </p>
                {dash.overdue_amount > 0.01 ? (
                  <p className="mt-1 text-[10px] font-semibold text-red-600 dark:text-red-400">
                    Overdue {formatInr(dash.overdue_amount)}
                  </p>
                ) : null}
              </div>
              <div className={kpiGlass}>
                <p className="text-[11px] font-bold uppercase tracking-wider text-[var(--pf-text-muted)]">
                  Credit limit
                </p>
                <p className="mt-2 font-mono text-lg font-bold tabular-nums text-[var(--pf-text)]">
                  {formatInr(dash.total_credit_limit)}
                </p>
                <p className="mt-1 text-[10px] text-[var(--pf-text-muted)]">
                  Available {formatInr(dash.available_limit)}
                </p>
              </div>
              <div className={kpiGlass}>
                <p className="text-[11px] font-bold uppercase tracking-wider text-[var(--pf-text-muted)]">Utilization</p>
                <p
                  className={`mt-2 font-mono text-lg font-bold tabular-nums ${utilizationBadgeClass(Number(dash.utilization_pct ?? 0))}`}
                >
                  {(dash.utilization_pct ?? 0).toFixed(1)}%
                </p>
                <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-[var(--pf-border)]">
                  <div
                    className={`h-full rounded-full ${utilizationBarColorClass(Number(dash.utilization_pct ?? 0))}`}
                    style={{ width: `${Math.min(100, Number(dash.utilization_pct ?? 0))}%` }}
                  />
                </div>
              </div>
              <div className={`${kpiGlass} border-purple-500/25 bg-purple-500/[0.05]`}>
                <p className="text-[11px] font-bold uppercase tracking-wider text-[var(--pf-text-muted)]">
                  EMI (ledger)
                </p>
                <p className="mt-2 font-mono text-lg font-bold tabular-nums text-purple-800 dark:text-purple-200">
                  {formatInr(txSummary?.emi_amount ?? 0)}
                </p>
                <p className="mt-1 text-[10px] text-[var(--pf-text-muted)]">Filtered view</p>
              </div>
            </div>
          </section>

          <section
            className={`${cardCls} border border-dashed border-[var(--pf-border)] bg-gradient-to-r from-sky-500/[0.06] via-transparent to-emerald-500/[0.06] px-4 py-4 sm:px-6`}
            aria-label="Billing flow"
          >
            <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-[var(--pf-text-muted)]">
              Mental model
            </p>
            <div className="mt-3 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              {[
                {
                  step: 'Unbilled',
                  hint: 'Swipes & EMI not yet on a statement',
                  amt: dash.unbilled_charges,
                  tone: 'sky',
                },
                {
                  step: 'Billed',
                  hint: 'Statement generated — amount owed',
                  amt: dash.billed_outstanding,
                  tone: 'amber',
                },
                {
                  step: 'Paid',
                  hint: 'Payments this month',
                  amt: dash.paid_this_month,
                  tone: 'emerald',
                },
              ].map((s, i) => (
                <div key={s.step} className="flex min-w-0 flex-1 items-center gap-3">
                  <div
                    className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full border-2 font-bold ${
                      s.tone === 'sky'
                        ? 'border-sky-500 bg-sky-500/20 text-sky-800 dark:text-sky-200'
                        : s.tone === 'amber'
                          ? 'border-amber-500 bg-amber-500/20 text-amber-900 dark:text-amber-200'
                          : 'border-emerald-500 bg-emerald-500/20 text-emerald-900 dark:text-emerald-200'
                    }`}
                  >
                    {i + 1}
                  </div>
                  <div className="min-w-0">
                    <p className="font-bold text-[var(--pf-text)]">{s.step}</p>
                    <p className="text-xs text-[var(--pf-text-muted)]">{s.hint}</p>
                    <p className="mt-0.5 font-mono text-sm font-semibold tabular-nums text-[var(--pf-text)]">
                      {formatInr(s.amt)}
                    </p>
                  </div>
                  {i < 2 ? (
                    <span className="hidden text-lg font-light text-[var(--pf-text-muted)] lg:block" aria-hidden>
                      →
                    </span>
                  ) : null}
                </div>
              ))}
            </div>
            {dash.next_due_date ? (
              <p className="mt-3 text-sm text-[var(--pf-text-muted)]">
                Next due <span className="font-semibold text-[var(--pf-text)]">{formatShortDate(dash.next_due_date)}</span>
              </p>
            ) : null}
          </section>

          {enrichedCards.length ? (
            <section className="space-y-3" aria-label="Your cards" id="cc-card-carousel">
              <div className="flex items-end justify-between gap-2">
                <h2 className="text-xs font-bold uppercase tracking-[0.16em] text-[var(--pf-text-muted)]">Your cards</h2>
                <p className="text-[10px] text-[var(--pf-text-muted)]">Scroll horizontally</p>
              </div>
              <div className="flex gap-4 overflow-x-auto pb-2 pt-1 [scrollbar-width:thin]">
                {enrichedCards.map((c) => {
                  const pct = Number(c.utilization_pct) || 0
                  const dueLabel = c.next_due_date
                    ? new Date(c.next_due_date).toLocaleDateString(undefined, {
                        day: 'numeric',
                        month: 'short',
                      })
                    : '—'
                  const overdue = Number(c.overdue_amount) > 0.01
                  return (
                    <div
                      key={c.id}
                      className={`relative min-w-[280px] max-w-[320px] shrink-0 rounded-2xl border p-5 shadow-lg transition hover:-translate-y-0.5 ${
                        overdue
                          ? 'border-red-500/40 bg-gradient-to-br from-red-500/10 to-slate-900/80'
                          : 'border-[var(--pf-border)] bg-gradient-to-br from-indigo-600/90 via-slate-900 to-slate-950 text-white'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="text-[10px] font-bold uppercase tracking-wider opacity-80">
                            {c.bank_name || 'Credit card'}
                          </p>
                          <p className="mt-1 truncate text-lg font-bold leading-tight">{c.card_name}</p>
                        </div>
                        <CreditCardIcon className="h-8 w-8 shrink-0 opacity-90" />
                      </div>
                      <dl className="mt-4 space-y-2 text-sm">
                        <div className="flex justify-between gap-2">
                          <dt className="opacity-80">Limit</dt>
                          <dd className="font-mono font-semibold tabular-nums">{formatInr(c.card_limit)}</dd>
                        </div>
                        <div className="flex justify-between gap-2">
                          <dt className="opacity-80">Outstanding</dt>
                          <dd className="font-mono font-semibold tabular-nums">{formatInr(c.used_amount)}</dd>
                        </div>
                        <div className="flex justify-between gap-2 text-xs">
                          <dt className="opacity-80">Unbilled</dt>
                          <dd className="font-mono tabular-nums text-sky-200">{formatInr(c.unbilled_charges)}</dd>
                        </div>
                        <div className="flex justify-between gap-2 text-xs">
                          <dt className="opacity-80">Due</dt>
                          <dd className={`font-mono tabular-nums ${overdue ? 'text-red-200' : ''}`}>{dueLabel}</dd>
                        </div>
                        <div className="flex justify-between gap-2 border-t border-white/10 pt-2">
                          <dt className="opacity-80">Utilization</dt>
                          <dd className="font-mono font-bold tabular-nums">{pct.toFixed(0)}%</dd>
                        </div>
                      </dl>
                      <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-white/20">
                        <div
                          className="h-full rounded-full bg-white"
                          style={{ width: `${Math.min(100, pct)}%`, opacity: pct >= 75 ? 0.85 : 1 }}
                        />
                      </div>
                      <div className="mt-4 flex flex-wrap gap-2">
                        <button
                          type="button"
                          className="rounded-lg bg-white/15 px-3 py-1.5 text-xs font-semibold backdrop-blur hover:bg-white/25"
                          onClick={() => {
                            setPendingTxCardId(c.id)
                          }}
                        >
                          Swipe
                        </button>
                        <button
                          type="button"
                          className="rounded-lg bg-white/10 px-3 py-1.5 text-xs font-semibold hover:bg-white/20"
                          onClick={() => setPayModalOpen(true)}
                        >
                          Pay
                        </button>
                        <button
                          type="button"
                          className="rounded-lg bg-white/10 px-3 py-1.5 text-xs font-semibold hover:bg-white/20"
                          onClick={() => openCardEditor(c)}
                        >
                          Edit
                        </button>
                      </div>
                    </div>
                  )
                })}
              </div>
            </section>
          ) : null}

          <div className="grid gap-4 lg:grid-cols-2">
            <section className={pfChartCard} aria-label="Monthly spend">
              <h3 className={chartTitle}>Monthly credit card spend</h3>
              <p className={chartSub}>All cards · from ledger (excl. refunds)</p>
              <div className="mt-3 h-[260px] w-full">
                {!portfolioMonthlySpendChart.length ? (
                  <p className="flex h-full items-center justify-center text-sm text-[var(--pf-text-muted)]">
                    Record swipes to see spend by month.
                  </p>
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={portfolioMonthlySpendChart} margin={{ top: 8, right: 16, left: 0, bottom: 24 }}>
                      <CartesianGrid strokeDasharray="3 3" className="stroke-[var(--pf-border)] opacity-40" />
                      <XAxis dataKey="label" tick={{ fontSize: 10 }} />
                      <YAxis tick={{ fontSize: 10 }} tickFormatter={(v) => `₹${(v / 1000).toFixed(0)}k`} width={48} />
                      <Tooltip formatter={(v) => formatInr(v)} />
                      <Bar dataKey="amount" name="Spend" fill="var(--pf-primary)" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </div>
            </section>

            <section className={pfChartCard} aria-label="Category spend">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <h3 className={chartTitle}>Spend by category</h3>
                  <p className={chartSub}>Year {yearlyChartYear} · all cards</p>
                </div>
                <select
                  className={`${pfSelectCompact} max-w-[7rem]`}
                  value={yearlyChartYear}
                  onChange={(e) => setYearlyChartYear(Number(e.target.value))}
                >
                  {(yearlyYears.length ? yearlyYears : [yearlyChartYear]).map((y) => (
                    <option key={y} value={y}>
                      {y}
                    </option>
                  ))}
                </select>
              </div>
              <div className="mt-3 h-[260px] w-full">
                {!categoryPieData.length || categoryPieData.every((d) => d.value === 0) ? (
                  <p className="flex h-full items-center justify-center text-sm text-[var(--pf-text-muted)]">
                    No categorized spend for this year.
                  </p>
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Tooltip formatter={(v) => formatInr(v)} />
                      <Legend />
                      <Pie
                        data={categoryPieData}
                        dataKey="value"
                        nameKey="name"
                        cx="50%"
                        cy="50%"
                        innerRadius={52}
                        outerRadius={86}
                        paddingAngle={2}
                      >
                        {categoryPieData.map((_, i) => (
                          <Cell key={categoryPieData[i].name} fill={CATEGORY_PIE_COLORS[i % CATEGORY_PIE_COLORS.length]} />
                        ))}
                      </Pie>
                    </PieChart>
                  </ResponsiveContainer>
                )}
              </div>
            </section>
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <section className={pfChartCard} aria-label="Credit limit usage">
              <h3 className={chartTitle}>Limit usage</h3>
              <p className={chartSub}>Used vs available across all cards</p>
              <div className="relative mt-3 h-[280px] w-full">
                {!usageTotals || usageTotals.totalLimit <= 0 || usagePieData.every((d) => d.value === 0) ? (
                  <p className="flex h-full items-center justify-center text-sm text-[var(--pf-text-muted)]">
                    No limit data yet.
                  </p>
                ) : (
                  <>
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Tooltip formatter={(v) => formatInr(v)} />
                        <Legend iconSize={10} verticalAlign="bottom" />
                        <Pie
                          data={usagePieData}
                          dataKey="value"
                          nameKey="name"
                          cx="50%"
                          cy="48%"
                          innerRadius={62}
                          outerRadius={92}
                          paddingAngle={2}
                        >
                          <Cell key="used" fill="#f87171" />
                          <Cell key="available" fill="#22c55e" />
                        </Pie>
                      </PieChart>
                    </ResponsiveContainer>
                    <div className="pointer-events-none absolute left-1/2 top-[44%] flex w-[200px] -translate-x-1/2 -translate-y-1/2 flex-col items-center gap-0.5 text-center">
                      <p className="text-[10px] font-semibold uppercase tracking-wide text-[var(--pf-text-muted)]">
                        Utilization
                      </p>
                      <p className={`text-2xl font-bold tabular-nums ${utilizationBadgeClass(Number(dash.utilization_pct ?? 0))}`}>
                        {(dash.utilization_pct ?? 0).toFixed(1)}%
                      </p>
                      <p className="text-[11px] text-[var(--pf-text-muted)]">
                        Used {formatInr(usageTotals.used)}
                      </p>
                      <p className="text-[11px] text-[var(--pf-text-muted)]">
                        Limit {formatInr(usageTotals.totalLimit)}
                      </p>
                    </div>
                  </>
                )}
              </div>
            </section>

            <section className={pfChartCard} aria-label="Bills and dues">
              <h3 className={chartTitle}>Bills & dues</h3>
              <p className={chartSub}>Unbilled, billed, paid this month, due, and overdue</p>
              <div className="mt-3 h-[260px] w-full">
                {billsBarData.length === 0 || billsBarData.every((d) => d.value === 0) ? (
                  <p className="flex h-full items-center justify-center text-sm text-[var(--pf-text-muted)]">
                    No statement amounts for this period.
                  </p>
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      data={billsBarData}
                      margin={{ top: 8, right: 16, left: 0, bottom: 24 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" opacity={0.2} />
                      <XAxis
                        dataKey="name"
                        tick={{ fontSize: 11 }}
                        tickMargin={8}
                        stroke="#64748b"
                      />
                      <YAxis
                        tick={{ fontSize: 11 }}
                        stroke="#64748b"
                        tickFormatter={(v) => `₹${(v / 1000).toFixed(0)}k`}
                      />
                      <Tooltip formatter={(v) => formatInr(v)} />
                      <Bar dataKey="value" name="Amount" radius={[4, 4, 0, 0]}>
                        {billsBarData.map((_, i) => (
                          <Cell key={billsBarData[i].name} fill={BILLS_BAR_COLORS[i % BILLS_BAR_COLORS.length]} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </div>
            </section>
          </div>

          <div className="flex justify-center py-1">
            <button type="button" className={btnSecondary} onClick={() => setExpandedAnalytics((v) => !v)}>
              {expandedAnalytics
                ? 'Hide extra charts'
                : 'More analytics — yearly per card, trend, statements vs payments'}
            </button>
          </div>

          {expandedAnalytics ? (
          <div className="grid gap-4 lg:grid-cols-2">
            <section className={pfChartCard} aria-label="Yearly spend per card">
              <div className="flex flex-wrap items-end justify-between gap-2">
                <div>
                  <h3 className={chartTitle}>Yearly spend per card</h3>
                  <p className={chartSub}>Swipe totals by card for the selected year</p>
                </div>
                <select
                  className={`${inputCls} max-w-[8rem]`}
                  value={yearlyChartYear}
                  onChange={(e) => setYearlyChartYear(Number(e.target.value))}
                >
                  {(yearlyYears.length ? yearlyYears : [yearlyChartYear]).map((y) => (
                    <option key={y} value={y}>
                      {y}
                    </option>
                  ))}
                </select>
              </div>
              <div className="mt-3 flex flex-wrap gap-3 text-sm text-[var(--pf-text-muted)]">
                <span>
                  <span className="font-semibold text-[var(--pf-text)]">Total: </span>
                  {formatInr(yearlySpendYearTotal)}
                </span>
                {yearlySpendHighest ? (
                  <span>
                    <span className="font-semibold text-[var(--pf-text)]">Highest: </span>
                    {yearlySpendHighest.name} ({formatInr(yearlySpendHighest.amount)})
                  </span>
                ) : null}
                {yearlySpendLowest && yearlySpendForYear.length > 1 ? (
                  <span>
                    <span className="font-semibold text-[var(--pf-text)]">Lowest: </span>
                    {yearlySpendLowest.name} ({formatInr(yearlySpendLowest.amount)})
                  </span>
                ) : null}
              </div>
              <div className="mt-3 h-[280px] w-full">
                {!yearlySpendForYear.length ? (
                  <p className="flex h-full items-center justify-center text-sm text-[var(--pf-text-muted)]">
                    No spend recorded for this year.
                  </p>
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={yearlySpendForYear} margin={{ top: 8, right: 16, left: 0, bottom: 48 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" opacity={0.2} />
                      <XAxis
                        dataKey="name"
                        tick={{ fontSize: 10 }}
                        stroke="#64748b"
                        interval={0}
                        angle={-25}
                        textAnchor="end"
                        height={56}
                      />
                      <YAxis
                        tick={{ fontSize: 11 }}
                        stroke="#64748b"
                        tickFormatter={(v) => `₹${(v / 1000).toFixed(0)}k`}
                      />
                      <Tooltip formatter={(v) => formatInr(v)} />
                      <Bar dataKey="amount" name="Spend" radius={[4, 4, 0, 0]} fill="#0ea5e9" />
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </div>
            </section>

            <section className={pfChartCard} aria-label="Monthly spend trend">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <h3 className={chartTitle}>Monthly spend trend</h3>
                  <p className={chartSub}>By card, year, and category filter</p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <select
                    className={inputCls}
                    value={selectedCardId}
                    onChange={(e) => setSelectedCardId(e.target.value)}
                  >
                    {cards.map((c) => (
                      <option key={c.id} value={String(c.id)}>
                        {c.card_name}
                      </option>
                    ))}
                  </select>
                  <select
                    className={inputCls}
                    value={selectedYear}
                    onChange={(e) => setSelectedYear(Number(e.target.value))}
                  >
                    {yearlyYears.length ? (
                      yearlyYears.map((y) => (
                        <option key={y} value={y}>
                          {y}
                        </option>
                      ))
                    ) : (
                      <option value={selectedYear}>{selectedYear}</option>
                    )}
                  </select>
                  <select
                    className={inputCls}
                    value={monthlyCategoryFilter}
                    onChange={(e) => setMonthlyCategoryFilter(e.target.value)}
                  >
                    <option value="">All categories</option>
                    {categories.map((c) => (
                      <option key={c.id} value={String(c.id)}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              {monthlyLineData.length > 0 ? (
                <p className="mt-2 text-xs text-[var(--pf-text-muted)]">
                  Avg {formatInr(monthlyStats.avg)}
                  {monthlyStats.hi ? (
                    <>
                      {' '}
                      · High {monthlyStats.hi.monthLabel} ({formatInr(monthlyStats.hi.amount)})
                    </>
                  ) : null}
                  {monthlyStats.lo && monthlyStats.hi?.monthLabel !== monthlyStats.lo.monthLabel ? (
                    <>
                      {' '}
                      · Low {monthlyStats.lo.monthLabel} ({formatInr(monthlyStats.lo.amount)})
                    </>
                  ) : null}
                </p>
              ) : null}
              <div className="mt-3 h-[280px] w-full">
                {!monthlyLineData.length ? (
                  <p className="flex h-full items-center justify-center text-sm text-[var(--pf-text-muted)]">
                    No monthly data for this selection.
                  </p>
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={monthlyLineData} margin={{ top: 8, right: 16, left: 0, bottom: 24 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" opacity={0.2} />
                      <XAxis dataKey="monthLabel" tick={{ fontSize: 11 }} stroke="#64748b" />
                      <YAxis
                        tick={{ fontSize: 11 }}
                        stroke="#64748b"
                        tickFormatter={(v) => `₹${(v / 1000).toFixed(0)}k`}
                      />
                      <Tooltip formatter={(v) => formatInr(v)} />
                      <ReferenceLine
                        y={monthlyStats.avg}
                        stroke="#94a3b8"
                        strokeDasharray="4 4"
                        label={{
                          value: 'Avg',
                          fill: '#94a3b8',
                          fontSize: 10,
                          position: 'insideTopRight',
                        }}
                      />
                      <Bar dataKey="amount" name="Amount" radius={[4, 4, 0, 0]} fill="#22c55e" />
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </div>
            </section>
          </div>
          ) : null}

            <section className={pfChartCard} aria-label="Card utilization">
              <h3 className={chartTitle}>Card utilization</h3>
              <p className={chartSub}>Used vs limit per card</p>
              <div className="mt-4 space-y-4">
                {!cardUtilization.length ? (
                  <p className="text-sm text-[var(--pf-text-muted)]">No cards registered.</p>
                ) : (
                  cardUtilization.map((row) => (
                    <div key={row.card_id}>
                      <div className="flex items-center justify-between gap-2 text-sm">
                        <span className="truncate font-medium text-[var(--pf-text)]">{row.card_name}</span>
                        <span
                          className={`shrink-0 font-semibold tabular-nums ${utilizationBadgeClass(Number(row.utilization_pct ?? 0))}`}
                        >
                          {Number(row.utilization_pct ?? 0).toFixed(0)}%
                        </span>
                      </div>
                      <div className="mt-1 h-2.5 overflow-hidden rounded-full bg-slate-200/30 dark:bg-slate-700/50">
                        <div
                          className="h-full rounded-full bg-[var(--pf-primary)] transition-[width]"
                          style={{
                            width: `${Math.min(100, Number(row.utilization_pct ?? 0))}%`,
                            backgroundColor:
                              Number(row.utilization_pct ?? 0) >= 75
                                ? '#ef4444'
                                : Number(row.utilization_pct ?? 0) >= 50
                                  ? '#f97316'
                                  : '#0ea5e9',
                          }}
                        />
                      </div>
                      <p className="mt-1 text-[11px] text-[var(--pf-text-muted)]">
                        {formatInr(row.used_amount)} of {formatInr(row.card_limit)}
                      </p>
                    </div>
                  ))
                )}
              </div>
            </section>

          <section className={pfChartCard} aria-label="Statement vs payments">
            <h3 className={chartTitle}>Statement totals vs payments</h3>
            <p className={chartSub}>Billed amount by statement close month vs cash paid (last 12 months)</p>
            <div className="mt-3 h-[300px] w-full">
              {!billedVsPaidChart.length ? (
                <p className="flex h-full items-center justify-center text-sm text-[var(--pf-text-muted)]">
                  No bill or payment history yet.
                </p>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={billedVsPaidChart} margin={{ top: 8, right: 16, left: 0, bottom: 24 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" opacity={0.2} />
                    <XAxis dataKey="label" tick={{ fontSize: 10 }} stroke="#64748b" />
                    <YAxis
                      tick={{ fontSize: 11 }}
                      stroke="#64748b"
                      tickFormatter={(v) => `₹${(v / 1000).toFixed(0)}k`}
                    />
                    <Tooltip formatter={(v) => formatInr(v)} />
                    <Legend />
                    <Line type="monotone" dataKey="billed" name="Statement total" stroke="#0ea5e9" strokeWidth={2} dot />
                    <Line type="monotone" dataKey="paid" name="Paid" stroke="#22c55e" strokeWidth={2} dot />
                  </LineChart>
                </ResponsiveContainer>
              )}
            </div>
          </section>

          <section
            className={`${cardCls} border-l-4 border-l-[var(--pf-primary)] p-4 sm:p-5`}
            aria-label="Insights"
          >
            <h3 className="text-sm font-bold uppercase tracking-wide text-[var(--pf-text)]">Insights</h3>
            <ul className="mt-2 list-inside list-disc space-y-1 text-sm text-[var(--pf-text-muted)]">
              {insights.map((line) => (
                <li key={line}>{line}</li>
              ))}
            </ul>
          </section>
        </>
      ) : null}

      <section id="cc-cards-manage" className="scroll-mt-8 space-y-6">
        <h2 className="text-xs font-bold uppercase tracking-[0.16em] text-[var(--pf-text-muted)]">Manage cards</h2>
          <div className="flex flex-wrap gap-2">
            {[
              { id: 'all', label: 'All cards' },
              { id: 'active', label: 'Active' },
              { id: 'high_util', label: 'High utilization' },
              { id: 'due_soon', label: 'Due soon' },
              { id: 'overdue', label: 'Overdue' },
            ].map((f) => (
              <button
                key={f.id}
                type="button"
                onClick={() => setCardsFilter(f.id)}
                className={`rounded-full px-3 py-1.5 text-xs font-semibold transition ${
                  cardsFilter === f.id
                    ? 'bg-[var(--pf-primary)] text-white'
                    : 'border border-[var(--pf-border)] text-[var(--pf-text-muted)] hover:bg-[var(--pf-card-hover)]'
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>

          <div className="space-y-4">
            <h2 className="text-base font-bold text-[var(--pf-text)]">Your cards</h2>
            {!filteredCards.length ? (
              <p className="text-sm text-[var(--pf-text-muted)]">
                {cards.length ? 'No cards match this filter.' : 'No cards yet — use Add card in the header.'}
              </p>
            ) : (
              <ul className="space-y-4">
                {filteredCards.map((c) => {
                  const pct = Number(c.utilization_pct) || 0
                  const dueLabel = c.next_due_date
                    ? new Date(c.next_due_date).toLocaleDateString(undefined, {
                        day: 'numeric',
                        month: 'short',
                      })
                    : '—'
                  const overdue = Number(c.overdue_amount) > 0.01
                  return (
                    <li key={c.id} className={`${cardCls} space-y-3 p-4 sm:p-5`}>
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <div>
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="text-base font-bold text-[var(--pf-text)]">{c.card_name}</span>
                            {c.bank_name ? (
                              <span className="text-sm text-[var(--pf-text-muted)]">{c.bank_name}</span>
                            ) : null}
                            {c.is_active === false ? (
                              <span className="rounded-full border border-[var(--pf-border)] px-2 py-0.5 text-[10px] font-semibold uppercase text-[var(--pf-text-muted)]">
                                Inactive
                              </span>
                            ) : null}
                          </div>
                          {(c.card_network || c.card_type) && (
                            <p className="mt-0.5 text-xs text-[var(--pf-text-muted)]">
                              {[c.card_network, c.card_type].filter(Boolean).join(' · ')}
                            </p>
                          )}
                        </div>
                        <span
                          className={`rounded-full border px-2.5 py-1 text-[11px] font-semibold ${utilizationBadgeClass(pct)}`}
                        >
                          {c.utilization_status} ({pct.toFixed(0)}%)
                        </span>
                      </div>

                      <div className="text-sm text-[var(--pf-text)]">
                        <p>
                          <span className="text-[var(--pf-text-muted)]">Limit: </span>
                          {formatInr(c.card_limit)}
                        </p>
                        <p className="mt-1">
                          <span className="text-[var(--pf-text-muted)]">Used: </span>
                          {formatInr(c.used_amount)}
                          <span className="text-[var(--pf-text-muted)]"> · Available: </span>
                          {formatInr(c.available_credit)}
                        </p>
                        <p className="mt-1 text-xs text-[var(--pf-text-muted)]">
                          Unbilled {formatInr(c.unbilled_charges)} · Billed {formatInr(c.billed_outstanding)}
                          {overdue ? (
                            <span className="font-semibold text-red-600 dark:text-red-400">
                              {' '}
                              · Overdue {formatInr(c.overdue_amount)}
                            </span>
                          ) : null}
                        </p>
                        <p className="mt-1 text-xs">
                          <span className="text-[var(--pf-text-muted)]">Due date: </span>
                          <span className={overdue ? 'font-semibold text-red-600 dark:text-red-400' : ''}>
                            {dueLabel}
                          </span>
                        </p>
                      </div>

                      <div>
                        <p className="text-[11px] font-semibold uppercase tracking-wide text-[var(--pf-text-muted)]">
                          Usage
                        </p>
                        <div className="mt-1.5 flex h-2.5 w-full overflow-hidden rounded-full bg-slate-200/80 dark:bg-slate-700/80">
                          <div
                            className={`h-full min-w-0 transition-all ${utilizationBarColorClass(pct)}`}
                            style={{ width: `${Math.min(100, Math.max(0, pct))}%` }}
                          />
                        </div>
                        <p className="mt-1 text-xs tabular-nums text-[var(--pf-text-muted)]">{pct.toFixed(0)}%</p>
                      </div>

                      <div className="flex flex-wrap gap-2">
                        <button
                          type="button"
                          className={btnSecondary}
                          onClick={() => {
                            setPendingTxCardId(c.id)
                          }}
                        >
                          Add expense
                        </button>
                        <button type="button" className={btnSecondary} onClick={() => setPayModalOpen(true)}>
                          Record payment
                        </button>
                        <button
                          type="button"
                          className={btnSecondary}
                          onClick={() =>
                            document.getElementById('cc-ledger')?.scrollIntoView({ behavior: 'smooth' })
                          }
                        >
                          View transactions
                        </button>
                        <button type="button" className={btnSecondary} onClick={() => openCardEditor(c)}>
                          Edit card
                        </button>
                        <button type="button" className={btnSecondary} onClick={() => handleDeleteCard(c)}>
                          Delete card
                        </button>
                      </div>
                    </li>
                  )
                })}
              </ul>
            )}
          </div>
      </section>

      <section id="cc-ledger" className={`${cardCls} scroll-mt-8 p-0`}>
          <div className="border-b border-[var(--pf-border)] px-4 py-3 sm:px-5">
            <h2 className="text-base font-bold text-[var(--pf-text)]">Transactions</h2>
            <p className="mt-1 text-xs text-[var(--pf-text-muted)]">
              Swipes, refunds, fees, and interest post here. Statement closing day on the card drives the billing-cycle month.
              Swipe / refund / EMI also create an expense line; fee and interest are ledger-only until booked elsewhere.
            </p>
          </div>

          <div className="flex flex-wrap gap-2 border-b border-[var(--pf-border)] px-4 py-3 sm:px-5">
            {[
              { id: '', label: 'All' },
              { id: 'unbilled', label: 'Unbilled' },
              { id: 'billed', label: 'Billed' },
              { id: 'paid', label: 'Paid' },
              { id: 'overdue', label: 'Overdue' },
              { id: 'emi', label: 'EMI' },
              { id: 'refunded', label: 'Refund' },
            ].map((f) => (
              <button
                key={f.id || 'all'}
                type="button"
                onClick={() => setTxFilterStatus(f.id)}
                className={`rounded-full px-3 py-1.5 text-xs font-semibold transition ${
                  txFilterStatus === f.id
                    ? 'bg-[var(--pf-primary)] text-white'
                    : 'border border-[var(--pf-border)] text-[var(--pf-text-muted)] hover:bg-[var(--pf-card-hover)]'
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>

          <div className="grid gap-3 border-b border-[var(--pf-border)] px-4 py-3 sm:grid-cols-2 lg:grid-cols-4 sm:px-5">
            <div>
              <label className={labelCls}>From date</label>
              <input
                className={inputCls}
                type="date"
                value={txFilterDateFrom}
                onChange={(e) => setTxFilterDateFrom(e.target.value)}
              />
            </div>
            <div>
              <label className={labelCls}>To date</label>
              <input
                className={inputCls}
                type="date"
                value={txFilterDateTo}
                onChange={(e) => setTxFilterDateTo(e.target.value)}
              />
            </div>
            <div>
              <label className={labelCls}>Card</label>
              <select
                className={inputCls}
                value={txFilterCardId}
                onChange={(e) => setTxFilterCardId(e.target.value)}
              >
                <option value="">All cards</option>
                {cards.map((c) => (
                  <option key={c.id} value={String(c.id)}>
                    {c.card_name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className={labelCls}>Category</label>
              <select
                className={inputCls}
                value={txFilterCategoryId}
                onChange={(e) => setTxFilterCategoryId(e.target.value)}
              >
                <option value="">All categories</option>
                {categories.map((c) => (
                  <option key={c.id} value={String(c.id)}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {txSummary ? (
            <div className="grid gap-2 border-b border-[var(--pf-border)] px-4 py-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 sm:px-5">
              {[
                ['Transactions', String(txSummary.transaction_count ?? 0)],
                ['Unbilled', formatInr(txSummary.unbilled_amount)],
                ['Billed', formatInr(txSummary.billed_amount)],
                ['Paid', formatInr(txSummary.paid_amount)],
                ['Overdue', formatInr(txSummary.overdue_amount)],
                ['Refunded', formatInr(txSummary.refunded_amount)],
              ].map(([k, v]) => (
                <div
                  key={k}
                  className="rounded-xl border border-[var(--pf-border)] bg-[var(--pf-surface)] px-3 py-2"
                >
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-[var(--pf-text-muted)]">{k}</p>
                  <p className="mt-1 text-sm font-bold tabular-nums text-[var(--pf-text)]">{v}</p>
                </div>
              ))}
            </div>
          ) : null}

          <div className="flex flex-col gap-3 border-b border-[var(--pf-border)] px-4 py-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between sm:px-5">
            <div className="flex flex-wrap gap-2">
              <button type="button" className={`${btnPrimary} inline-flex items-center gap-2`} onClick={() => openLedgerModal('swipe')}>
                <PlusIcon className="h-4 w-4" />
                Swipe
              </button>
              <button type="button" className={btnSecondary} onClick={() => openLedgerModal('emi')}>
                EMI
              </button>
              <button type="button" className={btnSecondary} onClick={() => setPayModalOpen(true)}>
                Payment
              </button>
              <button type="button" className={btnSecondary} onClick={() => setAddCardModalOpen(true)}>
                Add card
              </button>
            </div>
            <div className="flex flex-wrap gap-2">
              <button type="button" className={btnSecondary} onClick={() => exportLedgerCsv('credit-card-ledger')}>
                Export CSV
              </button>
              <button
                type="button"
                className={btnSecondary}
                onClick={() => exportLedgerCsv(`cc-statement-${todayISODate()}`)}
              >
                Download CSV statement
              </button>
            </div>
          </div>

          <div className="border-b border-[var(--pf-border)] px-4 py-2 sm:px-5">
            <h3 className="text-sm font-semibold text-[var(--pf-text)]">Ledger (oldest first · running balance per card)</h3>
          </div>
          <div className={`${pfTableWrap} max-h-[min(70vh,900px)] overflow-auto`}>
            <table className={`${pfTable} min-w-[960px]`}>
              <thead className="sticky top-0 z-10 border-b border-[var(--pf-border)] bg-[var(--pf-surface)] shadow-[0_1px_0_var(--pf-border)]">
                <tr>
                  <th className={pfTh}>Date</th>
                  <th className={pfTh}>Card</th>
                  <th className={pfTh}>Details</th>
                  <th className={pfTh}>Type</th>
                  <th className={pfThRight}>Amount</th>
                  <th className={`${pfThRight} text-[var(--pf-text-muted)]`}>Balance</th>
                  <th className={pfThRight}>Status</th>
                  <th className={pfTh}>Bill</th>
                  <th className={pfTh}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {tx.map((r) => (
                  <tr key={r.id} className={`${pfTrHover} ${ledgerRowAccentClass(r.ledger_status)}`}>
                    <td className={`${pfTd} whitespace-nowrap text-sm text-[var(--pf-text-muted)]`}>{r.transaction_date}</td>
                    <td className={`${pfTd} text-sm`}>{r.card_name ?? cards.find((c) => c.id === r.card_id)?.card_name ?? r.card_id}</td>
                    <td className={pfTd}>
                      <p className="font-semibold text-[var(--pf-text)]">{r.merchant || r.description || '—'}</p>
                      <p className="text-xs text-[var(--pf-text-muted)]">{r.category_name ?? 'Uncategorized'}</p>
                    </td>
                    <td className={pfTd}>
                      <span className="inline-flex items-center gap-1.5 capitalize">
                        {txTypeIcon(r.transaction_type, r.is_emi)}
                        <span className="text-xs font-medium">{r.transaction_type ?? '—'}</span>
                      </span>
                    </td>
                    <td className={`${pfTdRight} font-mono text-sm font-semibold tabular-nums ${ledgerAmountClass(r)}`}>
                      {formatInr(r.amount)}
                    </td>
                    <td className={`${pfTdRight} font-mono text-xs tabular-nums text-[var(--pf-text-muted)]`}>
                      {formatInr(r.running_balance)}
                    </td>
                    <td className={pfTdRight}>
                      <span
                        className={`inline-block rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${ledgerStatusBadgeClass(r.ledger_status)}`}
                      >
                        {r.ledger_status}
                      </span>
                    </td>
                    <td className={`${pfTd} text-xs`}>{r.bill_id ?? '—'}</td>
                    <td className={`${pfTd} text-xs`}>
                      <div className="flex flex-wrap gap-1">
                        <button type="button" className={btnSecondary} onClick={() => openTxEdit(r)}>
                          Edit
                        </button>
                        <button type="button" className={btnSecondary} onClick={() => handleDeleteTx(r)}>
                          Delete
                        </button>
                        {r.bill_id == null ? (
                          <button
                            type="button"
                            className={btnSecondary}
                            onClick={() => {
                              setTxAssign(r)
                              setTxAssignBillPick('')
                            }}
                          >
                            Mark billed
                          </button>
                        ) : null}
                        {r.bill_id != null ? (
                          <button
                            type="button"
                            className={btnSecondary}
                            onClick={() => {
                              setPayBillId(String(r.bill_id))
                              setPayModalOpen(true)
                            }}
                          >
                            View bill
                          </button>
                        ) : null}
                        {r.bill_id == null ? (
                          <button type="button" className={btnSecondary} onClick={() => handleConvertEmi(r)}>
                            EMI
                          </button>
                        ) : null}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {!tx.length ? <p className="p-4 text-sm text-[var(--pf-text-muted)]">No transactions match.</p> : null}
          </div>
      </section>

      <section id="cc-bills-pay" className="scroll-mt-8 space-y-6">
        <h2 className="text-xs font-bold uppercase tracking-[0.16em] text-[var(--pf-text-muted)]">Bills &amp; payments</h2>
        <div className="grid gap-6 lg:grid-cols-2">
          <form
            onSubmit={handleGenerateBill}
            className={`${cardCls} space-y-4 border border-[var(--pf-border)] bg-gradient-to-br from-sky-500/[0.06] to-transparent p-5 shadow-lg sm:p-6`}
          >
            <div className="flex items-center gap-3">
              <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-sky-500/20 text-sky-600 dark:text-sky-300">
                <ChartBarIcon className="h-7 w-7" />
              </span>
              <div>
                <h3 className="text-lg font-bold text-[var(--pf-text)]">Generate statement</h3>
                <p className="text-xs text-[var(--pf-text-muted)]">Unbilled charges in range roll into one bill.</p>
              </div>
            </div>
            <div>
              <label className={labelCls}>Card</label>
              <select className={inputCls} value={genCardId} onChange={(e) => setGenCardId(e.target.value)} required>
                <option value="">— Select —</option>
                {cards.map((c) => (
                  <option key={c.id} value={String(c.id)}>
                    {c.card_name}
                  </option>
                ))}
              </select>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <label className={labelCls}>Statement from</label>
                <input className={inputCls} type="date" value={billStart} onChange={(e) => setBillStart(e.target.value)} required />
              </div>
              <div>
                <label className={labelCls}>Statement to</label>
                <input className={inputCls} type="date" value={billEnd} onChange={(e) => setBillEnd(e.target.value)} required />
              </div>
            </div>
            <button type="submit" disabled={busy} className={btnPrimary}>
              Generate bill
            </button>
          </form>

          <div
            className={`${cardCls} flex flex-col justify-between gap-4 border border-[var(--pf-border)] bg-gradient-to-br from-emerald-500/[0.07] to-transparent p-5 shadow-lg sm:p-6`}
          >
            <div className="flex items-start gap-3">
              <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-emerald-500/20 text-emerald-600 dark:text-emerald-300">
                <BanknotesIcon className="h-7 w-7" />
              </span>
              <div>
                <h3 className="text-lg font-bold text-[var(--pf-text)]">Pay credit card bill</h3>
                <p className="mt-1 text-sm text-[var(--pf-text-muted)]">
                  Record a payment from your bank toward an open statement. Opens a guided form.
                </p>
              </div>
            </div>
            <button type="button" className={`${btnPrimary} w-full`} onClick={() => setPayModalOpen(true)}>
              Pay now
            </button>
          </div>

          <div className={`${cardCls} overflow-hidden lg:col-span-2 p-0 shadow-md`}>
            <div className="border-b border-[var(--pf-border)] px-4 py-3 sm:px-5">
              <h3 className="text-base font-bold text-[var(--pf-text)]">Statements</h3>
              <p className="text-xs text-[var(--pf-text-muted)]">Every bill you have generated.</p>
            </div>
            <div className={pfTableWrap}>
              <table className={pfTable}>
                <thead>
                  <tr>
                    <th className={pfTh}>ID</th>
                    <th className={pfTh}>Card</th>
                    <th className={pfTh}>Period</th>
                    <th className={pfTh}>Due</th>
                    <th className={pfTh}>Status</th>
                    <th className={`${pfTh} text-right`}>Total</th>
                    <th className={`${pfTh} text-right`}>Remaining</th>
                  </tr>
                </thead>
                <tbody>
                  {bills.map((b) => (
                    <tr key={b.id} className={pfTrHover}>
                      <td className={pfTd}>{b.id}</td>
                      <td className={pfTd}>{cards.find((c) => c.id === b.card_id)?.card_name ?? b.card_id}</td>
                      <td className={pfTd}>
                        {b.bill_start_date} → {b.bill_end_date}
                      </td>
                      <td className={pfTd}>{b.due_date}</td>
                      <td className={pfTd}>
                        <span
                          className={`inline-block rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase ${billStatusPillClass(b.display_status || b.status)}`}
                        >
                          {b.display_status || b.status}
                        </span>
                      </td>
                      <td className={`${pfTd} text-right`}>{formatInr(b.total_amount)}</td>
                      <td className={`${pfTd} text-right font-medium`}>
                        {formatInr(b.remaining != null ? b.remaining : Number(b.total_amount) - Number(b.amount_paid))}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {!bills.length ? <p className="p-4 text-sm text-[var(--pf-text-muted)]">No bills yet.</p> : null}
            </div>
          </div>
        </div>
      </section>

      <AppModal
        open={swipeModalOpen}
        onClose={() => !busy && setSwipeModalOpen(false)}
        title={txType === 'emi' || txIsEmiForm ? 'Record EMI / installment' : 'Record swipe'}
        subtitle="Creates a ledger line and expense (except fee/interest) per your card rules."
        maxWidthClass="max-w-2xl"
        footer={
          <>
            <AppButton type="button" variant="ghost" disabled={busy} onClick={() => setSwipeModalOpen(false)}>
              Cancel
            </AppButton>
            <AppButton type="submit" variant="primary" disabled={busy || !cards.length} form="cc-swipe-form">
              {busy ? 'Saving…' : 'Save'}
            </AppButton>
          </>
        }
      >
        <form id="cc-swipe-form" onSubmit={handleManualSwipe} className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <label className={labelCls}>Card</label>
              <select
                className={inputCls}
                value={txCardId}
                onChange={(e) => setTxCardId(e.target.value)}
                required
              >
                <option value="">— Select —</option>
                {cards.map((c) => (
                  <option key={c.id} value={String(c.id)}>
                    {c.card_name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className={labelCls}>Transaction type</label>
              <select className={inputCls} value={txType} onChange={(e) => setTxType(e.target.value)}>
                <option value="swipe">Swipe</option>
                <option value="refund">Refund</option>
                <option value="fee">Fee</option>
                <option value="interest">Interest</option>
                <option value="emi">EMI</option>
              </select>
            </div>
            <div>
              <label className={labelCls}>Amount (₹)</label>
              <input
                className={`${inputCls} font-mono tabular-nums`}
                type="number"
                min="0"
                step="0.01"
                value={txAmount}
                onChange={(e) => setTxAmount(e.target.value)}
                required
              />
            </div>
            <div>
              <label className={labelCls}>Date</label>
              <input className={inputCls} type="date" value={txDate} onChange={(e) => setTxDate(e.target.value)} required />
            </div>
            <div>
              <label className={labelCls}>Merchant</label>
              <input
                className={inputCls}
                value={txMerchant}
                onChange={(e) => setTxMerchant(e.target.value)}
                placeholder="Amazon, fuel…"
              />
            </div>
            <div>
              <label className={labelCls}>Category</label>
              <select className={inputCls} value={txCategoryId} onChange={(e) => setTxCategoryId(e.target.value)}>
                <option value="">— General —</option>
                {categories.map((c) => (
                  <option key={c.id} value={String(c.id)}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className={labelCls}>Billing cycle</label>
              <input className={`${inputCls} opacity-90`} readOnly value={txBillingCyclePreview} />
            </div>
            <div>
              <label className={labelCls}>Mark as EMI</label>
              <select
                className={inputCls}
                value={txIsEmiForm ? 'yes' : 'no'}
                onChange={(e) => setTxIsEmiForm(e.target.value === 'yes')}
              >
                <option value="no">No</option>
                <option value="yes">Yes</option>
              </select>
            </div>
          </div>
          <div>
            <label className={labelCls}>Notes (optional)</label>
            <input className={inputCls} value={txNotes} onChange={(e) => setTxNotes(e.target.value)} />
          </div>
          <div>
            <label className={labelCls}>Attachment URL (optional)</label>
            <input
              className={inputCls}
              value={txAttachmentUrl}
              onChange={(e) => setTxAttachmentUrl(e.target.value)}
              placeholder="Receipt link"
            />
          </div>
          <div>
            <label className={labelCls}>Description (optional)</label>
            <input className={inputCls} value={txDesc} onChange={(e) => setTxDesc(e.target.value)} />
          </div>
        </form>
      </AppModal>

      <AppModal
        open={payModalOpen}
        onClose={() => !busy && setPayModalOpen(false)}
        title="Pay credit card bill"
        subtitle="Statement balance is reduced; bank account is debited."
        maxWidthClass="max-w-lg"
        footer={
          <>
            <AppButton type="button" variant="ghost" disabled={busy} onClick={() => setPayModalOpen(false)}>
              Cancel
            </AppButton>
            <AppButton type="submit" variant="primary" disabled={busy} form="cc-pay-modal-form">
              {busy ? 'Processing…' : 'Pay now'}
            </AppButton>
          </>
        }
      >
        <form id="cc-pay-modal-form" onSubmit={handlePayBill} className="space-y-4">
          <div>
            <label className={labelCls}>Bill</label>
            <select className={inputCls} value={payBillId} onChange={(e) => setPayBillId(e.target.value)} required>
              <option value="">— Select —</option>
              {bills
                .filter((b) => b.status !== 'PAID')
                .map((b) => (
                  <option key={b.id} value={String(b.id)}>
                    #{b.id} · due {b.due_date} · rem {formatInr(b.remaining ?? b.total_amount - b.amount_paid)}
                  </option>
                ))}
            </select>
          </div>
          <div>
            <label className={labelCls}>Amount (₹)</label>
            <input
              className={`${inputCls} font-mono tabular-nums`}
              type="number"
              step="0.01"
              min="0"
              value={payAmount}
              onChange={(e) => setPayAmount(e.target.value)}
              required
            />
          </div>
          <div>
            <label className={labelCls}>Payment date</label>
            <input className={inputCls} type="date" value={payPaymentDate} onChange={(e) => setPayPaymentDate(e.target.value)} />
          </div>
          <div>
            <label className={labelCls}>From account</label>
            <select className={inputCls} value={payFromAcc} onChange={(e) => setPayFromAcc(e.target.value)} required>
              <option value="">— Select —</option>
              {accounts.map((a) => (
                <option key={a.id} value={String(a.id)}>
                  {a.account_name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className={labelCls}>Reference (optional)</label>
            <input className={inputCls} value={payRef} onChange={(e) => setPayRef(e.target.value)} />
          </div>
        </form>
      </AppModal>

      <AppModal
        open={addCardModalOpen}
        onClose={() => !busy && setAddCardModalOpen(false)}
        title="Add credit card"
        subtitle="Limits drive utilization; closing / due days power billing cycles."
        maxWidthClass="max-w-lg"
        footer={
          <>
            <AppButton type="button" variant="ghost" disabled={busy} onClick={() => setAddCardModalOpen(false)}>
              Cancel
            </AppButton>
            <AppButton type="submit" variant="primary" disabled={busy} form="cc-add-card-form">
              {busy ? 'Saving…' : 'Save card'}
            </AppButton>
          </>
        }
      >
        <form id="cc-add-card-form" onSubmit={handleAddCard} className="max-h-[65vh] space-y-3 overflow-y-auto pr-1">
          <div>
            <label className={labelCls}>Card name</label>
            <input className={inputCls} value={cardName} onChange={(e) => setCardName(e.target.value)} required />
          </div>
          <div>
            <label className={labelCls}>Bank (optional)</label>
            <input className={inputCls} value={bankName} onChange={(e) => setBankName(e.target.value)} />
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className={labelCls}>Network</label>
              <select className={inputCls} value={cardNetwork} onChange={(e) => setCardNetwork(e.target.value)}>
                <option value="">—</option>
                <option value="Visa">Visa</option>
                <option value="Mastercard">Mastercard</option>
                <option value="RuPay">RuPay</option>
                <option value="Other">Other</option>
              </select>
            </div>
            <div>
              <label className={labelCls}>Type</label>
              <select className={inputCls} value={cardType} onChange={(e) => setCardType(e.target.value)}>
                <option value="">—</option>
                <option value="Rewards">Rewards</option>
                <option value="Cashback">Cashback</option>
                <option value="Business">Business</option>
                <option value="Other">Other</option>
              </select>
            </div>
          </div>
          <div>
            <label className={labelCls}>Credit limit (₹)</label>
            <input
              className={`${inputCls} font-mono`}
              type="number"
              min="0"
              step="0.01"
              value={cardLimit}
              onChange={(e) => setCardLimit(e.target.value)}
            />
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className={labelCls}>Interest %</label>
              <input
                className={inputCls}
                type="number"
                min="0"
                max="100"
                step="0.01"
                value={interestRate}
                onChange={(e) => setInterestRate(e.target.value)}
                placeholder="0"
              />
            </div>
            <div>
              <label className={labelCls}>Annual fee</label>
              <input
                className={inputCls}
                type="number"
                min="0"
                step="0.01"
                value={annualFee}
                onChange={(e) => setAnnualFee(e.target.value)}
                placeholder="0"
              />
            </div>
          </div>
          <div>
            <label className={labelCls}>Currency</label>
            <input className={inputCls} value={currency} onChange={(e) => setCurrency(e.target.value)} maxLength={8} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>Closing day (1–31)</label>
              <input
                className={inputCls}
                type="number"
                min="1"
                max="31"
                value={closingDay}
                onChange={(e) => setClosingDay(e.target.value)}
              />
            </div>
            <div>
              <label className={labelCls}>Due day (1–31)</label>
              <input
                className={inputCls}
                type="number"
                min="1"
                max="31"
                value={dueDay}
                onChange={(e) => setDueDay(e.target.value)}
              />
            </div>
          </div>
          <div>
            <label className={labelCls}>Active</label>
            <select
              className={inputCls}
              value={isActiveAdd ? 'yes' : 'no'}
              onChange={(e) => setIsActiveAdd(e.target.value === 'yes')}
            >
              <option value="yes">Yes</option>
              <option value="no">No</option>
            </select>
          </div>
        </form>
      </AppModal>

      {editForm ? (
        <div className="fixed inset-0 z-[100] flex items-start justify-center overflow-y-auto bg-black/50 p-4 sm:p-8">
          <div
            className={`${cardCls} relative mt-8 w-full max-w-lg space-y-3 p-4 sm:p-5`}
            role="dialog"
            aria-modal="true"
            aria-labelledby="edit-card-title"
          >
            <div className="flex items-start justify-between gap-2">
              <h2 id="edit-card-title" className="text-base font-bold text-[var(--pf-text)]">
                Edit card
              </h2>
              <button
                type="button"
                className="text-sm text-[var(--pf-text-muted)] hover:text-[var(--pf-text)]"
                onClick={() => setEditForm(null)}
              >
                Close
              </button>
            </div>
            <form onSubmit={handleSaveEdit} className="space-y-3">
              <div>
                <label className={labelCls}>Card name</label>
                <input
                  className={inputCls}
                  value={editForm.card_name}
                  onChange={(e) => setEditForm({ ...editForm, card_name: e.target.value })}
                  required
                />
              </div>
              <div>
                <label className={labelCls}>Bank</label>
                <input
                  className={inputCls}
                  value={editForm.bank_name}
                  onChange={(e) => setEditForm({ ...editForm, bank_name: e.target.value })}
                />
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <label className={labelCls}>Card network</label>
                  <select
                    className={inputCls}
                    value={editForm.card_network || ''}
                    onChange={(e) => setEditForm({ ...editForm, card_network: e.target.value })}
                  >
                    <option value="">—</option>
                    <option value="Visa">Visa</option>
                    <option value="Mastercard">Mastercard</option>
                    <option value="RuPay">RuPay</option>
                    <option value="Other">Other</option>
                  </select>
                </div>
                <div>
                  <label className={labelCls}>Card type</label>
                  <select
                    className={inputCls}
                    value={editForm.card_type || ''}
                    onChange={(e) => setEditForm({ ...editForm, card_type: e.target.value })}
                  >
                    <option value="">—</option>
                    <option value="Rewards">Rewards</option>
                    <option value="Cashback">Cashback</option>
                    <option value="Business">Business</option>
                    <option value="Other">Other</option>
                  </select>
                </div>
              </div>
              <div>
                <label className={labelCls}>Credit limit</label>
                <input
                  className={inputCls}
                  type="number"
                  min="0"
                  step="0.01"
                  value={editForm.card_limit}
                  onChange={(e) => setEditForm({ ...editForm, card_limit: e.target.value })}
                />
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <label className={labelCls}>Interest rate %</label>
                  <input
                    className={inputCls}
                    type="number"
                    min="0"
                    max="100"
                    step="0.01"
                    value={editForm.interest_rate}
                    onChange={(e) => setEditForm({ ...editForm, interest_rate: e.target.value })}
                  />
                </div>
                <div>
                  <label className={labelCls}>Annual fee</label>
                  <input
                    className={inputCls}
                    type="number"
                    min="0"
                    step="0.01"
                    value={editForm.annual_fee}
                    onChange={(e) => setEditForm({ ...editForm, annual_fee: e.target.value })}
                  />
                </div>
              </div>
              <div>
                <label className={labelCls}>Currency</label>
                <input
                  className={inputCls}
                  value={editForm.currency}
                  onChange={(e) => setEditForm({ ...editForm, currency: e.target.value })}
                  maxLength={8}
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={labelCls}>Closing day</label>
                  <input
                    className={inputCls}
                    type="number"
                    min="1"
                    max="31"
                    value={editForm.closing_day}
                    onChange={(e) => setEditForm({ ...editForm, closing_day: e.target.value })}
                  />
                </div>
                <div>
                  <label className={labelCls}>Due day</label>
                  <input
                    className={inputCls}
                    type="number"
                    min="1"
                    max="31"
                    value={editForm.due_day}
                    onChange={(e) => setEditForm({ ...editForm, due_day: e.target.value })}
                  />
                </div>
              </div>
              <div>
                <label className={labelCls}>Is active</label>
                <select
                  className={inputCls}
                  value={editForm.is_active ? 'yes' : 'no'}
                  onChange={(e) => setEditForm({ ...editForm, is_active: e.target.value === 'yes' })}
                >
                  <option value="yes">Yes</option>
                  <option value="no">No</option>
                </select>
              </div>
              <div className="flex flex-wrap gap-2 pt-1">
                <button type="submit" disabled={busy} className={btnPrimary}>
                  {busy ? 'Saving…' : 'Save changes'}
                </button>
                <button
                  type="button"
                  className={btnSecondary}
                  onClick={() => setEditForm(null)}
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}

      {txEdit ? (
        <div className="fixed inset-0 z-[101] flex items-start justify-center overflow-y-auto bg-black/50 p-4 sm:p-8">
          <div className={`${cardCls} relative mt-8 w-full max-w-lg space-y-3 p-4 sm:p-5`} role="dialog" aria-modal="true">
            <div className="flex items-start justify-between gap-2">
              <h2 className="text-base font-bold text-[var(--pf-text)]">Edit transaction</h2>
              <button
                type="button"
                className="text-sm text-[var(--pf-text-muted)] hover:text-[var(--pf-text)]"
                onClick={() => setTxEdit(null)}
              >
                Close
              </button>
            </div>
            <form onSubmit={handleSaveTxEdit} className="space-y-3">
              <div>
                <label className={labelCls}>Date</label>
                <input
                  className={inputCls}
                  type="date"
                  value={txEdit.transaction_date}
                  onChange={(e) => setTxEdit({ ...txEdit, transaction_date: e.target.value })}
                  required
                />
              </div>
              <div>
                <label className={labelCls}>Type</label>
                <select
                  className={inputCls}
                  value={txEdit.transaction_type}
                  onChange={(e) => setTxEdit({ ...txEdit, transaction_type: e.target.value })}
                >
                  <option value="swipe">Swipe</option>
                  <option value="refund">Refund</option>
                  <option value="fee">Fee</option>
                  <option value="interest">Interest</option>
                  <option value="emi">EMI</option>
                </select>
              </div>
              <div>
                <label className={labelCls}>Amount (positive; refund stored as credit)</label>
                <input
                  className={inputCls}
                  type="number"
                  min="0"
                  step="0.01"
                  value={txEdit.amount}
                  onChange={(e) => setTxEdit({ ...txEdit, amount: e.target.value })}
                  required
                />
              </div>
              <div>
                <label className={labelCls}>Merchant</label>
                <input
                  className={inputCls}
                  value={txEdit.merchant}
                  onChange={(e) => setTxEdit({ ...txEdit, merchant: e.target.value })}
                />
              </div>
              <div>
                <label className={labelCls}>Category</label>
                <select
                  className={inputCls}
                  value={txEdit.category_id}
                  onChange={(e) => setTxEdit({ ...txEdit, category_id: e.target.value })}
                >
                  <option value="">— General —</option>
                  {categories.map((c) => (
                    <option key={c.id} value={String(c.id)}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className={labelCls}>Description</label>
                <input
                  className={inputCls}
                  value={txEdit.description}
                  onChange={(e) => setTxEdit({ ...txEdit, description: e.target.value })}
                />
              </div>
              <div>
                <label className={labelCls}>Notes</label>
                <input
                  className={inputCls}
                  value={txEdit.notes}
                  onChange={(e) => setTxEdit({ ...txEdit, notes: e.target.value })}
                />
              </div>
              <div>
                <label className={labelCls}>Attachment URL</label>
                <input
                  className={inputCls}
                  value={txEdit.attachment_url}
                  onChange={(e) => setTxEdit({ ...txEdit, attachment_url: e.target.value })}
                />
              </div>
              <div>
                <label className={labelCls}>EMI</label>
                <select
                  className={inputCls}
                  value={txEdit.is_emi ? 'yes' : 'no'}
                  onChange={(e) => setTxEdit({ ...txEdit, is_emi: e.target.value === 'yes' })}
                >
                  <option value="no">No</option>
                  <option value="yes">Yes</option>
                </select>
              </div>
              <div className="flex flex-wrap gap-2 pt-1">
                <button type="submit" disabled={busy} className={btnPrimary}>
                  {busy ? 'Saving…' : 'Save'}
                </button>
                <button type="button" className={btnSecondary} onClick={() => setTxEdit(null)}>
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}

      {txAssign ? (
        <div className="fixed inset-0 z-[101] flex items-start justify-center overflow-y-auto bg-black/50 p-4 sm:p-8">
          <div className={`${cardCls} relative mt-8 w-full max-w-md space-y-3 p-4 sm:p-5`} role="dialog" aria-modal="true">
            <h2 className="text-base font-bold text-[var(--pf-text)]">Assign to statement</h2>
            <p className="text-xs text-[var(--pf-text-muted)]">
              Adds this unbilled line to an existing open bill and increases the bill total. Use only when the line
              should have been on that statement.
            </p>
            <form onSubmit={handleConfirmAssignBill} className="space-y-3">
              <div>
                <label className={labelCls}>Bill</label>
                <select
                  className={inputCls}
                  value={txAssignBillPick}
                  onChange={(e) => setTxAssignBillPick(e.target.value)}
                  required
                >
                  <option value="">— Select —</option>
                  {bills
                    .filter((b) => b.card_id === txAssign.card_id && b.status !== 'PAID')
                    .map((b) => (
                      <option key={b.id} value={String(b.id)}>
                        #{b.id} · {b.bill_start_date} – {b.bill_end_date} · {b.status}
                      </option>
                    ))}
                </select>
              </div>
              <div className="flex flex-wrap gap-2">
                <button type="submit" disabled={busy} className={btnPrimary}>
                  {busy ? 'Saving…' : 'Assign'}
                </button>
                <button
                  type="button"
                  className={btnSecondary}
                  onClick={() => {
                    setTxAssign(null)
                    setTxAssignBillPick('')
                  }}
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </div>
  )
}
