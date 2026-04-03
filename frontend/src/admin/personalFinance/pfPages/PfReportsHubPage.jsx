import {
  ArrowTrendingDownIcon,
  ArrowTrendingUpIcon,
  ArrowsRightLeftIcon,
  BanknotesIcon,
  BuildingLibraryIcon,
  ChartPieIcon,
  InformationCircleIcon,
  LightBulbIcon,
  MinusSmallIcon,
  PresentationChartLineIcon,
  ShieldExclamationIcon,
  WalletIcon,
} from '@heroicons/react/24/solid'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { useOutletContext } from 'react-router-dom'
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Area,
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
  getReportsSummary,
  listFinanceAccounts,
  listPfExpenseCategories,
  pfFetchBlob,
  setPfToken,
  triggerDownloadBlob,
} from '../api.js'
import PfExportMenu from '../PfExportMenu.jsx'
import { PageHeader } from '../../../components/ui/PageHeader.jsx'
import {
  btnPrimary,
  btnSecondary,
  cardCls,
  inputCls,
  labelCls,
  pfChartCard,
  pfTable,
  pfTableWrap,
  pfTd,
  pfTdRight,
  pfTh,
  pfThRight,
  pfTrHover,
} from '../pfFormStyles.js'
import { PF_FINANCE_ACCOUNT_TYPES } from '../pfAccountTypes.js'
import { formatInr } from '../pfFormat.js'
import { usePfRefresh } from '../pfRefreshContext.jsx'
import { usePfTheme } from '../PfThemeContext.jsx'

const PIE_COLORS = ['#0ea5e9', '#8b5cf6', '#f59e0b', '#10b981', '#f43f5e', '#6366f1', '#ec4899', '#14b8a6', '#64748b']

/** Backend reports_summary caps range at 400 days */
const REPORTS_MAX_DAYS = 400

const REPORT_DATE_PRESETS = [
  { id: '3m', label: '3M', title: 'Last ~90 days' },
  { id: '6m', label: '6M', title: 'Last ~180 days' },
  { id: '1y', label: '1Y', title: 'Last ~365 days' },
  { id: 'ytd', label: 'YTD', title: 'Jan 1 → today' },
  { id: 'max', label: 'Max', title: `Up to ${REPORTS_MAX_DAYS} days (report limit)` },
]

const RATIO_HELP = {
  'Savings rate (after EMI)':
    '(Income − Expense − ledger EMI) ÷ Income × 100. Higher is better when income is stable.',
  'Expense ÷ income': 'Expense ÷ Income × 100 — your spending as a share of what you earned.',
  'EMI ÷ income': 'Ledger EMI ÷ Income × 100 — share of income going to EMI; many households aim to keep this moderate.',
  'Credit utilization': 'Card outstanding ÷ total credit limits (cards tracked in the app). Lower is generally healthier.',
  'Investments ÷ assets (est.)':
    'Invested book value ÷ an assets proxy (net worth plus estimated liabilities). Rough allocation signal, not advice.',
  Liquidity: 'Cash estimate ÷ monthlyized expense in this window — how many months of spend your cash might cover.',
}

