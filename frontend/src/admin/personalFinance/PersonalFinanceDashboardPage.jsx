import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { motion } from 'framer-motion'
import { Link, useOutletContext } from 'react-router-dom'
import {
  ArrowTrendingDownIcon,
  ArrowTrendingUpIcon,
  BanknotesIcon,
  BuildingLibraryIcon,
  CalendarDaysIcon,
  ChartPieIcon,
  CheckCircleIcon,
  CreditCardIcon,
  DevicePhoneMobileIcon,
  ExclamationTriangleIcon,
  InformationCircleIcon,
  ReceiptPercentIcon,
  ScaleIcon,
  SparklesIcon,
  TruckIcon,
  UsersIcon,
} from '@heroicons/react/24/solid'
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
import { chartGridStroke, chartTooltipBox } from '../../components/dashboard/chartTheme.js'
import { PageHeader } from '../../components/ui/PageHeader.jsx'
import KpiCard from '../dashboard/KpiCard.jsx'
import {
  getCashflowMonthSummary,
  getDashboardBundle,
  getDashboardSummary,
  getExpenseByCategory,
  getIncomeVsExpense,
  getInvestmentAllocation,
  getLoanDashboardAnalytics,
  getNetworthGrowth,
  getPfToken,
  getReportsSummary,
  listFinanceAccounts,
  listFinanceLoans,
  setPfToken,
} from './api.js'
import PfBankAccountSelect from './PfBankAccountSelect.jsx'
import PfMonthYearModal from './PfMonthYearModal.jsx'
import PfSegmentedControl from './PfSegmentedControl.jsx'
import { formatInr } from './pfFormat.js'
import {
  pfSelectCompact,
  pfTable,
  pfTableWrap,
  pfTd,
  pfTdRight,
  pfTh,
  pfThRight,
  pfTrHover,
} from './pfFormStyles.js'
import { usePfRefresh } from './pfRefreshContext.jsx'
import {
  dashboardBundleCacheKey,
  readDashboardBundleCache,
  writeDashboardBundleCache,
} from './pfDashboardCache.js'
import { usePfTheme } from './PfThemeContext.jsx'

const LazyDashboardCharts = lazy(() => import('./PersonalFinanceDashboardCharts.jsx'))

const LOAN_CHART_COLORS = ['#1E3A8A', '#0ea5e9', '#22c55e', '#a855f7', '#f59e0b', '#ec4899', '#64748b']

const chartTitle = 'text-[13px] font-semibold tracking-tight text-slate-900 dark:text-[var(--pf-text)]'
const chartSub = 'mt-0.5 text-xs text-slate-500 dark:text-[var(--pf-text-muted)]'

/** Section headings (18px) — separates dashboard blocks. */
const sectionTitleCls = 'text-lg font-semibold tracking-tight text-[var(--pf-text)]'
const sectionSubCls = 'mt-1 text-sm text-[var(--pf-text-muted)]'

/** Glass shell for dashboard charts & tables (PF only). */
const DASH_CHART_CARD =
  'min-w-0 rounded-2xl border border-black/[0.06] bg-white/55 p-4 shadow-[var(--pf-shadow)] backdrop-blur-xl transition-all duration-300 ease-out hover:-translate-y-1 hover:border-black/[0.1] hover:shadow-xl sm:p-5 dark:border-white/10 dark:bg-white/[0.04] dark:hover:border-white/[0.14] dark:hover:shadow-[0_10px_25px_rgba(0,0,0,0.22)]'

/** Overview charts — slightly more padding for hierarchy */
const DASH_INSIGHT_CARD = `${DASH_CHART_CARD} sm:!p-5`

const DASH_TABLE_WRAP =
  'overflow-x-auto rounded-2xl border border-[var(--pf-border)] bg-[var(--pf-card)]/50 shadow-[var(--pf-shadow)] backdrop-blur-md'

const bentoContainer = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: { staggerChildren: 0.06, delayChildren: 0.05 },
  },
}

const bentoItem = {
  hidden: { opacity: 0, y: 18 },
  show: { opacity: 1, y: 0, transition: { duration: 0.35, ease: [0.25, 0.1, 0.25, 1] } },
}

/** Last N rows for chart time window (1 / 3 / 6 / 12 months). */
function tailChartRows(rows, n) {
  if (!rows?.length) return []
  const take = Math.max(1, Math.min(n, rows.length))
  return rows.slice(-take)
}

function dashboardInsightMeta(line) {
  const t = String(line).toLowerCase()
  if (t.includes('decreased') || t.includes('consider paying')) {
    return {
      glyph: '▼',
      bar: 'border-l-rose-500/80 dark:border-l-rose-400',
      bg: 'bg-rose-500/[0.06] dark:bg-rose-500/[0.08]',
      Icon: ArrowTrendingDownIcon,
    }
  }
  if (t.includes('increased') || t.includes('comfortable range')) {
    return {
      glyph: '▲',
      bar: 'border-l-emerald-500/80 dark:border-l-emerald-400',
      bg: 'bg-emerald-500/[0.06] dark:bg-emerald-500/[0.08]',
      Icon: ArrowTrendingUpIcon,
    }
  }
  if (t.includes('largest expense') || t.includes('category')) {
    return {
      glyph: '◆',
      bar: 'border-l-violet-500/80 dark:border-l-violet-400',
      bg: 'bg-violet-500/[0.06] dark:bg-violet-500/[0.08]',
      Icon: ChartPieIcon,
    }
  }
  if (t.includes('due in the next') || t.includes('emi')) {
    return {
      glyph: '⚠',
      bar: 'border-l-amber-500/80 dark:border-l-amber-400',
      bg: 'bg-amber-500/[0.06] dark:bg-amber-500/[0.08]',
      Icon: CalendarDaysIcon,
    }
  }
  return {
    glyph: '●',
    bar: 'border-l-sky-500/80 dark:border-l-sky-400',
    bg: 'bg-sky-500/[0.05] dark:bg-sky-500/[0.08]',
    Icon: InformationCircleIcon,
  }
}

const DASH_TABS = [
  { id: 'overview', label: 'Overview' },
  { id: 'cashflow', label: 'Cashflow' },
  { id: 'credit', label: 'Credit & loans' },
]

function monthBounds(y, m) {
  const start = `${y}-${String(m).padStart(2, '0')}-01`
  const last = new Date(y, m, 0).getDate()
  const end = `${y}-${String(m).padStart(2, '0')}-${String(last).padStart(2, '0')}`
  return { start, end }
}