function firstOfMonth() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`
}

function todayISODate() {
  const d = new Date()
  return d.toISOString().slice(0, 10)
}

function addDaysISO(isoDate, deltaDays) {
  const d = new Date(`${isoDate}T12:00:00`)
  d.setDate(d.getDate() + deltaDays)
  return d.toISOString().slice(0, 10)
}

/** @param {'3m'|'6m'|'1y'|'3y'|'ytd'|'all'|'max'} preset */
function rangeForPreset(preset) {
  const end = todayISODate()
  if (preset === 'ytd') {
    const y = new Date().getFullYear()
    return { start: `${y}-01-01`, end }
  }
  if (preset === 'max' || preset === 'all' || preset === '3y') {
    return { start: addDaysISO(end, -(REPORTS_MAX_DAYS - 1)), end }
  }
  if (preset === '1y') return { start: addDaysISO(end, -365), end }
  if (preset === '6m') return { start: addDaysISO(end, -180), end }
  if (preset === '3m') return { start: addDaysISO(end, -90), end }
  return { start: firstOfMonth(), end }
}

function topCategoriesForPie(rows, max = 8) {
  const list = Array.isArray(rows) ? rows : []
  if (list.length <= max) return list.map((r) => ({ name: r.category, value: Number(r.amount) || 0 }))
  const head = list.slice(0, max)
  const rest = list.slice(max).reduce((s, r) => s + (Number(r.amount) || 0), 0)
  return [...head.map((r) => ({ name: r.category, value: Number(r.amount) || 0 })), { name: 'Other', value: rest }]
}

function SectionTitle({ id, children }) {
  return (
    <h2 id={id} className="text-lg font-bold text-slate-900 dark:text-slate-50">
      {children}
    </h2>
  )
}

const sectionShell =
  'relative scroll-mt-8 rounded-2xl border border-slate-200/70 bg-gradient-to-b from-white/90 to-slate-50/30 p-5 shadow-sm backdrop-blur-md dark:border-slate-700/60 dark:from-slate-900/55 dark:to-slate-950/20 sm:p-7'

const chartCardLg =
  'rounded-2xl border border-slate-200/80 bg-white/80 p-4 shadow-sm backdrop-blur-md transition-shadow duration-200 hover:shadow-lg dark:border-slate-700/80 dark:bg-slate-900/45 dark:hover:shadow-black/25 sm:p-5'

const chartCardMd = `${chartCardLg} min-h-[280px]`

const chartCardSm =
  'rounded-2xl border border-slate-200/70 bg-white/75 p-4 shadow-sm backdrop-blur-sm transition-shadow hover:shadow-md dark:border-slate-700/70 dark:bg-slate-900/40 min-h-[220px]'

const pfTheadSticky =
  'sticky top-0 z-10 bg-white/95 backdrop-blur-sm shadow-[inset_0_-1px_0_0_rgba(15,23,42,0.08)] dark:bg-[var(--pf-card)]/95 dark:shadow-[inset_0_-1px_0_0_rgba(255,255,255,0.06)]'

function ReportSectionHeader({
  icon: Icon,
  title,
  subtitle,
}) {
  return (
    <div className="mb-6 flex flex-wrap items-start gap-3 border-b border-slate-200/60 pb-5 dark:border-slate-700/50">
      {Icon ? (
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-sky-500/15 text-sky-700 dark:bg-sky-400/20 dark:text-sky-300">
          <Icon className="h-6 w-6" aria-hidden />
        </span>
      ) : null}
      <div className="min-w-0 flex-1">
        <h2 className="text-xl font-bold tracking-tight text-slate-900 dark:text-white">{title}</h2>
        {subtitle ? <p className="mt-1 max-w-3xl text-sm leading-relaxed text-slate-600 dark:text-slate-400">{subtitle}</p> : null}
      </div>
    </div>
  )
}

function RatioGauge({ label, valuePct, goodMax = 100, helpKey }) {
  const v = valuePct == null || Number.isNaN(valuePct) ? null : Math.min(100, Math.max(0, valuePct))
  const width = v == null ? 0 : v
  const tip = helpKey ? RATIO_HELP[helpKey] || helpKey : RATIO_HELP[label]
  return (
    <div
      className="group rounded-xl border border-slate-200/80 bg-white px-3 py-2 transition-shadow hover:shadow-md dark:border-slate-700 dark:bg-slate-900/40 dark:hover:border-slate-600"
      title={tip}
    >
      <p className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400">
        {label}
        {tip ? <InformationCircleIcon className="h-3.5 w-3.5 shrink-0 text-slate-400 opacity-70 group-hover:opacity-100" /> : null}
      </p>
      <p className="mt-0.5 font-mono text-sm font-semibold tabular-nums text-slate-900 dark:text-slate-100">
        {v == null ? '—' : `${v.toFixed(1)}%`}
      </p>
      <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-slate-200 dark:bg-slate-700">
        <div
          className="h-full rounded-full bg-sky-500 transition-all dark:bg-sky-400"
          style={{ width: `${goodMax ? Math.min(100, width) : width}%` }}
        />
      </div>
    </div>
  )
}

function KpiTile({ title, subtitle, block, higherIsBetter }) {
  const v = block?.current
  const pct = block?.trend_pct
  const dir = block?.direction
  let Icon = MinusSmallIcon
  let trendCls = 'text-slate-500 dark:text-slate-400'
  if (dir === 'up') {
    Icon = ArrowTrendingUpIcon
    trendCls = higherIsBetter
      ? 'text-emerald-600 dark:text-emerald-400'
      : 'text-rose-600 dark:text-rose-400'
  } else if (dir === 'down') {
    Icon = ArrowTrendingDownIcon
    trendCls = higherIsBetter
      ? 'text-rose-600 dark:text-rose-400'
      : 'text-emerald-600 dark:text-emerald-400'
  }
  return (
    <div className={pfChartCard}>
      <p className="text-[11px] font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400">{title}</p>
      <p className="mt-1 text-lg font-bold tabular-nums text-slate-900 dark:text-slate-50 sm:text-xl">{formatInr(v)}</p>
      {subtitle ? <p className="mt-0.5 text-[10px] text-slate-500 dark:text-slate-400">{subtitle}</p> : null}
      <div className={`mt-2 flex items-center gap-1 text-xs font-semibold ${trendCls}`}>
        <Icon className="h-4 w-4 shrink-0" aria-hidden />
        <span>
          {pct != null && Number.isFinite(pct) ? `${pct > 0 ? '+' : ''}${pct}%` : '—'} vs prior
        </span>
      </div>
    </div>
  )
}

export default function PfReportsHubPage() {
  const { onSessionInvalid } = useOutletContext() || {}
  const { tick } = usePfRefresh()
  const { isDark } = usePfTheme()
  const [start, setStart] = useState(() => rangeForPreset('ytd').start)
  const [end, setEnd] = useState(() => rangeForPreset('ytd').end)
  const [accountId, setAccountId] = useState('')
  const [categoryId, setCategoryId] = useState('')
  const [person, setPerson] = useState('')
  const [expenseAccountType, setExpenseAccountType] = useState('')
  const [accounts, setAccounts] = useState([])
  const [categories, setCategories] = useState([])
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [showFilters, setShowFilters] = useState(true)
  const [reportsExportBusy, setReportsExportBusy] = useState(false)
  /** Preset quick range; switching dates manually sets 'custom'. */
  const [datePreset, setDatePreset] = useState('ytd')

  const tooltipBox = useMemo(
    () => ({
      borderRadius: 12,
      border: isDark ? '1px solid #475569' : '1px solid #bae6fd',
      background: isDark ? '#1e293b' : '#ffffff',
      color: isDark ? '#e2e8f0' : '#0f172a',
    }),
    [isDark],
  )

  const axisStroke = isDark ? '#94a3b8' : '#64748b'
  const gridStroke = isDark ? '#334155' : '#e2e8f0'

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const [ac, cat] = await Promise.all([listFinanceAccounts(), listPfExpenseCategories()])
        if (!cancelled) {
          setAccounts(Array.isArray(ac) ? ac : [])
          setCategories(Array.isArray(cat) ? cat : [])
        }
      } catch {
        if (!cancelled) {
          setAccounts([])
          setCategories([])
        }
      }
    })()
    return () => {
      cancelled = true
    }
  }, [tick])

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const d = await getReportsSummary({
        from: start,
        to: end,
        accountId: accountId || undefined,
        expenseCategoryId: categoryId || undefined,
        person: person.trim() || undefined,
        expenseAccountType: expenseAccountType.trim() || undefined,
      })
      setData(d && typeof d === 'object' ? d : null)
    } catch (e) {
      if (e.status === 401) {
        setPfToken(null)
        onSessionInvalid?.()
      } else {
        setError(e.message || 'Failed to load report')
      }
    } finally {
      setLoading(false)
    }
  }, [start, end, accountId, categoryId, person, expenseAccountType, onSessionInvalid])

  useEffect(() => {
    load()
  }, [load, tick])

  const monthly = Array.isArray(data?.income_vs_expense_monthly) ? data.income_vs_expense_monthly : []
  const monthlyFull = Array.isArray(data?.monthly_summary) ? data.monthly_summary : []
  const byCat = Array.isArray(data?.expense_by_category) ? data.expense_by_category : []
  const byPerson = Array.isArray(data?.expense_by_person) ? data.expense_by_person : []
  const byAcc = Array.isArray(data?.expense_by_account) ? data.expense_by_account : []
  const byAccType = Array.isArray(data?.expense_by_account_type) ? data.expense_by_account_type : []
  const emiRows = Array.isArray(data?.emi_breakdown) ? data.emi_breakdown : []
  const emiOther = Array.isArray(data?.emi_vs_other_expense) ? data.emi_vs_other_expense : []
  const emiPieData = useMemo(
    () =>
      emiOther
        .map((x) => ({ name: x.name, value: Number(x.value) || 0 }))
        .filter((x) => x.value > 0),
    [emiOther],
  )
  const pieCat = useMemo(() => topCategoriesForPie(byCat), [byCat])
  const pieAcc = useMemo(() => {
    return byAcc.slice(0, 8).map((r) => ({
      name: r.account_name || '—',
      value: Number(r.amount) || 0,
    }))
  }, [byAcc])
  const pieAccType = useMemo(() => {
    return byAccType
      .map((r) => ({
        name: String(r.account_type || '—').replace(/_/g, ' '),
        value: Number(r.amount) || 0,
      }))
      .filter((x) => x.value > 0)
  }, [byAccType])
  const barAccType = useMemo(
    () =>
      pieAccType.map((x) => ({
        type: x.name,
        amount: x.value,
      })),
    [pieAccType],
  )
  const barPerson = useMemo(
    () =>
      byPerson.slice(0, 12).map((r) => ({
        person: r.person?.length > 20 ? `${r.person.slice(0, 18)}…` : r.person,
        amount: Number(r.amount) || 0,
      })),
    [byPerson],
  )

  function exportQueryString(ext) {
    const q = new URLSearchParams({ from: start, to: end })
    if (accountId) {
      const id = Number(accountId)
      if (id && !Number.isNaN(id)) q.set('account_id', String(id))
    }
    if (categoryId) {
      const cid = Number(categoryId)
      if (cid && !Number.isNaN(cid)) q.set('expense_category_id', String(cid))
    }
    if (person.trim()) q.set('person', person.trim())
    if (expenseAccountType.trim()) q.set('expense_account_type', expenseAccountType.trim())
    return { qs: q.toString(), ext }
  }

  async function handleReportsExport(kind) {
    setReportsExportBusy(true)
    try {
      const { qs, ext } = exportQueryString(kind)
      const path = `/pf/export/reports/${kind === 'pdf' ? 'pdf' : 'excel'}?${qs}`
      const { blob, filename } = await pfFetchBlob(path)
      const fallback =
        kind === 'pdf' ? `Expense_Report_${start}_${end}.pdf` : `Expense_Report_${start}_${end}.xlsx`
      triggerDownloadBlob(blob, filename || fallback)
    } catch (e) {
      if (e.status === 401) {
        setPfToken(null)
        onSessionInvalid?.()
      } else {
        window.alert(e.message || 'Export failed')
      }
    } finally {
      setReportsExportBusy(false)
    }
  }

  const k = data?.kpis || {}
  const adv = data?.advanced_metrics || {}
  const gauges = data?.ratio_gauges || {}
  const cashflowTrend = Array.isArray(data?.cashflow_trend_monthly) ? data.cashflow_trend_monthly : []
  const cumulativeDaily = Array.isArray(data?.cumulative_daily_cashflow) ? data.cumulative_daily_cashflow : []
  const stackedExpense = Array.isArray(data?.expense_category_stacked_monthly) ? data.expense_category_stacked_monthly : []
  const top5Bar = Array.isArray(data?.top5_expense_categories_bar) ? data.top5_expense_categories_bar : []
  const bsTrend = Array.isArray(data?.balance_sheet_trend) ? data.balance_sheet_trend : []
  const interestMo = Array.isArray(data?.interest_collected_monthly) ? data.interest_collected_monthly : []
  const ccUtilTrend = Array.isArray(data?.credit_utilization_trend) ? data.credit_utilization_trend : []
  const accSnap = Array.isArray(data?.account_balances_snapshot) ? data.account_balances_snapshot : []
  const mom = data?.month_over_month
  const forecast = data?.forecast

  const stackKeys = useMemo(() => {
    const s = new Set()
    for (const r of stackedExpense) {
      Object.keys(r || {}).forEach((key) => {
        if (key !== 'label') s.add(key)
      })
    }
    return [...s]
  }, [stackedExpense])

  const debtOutstandingTrend = useMemo(() => {
    return (bsTrend || []).map((r) => ({
      label: r.label,
      debt: (Number(r.loans_payable) || 0) + (Number(r.credit_cards_outstanding) || 0),
      loans: Number(r.loans_payable) || 0,
      cards: Number(r.credit_cards_outstanding) || 0,
    }))
  }, [bsTrend])

  const interestVsPaidData = useMemo(() => {
    const paidTotal = Number(data?.interest_paid) || 0
    const n = Math.max(1, interestMo.length || monthlyFull.length || 1)
    const paidPerMonth = paidTotal / n
    return (interestMo || []).map((r) => ({
      label: r.label,
      collected: Number(r.interest) || 0,
      paid: paidPerMonth,
    }))
  }, [interestMo, monthlyFull.length, data?.interest_paid])

  const savingsRateTrendData = useMemo(() => {
    return (monthlyFull || []).map((row) => {
      const inc = Number(row.income) || 0
      const exp = Number(row.expense) || 0
      const emi = Number(row.emi) || 0
      const rate = inc > 0.01 ? ((inc - exp - emi) / inc) * 100 : null
      return { label: row.label, savings_rate_pct: rate != null ? Math.round(rate * 10) / 10 : null }
    })
  }, [monthlyFull])

  const emiToIncomeTrendData = useMemo(() => {
    return (monthlyFull || []).map((row) => {
      const e = Number(row.emi) || 0
      const inc = Number(row.income) || 0
      const pct = inc > 0.01 ? (e / inc) * 100 : null
      return { label: row.label, emi_income_pct: pct != null ? Math.round(pct * 10) / 10 : null }
    })
  }, [monthlyFull])

  const expenseTrendData = useMemo(() => {
    return (monthlyFull || []).map((row) => ({
      label: row.label,
      expense: Number(row.expense) || 0,
    }))
  }, [monthlyFull])

  const incomeTrendData = useMemo(() => {
    return (monthlyFull || []).map((row) => ({
      label: row.label,
      income: Number(row.income) || 0,
    }))
  }, [monthlyFull])

  const insightSummaryBullets = useMemo(() => {
    const out = []
    if (mom) {
      if (mom.expense_change_pct != null && Number.isFinite(mom.expense_change_pct)) {
        out.push(
          `Expenses ${mom.expense_change_pct > 0 ? 'rose' : 'fell'} ${Math.abs(mom.expense_change_pct)}% vs ${mom.prev_label}.`,
        )
      }
      if (mom.income_change_pct != null && Number.isFinite(mom.income_change_pct)) {
        out.push(
          `Income ${mom.income_change_pct > 0 ? 'rose' : 'fell'} ${Math.abs(mom.income_change_pct)}% vs ${mom.prev_label}.`,
        )
      }
      if (mom.savings_change_pct != null && Number.isFinite(mom.savings_change_pct)) {
        out.push(`Savings after EMI moved ${mom.savings_change_pct > 0 ? '+' : ''}${mom.savings_change_pct}% vs prior month in range.`)
      }
      if (mom.net_worth_change_pct != null && Number.isFinite(mom.net_worth_change_pct)) {
        out.push(`Net worth (book series) ${mom.net_worth_change_pct > 0 ? 'up' : 'down'} ${Math.abs(mom.net_worth_change_pct)}% vs prior month.`)
      }
    }
    if (gauges.debt_to_income_emi_pct != null && gauges.debt_to_income_emi_pct > 30) {
      out.push(`EMI is about ${gauges.debt_to_income_emi_pct}% of income — worth reviewing if sustainable.`)
    }
    if (gauges.savings_rate_pct != null && gauges.savings_rate_pct < 5) {
      out.push(`Savings rate after EMI is under 5% — tight margin vs spending and debt service.`)
    }
    const rest = (Array.isArray(data?.insights) ? data.insights : []).filter((t) => typeof t === 'string')
    for (const t of rest) {
      if (out.length >= 10) break
      if (!out.some((x) => x.slice(0, 40) === t.slice(0, 40))) out.push(t)
    }
    return out.slice(0, 10)
  }, [mom, gauges, data])

  function applyPreset(preset) {
    const { start: s, end: e } = rangeForPreset(preset)
    setDatePreset(preset)
    setStart(s)
    setEnd(e)
  }

  return (
    <div className="mx-auto max-w-[1400px] space-y-6">
      <PageHeader
        title="Reports & analytics"
        description="Business-intelligence style analytics: a clear cashflow story (income, spend, EMI, savings), book-keeping trends (net worth, cards, loans), and drill-downs — scoped by your filters and compared to the prior window of equal length."
        action={
          <PfExportMenu
            busy={reportsExportBusy}
            items={[
              { key: 'pdf', label: 'Export PDF', onClick: () => handleReportsExport('pdf') },
              { key: 'xlsx', label: 'Export Excel', onClick: () => handleReportsExport('excel') },
            ]}
          />
        }
      />

      <div className={cardCls}>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-base font-bold text-slate-900 dark:text-slate-50">Filters &amp; range</h2>
          <div className="flex flex-wrap items-center gap-2">
            <span className="hidden text-[10px] font-semibold uppercase tracking-wide text-slate-500 sm:inline dark:text-slate-400">
              Quick
            </span>
            <div className="flex flex-wrap gap-1">
              {REPORT_DATE_PRESETS.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  title={p.title}
                  onClick={() => applyPreset(p.id)}
                  className={
                    datePreset === p.id
                      ? `${btnPrimary} px-2.5 py-1 text-xs`
                      : `${btnSecondary} px-2.5 py-1 text-xs`
                  }
                >
                  {p.label}
                </button>
              ))}
            </div>
            <button
              type="button"
              onClick={() => setShowFilters((v) => !v)}
              className={`${btnSecondary} px-3 text-xs sm:text-sm`}
            >
              {showFilters ? 'Collapse' : 'Expand'}
            </button>
          </div>
        </div>
        {showFilters ? (
          <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
            <div>
              <label htmlFor="rep-start" className={labelCls}>
                From
              </label>
              <input
                id="rep-start"
                type="date"
                className={inputCls}
                value={start}
                onChange={(e) => {
                  setDatePreset('custom')
                  setStart(e.target.value)
                }}
              />
            </div>
            <div>
              <label htmlFor="rep-end" className={labelCls}>To</label>
              <input
                id="rep-end"
                type="date"
                className={inputCls}
                value={end}
                onChange={(e) => {
                  setDatePreset('custom')
                  setEnd(e.target.value)
                }}
              />
            </div>
            <div>
              <label htmlFor="rep-acc" className={labelCls}>Account</label>
              <select
                id="rep-acc"
                className={inputCls}
                value={accountId}
                onChange={(e) => setAccountId(e.target.value)}
              >
                <option value="">All accounts</option>
                {accounts.map((a) => (
                  <option key={a.id} value={String(a.id)}>
                    {a.account_name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="rep-cat" className={labelCls}>Expense category</label>
              <select
                id="rep-cat"
                className={inputCls}
                value={categoryId}
                onChange={(e) => setCategoryId(e.target.value)}
              >
                <option value="">All categories</option>
                {categories.map((c) => (
                  <option key={c.id} value={String(c.id)}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="rep-person" className={labelCls}>Person</label>
              <input
                id="rep-person"
                className={inputCls}
                placeholder="Paid by / received from"
                value={person}
                onChange={(e) => setPerson(e.target.value)}
              />
            </div>
            <div>
              <label htmlFor="rep-acctype" className={labelCls}>Expense account type</label>
              <select
                id="rep-acctype"
                className={inputCls}
                value={expenseAccountType}
                onChange={(e) => setExpenseAccountType(e.target.value)}
              >
                <option value="">All types</option>
                <option value="UNLINKED">Unlinked (no account)</option>
                {PF_FINANCE_ACCOUNT_TYPES.map((t) => (
                  <option key={t.value} value={t.value}>
                    {t.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex items-end sm:col-span-2 lg:col-span-3 xl:col-span-5">
              <button type="button" onClick={() => load()} disabled={loading} className={`${btnPrimary} w-full sm:w-auto`}>
                {loading ? 'Loading…' : 'Refresh'}
              </button>
            </div>
          </div>
        ) : (
          <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">
            Period: {data?.period?.start ?? start} → {data?.period?.end ?? end}
          </p>
        )}
        {error ? <p className="mt-3 text-sm text-amber-800 dark:text-amber-200">{error}</p> : null}
      </div>

      <section id="rep-kpi" className={sectionShell}>
        <ReportSectionHeader
          icon={PresentationChartLineIcon}
          title="KPI summary"
          subtitle="Organized by money flow, asset-related flows, and risk signals. Compared to the prior period of equal length."
        />
        <div className="grid gap-8 lg:grid-cols-3">
          <div>
            <h3 className="mb-3 flex items-center gap-2 text-[11px] font-bold uppercase tracking-wide text-slate-600 dark:text-slate-400">
              <BanknotesIcon className="h-4 w-4 text-emerald-600 dark:text-emerald-400" aria-hidden />
              Money
            </h3>
            <div className="grid gap-3 sm:grid-cols-2">
              <KpiTile title="Total income" block={k.total_income} higherIsBetter />
              <KpiTile title="Total expense" block={k.total_expense} higherIsBetter={false} />
              <KpiTile title="Net savings" subtitle="Income − expense" block={k.net_savings} higherIsBetter />
              <KpiTile
                title="EMI & repayments"
                subtitle="Ledger EMI + liability payments"
                block={k.emi_paid}
                higherIsBetter={false}
              />
            </div>
          </div>
          <div>
            <h3 className="mb-3 flex items-center gap-2 text-[11px] font-bold uppercase tracking-wide text-slate-600 dark:text-slate-400">
              <BuildingLibraryIcon className="h-4 w-4 text-sky-600 dark:text-sky-400" aria-hidden />
              Assets &amp; lending
            </h3>
            <div className="grid gap-3 sm:grid-cols-2">
              <KpiTile title="Investments added" subtitle="By investment date" block={k.investments_added} higherIsBetter />
              <KpiTile
                title="Loan given"
                subtitle="New loans (start in window)"
                block={k.loan_given}
                higherIsBetter={false}
              />
              <KpiTile title="Loan received" subtitle="Collections on loans you gave" block={k.loan_received} higherIsBetter />
              <div className={pfChartCard}>
                <p className="text-[11px] font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                  Net worth (latest in trend)
                </p>
                <p className="mt-1 text-lg font-bold tabular-nums text-slate-900 dark:text-slate-50 sm:text-xl">
                  {bsTrend.length ? formatInr(bsTrend[bsTrend.length - 1]?.net_worth) : '—'}
                </p>
                <p className="mt-0.5 text-[10px] text-slate-500 dark:text-slate-400">Book series month-end if available</p>
              </div>
            </div>
          </div>
          <div>
            <h3 className="mb-3 flex items-center gap-2 text-[11px] font-bold uppercase tracking-wide text-slate-600 dark:text-slate-400">
              <ShieldExclamationIcon className="h-4 w-4 text-amber-600 dark:text-amber-400" aria-hidden />
              Risk &amp; cushion
            </h3>
            <div className="grid gap-3 sm:grid-cols-2">
              <KpiTile title="Interest paid" subtitle="On liabilities" block={k.interest_paid} higherIsBetter={false} />
              <div className={pfChartCard} title={RATIO_HELP['Credit utilization']}>
                <p className="text-[11px] font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                  Credit utilization
                </p>
                <p className="mt-1 text-lg font-bold tabular-nums text-slate-900 dark:text-slate-50 sm:text-xl">
                  {adv.credit_utilization_pct != null ? `${Number(adv.credit_utilization_pct).toFixed(1)}%` : '—'}
                </p>
                <p className="mt-0.5 text-[10px] text-slate-500 dark:text-slate-400">Cards in app</p>
              </div>
              <div className={pfChartCard} title={RATIO_HELP.Liquidity}>
                <p className="text-[11px] font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400">Runway</p>
                <p className="mt-1 text-lg font-bold tabular-nums text-slate-900 dark:text-slate-50 sm:text-xl">
                  {adv.runway_months != null ? `${adv.runway_months} mo` : '—'}
                </p>
                <p className="mt-0.5 text-[10px] text-slate-500 dark:text-slate-400">Cash ÷ monthlyized expense</p>
              </div>
              <div className={pfChartCard}>
                <p className="text-[11px] font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400">Savings (after EMI)</p>
                <p className="mt-1 text-lg font-bold tabular-nums text-slate-900 dark:text-slate-50 sm:text-xl">
                  {formatInr(adv.savings_after_emi)}
                </p>
                <p className="mt-0.5 text-[10px] text-slate-500 dark:text-slate-400">Income − expense − ledger EMI</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section id="rep-insights-top" className={sectionShell}>
        <ReportSectionHeader
          icon={LightBulbIcon}
          title="Insights summary"
          subtitle="Derived from month-over-month changes, ratio checks, and automated observations — scan this first."
        />
        <div className="rounded-2xl border border-amber-200/50 bg-gradient-to-br from-amber-50/90 to-white/80 p-5 dark:border-amber-900/40 dark:from-amber-950/35 dark:to-slate-900/50">
          <ul className="space-y-2.5 text-sm leading-relaxed text-slate-800 dark:text-slate-100">
            {insightSummaryBullets.length === 0 ? (
              <li className="list-none text-slate-500 dark:text-slate-400">Load a period with data to see highlights.</li>
            ) : (
              insightSummaryBullets.map((line, i) => (
                <li key={`insight-${i}`} className="flex gap-2.5">
                  <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-amber-500 dark:bg-amber-400" />
                  <span>{line}</span>
                </li>
              ))
            )}
          </ul>
        </div>
      </section>

      <section id="rep-ratios" className={sectionShell}>
        <ReportSectionHeader
          icon={ChartPieIcon}
          title="Financial health — ratio gauges"
          subtitle="Hover a label for the formula. Values use your filtered period."
        />
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          <RatioGauge label="Savings rate (after EMI)" valuePct={gauges.savings_rate_pct} />
          <RatioGauge label="Expense ÷ income" valuePct={gauges.expense_ratio_pct} />
          <RatioGauge label="EMI ÷ income" valuePct={gauges.debt_to_income_emi_pct} />
          <RatioGauge label="Credit utilization" valuePct={gauges.credit_utilization_pct} />
          <RatioGauge label="Investments ÷ assets (est.)" valuePct={gauges.investment_ratio_pct} />
        </div>
      </section>

      <section id="rep-cashflow" className={sectionShell}>
        <ReportSectionHeader
          icon={ArrowsRightLeftIcon}
          title="Cashflow analysis"
          subtitle="Large charts: income vs expense over time, monthly cashflow components, then cumulative daily path."
        />
        <div className="space-y-6">
          <div className={chartCardLg}>
            <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">Income vs expense (trend)</h3>
            <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">Monthly lines — easier to see pace than bars alone.</p>
            <div className="mt-3 h-[min(420px,55vw)] min-h-[300px] w-full min-w-0">
              {monthly.length === 0 ? (
                <p className="py-16 text-center text-sm text-slate-500">No data in range.</p>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={monthly} margin={{ top: 12, right: 12, left: 4, bottom: 8 }}>
                    <defs>
                      <linearGradient id="repIncFill" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#22c55e" stopOpacity={0.22} />
                        <stop offset="100%" stopColor="#22c55e" stopOpacity={0} />
                      </linearGradient>
                      <linearGradient id="repExpFill" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#f43f5e" stopOpacity={0.18} />
                        <stop offset="100%" stopColor="#f43f5e" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke={gridStroke} opacity={0.45} />
                    <XAxis dataKey="label" tick={{ fontSize: 10, fill: axisStroke }} interval={0} angle={-18} textAnchor="end" height={56} />
                    <YAxis tick={{ fontSize: 10, fill: axisStroke }} tickFormatter={(v) => (v >= 100000 ? `${(v / 100000).toFixed(1)}L` : `${(v / 1000).toFixed(0)}k`)} />
                    <Tooltip formatter={(v) => formatInr(v)} contentStyle={tooltipBox} />
                    <Legend wrapperStyle={{ fontSize: 12 }} />
                    <Area type="monotone" dataKey="income" name="Income" stroke="#16a34a" strokeWidth={2.5} fill="url(#repIncFill)" dot={{ r: 3 }} />
                    <Area type="monotone" dataKey="expense" name="Expense" stroke="#e11d48" strokeWidth={2.5} fill="url(#repExpFill)" dot={{ r: 3 }} />
                  </LineChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>

          <div className={chartCardLg}>
            <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">Cashflow trend (by month)</h3>
            <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">Income, expense, ledger EMI, savings after EMI</p>
            <div className="mt-3 h-[min(400px,52vw)] min-h-[280px] w-full min-w-0">
              {cashflowTrend.length === 0 ? (
                <p className="py-16 text-center text-sm text-slate-500">No monthly slices in range.</p>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={cashflowTrend} margin={{ top: 12, right: 12, left: 4, bottom: 8 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke={gridStroke} opacity={0.45} />
                    <XAxis dataKey="label" tick={{ fontSize: 10, fill: axisStroke }} interval={0} angle={-18} textAnchor="end" height={52} />
                    <YAxis tick={{ fontSize: 10, fill: axisStroke }} tickFormatter={(v) => (v >= 100000 ? `${(v / 100000).toFixed(1)}L` : `${(v / 1000).toFixed(0)}k`)} />
                    <Tooltip formatter={(v) => formatInr(v)} contentStyle={tooltipBox} />
                    <Legend wrapperStyle={{ fontSize: 11 }} />
                    <Line type="monotone" dataKey="income" name="Income" stroke="#22c55e" strokeWidth={2.5} dot={false} />
                    <Line type="monotone" dataKey="expense" name="Expense" stroke="#f43f5e" strokeWidth={2.5} dot={false} />
                    <Line type="monotone" dataKey="emi" name="EMI (ledger)" stroke="#a855f7" strokeWidth={2} dot={false} />
                    <Line type="monotone" dataKey="savings" name="Savings" stroke="#0ea5e9" strokeWidth={2.5} dot />
                  </LineChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>

          <div className="grid gap-6 lg:grid-cols-2">
            <div className={chartCardMd}>
              <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">Income, expense &amp; savings rate</h3>
              <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">% = (income − expense − EMI) ÷ income per month</p>
              <div className="mt-2 h-[260px] w-full min-w-0">
                {savingsRateTrendData.length === 0 ? (
                  <p className="py-12 text-center text-sm text-slate-500">No rows.</p>
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={savingsRateTrendData} margin={{ top: 8, right: 8, left: 0, bottom: 4 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke={gridStroke} opacity={0.45} />
                      <XAxis dataKey="label" tick={{ fontSize: 9, fill: axisStroke }} interval={0} angle={-16} textAnchor="end" height={48} />
                      <YAxis tick={{ fontSize: 10, fill: axisStroke }} unit="%" />
                      <Tooltip formatter={(v) => (v == null ? '—' : `${v}%`)} contentStyle={tooltipBox} />
                      <Line type="monotone" dataKey="savings_rate_pct" name="Savings rate %" stroke="#10b981" strokeWidth={2} dot />
                    </LineChart>
                  </ResponsiveContainer>
                )}
              </div>
            </div>
            <div className={chartCardMd}>
              <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">Income &amp; expense pace</h3>
              <div className="mt-2 h-[260px] w-full min-w-0">
                {incomeTrendData.length === 0 ? (
                  <p className="py-12 text-center text-sm text-slate-500">No rows.</p>
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={incomeTrendData} margin={{ top: 8, right: 8, left: 0, bottom: 4 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke={gridStroke} opacity={0.45} />
                      <XAxis dataKey="label" tick={{ fontSize: 9, fill: axisStroke }} interval={0} angle={-16} textAnchor="end" height={48} />
                      <YAxis tick={{ fontSize: 10, fill: axisStroke }} tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
                      <Tooltip formatter={(v) => formatInr(v)} contentStyle={tooltipBox} />
                      <Legend wrapperStyle={{ fontSize: 11 }} />
                      <Line type="monotone" dataKey="income" name="Income" stroke="#0ea5e9" strokeWidth={2} dot={false} />
                    </LineChart>
                  </ResponsiveContainer>
                )}
              </div>
            </div>
            <div className={chartCardMd}>
              <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">Expense trend</h3>
              <div className="mt-2 h-[260px] w-full min-w-0">
                {expenseTrendData.length === 0 ? (
                  <p className="py-12 text-center text-sm text-slate-500">No rows.</p>
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={expenseTrendData} margin={{ top: 8, right: 8, left: 0, bottom: 4 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke={gridStroke} opacity={0.45} />
                      <XAxis dataKey="label" tick={{ fontSize: 9, fill: axisStroke }} interval={0} angle={-16} textAnchor="end" height={48} />
                      <YAxis tick={{ fontSize: 10, fill: axisStroke }} tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
                      <Tooltip formatter={(v) => formatInr(v)} contentStyle={tooltipBox} />
                      <Line type="monotone" dataKey="expense" name="Expense" stroke="#f97316" strokeWidth={2} dot />
                    </LineChart>
                  </ResponsiveContainer>
                )}
              </div>
            </div>
            <div className={chartCardMd}>
              <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">Cumulative cashflow (daily)</h3>
              <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">Running sum of income − expense</p>
              <div className="mt-2 h-[260px] w-full min-w-0">
                {cumulativeDaily.length === 0 ? (
                  <p className="py-12 text-center text-sm text-slate-500">No days in range.</p>
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={cumulativeDaily} margin={{ top: 8, right: 8, left: 0, bottom: 4 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke={gridStroke} opacity={0.45} />
                      <XAxis dataKey="date" tick={{ fontSize: 9, fill: axisStroke }} interval="preserveStartEnd" />
                      <YAxis tick={{ fontSize: 10, fill: axisStroke }} tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
                      <Tooltip formatter={(v) => formatInr(v)} contentStyle={tooltipBox} />
                      <Line type="monotone" dataKey="cumulative" name="Cumulative" stroke="#6366f1" strokeWidth={2.5} dot={false} />
                    </LineChart>
                  </ResponsiveContainer>
                )}
              </div>
            </div>
          </div>
        </div>
      </section>

      <section id="rep-spending" className={sectionShell}>
        <ReportSectionHeader
          icon={WalletIcon}
          title="Spending &amp; expense analysis"
          subtitle="Category mix, payee splits, and how much flowed through each account type."
        />
        <div className="grid gap-6 lg:grid-cols-2">
          <div className={`${chartCardMd} lg:col-span-2`}>
            <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">Expense by category (stacked by month)</h3>
            <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">Top categories per month + Other</p>
            <div className="mt-2 h-[260px] w-full min-w-0">
              {stackedExpense.length === 0 ? (
                <p className="py-12 text-center text-sm text-slate-500">No data.</p>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={stackedExpense} margin={{ top: 8, right: 8, left: 0, bottom: 4 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke={gridStroke} opacity={0.5} />
                    <XAxis dataKey="label" tick={{ fontSize: 10, fill: axisStroke }} interval={0} angle={-20} textAnchor="end" height={52} />
                    <YAxis tick={{ fontSize: 10, fill: axisStroke }} tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
                    <Tooltip formatter={(v) => formatInr(v)} contentStyle={tooltipBox} />
                    <Legend wrapperStyle={{ fontSize: 10 }} />
                    {stackKeys.map((key, i) => (
                      <Bar
                        key={key}
                        dataKey={key}
                        stackId="exp"
                        fill={PIE_COLORS[i % PIE_COLORS.length]}
                        radius={[0, 0, 0, 0]}
                      />
                    ))}
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>

          <div className={`${chartCardMd} lg:col-span-2`}>
            <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">Top 5 expense categories</h3>
            <div className="mt-2 h-[240px] w-full min-w-0">
              {top5Bar.length === 0 ? (
                <p className="py-12 text-center text-sm text-slate-500">No expense data.</p>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={top5Bar} layout="vertical" margin={{ left: 8, right: 16 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke={gridStroke} opacity={0.5} />
                    <XAxis type="number" tick={{ fontSize: 10, fill: axisStroke }} tickFormatter={(v) => formatInr(v)} />
                    <YAxis type="category" dataKey="name" width={120} tick={{ fontSize: 10, fill: axisStroke }} />
                    <Tooltip formatter={(v) => formatInr(v)} contentStyle={tooltipBox} />
                    <Bar dataKey="amount" fill="#f97316" radius={[0, 6, 6, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>
        </div>

        <div className="mt-8 grid gap-6 lg:grid-cols-2">
          <div className={chartCardMd}>
            <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">Expense by category</h3>
            <div className="mt-2 h-[260px] w-full min-w-0">
              {pieCat.length === 0 ? (
                <p className="py-12 text-center text-sm text-slate-500">No expense data.</p>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={pieCat}
                      nameKey="name"
                      dataKey="value"
                      cx="50%"
                      cy="50%"
                      innerRadius={58}
                      outerRadius={88}
                      paddingAngle={2}
                    >
                      {pieCat.map((_, i) => (
                        <Cell key={`c-${i}`} fill={PIE_COLORS[i % PIE_COLORS.length]} stroke="transparent" />
                      ))}
                    </Pie>
                    <Tooltip formatter={(v) => formatInr(v)} contentStyle={tooltipBox} />
                    <Legend layout="horizontal" verticalAlign="bottom" align="center" wrapperStyle={{ fontSize: 10 }} />
                  </PieChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>
          <div className={chartCardMd}>
            <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">Expense by account type</h3>
            <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">Bank, cash, wallet, card, unlinked, etc.</p>
            <div className="mt-2 h-[260px] w-full min-w-0">
              {pieAccType.length === 0 ? (
                <p className="py-12 text-center text-sm text-slate-500">No expense data.</p>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={pieAccType}
                      nameKey="name"
                      dataKey="value"
                      cx="50%"
                      cy="50%"
                      innerRadius={48}
                      outerRadius={88}
                      paddingAngle={1}
                    >
                      {pieAccType.map((_, i) => (
                        <Cell key={`at-${i}`} fill={PIE_COLORS[i % PIE_COLORS.length]} stroke="transparent" />
                      ))}
                    </Pie>
                    <Tooltip formatter={(v) => formatInr(v)} contentStyle={tooltipBox} />
                    <Legend layout="horizontal" verticalAlign="bottom" align="center" wrapperStyle={{ fontSize: 10 }} />
                  </PieChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>
          <div className={`${chartCardMd} lg:col-span-2`}>
            <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">Expense by account type (bars)</h3>
            <div className="mt-2 h-[240px] w-full min-w-0">
              {barAccType.length === 0 ? (
                <p className="py-12 text-center text-sm text-slate-500">No expense data.</p>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={barAccType} layout="vertical" margin={{ left: 8, right: 12 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke={gridStroke} opacity={0.5} horizontal />
                    <XAxis type="number" tick={{ fontSize: 10, fill: axisStroke }} tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
                    <YAxis type="category" dataKey="type" width={120} tick={{ fontSize: 10, fill: axisStroke }} />
                    <Tooltip formatter={(v) => formatInr(v)} contentStyle={tooltipBox} />
                    <Bar dataKey="amount" name="Amount" fill="#0ea5e9" radius={[0, 6, 6, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>
          <div className={chartCardMd}>
            <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">Expense by account</h3>
            <div className="mt-2 h-[260px] w-full min-w-0">
              {pieAcc.length === 0 ? (
                <p className="py-12 text-center text-sm text-slate-500">No expense data.</p>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={pieAcc}
                      nameKey="name"
                      dataKey="value"
                      cx="50%"
                      cy="50%"
                      innerRadius={0}
                      outerRadius={88}
                      paddingAngle={1}
                    >
                      {pieAcc.map((_, i) => (
                        <Cell key={`a-${i}`} fill={PIE_COLORS[i % PIE_COLORS.length]} stroke="transparent" />
                      ))}
                    </Pie>
                    <Tooltip formatter={(v) => formatInr(v)} contentStyle={tooltipBox} />
                    <Legend layout="horizontal" verticalAlign="bottom" align="center" wrapperStyle={{ fontSize: 10 }} />
                  </PieChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>
          <div className={chartCardSm}>
            <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">Expense by person</h3>
            <div className="mt-2 h-[260px] w-full min-w-0">
              {barPerson.length === 0 ? (
                <p className="py-12 text-center text-sm text-slate-500">No data.</p>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart layout="vertical" data={barPerson} margin={{ top: 4, right: 8, left: 4, bottom: 4 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke={gridStroke} opacity={0.5} horizontal />
                    <XAxis type="number" tick={{ fontSize: 10, fill: axisStroke }} tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
                    <YAxis type="category" dataKey="person" width={100} tick={{ fontSize: 10, fill: axisStroke }} />
                    <Tooltip formatter={(v) => formatInr(v)} contentStyle={tooltipBox} />
                    <Bar dataKey="amount" name="Amount" fill="#8b5cf6" radius={[0, 6, 6, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>
          <div className={chartCardSm}>
            <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">EMI vs other expense</h3>
            <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">Ledger split · excludes liability slice from “other”</p>
            <div className="mt-2 h-[240px] w-full min-w-0">
              {emiPieData.length === 0 ? (
                <p className="py-12 text-center text-sm text-slate-500">No data.</p>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={emiPieData}
                      nameKey="name"
                      dataKey="value"
                      cx="50%"
                      cy="50%"
                      innerRadius={48}
                      outerRadius={84}
                      paddingAngle={2}
                    >
                      {emiPieData.map((_, i) => (
                        <Cell key={`e-${i}`} fill={PIE_COLORS[i % PIE_COLORS.length]} stroke="transparent" />
                      ))}
                    </Pie>
                    <Tooltip formatter={(v) => formatInr(v)} contentStyle={tooltipBox} />
                    <Legend layout="horizontal" verticalAlign="bottom" align="center" wrapperStyle={{ fontSize: 10 }} />
                  </PieChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>
        </div>
      </section>

      <section id="rep-assets-nw" className={sectionShell}>
        <ReportSectionHeader
          icon={BuildingLibraryIcon}
          title="Assets & net worth"
          subtitle="Net worth from accounting series; account balances are a current snapshot."
        />
        <div className="space-y-6">
          <div className={chartCardLg}>
            <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">Net worth trend</h3>
            <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">Month-end from financial tables (longer ranges need full months).</p>
            <div className="mt-3 h-[min(400px,50vw)] min-h-[300px] w-full min-w-0">
              {bsTrend.length === 0 ? (
                <p className="py-16 text-center text-sm text-slate-500">No rows — widen the date range to include full calendar months.</p>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={bsTrend} margin={{ top: 12, right: 12, left: 4, bottom: 8 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke={gridStroke} opacity={0.45} />
                    <XAxis dataKey="label" tick={{ fontSize: 10, fill: axisStroke }} interval={0} angle={-16} textAnchor="end" height={48} />
                    <YAxis tick={{ fontSize: 10, fill: axisStroke }} tickFormatter={(v) => formatInr(v)} />
                    <Tooltip formatter={(v) => formatInr(v)} contentStyle={tooltipBox} />
                    <Line type="monotone" dataKey="net_worth" name="Net worth" stroke="#0ea5e9" strokeWidth={3} dot={{ r: 4 }} />
                  </LineChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>
        <div className={chartCardMd}>
          <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">Account balances (snapshot)</h3>
          <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">Current book balances — not historical</p>
          <div className="mt-2 h-[min(320px,40vw)] min-h-[260px] w-full min-w-0">
            {accSnap.length === 0 ? (
              <p className="py-12 text-center text-sm text-slate-500">No accounts.</p>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={accSnap} layout="vertical" margin={{ left: 4, right: 12 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke={gridStroke} opacity={0.5} />
                  <XAxis type="number" tick={{ fontSize: 10, fill: axisStroke }} tickFormatter={(v) => formatInr(v)} />
                  <YAxis
                    type="category"
                    dataKey="account_name"
                    width={140}
                    tick={{ fontSize: 9, fill: axisStroke }}
                  />
                  <Tooltip formatter={(v) => formatInr(v)} contentStyle={tooltipBox} />
                  <Bar dataKey="balance" fill="#38bdf8" radius={[0, 6, 6, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>
        </div>
      </section>

      <section id="rep-loans" className={sectionShell}>
        <ReportSectionHeader
          icon={ShieldExclamationIcon}
          title="Loans &amp; credit"
          subtitle="Debt carried on the books, EMI burden month by month, interest you earn vs pay, and card utilization."
        />
        <div className="space-y-6">
          <div className={chartCardLg}>
            <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">Debt outstanding over time</h3>
            <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
              Month-end loans payable plus card liabilities (from accounting trend).
            </p>
            <div className="mt-3 h-[min(360px,48vw)] min-h-[260px] w-full min-w-0">
              {debtOutstandingTrend.length === 0 || !debtOutstandingTrend.some((r) => (Number(r.debt) || 0) > 0.01) ? (
                <p className="py-16 text-center text-sm text-slate-500">No liability balances in trend rows — widen the range to include full months.</p>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={debtOutstandingTrend} margin={{ top: 12, right: 12, left: 4, bottom: 8 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke={gridStroke} opacity={0.45} />
                    <XAxis dataKey="label" tick={{ fontSize: 10, fill: axisStroke }} interval={0} angle={-14} textAnchor="end" height={44} />
                    <YAxis tick={{ fontSize: 10, fill: axisStroke }} tickFormatter={(v) => formatInr(v)} />
                    <Tooltip formatter={(v) => formatInr(v)} contentStyle={tooltipBox} />
                    <Legend wrapperStyle={{ fontSize: 11 }} />
                    <Line type="monotone" dataKey="debt" name="Total debt" stroke="#7c3aed" strokeWidth={3} dot={{ r: 3 }} />
                    <Line type="monotone" dataKey="loans" name="Loans payable" stroke="#6366f1" strokeWidth={2} dot={false} />
                    <Line type="monotone" dataKey="cards" name="Cards" stroke="#f97316" strokeWidth={2} dot={false} />
                  </LineChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>

          <div className="grid gap-6 lg:grid-cols-2">
            <div className={chartCardMd}>
              <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">EMI ÷ income by month</h3>
              <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
                Ledger EMI ÷ income per month — compare to period average {data?.emi_vs_income_pct != null ? `${data.emi_vs_income_pct}%` : '—'}.
              </p>
              <div className="mt-2 h-[min(280px,40vw)] min-h-[220px] w-full min-w-0">
                {emiToIncomeTrendData.length === 0 ? (
                  <p className="py-12 text-center text-sm text-slate-500">No monthly rows.</p>
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={emiToIncomeTrendData} margin={{ top: 8, right: 8, left: 0, bottom: 4 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke={gridStroke} opacity={0.5} />
                      <XAxis dataKey="label" tick={{ fontSize: 10, fill: axisStroke }} interval={0} angle={-12} textAnchor="end" height={44} />
                      <YAxis tick={{ fontSize: 10, fill: axisStroke }} unit="%" domain={[0, 'auto']} />
                      <Tooltip formatter={(v) => (v != null ? `${v}%` : '—')} contentStyle={tooltipBox} />
                      <Line
                        type="monotone"
                        dataKey="emi_income_pct"
                        name="EMI ÷ income"
                        stroke="#d946ef"
                        strokeWidth={2.5}
                        connectNulls
                        dot={{ r: 3 }}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                )}
              </div>
            </div>
            <div className={chartCardSm}>
              <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">Credit utilization</h3>
              <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">Outstanding ÷ limits — non-cash lines repeat current book</p>
              <div className="mt-2 h-[220px] w-full min-w-0">
                {ccUtilTrend.length === 0 ? (
                  <p className="py-12 text-center text-sm text-slate-500">No trend rows.</p>
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={ccUtilTrend} margin={{ top: 8, right: 8, left: 0, bottom: 4 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke={gridStroke} opacity={0.5} />
                      <XAxis dataKey="label" tick={{ fontSize: 10, fill: axisStroke }} />
                      <YAxis tick={{ fontSize: 10, fill: axisStroke }} unit="%" />
                      <Tooltip formatter={(v) => `${v}%`} contentStyle={tooltipBox} />
                      <Line type="monotone" dataKey="utilization_pct" name="Util %" stroke="#f59e0b" strokeWidth={2} dot />
                    </LineChart>
                  </ResponsiveContainer>
                )}
              </div>
            </div>
          </div>

          <div className={chartCardMd}>
            <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">Interest collected vs interest paid</h3>
            <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
              Collected by month from loans you gave; interest paid is spread evenly across months in this range (total {formatInr(data?.interest_paid ?? 0)}).
            </p>
            <div className="mt-2 h-[min(280px,40vw)] min-h-[220px] w-full min-w-0">
              {interestVsPaidData.length === 0 ? (
                <p className="py-12 text-center text-sm text-slate-500">No months in range.</p>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={interestVsPaidData} margin={{ top: 8, right: 8, left: 0, bottom: 4 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke={gridStroke} opacity={0.5} />
                    <XAxis dataKey="label" tick={{ fontSize: 10, fill: axisStroke }} />
                    <YAxis tick={{ fontSize: 10, fill: axisStroke }} tickFormatter={(v) => formatInr(v)} />
                    <Tooltip formatter={(v) => formatInr(v)} contentStyle={tooltipBox} />
                    <Legend wrapperStyle={{ fontSize: 11 }} />
                    <Line type="monotone" dataKey="collected" name="Collected" stroke="#10b981" strokeWidth={2} dot={{ r: 3 }} />
                    <Line type="monotone" dataKey="paid" name="Paid (allocated)" stroke="#f43f5e" strokeWidth={2} dot={false} />
                  </LineChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>
        </div>
      </section>

      {mom ? (
        <div className={cardCls}>
          <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">Month-over-month</h3>
          <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
            Last month in window vs previous: {mom.this_label} vs {mom.prev_label}
          </p>
          <div className={`mt-3 max-h-[min(360px,50vh)] overflow-auto ${pfTableWrap}`}>
            <table className={`${pfTable} min-w-[28rem]`}>
              <thead className={pfTheadSticky}>
                <tr>
                  <th className={pfTh}>Metric</th>
                  <th className={pfThRight}>This</th>
                  <th className={pfThRight}>Prior</th>
                  <th className={pfThRight}>Δ %</th>
                </tr>
              </thead>
              <tbody>
                {[
                  ['Income', mom.income_this, mom.income_prev, mom.income_change_pct],
                  ['Expense', mom.expense_this, mom.expense_prev, mom.expense_change_pct],
                  ['EMI (ledger)', mom.emi_this, mom.emi_prev, mom.emi_change_pct],
                  ['Savings after EMI', mom.savings_this, mom.savings_prev, mom.savings_change_pct],
                  ['Net worth (series)', mom.net_worth_this, mom.net_worth_prev, mom.net_worth_change_pct],
                ].map(([label, a, b, pct]) => (
                  <tr key={label} className={pfTrHover}>
                    <td className={pfTd}>{label}</td>
                    <td className={pfTdRight}>{a == null ? '—' : formatInr(a)}</td>
                    <td className={pfTdRight}>{b == null ? '—' : formatInr(b)}</td>
                    <td className={pfTdRight}>{pct == null ? '—' : `${pct > 0 ? '+' : ''}${pct}%`}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-2">
        <div className={cardCls}>
          <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">Category breakdown</h3>
          <div className={`mt-2 max-h-[min(320px,45vh)] overflow-auto ${pfTableWrap}`}>
            <table className={`${pfTable} min-w-[18rem]`}>
              <thead className={pfTheadSticky}>
                <tr>
                  <th className={pfTh}>Category</th>
                  <th className={pfThRight}>Amount</th>
                  <th className={pfThRight}>%</th>
                </tr>
              </thead>
              <tbody>
                {byCat.length === 0 ? (
                  <tr>
                    <td colSpan={3} className="border-b border-sky-100/90 px-3 py-6 text-center text-slate-500 first:pl-4 dark:border-slate-700">
                      No rows
                    </td>
                  </tr>
                ) : (
                  byCat.map((row) => (
                    <tr key={row.category} className={pfTrHover}>
                      <td className={pfTd}>{row.category}</td>
                      <td className={pfTdRight}>{formatInr(row.amount)}</td>
                      <td className={pfTdRight}>{row.pct != null ? `${row.pct}%` : '—'}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div className={cardCls}>
          <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">Person breakdown</h3>
          <div className={`mt-2 max-h-[min(320px,45vh)] overflow-auto ${pfTableWrap}`}>
            <table className={`${pfTable} min-w-[18rem]`}>
              <thead className={pfTheadSticky}>
                <tr>
                  <th className={pfTh}>Person</th>
                  <th className={pfThRight}>Amount</th>
                  <th className={pfThRight}>%</th>
                </tr>
              </thead>
              <tbody>
                {byPerson.length === 0 ? (
                  <tr>
                    <td colSpan={3} className="border-b border-sky-100/90 px-3 py-6 text-center text-slate-500 first:pl-4 dark:border-slate-700">
                      No rows
                    </td>
                  </tr>
                ) : (
                  byPerson.map((row) => (
                    <tr key={row.person} className={pfTrHover}>
                      <td className={pfTd}>{row.person}</td>
                      <td className={pfTdRight}>{formatInr(row.amount)}</td>
                      <td className={pfTdRight}>{row.pct != null ? `${row.pct}%` : '—'}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div className={cardCls}>
          <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">Account breakdown</h3>
          <div className={`mt-2 max-h-[min(320px,45vh)] overflow-auto ${pfTableWrap}`}>
            <table className={`${pfTable} min-w-[18rem]`}>
              <thead className={pfTheadSticky}>
                <tr>
                  <th className={pfTh}>Account</th>
                  <th className={pfThRight}>Amount</th>
                  <th className={pfThRight}>%</th>
                </tr>
              </thead>
              <tbody>
                {byAcc.length === 0 ? (
                  <tr>
                    <td colSpan={3} className="border-b border-sky-100/90 px-3 py-6 text-center text-slate-500 first:pl-4 dark:border-slate-700">
                      No rows
                    </td>
                  </tr>
                ) : (
                  byAcc.map((row) => (
                    <tr key={`${row.account_id}-${row.account_name}`} className={pfTrHover}>
                      <td className={pfTd}>{row.account_name}</td>
                      <td className={pfTdRight}>{formatInr(row.amount)}</td>
                      <td className={pfTdRight}>{row.pct != null ? `${row.pct}%` : '—'}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div className={cardCls}>
          <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">Liability repayments (by loan)</h3>
          <div className={`mt-2 max-h-[min(320px,45vh)] overflow-auto ${pfTableWrap}`}>
            <table className={`${pfTable} min-w-[18rem]`}>
              <thead className={pfTheadSticky}>
                <tr>
                  <th className={pfTh}>Liability</th>
                  <th className={pfThRight}>Paid</th>
                </tr>
              </thead>
              <tbody>
                {emiRows.length === 0 ? (
                  <tr>
                    <td colSpan={2} className="border-b border-sky-100/90 px-3 py-6 text-center text-slate-500 first:pl-4 dark:border-slate-700">
                      No liability payments in range
                    </td>
                  </tr>
                ) : (
                  emiRows.map((row) => (
                    <tr key={row.loan} className={pfTrHover}>
                      <td className={pfTd}>{row.loan}</td>
                      <td className={pfTdRight}>{formatInr(row.emi_paid)}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {forecast ? (
        <div className={cardCls}>
          <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">Simple forecast</h3>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{forecast.note}</p>
          <ul className="mt-3 space-y-1 text-sm text-slate-700 dark:text-slate-300">
            <li>Avg income (recent months in window): {formatInr(forecast.avg_income)}</li>
            <li>Avg expense: {formatInr(forecast.avg_expense)}</li>
            <li>Avg ledger EMI: {formatInr(forecast.avg_emi_ledger)}</li>
            <li className="font-semibold text-slate-900 dark:text-slate-100">
              Projected savings (avg income − avg expense − avg EMI): {formatInr(forecast.projected_savings)}
            </li>
          </ul>
        </div>
      ) : null}

      <div className={cardCls}>
        <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">Monthly comparison</h3>
        <div className={`mt-2 max-h-[min(420px,55vh)] overflow-auto ${pfTableWrap}`}>
          <table className={`${pfTable} min-w-[32rem]`}>
            <thead className={pfTheadSticky}>
              <tr>
                <th className={pfTh}>Month</th>
                <th className={pfThRight}>Income</th>
                <th className={pfThRight}>Expense</th>
                <th className={pfThRight}>EMI (ledger)</th>
                <th className={pfThRight}>Net</th>
              </tr>
            </thead>
            <tbody>
              {monthlyFull.length === 0 ? (
                <tr>
                  <td colSpan={5} className="border-b border-sky-100/90 px-3 py-6 text-center text-slate-500 first:pl-4 dark:border-slate-700">
                    No rows
                  </td>
                </tr>
              ) : (
                monthlyFull.map((row) => (
                  <tr key={row.month} className={pfTrHover}>
                    <td className={pfTd}>{row.label}</td>
                    <td className={pfTdRight}>{formatInr(row.income)}</td>
                    <td className={pfTdRight}>{formatInr(row.expense)}</td>
                    <td className={pfTdRight}>{formatInr(row.emi)}</td>
                    <td className={`${pfTdRight} font-medium`}>{formatInr(row.net)}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className={cardCls}>
        <SectionTitle id="rep-insights">Insights & observations</SectionTitle>
        <ul className="mt-3 list-inside list-disc space-y-2 text-sm text-slate-700 dark:text-slate-300">
          {(Array.isArray(data?.insights) ? data.insights : []).length === 0 ? (
            <li className="list-none text-slate-500">No insights for this period.</li>
          ) : (
            data.insights.map((t) => (
              <li key={t}>{t}</li>
            ))
          )}
        </ul>
        <p className="mt-4 text-xs text-slate-500 dark:text-slate-400">
          Prior window: {data?.period?.prior_start} → {data?.period?.prior_end} ({data?.period?.days} days). Trend % compares
          current period to that window. EMI total includes expense categories tagged EMI plus liability repayments.
        </p>
      </div>
    </div>
  )
}