export default function PersonalFinanceDashboardPage() {
  const { onSessionInvalid } = useOutletContext() || {}
  const { tick } = usePfRefresh()
  const { isDark } = usePfTheme()
  const bundleTickRef = useRef(null)
  const [dashStage, setDashStage] = useState(0)
  const [activeTab, setActiveTab] = useState('overview')
  /** Chart window for Overview: 1 / 3 / 6 / 12 months of series data */
  const [overviewTimeRange, setOverviewTimeRange] = useState(12)
  const [loading, setLoading] = useState(false)
  const [loadError, setLoadError] = useState('')
  const [summary, setSummary] = useState(null)
  const [incomeExpense, setIncomeExpense] = useState([])
  const [expenseCats, setExpenseCats] = useState([])
  const [networth, setNetworth] = useState([])
  const [invAlloc, setInvAlloc] = useState([])
  const [loanAnalytics, setLoanAnalytics] = useState(null)
  const [cashflowMonth, setCashflowMonth] = useState(null)
  const [accounts, setAccounts] = useState([])
  const [bankFilter, setBankFilter] = useState('')
  const [loansList, setLoansList] = useState([])
  const [dashYear, setDashYear] = useState(() => new Date().getFullYear())
  const [dashMonth, setDashMonth] = useState(() => new Date().getMonth() + 1)
  const [monthModalOpen, setMonthModalOpen] = useState(false)
  const [upcomingEmis, setUpcomingEmis] = useState([])
  const [emisDueMonth, setEmisDueMonth] = useState(null)
  const [accountingPolicy, setAccountingPolicy] = useState(null)
  const [creditCardsSummary, setCreditCardsSummary] = useState(null)
  const [expenseByAccountReport, setExpenseByAccountReport] = useState([])
  const [expenseByAccountReportLoading, setExpenseByAccountReportLoading] = useState(false)
  const [expenseByAccountReportError, setExpenseByAccountReportError] = useState('')

  const accountQuery = bankFilter === '' ? undefined : bankFilter
  const dashMonthValue = `${dashYear}-${String(dashMonth).padStart(2, '0')}`
  const dashMonthLabel = useMemo(
    () => new Date(dashYear, dashMonth - 1, 1).toLocaleString(undefined, { month: 'long', year: 'numeric' }),
    [dashYear, dashMonth],
  )

  const tooltipBox = useMemo(() => chartTooltipBox(isDark), [isDark])
  const gridStroke = useMemo(() => chartGridStroke(isDark), [isDark])

  const hydrateFromBundle = useCallback((b) => {
    setSummary(b.summary && typeof b.summary === 'object' ? b.summary : null)
    setIncomeExpense(Array.isArray(b.income_vs_expense) ? b.income_vs_expense : [])
    setExpenseCats(Array.isArray(b.expense_by_category) ? b.expense_by_category : [])
    setNetworth(Array.isArray(b.networth_growth) ? b.networth_growth : [])
    setInvAlloc(Array.isArray(b.investment_allocation) ? b.investment_allocation : [])
    setLoanAnalytics(b.loans_analytics && typeof b.loans_analytics === 'object' ? b.loans_analytics : null)
    setCashflowMonth(b.cashflow_month && typeof b.cashflow_month === 'object' ? b.cashflow_month : null)
    setLoansList(Array.isArray(b.loans) ? b.loans : [])
    setUpcomingEmis(Array.isArray(b.upcoming_emis) ? b.upcoming_emis : [])
    setEmisDueMonth(b.emis_due_selected_month && typeof b.emis_due_selected_month === 'object' ? b.emis_due_selected_month : null)
    setAccountingPolicy(b.accounting_policy && typeof b.accounting_policy === 'object' ? b.accounting_policy : null)
    setCreditCardsSummary(
      b.credit_cards_summary && typeof b.credit_cards_summary === 'object' ? b.credit_cards_summary : null,
    )
    if (Array.isArray(b.accounts) && b.accounts.length > 0) {
      setAccounts(b.accounts)
    }
  }, [])

  const loadAccounts = useCallback(async () => {
    if (!getPfToken()) return
    try {
      const d = await listFinanceAccounts()
      setAccounts(Array.isArray(d) ? d : [])
    } catch (e) {
      if (e.status === 401) {
        setPfToken(null)
        onSessionInvalid?.()
      }
    }
  }, [onSessionInvalid])

  useEffect(() => {
    loadAccounts()
  }, [loadAccounts, tick])

  const loadAll = useCallback(async () => {
    if (!getPfToken()) return
    const cacheKey = dashboardBundleCacheKey(accountQuery, dashYear, dashMonth)
    const bustCache = bundleTickRef.current !== tick
    bundleTickRef.current = tick
    const cached = readDashboardBundleCache(cacheKey)
    if (cached) {
      hydrateFromBundle(cached)
      setLoadError('')
      setLoading(false)
      if (!bustCache) return
    } else {
      setLoading(true)
    }
    setLoadError('')
    try {
      const b = await getDashboardBundle(accountQuery, dashYear, dashMonth, { recentLimit: 12 })
      writeDashboardBundleCache(cacheKey, b)
      hydrateFromBundle(b)
    } catch (e) {
      if (e.status === 401) {
        setPfToken(null)
        onSessionInvalid?.()
        setLoadError('Session expired — sign in again.')
        setLoading(false)
        return
      }
      try {
        const full = await getDashboardSummary(accountQuery, {
          periodYear: dashYear,
          periodMonth: dashMonth,
          full: true,
          recentLimit: 12,
        })
        if (full && typeof full === 'object' && full.summary != null && Array.isArray(full.income_vs_expense)) {
          hydrateFromBundle(full)
          writeDashboardBundleCache(cacheKey, full)
        } else {
          const { start: expStart, end: expEnd } = monthBounds(dashYear, dashMonth)
          const [s, ie, ec, nw, ia, la, cf, loans] = await Promise.all([
            getDashboardSummary(accountQuery, { periodYear: dashYear, periodMonth: dashMonth, recentLimit: 12 }),
            getIncomeVsExpense(dashYear, accountQuery),
            getExpenseByCategory(expStart, expEnd, accountQuery),
            getNetworthGrowth(dashYear, accountQuery),
            getInvestmentAllocation(),
            getLoanDashboardAnalytics(dashYear),
            getCashflowMonthSummary(dashYear, dashMonth),
            listFinanceLoans().catch(() => []),
          ])
          setSummary(s)
          setIncomeExpense(Array.isArray(ie) ? ie : [])
          setExpenseCats(Array.isArray(ec) ? ec : [])
          setNetworth(Array.isArray(nw) ? nw : [])
          setInvAlloc(Array.isArray(ia) ? ia : [])
          setLoanAnalytics(la && typeof la === 'object' ? la : null)
          setCashflowMonth(cf && typeof cf === 'object' ? cf : null)
          setLoansList(Array.isArray(loans) ? loans : [])
          setUpcomingEmis([])
          setEmisDueMonth(null)
          setAccountingPolicy(null)
        }
      } catch (e2) {
        setLoadError(e2.message || e.message || 'Failed to load dashboard')
      }
    } finally {
      setLoading(false)
    }
  }, [dashYear, dashMonth, onSessionInvalid, accountQuery, tick, hydrateFromBundle])

  useEffect(() => {
    loadAll()
  }, [loadAll, tick])

  useEffect(() => {
    if (!summary) {
      setDashStage(0)
      return
    }
    setDashStage(2)
  }, [summary])

  useEffect(() => {
    if (activeTab !== 'cashflow') return
    if (!getPfToken()) return
    let cancelled = false
    const { start, end } = monthBounds(dashYear, dashMonth)
    setExpenseByAccountReportLoading(true)
    setExpenseByAccountReportError('')
    getReportsSummary({
      from: start,
      to: end,
      accountId: bankFilter || undefined,
    })
      .then((data) => {
        if (cancelled) return
        const rows = Array.isArray(data?.expense_by_account) ? data.expense_by_account : []
        setExpenseByAccountReport(rows)
      })
      .catch((e) => {
        if (cancelled) return
        setExpenseByAccountReport([])
        setExpenseByAccountReportError(e?.message || 'Could not load expense by account.')
      })
      .finally(() => {
        if (!cancelled) setExpenseByAccountReportLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [activeTab, dashYear, dashMonth, bankFilter, tick])

  const pieData = useMemo(
    () =>
      (expenseCats || []).map((row) => ({
        name: row.category || 'Other',
        value: Number(row.total) || 0,
      })),
    [expenseCats],
  )

  const barIeDataFull = useMemo(
    () =>
      (incomeExpense || []).map((row) => ({
        month: row.month,
        income: Number(row.income) || 0,
        expense: Number(row.expense) || 0,
      })),
    [incomeExpense],
  )

  const barIeData = useMemo(
    () => tailChartRows(barIeDataFull, overviewTimeRange),
    [barIeDataFull, overviewTimeRange],
  )

  const networthData = useMemo(
    () =>
      (networth || []).map((row) => ({
        month: row.month,
        netWorth: Number(row.net_worth) || 0,
      })),
    [networth],
  )

  const networthDisplayData = useMemo(
    () => tailChartRows(networthData, overviewTimeRange),
    [networthData, overviewTimeRange],
  )

  const incomeM = Number(summary?.total_income) || 0
  const expenseM = Number(summary?.total_expense) || 0
  const emiM = Number(cashflowMonth?.emi_expense_month) || 0
  const savingsRateFormula = incomeM > 0.01 ? (incomeM - expenseM - emiM) / incomeM : null

  const liquidBankKpi = Number(summary?.liquid_bank ?? summary?.balance_bank) || 0
  const liquidCashKpi =
    summary?.liquid_cash != null && !Number.isNaN(Number(summary.liquid_cash))
      ? Number(summary.liquid_cash)
      : null
  const liquidWalletKpi =
    summary?.liquid_wallet != null && !Number.isNaN(Number(summary.liquid_wallet))
      ? Number(summary.liquid_wallet)
      : null
  const legacyCashBucket = Number(summary?.balance_cash ?? summary?.cash_balance) || 0
  const hasLiquidSplit = liquidCashKpi != null && liquidWalletKpi != null
  const liquidTotalKpi = hasLiquidSplit
    ? liquidBankKpi + liquidCashKpi + liquidWalletKpi
    : summary?.liquid_total != null && !Number.isNaN(Number(summary.liquid_total))
      ? Number(summary.liquid_total)
      : liquidBankKpi + legacyCashBucket

  const cashBankTotal = liquidTotalKpi

  const totalAssetsBook =
    cashBankTotal +
    (Number(summary?.total_investment) || 0) +
    (Number(summary?.total_assets) || 0) +
    (Number(summary?.loan_receivable) || 0)

  const compositionPieData = useMemo(() => {
    const inv = Number(summary?.total_investment) || 0
    const fixed = Number(summary?.total_assets) || 0
    const lent = Number(summary?.loan_receivable ?? summary?.loan_outstanding) || 0
    const bank = Number(summary?.liquid_bank ?? summary?.balance_bank) || 0
    const cashPart =
      summary?.liquid_cash != null && !Number.isNaN(Number(summary.liquid_cash))
        ? Number(summary.liquid_cash)
        : null
    const walletPart =
      summary?.liquid_wallet != null && !Number.isNaN(Number(summary.liquid_wallet))
        ? Number(summary.liquid_wallet)
        : null
    const legacy = Number(summary?.balance_cash ?? summary?.cash_balance) || 0
    const rows = []
    if (bank > 0.01) rows.push({ name: 'Bank', value: bank })
    if (cashPart != null && walletPart != null) {
      if (cashPart > 0.01) rows.push({ name: 'Cash', value: cashPart })
      if (walletPart > 0.01) rows.push({ name: 'Wallet', value: walletPart })
    } else if (legacy > 0.01) {
      rows.push({ name: 'Cash & wallet', value: legacy })
    }
    rows.push(
      { name: 'Investments', value: inv },
      { name: 'Fixed assets', value: fixed },
      { name: 'Loans given', value: lent },
    )
    return rows.filter((x) => x.value > 0.01)
  }, [summary])

  /** Overview insight charts (derived only — no new API). */
  const overviewNwThreeLineData = useMemo(() => {
    const liab = Number(summary?.total_liabilities) || 0
    return networthDisplayData.map((r) => ({
      month: r.month,
      netWorth: r.netWorth,
      ...(bankFilter
        ? {}
        : {
            assets: r.netWorth + liab,
            liabilities: liab,
          }),
    }))
  }, [networthDisplayData, summary, bankFilter])

  const expenseCategoryHBarData = useMemo(
    () =>
      [...(expenseCats || [])]
        .map((c) => ({ name: c.category || 'Other', amount: Number(c.total) || 0 }))
        .filter((x) => x.amount > 0.01)
        .sort((a, b) => b.amount - a.amount),
    [expenseCats],
  )

  const cashflowHealthData = useMemo(() => {
    const rows = (incomeExpense || []).map((row) => {
      const inc = Number(row.income) || 0
      const exp = Number(row.expense) || 0
      return { month: row.month, moneyIn: inc, moneyOut: exp, net: inc - exp }
    })
    return tailChartRows(rows, overviewTimeRange)
  }, [incomeExpense, overviewTimeRange])

  const debtTrendData = useMemo(() => {
    const liab = Number(summary?.total_liabilities) || 0
    const cc = Number(creditCardsSummary?.used_limit) || 0
    return (incomeExpense || []).map((row) => ({
      month: row.month,
      emi: row.month === dashMonthValue ? emiM : 0,
      loanOutstanding: liab,
      ccOutstanding: cc,
    }))
  }, [incomeExpense, dashMonthValue, emiM, summary, creditCardsSummary])

  const savingsRateTrendData = useMemo(
    () =>
      (incomeExpense || []).map((row) => {
        const inc = Number(row.income) || 0
        const exp = Number(row.expense) || 0
        const emi = row.month === dashMonthValue ? emiM : 0
        const rate = inc > 0.01 ? ((inc - exp - emi) / inc) * 100 : null
        return { month: row.month, rate: rate != null ? Math.round(rate * 10) / 10 : null }
      }),
    [incomeExpense, dashMonthValue, emiM],
  )

  const financialHealth = useMemo(() => {
    const income = incomeM
    const expense = expenseM
    const emi = emiM
    const sr = income > 0.01 ? (income - expense - emi) / income : 0
    const sPts = Math.min(30, Math.max(0, 15 + sr * 75))
    const util = Number(creditCardsSummary?.utilization_pct) || 0
    const uPts = Math.min(20, Math.max(0, 20 - util * 0.22))
    const dti = income > 0.01 ? emi / income : 0
    const dPts = Math.min(20, Math.max(0, 20 - dti * 45))
    let gPts = 10
    if (networthData.length >= 2) {
      const a = networthData[networthData.length - 2].netWorth
      const b = networthData[networthData.length - 1].netWorth
      if (Math.abs(a) > 0.01) {
        const pct = (b - a) / Math.abs(a)
        gPts = Math.min(20, Math.max(0, 10 + pct * 80))
      }
    }
    const ePts =
      expense > 0.01 ? Math.min(10, Math.max(0, (cashBankTotal / expense) * 2.2)) : expense <= 0 ? 8 : 0
    const score = Math.round(sPts + uPts + dPts + gPts + ePts)
    const label =
      score >= 75 ? 'Excellent' : score >= 55 ? 'Good' : score >= 40 ? 'Fair' : 'Needs attention'
    return { score: Math.min(100, Math.max(0, score)), label }
  }, [incomeM, expenseM, emiM, creditCardsSummary, networthData, cashBankTotal])

  const ratioCards = useMemo(() => {
    const inc = incomeM
    const exp = expenseM
    const emi = emiM
    const sav = inc - exp - emi
    const savingsRate = inc > 0.01 ? sav / inc : null
    const debtToInc = inc > 0.01 ? emi / inc : null
    const lim = Number(creditCardsSummary?.total_credit_limit) || 0
    const util = lim > 0.01 ? (Number(creditCardsSummary?.used_limit) || 0) / lim : null
    const invRatio = totalAssetsBook > 0.01 ? (Number(summary?.total_investment) || 0) / totalAssetsBook : null
    const liq = exp > 0.01 ? cashBankTotal / exp : null
    const pct = (x) => (x == null || Number.isNaN(x) ? '—' : `${(x * 100).toFixed(1)}%`)
    return [
      { label: 'Savings rate', value: pct(savingsRate), hint: '(Income − expense − EMI) / income' },
      { label: 'Debt to income', value: pct(debtToInc), hint: 'EMI / income' },
      { label: 'Credit utilization', value: pct(util), hint: 'Used / limit' },
      { label: 'Investment / assets', value: pct(invRatio), hint: 'Investments / total assets' },
      { label: 'Liquidity', value: pct(liq), hint: 'Liquid cash / monthly expense' },
    ]
  }, [incomeM, expenseM, emiM, creditCardsSummary, totalAssetsBook, summary, cashBankTotal])

  const ratioRowCards = useMemo(
    () =>
      ratioCards.filter((r) =>
        ['Savings rate', 'Debt to income', 'Credit utilization', 'Liquidity'].includes(r.label),
      ),
    [ratioCards],
  )

  const netWorthMomLabel = useMemo(() => {
    if (networthData.length < 2) return null
    const a = networthData[networthData.length - 2].netWorth
    const b = networthData[networthData.length - 1].netWorth
    if (Math.abs(a) < 0.01) return null
    const pct = ((b - a) / Math.abs(a)) * 100
    return `${pct >= 0 ? '↑' : '↓'} ${Math.abs(pct).toFixed(1)}% vs prior month`
  }, [networthData])

  const insightsList = useMemo(() => {
    const lines = []
    if (networthData.length >= 2) {
      const d = networthData[networthData.length - 1].netWorth - networthData[networthData.length - 2].netWorth
      if (d < 0)
        lines.push(`Net worth decreased by ${formatInr(Math.abs(d))} vs the prior month on the trend.`)
      else if (d > 0) lines.push(`Net worth increased by ${formatInr(d)} vs the prior month on the trend.`)
    }
    const catTotal = (expenseCats || []).reduce((s, x) => s + (Number(x.total) || 0), 0)
    const top = [...(expenseCats || [])].sort((a, b) => (Number(b.total) || 0) - (Number(a.total) || 0))[0]
    if (top && catTotal > 0.01) {
      const p = ((Number(top.total) || 0) / catTotal) * 100
      lines.push(`Largest expense category in ${dashMonthLabel}: ${top.category || 'Other'} (${p.toFixed(0)}%).`)
    }
    if (creditCardsSummary?.utilization_pct != null) {
      const u = creditCardsSummary.utilization_pct
      lines.push(
        `Credit utilization is ${u}%${u < 30 ? ' — within a comfortable range' : u < 75 ? '' : ' — consider paying down balances'}.`,
      )
    }
    const emiWeek = loanAnalytics?.upcoming_emis_this_week?.length ?? 0
    if (emiWeek > 0) lines.push(`${emiWeek} lending EMI(s) due in the next 7 days.`)
    if (incomeM > 0.01 && savingsRateFormula != null) {
      lines.push(`Savings rate is ${(savingsRateFormula * 100).toFixed(0)}% for ${dashMonthLabel}.`)
    }
    return lines.slice(0, 8)
  }, [
    networthData,
    expenseCats,
    dashMonthLabel,
    creditCardsSummary,
    loanAnalytics,
    incomeM,
    savingsRateFormula,
  ])

  const upcomingPaymentsRows = useMemo(() => {
    const rows = []
    if (creditCardsSummary?.current_bill?.due_date) {
      rows.push({
        type: 'Credit card',
        name: creditCardsSummary.current_bill.card_name,
        amount: Number(creditCardsSummary.current_bill.remaining) || 0,
        due: creditCardsSummary.current_bill.due_date,
      })
    }
    if (Array.isArray(emisDueMonth?.items)) {
      for (const row of emisDueMonth.items) {
        rows.push({
          type: row.side === 'lend' ? 'EMI · you lend' : 'EMI · you borrow',
          name: row.name || '—',
          amount: Number(row.amount) || 0,
          due: row.due_date || '',
        })
      }
    }
    rows.sort((a, b) => String(a.due).localeCompare(String(b.due)))
    const seen = new Set()
    const dedup = []
    for (const r of rows) {
      const k = `${r.type}|${r.name}|${r.due}|${r.amount}`
      if (seen.has(k)) continue
      seen.add(k)
      dedup.push(r)
    }
    return dedup.slice(0, 16)
  }, [creditCardsSummary, emisDueMonth])

  const cashflowTrendData = useMemo(
    () =>
      (incomeExpense || []).map((row) => ({
        month: row.month,
        income: Number(row.income) || 0,
        expense: Number(row.expense) || 0,
        savings: (Number(row.income) || 0) - (Number(row.expense) || 0),
        emi: row.month === dashMonthValue ? emiM : 0,
      })),
    [incomeExpense, dashMonthValue, emiM],
  )

  const cashflowMonthlyTableRows = useMemo(
    () =>
      (incomeExpense || []).map((row) => ({
        month: row.month,
        income: Number(row.income) || 0,
        expense: Number(row.expense) || 0,
        emi: row.month === dashMonthValue ? emiM : 0,
        savings: (Number(row.income) || 0) - (Number(row.expense) || 0),
      })),
    [incomeExpense, dashMonthValue, emiM],
  )

  const loanExposurePie = useMemo(() => {
    const rem = Number(loanAnalytics?.total_remaining_receivable) || 0
    const od = Number(loanAnalytics?.overdue_emi_amount) || 0
    const cur = Math.max(0, rem - od)
    return [
      { name: 'Current receivable', value: cur },
      { name: 'Overdue EMI', value: od },
    ].filter((x) => x.value > 0.01)
  }, [loanAnalytics])

  const invBarData = useMemo(
    () =>
      (invAlloc || []).map((row) => ({
        type: row.type || 'Other',
        value: Number(row.value) || 0,
      })),
    [invAlloc],
  )

  const investmentAllocationBarSorted = useMemo(
    () => [...invBarData].sort((a, b) => (Number(b.value) || 0) - (Number(a.value) || 0)),
    [invBarData],
  )

  const cashflowBarData = useMemo(() => {
    if (!cashflowMonth) return []
    return [
      { name: 'Expense', value: Number(cashflowMonth.total_expense_month) || 0 },
      { name: 'CC swipe (expense)', value: Number(cashflowMonth.credit_card_expense_month) || 0 },
      { name: 'CC bill paid (cash)', value: Number(cashflowMonth.credit_card_bill_payments_month) || 0 },
      { name: 'External deposit (bank)', value: Number(cashflowMonth.external_deposit_month) || 0 },
      { name: 'External withdrawal (bank)', value: Number(cashflowMonth.external_withdrawal_month) || 0 },
      { name: 'Food', value: Number(cashflowMonth.food_expense) || 0 },
      { name: 'EMI', value: Number(cashflowMonth.emi_expense_month) || 0 },
      { name: 'Dairy', value: Number(cashflowMonth.dairy_expense) || 0 },
      { name: 'Pending EMIs', value: Number(cashflowMonth.pending_emis_receivable) || 0 },
      { name: 'Cash accts', value: Number(cashflowMonth.cash_balance) || 0 },
      { name: 'Bank accts', value: Number(cashflowMonth.bank_balance) || 0 },
    ]
  }, [cashflowMonth])

  const cashflowTableRows = useMemo(
    () => [
      { label: `Expense (${dashMonthLabel})`, value: cashflowMonth?.total_expense_month },
      { label: 'Credit card expenses (swipe date)', value: cashflowMonth?.credit_card_expense_month },
      { label: 'Credit card bill payments (cash out)', value: cashflowMonth?.credit_card_bill_payments_month },
      { label: 'External deposits (ledger — bank in)', value: cashflowMonth?.external_deposit_month },
      { label: 'External withdrawals (ledger — bank out)', value: cashflowMonth?.external_withdrawal_month },
      { label: 'Food & groceries', value: cashflowMonth?.food_expense },
      { label: 'EMI expenses', value: cashflowMonth?.emi_expense_month },
      { label: 'Dairy (farm + feed)', value: cashflowMonth?.dairy_expense },
      { label: 'Pending EMIs (receivable)', value: cashflowMonth?.pending_emis_receivable },
      { label: 'Cash-style accounts', value: cashflowMonth?.cash_balance },
      { label: 'Bank-style accounts', value: cashflowMonth?.bank_balance },
    ],
    [cashflowMonth, dashMonthLabel],
  )

  const cashflowSnapshotTiles = useMemo(() => {
    if (!cashflowMonth) return []
    const dm = dashMonthLabel
    const cf = cashflowMonth
    return [
      {
        key: 'totex',
        title: `Expense · ${dm}`,
        value: formatInr(cf.total_expense_month),
        subtitle: 'All recorded expenses in this period',
        icon: CreditCardIcon,
        tint: 'rose',
      },
      {
        key: 'ccsw',
        title: 'CC expenses (swipes)',
        value: formatInr(cf.credit_card_expense_month),
        subtitle: 'P&L on swipe date — bank not debited yet',
        icon: CreditCardIcon,
        tint: 'fuchsia',
      },
      {
        key: 'ccpay',
        title: 'CC bill payments',
        value: formatInr(cf.credit_card_bill_payments_month),
        subtitle: 'Cash paid to card issuer this month',
        icon: BanknotesIcon,
        tint: 'purple',
      },
      {
        key: 'exdep',
        title: 'External deposits',
        value: formatInr(cf.external_deposit_month),
        subtitle: 'Ledger: EXTERNAL_DEPOSIT',
        icon: ArrowTrendingUpIcon,
        tint: 'teal',
      },
      {
        key: 'exwd',
        title: 'External withdrawals',
        value: formatInr(cf.external_withdrawal_month),
        subtitle: 'Ledger: EXTERNAL_WITHDRAWAL',
        icon: ArrowTrendingDownIcon,
        tint: 'orange',
      },
      {
        key: 'food',
        title: 'Food & groceries',
        value: formatInr(cf.food_expense),
        subtitle: 'Category total',
        icon: ChartPieIcon,
        tint: 'lime',
      },
      {
        key: 'emi',
        title: 'EMI expenses',
        value: formatInr(cf.emi_expense_month),
        subtitle: 'EMI – Loans + cards + EMI-like labels',
        icon: ReceiptPercentIcon,
        tint: 'amber',
      },
      {
        key: 'dairy',
        title: 'Dairy (farm + feed)',
        value: formatInr(cf.dairy_expense),
        subtitle: 'Dairy Farm + Feed categories',
        icon: TruckIcon,
        tint: 'emerald',
      },
      {
        key: 'pend',
        title: 'Pending EMIs (receivable)',
        value: formatInr(cf.pending_emis_receivable),
        subtitle: 'Unpaid installments you are owed',
        icon: CalendarDaysIcon,
        tint: 'yellow',
      },
      {
        key: 'cashb',
        title: 'Cash-style accounts',
        value: formatInr(cf.cash_balance),
        subtitle: 'Cash / wallet / petty (heuristic)',
        icon: BanknotesIcon,
        tint: 'green',
      },
      {
        key: 'bankb',
        title: 'Bank-style accounts',
        value: formatInr(cf.bank_balance),
        subtitle: 'Other account types (balance sum)',
        icon: BuildingLibraryIcon,
        tint: 'sky',
      },
    ]
  }, [cashflowMonth, dashMonthLabel])

  const filterBankName = useMemo(() => {
    if (!bankFilter) return ''
    return accounts.find((a) => String(a.id) === bankFilter)?.account_name ?? ''
  }, [accounts, bankFilter])

  const unallocInc = Number(summary?.unallocated_income_ytd) || 0
  const unallocExp = Number(summary?.unallocated_expense_ytd) || 0
  const showUnallocatedHint = !bankFilter && (unallocInc > 0 || unallocExp > 0)
  const periodModeMonth = summary?.period_mode === 'month'

  const txSubtitle = bankFilter
    ? `${periodModeMonth ? `${dashMonthLabel} · ` : ''}Transactions for ${filterBankName || 'selected bank'} only`
    : periodModeMonth
      ? `Showing ${dashMonthLabel} · add more from Income or Expenses`
      : 'Latest income and expense rows · add more from Income or Expenses in the sidebar'

  return (
    <div className="mx-auto max-w-[1400px] space-y-8 px-1 sm:px-0">
      <PageHeader
        title="Dashboard"
        titleClassName="text-[1.75rem] font-semibold tracking-tight text-[var(--pf-text)] leading-tight"
        description={loading ? 'Updating…' : undefined}
        action={
          <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:flex-wrap sm:items-center sm:justify-end">
            {summary ? (
              <div
                className="mr-auto w-full rounded-2xl border border-[var(--pf-border)] bg-[var(--pf-card)] px-3 py-2 shadow-[var(--pf-shadow)] backdrop-blur-sm sm:mr-0 sm:w-auto sm:max-w-[13rem]"
                title="Blended score: savings rate, credit utilization, EMI vs income, net worth change, cash cushion vs spending"
              >
                <p className="text-[10px] font-semibold uppercase tracking-wide text-[var(--pf-text-muted)]">
                  Financial health
                </p>
                <p className="font-mono text-xl font-bold tabular-nums text-[var(--pf-text)]">
                  {financialHealth.score}
                  <span className="text-sm font-normal text-[var(--pf-text-muted)]"> / 100</span>
                </p>
                <p className="text-xs text-[var(--pf-text-muted)]">{financialHealth.label}</p>
              </div>
            ) : null}
            {activeTab === 'overview' ? (
              <div
                className="flex w-full flex-wrap gap-1 rounded-xl border border-[var(--pf-border)] bg-[var(--pf-card)]/70 p-1 shadow-[var(--pf-shadow)] backdrop-blur-sm sm:w-auto"
                title="Length of trend charts on Overview (income, net worth, cashflow)"
              >
                {[
                  { v: 1, label: 'This month' },
                  { v: 3, label: '3M' },
                  { v: 6, label: '6M' },
                  { v: 12, label: '1Y' },
                ].map(({ v, label }) => (
                  <button
                    key={v}
                    type="button"
                    onClick={() => setOverviewTimeRange(v)}
                    className={`rounded-lg px-2.5 py-1.5 text-[11px] font-bold transition sm:px-3 sm:text-xs ${
                      overviewTimeRange === v
                        ? 'bg-[var(--pf-primary)] text-white shadow-sm'
                        : 'text-[var(--pf-text-muted)] hover:bg-[var(--pf-card-hover)] hover:text-[var(--pf-text)]'
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            ) : null}
            <button
              type="button"
              onClick={() => setMonthModalOpen(true)}
              className={`${pfSelectCompact} min-w-[6.5rem] text-left font-bold text-[var(--pf-text)] transition hover:bg-[var(--pf-card-hover)] active:scale-[0.97]`}
            >
              {new Date(dashYear, dashMonth - 1, 1).toLocaleString(undefined, { month: 'short', year: 'numeric' })}
            </button>
            <PfBankAccountSelect
              className="flex-[1.2] sm:max-w-[16rem]"
              value={bankFilter}
              onChange={setBankFilter}
              accounts={accounts}
            />
          </div>
        }
      />

      {bankFilter ? (
        <p className="hidden rounded-2xl border border-sky-200 bg-sky-50 px-4 py-2 text-sm text-sky-900 md:block">
          Filter: <span className="font-semibold">{filterBankName || 'Selected account'}</span>. Income, expense, and
          recent activity use this account and <span className="font-semibold">{dashMonthLabel}</span> where applicable.
        </p>
      ) : null}

      {showUnallocatedHint ? (
        <div className="hidden rounded-2xl border border-amber-200/90 bg-amber-50 px-4 py-3 text-sm text-amber-950 md:block dark:border-amber-800/70 dark:bg-amber-950/45 dark:text-amber-50/95">
          <p className="font-semibold text-amber-900 dark:text-amber-100">Cash total may look low vs income/expense</p>
          <p className="mt-1 text-amber-900/90 dark:text-amber-100/90">
            You have{' '}
            {unallocInc > 0 ? (
              <>
                {formatInr(unallocInc)} income {periodModeMonth ? `in ${dashMonthLabel}` : 'YTD'}{' '}
                {unallocExp > 0 ? 'and ' : ''}
              </>
            ) : null}
            {unallocExp > 0 ? (
              <>{formatInr(unallocExp)} expenses {periodModeMonth ? `in ${dashMonthLabel}` : 'YTD'} </>
            ) : null}
            with no bank account linked. Add a{' '}
            <span className="font-semibold text-amber-950 dark:text-amber-50">cash / wallet / petty cash</span> account
            under{' '}
            <Link to="/personal-finance/accounts" className="font-semibold text-amber-950 underline decoration-amber-700/70 underline-offset-2 hover:text-amber-900 dark:text-amber-200 dark:decoration-amber-400/80">
              Accounts
            </Link>
            , then assign those rows to it on{' '}
            <Link to="/personal-finance/expenses" className="font-semibold text-amber-950 underline decoration-amber-700/70 underline-offset-2 hover:text-amber-900 dark:text-amber-200 dark:decoration-amber-400/80">
              Expenses
            </Link>{' '}
            (or{' '}
            <Link to="/personal-finance/income" className="font-semibold text-amber-950 underline decoration-amber-700/70 underline-offset-2 hover:text-amber-900 dark:text-amber-200 dark:decoration-amber-400/80">
              Income
            </Link>
            ) so cash totals stay consistent.
          </p>
        </div>
      ) : null}

      {loadError ? (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">{loadError}</div>
      ) : null}

      <div className="w-full overflow-x-auto [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        <PfSegmentedControl
          className="inline-flex min-w-full sm:min-w-0"
          options={DASH_TABS.map((t) => ({ id: t.id, label: t.label }))}
          value={activeTab}
          onChange={setActiveTab}
        />
      </div>

      {activeTab === 'overview' && (
        <>
      {loading && !summary ? (
        <div className="space-y-8" aria-hidden>
          <div className="h-48 animate-pulse rounded-2xl bg-slate-200/50 dark:bg-white/10 sm:h-52" />
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="h-28 animate-pulse rounded-2xl bg-slate-200/50 dark:bg-white/10" />
            ))}
          </div>
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={`w-${i}`} className="h-28 animate-pulse rounded-2xl bg-slate-200/50 dark:bg-white/10" />
            ))}
          </div>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={`r-${i}`} className="h-24 animate-pulse rounded-xl bg-slate-200/50 dark:bg-white/10" />
            ))}
          </div>
        </div>
      ) : null}

      <section aria-label="Financial summary" className={loading && !summary ? 'hidden' : ''}>
        <motion.div
          className="space-y-8"
          variants={bentoContainer}
          initial="hidden"
          animate="show"
        >
          <motion.div variants={bentoItem}>
            <div className="relative overflow-hidden rounded-2xl border border-black/[0.07] bg-gradient-to-br from-violet-500/[0.12] via-white/70 to-sky-500/[0.08] p-6 shadow-[var(--pf-shadow)] backdrop-blur-xl dark:border-white/10 dark:from-violet-600/25 dark:via-white/[0.04] dark:to-indigo-950/50 sm:p-8">
              <div className="pointer-events-none absolute -right-16 -top-16 h-56 w-56 rounded-full bg-gradient-to-br from-violet-400/25 to-indigo-500/10 blur-3xl dark:from-violet-500/20 dark:to-transparent" />
              <div className="relative flex flex-col gap-8 lg:flex-row lg:items-end lg:justify-between">
                <div className="min-w-0">
                  <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-slate-600 dark:text-white/65">
                    Net worth
                  </p>
                  <p className="mt-2 break-words text-3xl font-bold tabular-nums tracking-tight text-slate-900 dark:text-white sm:text-[2.15rem]">
                    {formatInr(summary?.net_worth)}
                  </p>
                  {netWorthMomLabel ? (
                    <p className="mt-2 text-sm font-semibold text-slate-700 dark:text-white/85">{netWorthMomLabel}</p>
                  ) : null}
                  <p className="mt-2 max-w-xl text-xs leading-relaxed text-slate-600 dark:text-white/55">
                    {bankFilter ? 'Selected account lens where applicable' : 'Assets + receivables − liabilities'}
                  </p>
                </div>
                <div className="flex flex-wrap gap-x-10 gap-y-4 border-t border-black/[0.06] pt-6 dark:border-white/10 lg:border-t-0 lg:pt-0">
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-wide text-teal-700/90 dark:text-teal-300/90">
                      Assets
                    </p>
                    <p className="mt-1 text-lg font-bold tabular-nums text-teal-900 dark:text-teal-200">
                      {formatInr(totalAssetsBook)}
                    </p>
                  </div>
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-wide text-purple-700/90 dark:text-purple-300/90">
                      Liabilities
                    </p>
                    <p className="mt-1 text-lg font-bold tabular-nums text-purple-900 dark:text-purple-200">
                      {formatInr(summary?.total_liabilities)}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </motion.div>

          <motion.div variants={bentoItem}>
            <p className="mb-3 text-xs font-bold uppercase tracking-wide text-[var(--pf-text-muted)]">Liquid</p>
            <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
              <KpiCard
                title="Bank"
                value={formatInr(liquidBankKpi)}
                subtitle="Checking & savings"
                icon={BuildingLibraryIcon}
                tint="teal"
              />
              <KpiCard
                title="Cash"
                value={formatInr(hasLiquidSplit ? liquidCashKpi : legacyCashBucket)}
                subtitle={hasLiquidSplit ? 'Physical cash' : 'Cash & wallet (legacy)'}
                icon={BanknotesIcon}
                tint="teal"
              />
              <KpiCard
                title="Wallet"
                value={formatInr(hasLiquidSplit ? liquidWalletKpi : null)}
                subtitle={hasLiquidSplit ? 'UPI / wallets' : 'Enable wallet-type accounts'}
                icon={DevicePhoneMobileIcon}
                tint="cyan"
              />
              <KpiCard
                title="Total liquid"
                value={formatInr(liquidTotalKpi)}
                subtitle="Bank + cash + wallet"
                icon={BanknotesIcon}
                tint="sky"
              />
            </div>
          </motion.div>

          <motion.div variants={bentoItem}>
            <p className="mb-3 text-xs font-bold uppercase tracking-wide text-[var(--pf-text-muted)]">Wealth & debt</p>
            <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
              <KpiCard
                title="Investments"
                value={formatInr(summary?.total_investment)}
                subtitle="Funds, FDs, equity (book)"
                icon={ChartPieIcon}
                tint="indigo"
              />
              <KpiCard
                title="Loans given"
                value={formatInr(summary?.finance_loans_given_balance)}
                subtitle="LOAN_GIVEN accounts"
                icon={UsersIcon}
                tint="orange"
              />
              <KpiCard
                title="Loans taken"
                value={formatInr(summary?.finance_loans_taken_balance)}
                subtitle="LOAN_TAKEN balances"
                icon={ReceiptPercentIcon}
                tint="orange"
              />
              <KpiCard
                title="Liabilities"
                value={formatInr(summary?.total_liabilities)}
                subtitle="Loans & cards outstanding"
                icon={ScaleIcon}
                tint="purple"
              />
            </div>
          </motion.div>

          <motion.div variants={bentoItem}>
            <p className="mb-3 text-xs font-bold uppercase tracking-wide text-[var(--pf-text-muted)]">Ratios</p>
            <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
              {ratioRowCards.map((r) => (
                <div
                  key={r.label}
                  className="rounded-2xl border border-black/[0.06] bg-white/50 px-4 py-4 shadow-[var(--pf-shadow)] backdrop-blur-md transition-all duration-200 ease-out hover:-translate-y-0.5 hover:border-black/10 hover:shadow-lg dark:border-white/10 dark:bg-white/[0.04] dark:hover:border-white/[0.14]"
                >
                  <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500 dark:text-[var(--pf-text-muted)]">
                    {r.label}
                  </p>
                  <p className="mt-1.5 font-mono text-base font-bold tabular-nums text-slate-900 dark:text-white">{r.value}</p>
                  <p className="mt-1 text-[10px] leading-snug text-slate-500 dark:text-[var(--pf-text-muted)]">{r.hint}</p>
                </div>
              ))}
            </div>
          </motion.div>
        </motion.div>
      </section>

      <div className={`mt-8 space-y-3 ${loading && !summary ? 'hidden' : ''}`}>
        <div>
          <h2 className={sectionTitleCls}>Charts</h2>
          <p className={sectionSubCls}>
            Trends for {dashYear} · window matches header ({overviewTimeRange === 1 ? '1 mo' : overviewTimeRange === 3 ? '3 mo' : overviewTimeRange === 6 ? '6 mo' : '12 mo'})
          </p>
        </div>
        {dashStage >= 1 ? (
          <Suspense
            fallback={
              <div className="grid grid-cols-1 gap-4 lg:grid-cols-2" aria-hidden>
                {Array.from({ length: 6 }).map((_, i) => (
                  <div
                    key={i}
                    className={`${DASH_INSIGHT_CARD} h-[300px] animate-pulse bg-slate-200/50 dark:bg-slate-700/40`}
                  />
                ))}
              </div>
            }
          >
            <LazyDashboardCharts
              chartMode="overview"
              isDark={isDark}
              barIeData={barIeData}
              pieData={pieData}
              networthData={networthDisplayData}
              invBarData={invBarData}
              cashflowTrendData={cashflowTrendData}
              overviewNwThreeLineData={overviewNwThreeLineData}
              expenseCategoryHBarData={expenseCategoryHBarData}
              cashflowHealthData={cashflowHealthData}
              debtTrendData={debtTrendData}
              savingsRateTrendData={savingsRateTrendData}
              accountDistributionData={compositionPieData}
              investmentAllocationBarSorted={investmentAllocationBarSorted}
              dashYear={dashYear}
              dashMonthLabel={dashMonthLabel}
              filterBankName={filterBankName}
              bankFilter={bankFilter}
              pfChartCard={DASH_CHART_CARD}
              pfInsightCard={DASH_INSIGHT_CARD}
              chartTitleCls={chartTitle}
              chartSubCls={chartSub}
            />
          </Suspense>
        ) : null}
      </div>

      {dashStage >= 2 ? (
        <>
          {insightsList.length > 0 ? (
            <section className={`${DASH_CHART_CARD} mt-8`} aria-label="Insights">
              <div className="flex items-start gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-[var(--pf-border)] bg-[var(--pf-card-hover)]/50 text-[var(--pf-primary)]">
                  <SparklesIcon className="h-5 w-5" />
                </div>
                <div className="min-w-0 flex-1">
                  <h2 className={chartTitle}>Insights</h2>
                  <p className={chartSub}>High-signal notes from your current numbers · {dashMonthLabel}</p>
                </div>
              </div>
              <ul className="mt-5 grid gap-3 sm:grid-cols-1">
                {insightsList.map((line, idx) => {
                  const { glyph, bar, bg, Icon } = dashboardInsightMeta(line)
                  return (
                    <motion.li
                      key={`insight-${idx}`}
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.3, delay: idx * 0.04 }}
                      className={`flex gap-3 rounded-xl border border-[var(--pf-border)]/60 py-3 pl-3 pr-4 text-[13px] leading-snug text-slate-800 dark:text-[var(--pf-text)] ${bar} border-l-[3px] ${bg} transition-all duration-200 hover:border-[var(--pf-border)]`}
                    >
                      <span className="mt-0.5 shrink-0 font-mono text-base tabular-nums text-slate-500 dark:text-white/50">
                        {glyph}
                      </span>
                      <Icon className="mt-0.5 h-4 w-4 shrink-0 opacity-70 text-[var(--pf-text-muted)]" />
                      <span className="min-w-0">{line}</span>
                    </motion.li>
                  )
                })}
              </ul>
            </section>
          ) : null}

          <div className="mt-8 grid grid-cols-1 gap-6 lg:grid-cols-2 lg:gap-4">
          {upcomingPaymentsRows.length > 0 ? (
            <section className={DASH_CHART_CARD} aria-label="Upcoming payments">
              <h2 className={chartTitle}>Upcoming payments</h2>
              <p className={`${chartSub} hidden md:block`}>Credit card and EMI obligations with due dates</p>
              <p className={`${chartSub} md:hidden`}>Due dates & amounts</p>
              <div className="mt-4 space-y-3 md:hidden">
                {upcomingPaymentsRows.map((row, idx) => (
                  <div
                    key={`${row.type}-${row.name}-${row.due}-${idx}`}
                    className="flex flex-col gap-1 rounded-2xl border border-slate-100 bg-white p-4 shadow-sm dark:border-slate-600 dark:bg-slate-800"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <span className="text-[11px] font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                        {row.type}
                      </span>
                      <span className="shrink-0 text-base font-bold tabular-nums text-slate-900 dark:text-slate-100">
                        {formatInr(row.amount)}
                      </span>
                    </div>
                    <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">{row.name}</p>
                    <p className="text-xs tabular-nums text-slate-600 dark:text-slate-400">
                      Due {row.due || '—'}
                    </p>
                  </div>
                ))}
              </div>
              <div className={`mt-3 hidden md:block ${DASH_TABLE_WRAP}`}>
                <table className={`${pfTable} min-w-[480px] text-[13px]`}>
                  <thead className="sticky top-0 z-[1]">
                    <tr>
                      <th className={`${pfTh} sticky top-0 bg-[var(--pf-th-bg)]/95 backdrop-blur-sm`}>Type</th>
                      <th className={`${pfTh} sticky top-0 bg-[var(--pf-th-bg)]/95 backdrop-blur-sm`}>Name</th>
                      <th className={`${pfTh} sticky top-0 bg-[var(--pf-th-bg)]/95 backdrop-blur-sm`}>Due</th>
                      <th className={`${pfThRight} sticky top-0 bg-[var(--pf-th-bg)]/95 backdrop-blur-sm`}>Amount</th>
                    </tr>
                  </thead>
                  <tbody>
                    {upcomingPaymentsRows.map((row, idx) => (
                      <tr
                        key={`${row.type}-${row.name}-${row.due}-${idx}`}
                        className={`${pfTrHover} transition-colors hover:bg-white/[0.05] dark:hover:bg-white/[0.05]`}
                      >
                        <td className={pfTd}>{row.type}</td>
                        <td className={`${pfTd} max-w-[12rem] truncate`}>{row.name}</td>
                        <td className={`${pfTd} tabular-nums text-slate-600 dark:text-slate-400`}>{row.due || '—'}</td>
                        <td className={pfTdRight}>{formatInr(row.amount)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          ) : null}

          <section aria-label="Recent transactions" className={`${DASH_CHART_CARD} min-w-0`}>
            <h2 className={chartTitle}>Recent transactions</h2>
            <p className={`${chartSub} hidden md:block`}>{txSubtitle}</p>
            {(summary?.recent_transactions ?? []).length === 0 ? (
              <p className="mt-4 text-center text-sm text-slate-500 dark:text-slate-400">No transactions in this period.</p>
            ) : (
              <>
                <div className="mt-4 space-y-3 md:hidden">
                  {summary.recent_transactions.map((tx) => {
                    const method = (tx.payment_method || tx.method || '').toString()
                    const methodLabel =
                      method === 'upi'
                        ? 'UPI'
                        : method === 'bank_transfer'
                          ? 'Bank'
                          : method === 'cash'
                            ? 'Cash'
                            : method
                              ? method
                              : '—'
                    return (
                      <div
                        key={`${tx.kind}-${tx.id}`}
                        className="flex flex-col gap-1 rounded-2xl border border-slate-100 bg-white p-4 shadow-sm transition active:scale-[0.99] dark:border-slate-600 dark:bg-slate-800"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <span className="min-w-0 flex-1 font-semibold text-slate-900 dark:text-slate-100">
                            {tx.category || '—'}
                          </span>
                          <span
                            className={`shrink-0 font-mono text-base font-bold tabular-nums ${
                              tx.kind === 'income' ? 'text-emerald-600 dark:text-emerald-400' : 'text-[#EF4444]'
                            }`}
                          >
                            {formatInr(tx.amount)}
                          </span>
                        </div>
                        <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
                          <span className="tabular-nums">{tx.date}</span>
                          <span className="rounded-full bg-slate-100 px-2 py-0.5 font-medium capitalize text-slate-600 dark:bg-slate-700 dark:text-slate-300">
                            {methodLabel}
                          </span>
                        </div>
                      </div>
                    )
                  })}
                </div>
                <div className={`mt-4 hidden md:block ${DASH_TABLE_WRAP}`}>
                  <table className={`${pfTable} min-w-[520px] text-[13px]`}>
                    <thead className="sticky top-0 z-[1]">
                      <tr>
                        <th className={`${pfTh} sticky top-0 bg-[var(--pf-th-bg)]/95 backdrop-blur-sm`}>Type</th>
                        <th className={`${pfTh} sticky top-0 bg-[var(--pf-th-bg)]/95 backdrop-blur-sm`}>Date</th>
                        <th className={`${pfTh} sticky top-0 bg-[var(--pf-th-bg)]/95 backdrop-blur-sm`}>Category</th>
                        <th className={`${pfThRight} sticky top-0 bg-[var(--pf-th-bg)]/95 backdrop-blur-sm`}>Amount</th>
                      </tr>
                    </thead>
                    <tbody>
                      {summary.recent_transactions.map((tx) => (
                        <tr
                          key={`${tx.kind}-${tx.id}`}
                          className={`${pfTrHover} transition-colors hover:bg-white/[0.05] dark:hover:bg-white/[0.05]`}
                        >
                          <td className={pfTd}>
                            <span
                              className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
                                tx.kind === 'income'
                                  ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-200'
                                  : 'bg-orange-100 text-orange-800 dark:bg-orange-900/40 dark:text-orange-200'
                              }`}
                            >
                              {tx.kind}
                            </span>
                          </td>
                          <td className={`${pfTd} text-slate-600 dark:text-slate-400`}>{tx.date}</td>
                          <td className={`${pfTd} dark:text-slate-200`}>{tx.category}</td>
                          <td className={pfTdRight}>{formatInr(tx.amount)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            )}
          </section>
          </div>
        </>
      ) : null}
        </>
      )}

      {activeTab === 'cashflow' && (
        <>
          <section aria-label="Cashflow period overview" className="space-y-3">
            <div>
              <h2 className={sectionTitleCls}>Period overview</h2>
              <p className={sectionSubCls}>
                Income, spending, and ratios for {dashMonthLabel}
                {bankFilter ? ` · ${filterBankName || 'filtered account'}` : ''}.
              </p>
            </div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <KpiCard
                stacked
                title={`Income · ${dashMonthLabel}`}
                value={formatInr(summary?.total_income)}
                subtitle={bankFilter ? filterBankName || 'Selected account' : 'Recorded in period'}
                icon={ArrowTrendingUpIcon}
                tint="emerald"
              />
              <KpiCard
                stacked
                title={`Expense · ${dashMonthLabel}`}
                value={formatInr(summary?.total_expense)}
                subtitle="All expenses in period"
                icon={CreditCardIcon}
                tint="rose"
              />
              <KpiCard
                stacked
                title="EMI"
                value={formatInr(cashflowMonth?.emi_expense_month)}
                subtitle="EMI-tagged expense this month"
                icon={ReceiptPercentIcon}
                tint="amber"
              />
              <KpiCard
                stacked
                title="Savings"
                value={formatInr(incomeM - expenseM)}
                subtitle="Income − expense (before EMI carve-out in rate)"
                icon={BanknotesIcon}
                tint="slate"
              />
              <KpiCard
                stacked
                title="Savings rate"
                value={
                  incomeM > 0.01 && savingsRateFormula != null ? `${(savingsRateFormula * 100).toFixed(1)}%` : '—'
                }
                subtitle="(Income − expense − EMI) / income"
                icon={ChartPieIcon}
                tint="indigo"
              />
              <KpiCard
                stacked
                title="Expense ratio"
                value={incomeM > 0.01 ? `${((expenseM / incomeM) * 100).toFixed(1)}%` : '—'}
                subtitle="Expense / income"
                icon={ScaleIcon}
                tint="sky"
              />
            </div>
          </section>

          <section className="space-y-4" aria-label="Cashflow charts">
            <div>
              <h2 className={sectionTitleCls}>Charts</h2>
              <p className={sectionSubCls}>Income vs expense, categories, and multi-series cashflow for {dashYear}.</p>
            </div>
            {dashStage >= 1 ? (
              <Suspense
                fallback={
                  <div className={`${DASH_CHART_CARD} h-[280px] animate-pulse bg-slate-200/50 dark:bg-slate-700/40`} aria-hidden />
                }
              >
                <LazyDashboardCharts
                  chartMode="cashflow"
                  isDark={isDark}
                  barIeData={barIeDataFull}
                  pieData={pieData}
                  networthData={networthData}
                  invBarData={invBarData}
                  cashflowTrendData={cashflowTrendData}
                  dashYear={dashYear}
                  dashMonthLabel={dashMonthLabel}
                  filterBankName={filterBankName}
                  bankFilter={bankFilter}
                  pfChartCard={DASH_CHART_CARD}
                  chartTitleCls={chartTitle}
                  chartSubCls={chartSub}
                />
              </Suspense>
            ) : null}
          </section>

          <section aria-label="Expense by account" className="space-y-3">
            <div>
              <h2 className={sectionTitleCls}>Expense by account</h2>
              <p className={sectionSubCls}>
                Totals from expense rows linked to each bank account in {dashMonthLabel} (same rules as Reports →
                Summary). Assign an account on the Expenses page when missing.
              </p>
            </div>
            {expenseByAccountReportError ? (
              <div className="rounded-2xl border border-amber-200/80 bg-amber-50/90 px-4 py-3 text-sm text-amber-950 dark:border-amber-900/50 dark:bg-amber-950/30 dark:text-amber-100">
                {expenseByAccountReportError}
              </div>
            ) : null}
            {expenseByAccountReportLoading ? (
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3" aria-hidden>
                {Array.from({ length: 4 }).map((_, i) => (
                  <div key={i} className="h-32 animate-pulse rounded-2xl bg-white/10 dark:bg-white/[0.06]" />
                ))}
              </div>
            ) : expenseByAccountReport.length === 0 ? (
              <div className={`${DASH_CHART_CARD} text-sm text-[var(--pf-text-muted)]`}>
                {accounts.length === 0
                  ? 'Add bank accounts under Accounts or Money movement, then link expenses to an account to see splits here.'
                  : `No expenses with a linked account in ${dashMonthLabel}, or all amounts are under (No account). Link transactions on the Expenses page.`}
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                {expenseByAccountReport.map((row, i) => (
                  <KpiCard
                    stacked
                    key={row.account_id != null ? `acc-${row.account_id}` : `row-${i}-${row.account_name}`}
                    title={row.account_name || 'Account'}
                    value={formatInr(row.amount)}
                    subtitle={
                      row.pct != null && Number(row.pct) > 0
                        ? `${Number(row.pct).toFixed(0)}% of expense in this period`
                        : 'Share of period expense'
                    }
                    icon={BuildingLibraryIcon}
                    tint={['slate', 'sky', 'indigo', 'teal', 'rose', 'amber'][i % 6]}
                  />
                ))}
              </div>
            )}
          </section>

          <section aria-label="Month cashflow snapshot" className="space-y-3">
            <div>
              <h2 className={sectionTitleCls}>{dashMonthLabel} · snapshot</h2>
              <p className={sectionSubCls}>Ledger-style buckets for the selected month.</p>
            </div>
            <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-4">
              {cashflowSnapshotTiles.map((tile) => (
                <KpiCard
                  key={tile.key}
                  title={tile.title}
                  value={tile.value}
                  subtitle={tile.subtitle}
                  icon={tile.icon}
                  tint={tile.tint}
                />
              ))}
            </div>
          </section>

          <section aria-label="Cashflow analytics" className="space-y-4">
            <div>
              <h2 className={sectionTitleCls}>Analytics</h2>
              <p className={sectionSubCls}>Bar view and copy-friendly table for the same month buckets.</p>
            </div>
            <div className="grid min-w-0 gap-6 lg:grid-cols-2">
              <div className={`min-w-0 ${DASH_CHART_CARD}`}>
                <h2 className={chartTitle}>{dashMonthLabel} · amounts at a glance</h2>
                <p className={chartSub}>Same buckets as the snapshot (₹)</p>
                <div className="mt-3 h-[320px] min-h-[320px] min-w-0 w-full">
                  {cashflowBarData.length === 0 || cashflowBarData.every((d) => d.value === 0) ? (
                    <p className="flex h-full items-center justify-center text-sm text-slate-500 dark:text-slate-400">
                      No expense data for {dashMonthLabel} yet
                    </p>
                  ) : (
                    <ResponsiveContainer width="100%" height="100%" minWidth={48} minHeight={240}>
                      <BarChart
                        data={cashflowBarData}
                        layout="vertical"
                        margin={{ top: 8, right: 16, left: 8, bottom: 0 }}
                      >
                        <defs>
                          <linearGradient id="pfCashflowGlanceBar" x1="0" y1="0" x2="1" y2="0">
                            <stop offset="0%" stopColor="#38bdf8" stopOpacity={0.35} />
                            <stop offset="100%" stopColor="#6366f1" stopOpacity={0.95} />
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" stroke={gridStroke} strokeOpacity={0.35} />
                        <XAxis
                          type="number"
                          tick={{ fontSize: 11, fill: isDark ? '#94a3b8' : '#64748b' }}
                          stroke={isDark ? '#94a3b8' : '#64748b'}
                          tickFormatter={(v) => `₹${(v / 1000).toFixed(0)}k`}
                        />
                        <YAxis
                          type="category"
                          dataKey="name"
                          width={92}
                          tick={{ fontSize: 10, fill: isDark ? '#94a3b8' : '#64748b' }}
                          stroke={isDark ? '#94a3b8' : '#64748b'}
                        />
                        <Tooltip formatter={(v) => formatInr(v)} contentStyle={tooltipBox} />
                        <Bar
                          dataKey="value"
                          name="Amount"
                          fill="url(#pfCashflowGlanceBar)"
                          radius={[0, 6, 6, 0]}
                          animationDuration={550}
                          animationEasing="ease-out"
                        />
                      </BarChart>
                    </ResponsiveContainer>
                  )}
                </div>
              </div>

              <div className={`min-w-0 ${DASH_CHART_CARD}`}>
                <h2 className={chartTitle}>Month breakdown · table</h2>
                <p className={chartSub}>Quick copy-friendly totals</p>
                <div className={`mt-3 ${DASH_TABLE_WRAP}`}>
                  <table className={`${pfTable} min-w-[280px] text-[13px]`}>
                    <thead className="sticky top-0 z-[1]">
                      <tr>
                        <th className={`${pfTh} sticky top-0 bg-[var(--pf-th-bg)]/95 backdrop-blur-sm`}>Metric</th>
                        <th className={`${pfThRight} sticky top-0 bg-[var(--pf-th-bg)]/95 backdrop-blur-sm`}>Amount</th>
                      </tr>
                    </thead>
                    <tbody>
                      {cashflowTableRows.map((row) => (
                        <tr
                          key={row.label}
                          className={`${pfTrHover} transition-colors hover:bg-white/[0.03] dark:hover:bg-white/[0.03]`}
                        >
                          <td className={`${pfTd} text-slate-700 dark:text-slate-300`}>{row.label}</td>
                          <td className={`${pfTdRight} font-mono tabular-nums`}>{formatInr(row.value)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </section>

          <section className={`${DASH_CHART_CARD}`} aria-label="Monthly cashflow table">
            <h2 className={chartTitle}>Monthly summary · {dashYear}</h2>
            <p className={chartSub}>Income, expense, EMI ({dashMonthLabel} row only), savings</p>
            <div className={`mt-3 ${DASH_TABLE_WRAP}`}>
              <table className={`${pfTable} min-w-[520px] text-[13px]`}>
                <thead className="sticky top-0 z-[1]">
                  <tr>
                    <th className={`${pfTh} sticky top-0 bg-[var(--pf-th-bg)]/95 backdrop-blur-sm`}>Month</th>
                    <th className={`${pfThRight} sticky top-0 bg-[var(--pf-th-bg)]/95 backdrop-blur-sm`}>Income</th>
                    <th className={`${pfThRight} sticky top-0 bg-[var(--pf-th-bg)]/95 backdrop-blur-sm`}>Expense</th>
                    <th className={`${pfThRight} sticky top-0 bg-[var(--pf-th-bg)]/95 backdrop-blur-sm`}>EMI</th>
                    <th className={`${pfThRight} sticky top-0 bg-[var(--pf-th-bg)]/95 backdrop-blur-sm`}>Savings</th>
                  </tr>
                </thead>
                <tbody>
                  {cashflowMonthlyTableRows.map((row) => (
                    <tr
                      key={row.month}
                      className={`${pfTrHover} transition-colors hover:bg-white/[0.03] dark:hover:bg-white/[0.03]`}
                    >
                      <td className={`${pfTd} font-medium tabular-nums`}>{row.month}</td>
                      <td className={`${pfTdRight} font-mono tabular-nums`}>{formatInr(row.income)}</td>
                      <td className={`${pfTdRight} font-mono tabular-nums`}>{formatInr(row.expense)}</td>
                      <td className={`${pfTdRight} font-mono tabular-nums`}>{formatInr(row.emi)}</td>
                      <td className={`${pfTdRight} font-mono tabular-nums`}>{formatInr(row.savings)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </>
      )}

      {activeTab === 'credit' && (
        <>
          <section aria-label="Credit cards overview" className="space-y-3">
            <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
              <KpiCard
                title="Total credit limit"
                value={formatInr(creditCardsSummary?.total_credit_limit)}
                subtitle={`${creditCardsSummary?.card_count ?? 0} card(s)`}
                icon={CreditCardIcon}
                tint="slate"
              />
              <KpiCard
                title="Credit used"
                value={formatInr(creditCardsSummary?.used_limit)}
                subtitle="Billed + unbilled"
                icon={CreditCardIcon}
                tint="fuchsia"
              />
              <KpiCard
                title="Utilization"
                value={creditCardsSummary?.utilization_pct != null ? `${creditCardsSummary.utilization_pct}%` : '—'}
                subtitle={creditCardsSummary?.credit_health ?? '—'}
                icon={ChartPieIcon}
                tint="amber"
              />
              <KpiCard
                title="CC overdue"
                value={formatInr(creditCardsSummary?.overdue_amount)}
                subtitle="Statements past due"
                icon={ExclamationTriangleIcon}
                tint="rose"
              />
              <KpiCard
                title="Loan given (principal)"
                value={formatInr(loanAnalytics?.total_loan_given)}
                subtitle="Money you lent out"
                icon={BanknotesIcon}
                tint="sky"
              />
              <KpiCard
                title="Loan collected"
                value={formatInr(loanAnalytics?.total_collected)}
                subtitle="All-time repayments"
                icon={ArrowTrendingUpIcon}
                tint="green"
              />
              <KpiCard
                title="Loan outstanding"
                value={formatInr(loanAnalytics?.total_remaining_receivable)}
                subtitle="Still to collect"
                icon={ScaleIcon}
                tint="cyan"
              />
              <KpiCard
                title="EMI due (month)"
                value={formatInr(loanAnalytics?.emi_due_this_month)}
                subtitle="Unpaid EMIs due this calendar month"
                icon={CalendarDaysIcon}
                tint="amber"
              />
            </div>
          </section>

          <section className={DASH_CHART_CARD} aria-label="Credit utilization trend">
            <h2 className={chartTitle}>Credit utilization trend</h2>
            <p className={chartSub}>
              Month-over-month utilization history is not in the bundle yet; snapshot for {dashMonthLabel}:{' '}
              <span className="font-semibold text-slate-800 dark:text-slate-200">
                {creditCardsSummary?.utilization_pct != null ? `${creditCardsSummary.utilization_pct}%` : '—'}
              </span>
            </p>
          </section>

          {emisDueMonth ? (
            <section
              aria-label="EMIs due in selected month"
              className={`${DASH_CHART_CARD} border-sky-200/80 dark:border-slate-600`}
            >
              <h2 className={chartTitle}>EMIs due · {dashMonthLabel}</h2>
              <p className={chartSub}>
                <span className="font-semibold text-slate-700 dark:text-slate-300">You lend</span>{' '}
                {formatInr(emisDueMonth.lend_due_total)} ({emisDueMonth.lend_count ?? 0} installment
                {(emisDueMonth.lend_count ?? 0) === 1 ? '' : 's'}) ·{' '}
                <span className="font-semibold text-slate-700 dark:text-slate-300">You borrow</span>{' '}
                {formatInr(emisDueMonth.borrow_due_total)} ({emisDueMonth.borrow_count ?? 0} installment
                {(emisDueMonth.borrow_count ?? 0) === 1 ? '' : 's'}) ·{' '}
                <span className="font-semibold text-slate-900 dark:text-slate-100">Net calendar exposure</span>{' '}
                {formatInr(emisDueMonth.combined_due_total)}
              </p>
              {accountingPolicy?.one_liner ? (
                <p className="mt-1 text-[11px] leading-snug text-slate-500 dark:text-slate-400">
                  Policy v{accountingPolicy.version}: {accountingPolicy.one_liner}
                </p>
              ) : null}
              {Array.isArray(emisDueMonth.items) && emisDueMonth.items.length > 0 ? (
                <div className={`${pfTableWrap} mt-3 max-h-[min(22rem,50vh)] overflow-y-auto`}>
                  <table className={`${pfTable} min-w-[520px] text-xs`}>
                    <thead className="sticky top-0 bg-white dark:bg-slate-900">
                      <tr>
                        <th className={pfTh}>Side</th>
                        <th className={pfTh}>Name</th>
                        <th className={pfTh}>EMI #</th>
                        <th className={pfTh}>Due</th>
                        <th className={pfThRight}>Amount</th>
                      </tr>
                    </thead>
                    <tbody>
                      {emisDueMonth.items.map((row, idx) => (
                        <tr key={`${row.side}-${row.entity_id}-${row.emi_number}-${idx}`} className={pfTrHover}>
                          <td className={pfTd}>
                            {row.side === 'lend' ? (
                              <span className="rounded-full bg-teal-100 px-2 py-0.5 text-[10px] font-bold uppercase text-teal-900 dark:bg-teal-950/60 dark:text-teal-200">
                                Lend
                              </span>
                            ) : (
                              <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold uppercase text-amber-950 dark:bg-amber-950/50 dark:text-amber-200">
                                Borrow
                              </span>
                            )}
                          </td>
                          <td className={`${pfTd} max-w-[10rem] truncate font-medium`}>{row.name}</td>
                          <td className={pfTd}>{row.emi_number}</td>
                          <td className={`${pfTd} text-slate-600 dark:text-slate-400`}>{row.due_date ?? '—'}</td>
                          <td className={pfTdRight}>{formatInr(row.amount)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
                  No scheduled EMIs with a due date in this month (lend or borrow).
                </p>
              )}
            </section>
          ) : null}

          {Array.isArray(creditCardsSummary?.alerts) && creditCardsSummary.alerts.length > 0 ? (
            <section
              className={`${DASH_CHART_CARD} border-fuchsia-200/80 dark:border-fuchsia-900/40`}
              aria-label="Credit card alerts"
            >
              <h2 className={chartTitle}>Credit card alerts</h2>
              <p className={chartSub}>Due dates, overdue statements, and high limit usage</p>
              <ul className="mt-3 space-y-2">
                {creditCardsSummary.alerts.map((a, idx) => (
                  <li
                    key={`${a.type}-${a.card_id}-${a.bill_id ?? idx}`}
                    className={`rounded-xl border px-3 py-2.5 text-sm ${
                      a.severity === 'high'
                        ? 'border-rose-200 bg-rose-50/90 text-rose-950 dark:border-rose-900 dark:bg-rose-950/35 dark:text-rose-100'
                        : 'border-amber-200 bg-amber-50/90 text-amber-950 dark:border-amber-900 dark:bg-amber-950/35 dark:text-amber-100'
                    }`}
                  >
                    {a.message}
                  </li>
                ))}
              </ul>
            </section>
          ) : null}

          {creditCardsSummary?.current_bill ? (
            <section className={DASH_CHART_CARD} aria-label="Next credit card statement">
              <h2 className={chartTitle}>Next statement (earliest due)</h2>
              <p className={chartSub}>
                {creditCardsSummary.current_bill.card_name} · period {creditCardsSummary.current_bill.bill_period} · due{' '}
                {creditCardsSummary.current_bill.due_date} · remaining {formatInr(creditCardsSummary.current_bill.remaining)}{' '}
                of {formatInr(creditCardsSummary.current_bill.total_amount)}
              </p>
            </section>
          ) : null}

          {cashflowMonth != null ? (
            <section className={DASH_CHART_CARD} aria-label="EMI receivable vs expense">
              <h2 className={chartTitle}>EMI · paid (expense) vs pending (receivable)</h2>
              <p className={chartSub}>{dashMonthLabel} · profile-wide</p>
              <div className="mt-3 h-[200px] min-h-[200px] min-w-0 w-full">
                <ResponsiveContainer width="100%" height="100%" minWidth={48} minHeight={160}>
                  <BarChart
                    data={[
                      {
                        name: 'EMI',
                        paid: Number(cashflowMonth.emi_expense_month) || 0,
                        pending: Number(cashflowMonth.pending_emis_receivable) || 0,
                      },
                    ]}
                    margin={{ top: 8, right: 8, left: 0, bottom: 0 }}
                  >
                    <defs>
                      <linearGradient id="pfEmiPaidCredit" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#22c55e" />
                        <stop offset="100%" stopColor="#15803d" />
                      </linearGradient>
                      <linearGradient id="pfEmiPendingCredit" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#f59e0b" />
                        <stop offset="100%" stopColor="#c2410c" />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke={isDark ? '#334155' : '#e2e8f0'} />
                    <XAxis dataKey="name" tick={{ fontSize: 11, fill: isDark ? '#94a3b8' : '#64748b' }} stroke={isDark ? '#94a3b8' : '#64748b'} />
                    <YAxis
                      tick={{ fontSize: 11, fill: isDark ? '#94a3b8' : '#64748b' }}
                      stroke={isDark ? '#94a3b8' : '#64748b'}
                      tickFormatter={(v) => `₹${(v / 1000).toFixed(0)}k`}
                    />
                    <Tooltip formatter={(v) => formatInr(v)} contentStyle={tooltipBox} animationDuration={200} />
                    <Legend verticalAlign="bottom" height={28} />
                    <Bar
                      dataKey="paid"
                      name="EMI paid (expense)"
                      fill="url(#pfEmiPaidCredit)"
                      radius={[6, 6, 0, 0]}
                      animationDuration={800}
                    />
                    <Bar
                      dataKey="pending"
                      name="Pending receivable"
                      fill="url(#pfEmiPendingCredit)"
                      radius={[6, 6, 0, 0]}
                      animationDuration={800}
                    />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </section>
          ) : null}

          {upcomingEmis.length > 0 ? (
            <section className={DASH_CHART_CARD} aria-label="Upcoming EMIs">
              <h2 className={chartTitle}>Upcoming EMIs</h2>
              <p className={chartSub}>Next unpaid installments you are owed</p>
              <div className="mt-3 flex gap-3 overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                {upcomingEmis.map((e) => (
                  <div
                    key={e.loan_id}
                    className="min-w-[11rem] shrink-0 rounded-2xl border border-slate-100 bg-slate-50/90 p-4 shadow-sm transition duration-200 hover:-translate-y-0.5 hover:shadow-md dark:border-slate-600 dark:bg-slate-800/90 dark:shadow-none"
                  >
                    <p className="font-bold text-slate-900 dark:text-slate-100">{e.borrower_name}</p>
                    <p className="mt-1 text-xs text-slate-500 tabular-nums dark:text-slate-400">{e.due_date}</p>
                    <p className="mt-2 font-mono text-lg font-bold tabular-nums text-[#1E3A8A] dark:text-blue-400">
                      {formatInr(e.emi_amount)}
                    </p>
                  </div>
                ))}
              </div>
            </section>
          ) : null}

          <section aria-label="Loan exposure mix" className={DASH_CHART_CARD}>
            <h2 className={chartTitle}>Receivable: current vs overdue</h2>
            <p className={chartSub}>Outstanding you are owed, split by overdue EMIs</p>
            <div className="mt-3 h-[260px] min-h-[260px] w-full">
              {loanExposurePie.length === 0 ? (
                <p className="flex h-full items-center justify-center text-sm text-slate-500">No receivable balance</p>
              ) : (
                <ResponsiveContainer width="100%" height="100%" minHeight={220}>
                  <PieChart>
                    <Pie
                      data={loanExposurePie}
                      dataKey="value"
                      nameKey="name"
                      cx="50%"
                      cy="50%"
                      outerRadius={88}
                      label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                    >
                      {loanExposurePie.map((_, i) => (
                        <Cell key={i} fill={LOAN_CHART_COLORS[i % LOAN_CHART_COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(v) => formatInr(v)} contentStyle={tooltipBox} />
                  </PieChart>
                </ResponsiveContainer>
              )}
            </div>
          </section>

          <section aria-label="Loans lending portfolio" className="space-y-4">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <KpiCard
                title="Total loan given"
                value={formatInr(loanAnalytics?.total_loan_given)}
                subtitle="Sum of principal (loan amounts)"
                icon={BanknotesIcon}
                tint="sky"
              />
              <KpiCard
                title="Interest profit (book)"
                value={formatInr(loanAnalytics?.total_interest_profit)}
                subtitle="Expected interest on scheduled loans"
                icon={ReceiptPercentIcon}
                tint="amber"
              />
              <KpiCard
                title="Total expected"
                value={formatInr(loanAnalytics?.total_amount_expected)}
                subtitle="Principal + interest (book)"
                icon={ScaleIcon}
                tint="indigo"
              />
              <KpiCard
                title="Total collected"
                value={formatInr(loanAnalytics?.total_collected)}
                subtitle="All EMI / payments recorded"
                icon={ArrowTrendingUpIcon}
                tint="green"
              />
              <KpiCard
                title="Remaining receivable"
                value={formatInr(loanAnalytics?.total_remaining_receivable)}
                subtitle="Unpaid EMIs or latest balance"
                icon={ChartPieIcon}
                tint="cyan"
              />
              <KpiCard
                title="Active loans"
                value={loanAnalytics?.active_loans != null ? String(loanAnalytics.active_loans) : '—'}
                subtitle="Not closed"
                icon={UsersIcon}
                tint="blue"
              />
              <KpiCard
                title="Closed loans"
                value={loanAnalytics?.closed_loans != null ? String(loanAnalytics.closed_loans) : '—'}
                subtitle="Fully settled"
                icon={CheckCircleIcon}
                tint="slate"
              />
              <KpiCard
                title="This month collection"
                value={formatInr(loanAnalytics?.this_month_collection)}
                subtitle="Payments in the current calendar month"
                icon={CalendarDaysIcon}
                tint="pink"
              />
              <KpiCard
                title="EMI due this month"
                value={formatInr(loanAnalytics?.emi_due_this_month)}
                subtitle="Unpaid installments due in the current calendar month"
                icon={CalendarDaysIcon}
                tint="cyan"
              />
              <KpiCard
                title="Principal collected (lifetime)"
                value={formatInr(loanAnalytics?.principal_collected_lifetime)}
                subtitle="Principal portion of all recorded repayments"
                icon={BanknotesIcon}
                tint="slate"
              />
              <KpiCard
                title="Interest collected (lifetime)"
                value={formatInr(loanAnalytics?.interest_collected_lifetime)}
                subtitle="Interest portion of repayments (lending profit)"
                icon={ReceiptPercentIcon}
                tint="amber"
              />
              <KpiCard
                title="Overdue EMI (receivable)"
                value={formatInr(loanAnalytics?.overdue_emi_amount)}
                subtitle="Unpaid installments past due date"
                icon={ExclamationTriangleIcon}
                tint="orange"
              />
              <KpiCard
                title="Upcoming EMIs (7 days)"
                value={
                  Array.isArray(loanAnalytics?.upcoming_emis_this_week)
                    ? String(loanAnalytics.upcoming_emis_this_week.length)
                    : '—'
                }
                subtitle="Count of installments due in the next week"
                icon={CalendarDaysIcon}
                tint="violet"
              />
            </div>
          </section>

          <section aria-label="Loan charts" className="grid min-w-0 gap-4 lg:grid-cols-2">
            <div className={`min-w-0 ${DASH_CHART_CARD}`}>
              <h2 className={chartTitle}>Loan: given vs collected vs remaining</h2>
              <p className={chartSub}>Portfolio totals (₹)</p>
              <div className="mt-3 h-[280px] min-h-[280px] min-w-0 w-full">
                <ResponsiveContainer width="100%" height="100%" minWidth={48} minHeight={220}>
                  <BarChart
                    data={[
                      {
                        name: 'Loans',
                        given: Number(loanAnalytics?.given_vs_collected_vs_remaining?.given) || 0,
                        collected: Number(loanAnalytics?.given_vs_collected_vs_remaining?.collected) || 0,
                        remaining: Number(loanAnalytics?.given_vs_collected_vs_remaining?.remaining) || 0,
                      },
                    ]}
                    margin={{ top: 8, right: 8, left: 0, bottom: 0 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                    <XAxis dataKey="name" tick={{ fontSize: 11 }} stroke="#64748b" />
                    <YAxis tick={{ fontSize: 11 }} stroke="#64748b" tickFormatter={(v) => `₹${(v / 1000).toFixed(0)}k`} />
                    <Tooltip formatter={(v) => formatInr(v)} contentStyle={tooltipBox} />
                    <Legend />
                    <Bar dataKey="given" name="Given" fill="#0ea5e9" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="collected" name="Collected" fill="#22c55e" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="remaining" name="Remaining" fill="#f59e0b" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className={`min-w-0 ${DASH_CHART_CARD}`}>
              <h2 className={chartTitle}>Monthly EMI collection</h2>
              <p className={chartSub}>{dashYear} · total paid per month</p>
              <div className="mt-3 h-[280px] min-h-[280px] min-w-0 w-full">
                <ResponsiveContainer width="100%" height="100%" minWidth={48} minHeight={220}>
                  <LineChart
                    data={(loanAnalytics?.collections_by_month ?? []).map((r) => ({
                      month: r.month,
                      amount: Number(r.amount) || 0,
                    }))}
                    margin={{ top: 8, right: 8, left: 0, bottom: 0 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                    <XAxis dataKey="month" tick={{ fontSize: 10 }} stroke="#64748b" angle={-35} textAnchor="end" height={56} />
                    <YAxis tick={{ fontSize: 11 }} stroke="#64748b" tickFormatter={(v) => `₹${(v / 1000).toFixed(0)}k`} />
                    <Tooltip formatter={(v) => formatInr(v)} contentStyle={tooltipBox} />
                    <Line type="monotone" dataKey="amount" name="Collected" stroke="#004080" strokeWidth={2.5} dot />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className={`min-w-0 ${DASH_CHART_CARD}`}>
              <h2 className={chartTitle}>Interest collected by month</h2>
              <p className={chartSub}>{dashYear} · from payment records</p>
              <div className="mt-3 h-[280px] min-h-[280px] min-w-0 w-full">
                <ResponsiveContainer width="100%" height="100%" minWidth={48} minHeight={220}>
                  <LineChart
                    data={(loanAnalytics?.interest_profit_by_month ?? []).map((r) => ({
                      month: r.month,
                      amount: Number(r.amount) || 0,
                    }))}
                    margin={{ top: 8, right: 8, left: 0, bottom: 0 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                    <XAxis dataKey="month" tick={{ fontSize: 10 }} stroke="#64748b" angle={-35} textAnchor="end" height={56} />
                    <YAxis tick={{ fontSize: 11 }} stroke="#64748b" tickFormatter={(v) => `₹${(v / 1000).toFixed(0)}k`} />
                    <Tooltip formatter={(v) => formatInr(v)} contentStyle={tooltipBox} />
                    <Line type="monotone" dataKey="amount" name="Interest" stroke="#a855f7" strokeWidth={2.5} dot />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className={`min-w-0 ${DASH_CHART_CARD}`}>
              <h2 className={chartTitle}>Active vs closed loans</h2>
              <p className={chartSub}>Loan count</p>
              <div className="mt-3 h-[280px] min-h-[280px] min-w-0 w-full">
                {(() => {
                  const pieLoan = (loanAnalytics?.active_vs_closed_pie ?? []).filter((x) => Number(x.value) > 0)
                  return pieLoan.length === 0 ? (
                    <p className="flex h-full items-center justify-center text-sm text-slate-500">No loans yet</p>
                  ) : (
                    <ResponsiveContainer width="100%" height="100%" minWidth={48} minHeight={220}>
                      <PieChart>
                        <Pie
                          data={pieLoan}
                          dataKey="value"
                          nameKey="name"
                          cx="50%"
                          cy="50%"
                          outerRadius={100}
                          label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                        >
                          {pieLoan.map((_, i) => (
                            <Cell key={i} fill={LOAN_CHART_COLORS[i % LOAN_CHART_COLORS.length]} />
                          ))}
                        </Pie>
                        <Tooltip formatter={(v) => v} />
                      </PieChart>
                    </ResponsiveContainer>
                  )
                })()}
              </div>
            </div>
          </section>

          <section aria-label="Your loans table" className={DASH_CHART_CARD}>
            <h2 className={chartTitle}>Your loans</h2>
            <p className={chartSub}>Manage details from the Loans page in the sidebar</p>
            <div className={`mt-4 ${pfTableWrap}`}>
              <table className={`${pfTable} min-w-[640px]`}>
                <thead>
                  <tr>
                    <th className={pfTh}>Borrower</th>
                    <th className={pfThRight}>Principal</th>
                    <th className={pfTh}>Status</th>
                    <th className={pfThRight}>Remaining</th>
                    <th className={pfThRight}>EMI</th>
                  </tr>
                </thead>
                <tbody>
                  {loansList.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="border-b border-sky-100/90 px-3 py-8 text-center text-slate-500 first:pl-4">
                        No loans yet — add lending from the Loans section.
                      </td>
                    </tr>
                  ) : (
                    loansList.map((L) => (
                      <tr key={L.id} className={pfTrHover}>
                        <td className={`${pfTd} font-medium text-slate-800`}>{L.borrower_name}</td>
                        <td className={pfTdRight}>{formatInr(L.loan_amount)}</td>
                        <td className={pfTd}>
                          <span className="rounded-full bg-sky-100/80 px-2 py-0.5 text-xs font-semibold text-sky-900">
                            {L.status}
                          </span>
                        </td>
                        <td className={`${pfTdRight} text-slate-700`}>{formatInr(L.remaining_amount)}</td>
                        <td className={`${pfTdRight} text-slate-600`}>{formatInr(L.emi_amount)}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </section>
        </>
      )}

      <PfMonthYearModal
        open={monthModalOpen}
        onClose={() => setMonthModalOpen(false)}
        year={dashYear}
        month={dashMonth}
        onApply={(y, m) => {
          setDashYear(y)
          setDashMonth(m)
        }}
        minYear={new Date().getFullYear() - 8}
        maxYear={new Date().getFullYear() + 1}
      />
    </div>
  )
}
