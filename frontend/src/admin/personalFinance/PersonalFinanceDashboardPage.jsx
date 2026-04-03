import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useOutletContext } from 'react-router-dom'
import {
  ArrowTrendingDownIcon,
  ArrowTrendingUpIcon,
  BanknotesIcon,
  BuildingLibraryIcon,
  CalendarDaysIcon,
  ChartPieIcon,
  CheckCircleIcon,
  CreditCardIcon,
  ExclamationTriangleIcon,
  ReceiptPercentIcon,
  ScaleIcon,
  TruckIcon,
  UsersIcon,
} from '@heroicons/react/24/solid'
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ComposedChart,
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
  listFinanceAccounts,
  listFinanceLoans,
  setPfToken,
} from './api.js'
import PfMonthYearModal from './PfMonthYearModal.jsx'
import PfSegmentedControl from './PfSegmentedControl.jsx'
import { formatInr } from './pfFormat.js'
import {
  pfChartCard,
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

const chartTitle = 'text-base font-bold text-sky-950 dark:text-[var(--pf-text)]'
const chartSub = 'mt-0.5 text-xs text-slate-500 dark:text-[var(--pf-text-muted)]'

const DASH_TABS = [
  { id: 'overview', label: 'Overview' },
  { id: 'cashflow', label: 'Cashflow' },
  { id: 'credit', label: 'Credit & loans' },
]

function buildDashboardMonthOptions(count = 48) {
  const out = []
  const d = new Date()
  d.setDate(1)
  for (let i = 0; i < count; i++) {
    const y = d.getFullYear()
    const m = d.getMonth() + 1
    out.push({
      y,
      m,
      value: `${y}-${String(m).padStart(2, '0')}`,
      label: d.toLocaleString(undefined, { month: 'short', year: 'numeric' }),
    })
    d.setMonth(d.getMonth() - 1)
  }
  return out
}

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
  const [nwHorizon, setNwHorizon] = useState(12)
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

  const monthOptions = useMemo(() => buildDashboardMonthOptions(48), [])
  const accountQuery = bankFilter === '' ? undefined : bankFilter
  const dashMonthValue = `${dashYear}-${String(dashMonth).padStart(2, '0')}`
  const dashMonthLabel = useMemo(
    () => new Date(dashYear, dashMonth - 1, 1).toLocaleString(undefined, { month: 'long', year: 'numeric' }),
    [dashYear, dashMonth],
  )

  const tooltipBox = useMemo(
    () => ({
      borderRadius: 12,
      border: isDark ? '1px solid #475569' : '1px solid #bae6fd',
      background: isDark ? '#1e293b' : '#ffffff',
      color: isDark ? '#e2e8f0' : '#0f172a',
    }),
    [isDark],
  )

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

  const pieData = useMemo(
    () =>
      (expenseCats || []).map((row) => ({
        name: row.category || 'Other',
        value: Number(row.total) || 0,
      })),
    [expenseCats],
  )

  const barIeData = useMemo(
    () =>
      (incomeExpense || []).map((row) => ({
        month: row.month,
        income: Number(row.income) || 0,
        expense: Number(row.expense) || 0,
      })),
    [incomeExpense],
  )

  const networthData = useMemo(
    () =>
      (networth || []).map((row) => ({
        month: row.month,
        netWorth: Number(row.net_worth) || 0,
      })),
    [networth],
  )

  const networthDisplayData = useMemo(() => {
    const take = nwHorizon === 6 ? 6 : nwHorizon === 36 ? 36 : 12
    if (networthData.length === 0) return []
    return networthData.slice(-Math.min(take, networthData.length))
  }, [networthData, nwHorizon])

  const incomeM = Number(summary?.total_income) || 0
  const expenseM = Number(summary?.total_expense) || 0
  const emiM = Number(cashflowMonth?.emi_expense_month) || 0
  const savingsRateFormula = incomeM > 0.01 ? (incomeM - expenseM - emiM) / incomeM : null

  const cashBankTotal =
    (Number(summary?.balance_cash ?? summary?.cash_balance) || 0) + (Number(summary?.balance_bank) || 0)
  const totalAssetsBook =
    cashBankTotal +
    (Number(summary?.total_investment) || 0) +
    (Number(summary?.total_assets) || 0) +
    (Number(summary?.loan_receivable) || 0)

  const compositionPieData = useMemo(() => {
    const cash = Number(summary?.balance_cash ?? summary?.cash_balance) || 0
    const bank = Number(summary?.balance_bank) || 0
    const inv = Number(summary?.total_investment) || 0
    const fixed = Number(summary?.total_assets) || 0
    const lent = Number(summary?.loan_receivable ?? summary?.loan_outstanding) || 0
    return [
      { name: 'Cash', value: cash },
      { name: 'Bank', value: bank },
      { name: 'Investments', value: inv },
      { name: 'Fixed assets', value: fixed },
      { name: 'Loans given', value: lent },
    ].filter((x) => x.value > 0.01)
  }, [summary])

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
    const cashOnly = Number(summary?.balance_cash ?? summary?.cash_balance) || 0
    const liq = exp > 0.01 ? cashOnly / exp : null
    const pct = (x) => (x == null || Number.isNaN(x) ? '—' : `${(x * 100).toFixed(1)}%`)
    return [
      { label: 'Savings rate', value: pct(savingsRate), hint: '(Income − expense − EMI) / income' },
      { label: 'Debt to income', value: pct(debtToInc), hint: 'EMI / income' },
      { label: 'Credit utilization', value: pct(util), hint: 'Used / limit' },
      { label: 'Investment / assets', value: pct(invRatio), hint: 'Investments / total assets' },
      { label: 'Liquidity', value: pct(liq), hint: 'Cash / monthly expense' },
    ]
  }, [incomeM, expenseM, emiM, creditCardsSummary, totalAssetsBook, summary])

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

  const overviewAssetsLiabData = useMemo(() => {
    const liab = Number(summary?.total_liabilities) || 0
    return networthDisplayData.map((r) => ({
      month: r.month,
      assets: r.netWorth + liab,
      liabilities: liab,
      netWorth: r.netWorth,
    }))
  }, [networthDisplayData, summary])

  const monthlyFinanceBarData = useMemo(() => {
    let prev = null
    return (incomeExpense || []).map((row) => {
      const nwRow = networthData.find((n) => n.month === row.month)
      const nw = nwRow ? nwRow.netWorth : null
      let nwChange = 0
      if (prev != null && nw != null) nwChange = nw - prev
      prev = nw
      return {
        month: row.month,
        income: Number(row.income) || 0,
        expense: Number(row.expense) || 0,
        emi: row.month === dashMonthValue ? emiM : 0,
        savings: (Number(row.income) || 0) - (Number(row.expense) || 0),
        nwChange,
      }
    })
  }, [incomeExpense, networthData, dashMonthValue, emiM])

  const loanExposurePie = useMemo(() => {
    const rem = Number(loanAnalytics?.total_remaining_receivable) || 0
    const od = Number(loanAnalytics?.overdue_emi_amount) || 0
    const cur = Math.max(0, rem - od)
    return [
      { name: 'Current receivable', value: cur },
      { name: 'Overdue EMI', value: od },
    ].filter((x) => x.value > 0.01)
  }, [loanAnalytics])

  const COMPOSITION_COLORS = isDark
    ? ['#38bdf8', '#4ade80', '#a78bfa', '#fbbf24', '#f472b6']
    : ['#0369a1', '#059669', '#7c3aed', '#d97706', '#db2777']

  const invBarData = useMemo(
    () =>
      (invAlloc || []).map((row) => ({
        type: row.type || 'Other',
        value: Number(row.value) || 0,
      })),
    [invAlloc],
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
    <div className="mx-auto max-w-[1600px] space-y-4 md:space-y-6 lg:space-y-8">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2">
          <h1 className="text-xl font-bold tracking-tight text-slate-900 dark:text-slate-100 sm:text-2xl md:text-3xl">Dashboard</h1>
          {loading ? <span className="text-xs text-slate-400 dark:text-slate-500 md:text-sm">Updating…</span> : null}
        </div>
        <div className="flex flex-wrap items-center justify-end gap-2">
          {summary ? (
            <div
              className="mr-auto w-full rounded-2xl border border-slate-200/90 bg-white px-3 py-2 shadow-sm sm:mr-0 sm:w-auto sm:max-w-[13rem] dark:border-slate-600 dark:bg-slate-800/90"
              title="Blended score: savings rate, credit utilization, EMI vs income, net worth change, cash cushion vs spending"
            >
              <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                Financial health
              </p>
              <p className="font-mono text-xl font-bold tabular-nums text-slate-900 dark:text-slate-100">
                {financialHealth.score}
                <span className="text-sm font-normal text-slate-500 dark:text-slate-400"> / 100</span>
              </p>
              <p className="text-xs text-slate-600 dark:text-slate-300">{financialHealth.label}</p>
            </div>
          ) : null}
          <button
            type="button"
            onClick={() => setMonthModalOpen(true)}
            className={`${pfSelectCompact} min-w-[6.5rem] text-left font-bold text-slate-900 transition hover:bg-slate-50 active:scale-[0.97] dark:text-slate-100`}
          >
            {new Date(dashYear, dashMonth - 1, 1).toLocaleString(undefined, { month: 'short', year: 'numeric' })}
          </button>
          <select
            aria-label="Month (quick)"
            className={`${pfSelectCompact} hidden max-w-[9rem] sm:block`}
            value={dashMonthValue}
            onChange={(e) => {
              const v = e.target.value
              const [y, m] = v.split('-').map(Number)
              if (y && m) {
                setDashYear(y)
                setDashMonth(m)
              }
            }}
          >
            {monthOptions.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
          <label htmlFor="pf-bank-filter" className="sr-only">
            Bank or account
          </label>
          <select
            id="pf-bank-filter"
            className={`${pfSelectCompact} min-w-[6.5rem] flex-[1.2] sm:max-w-[12rem]`}
            value={bankFilter}
            onChange={(e) => setBankFilter(e.target.value)}
          >
            <option value="">All banks</option>
            {accounts.map((a) => (
              <option key={a.id} value={String(a.id)}>
                {a.account_name}
              </option>
            ))}
          </select>
        </div>
      </div>

      {bankFilter ? (
        <p className="hidden rounded-2xl border border-sky-200 bg-sky-50 px-4 py-2 text-sm text-sky-900 md:block">
          Filter: <span className="font-semibold">{filterBankName || 'Selected account'}</span>. Income, expense, and
          recent activity use this account and <span className="font-semibold">{dashMonthLabel}</span> where applicable.
        </p>
      ) : null}

      {showUnallocatedHint ? (
        <div className="hidden rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950 md:block">
          <p className="font-semibold text-amber-900">Cash total may look low vs income/expense</p>
          <p className="mt-1 text-amber-900/90">
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
            not linked to any bank account. Link transactions to accounts in Income/Expenses.
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
        <div className="grid grid-cols-2 gap-3 xl:grid-cols-4" aria-hidden>
          {Array.from({ length: 6 }).map((_, i) => (
            <div
              key={i}
              className={`animate-pulse rounded-2xl bg-slate-200/70 ${i === 0 ? 'col-span-2 h-32 xl:col-span-1' : 'h-28'}`}
            />
          ))}
        </div>
      ) : null}
      <section aria-label="Financial summary" className={loading && !summary ? 'hidden' : ''}>
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
          <KpiCard
            wrapperClassName="col-span-2 xl:col-span-2"
            title="Net worth"
            value={formatInr(summary?.net_worth)}
            subtitle={bankFilter ? 'Selected account lens where applicable' : 'Assets + receivables − liabilities'}
            trendLabel={netWorthMomLabel || undefined}
            icon={ScaleIcon}
            iconTintClass="bg-violet-100 text-violet-700 md:bg-white/20 md:text-white"
            gradientClass="md:bg-gradient-to-br md:from-[#5b21b6] md:to-[#4c1d95]"
          />
          <KpiCard
            title="Cash balance"
            value={formatInr(cashBankTotal)}
            subtitle="Cash + bank accounts"
            icon={BanknotesIcon}
            iconTintClass="bg-sky-100 text-sky-700 md:bg-white/20 md:text-white"
            gradientClass="md:bg-gradient-to-br md:from-slate-600 md:to-slate-800"
          />
          <KpiCard
            title="Investments"
            value={formatInr(summary?.total_investment)}
            subtitle="Funds, FDs, equity (book)"
            icon={ChartPieIcon}
            iconTintClass="bg-cyan-100 text-cyan-700 md:bg-white/20 md:text-white"
            gradientClass="md:bg-gradient-to-br md:from-sky-700 md:to-blue-800"
          />
          <KpiCard
            title="Total liabilities"
            value={formatInr(summary?.total_liabilities)}
            subtitle="Loans & cards outstanding"
            icon={ReceiptPercentIcon}
            iconTintClass="bg-slate-200 text-slate-800 md:bg-white/20 md:text-white"
            gradientClass="md:bg-gradient-to-br md:from-rose-900/90 md:to-slate-900"
          />
          <KpiCard
            title="Credit utilization"
            value={creditCardsSummary?.utilization_pct != null ? `${creditCardsSummary.utilization_pct}%` : '—'}
            subtitle={
              creditCardsSummary?.total_credit_limit
                ? `of ${formatInr(creditCardsSummary.total_credit_limit)} limit`
                : 'Add cards to track'
            }
            icon={CreditCardIcon}
            iconTintClass="bg-amber-100 text-amber-800 md:bg-white/20 md:text-white"
            gradientClass="md:bg-gradient-to-br md:from-amber-700 md:to-orange-700"
          />
          <KpiCard
            title="Savings rate"
            value={
              incomeM > 0.01 && savingsRateFormula != null ? `${(savingsRateFormula * 100).toFixed(1)}%` : '—'
            }
            subtitle="(Income − expense − EMI) / income"
            icon={ArrowTrendingUpIcon}
            iconTintClass="bg-emerald-100 text-emerald-800 md:bg-white/20 md:text-white"
            gradientClass="md:bg-gradient-to-br md:from-emerald-800 md:to-teal-700"
          />
        </div>
      </section>

      <section
        aria-label="Key ratios"
        className={`grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-5 ${loading && !summary ? 'hidden' : ''}`}
      >
        {ratioCards.map((r) => (
          <div
            key={r.label}
            className="rounded-xl border border-slate-200/80 bg-white px-3 py-2.5 dark:border-slate-600 dark:bg-slate-800/80"
          >
            <p className="text-[11px] font-medium text-slate-500 dark:text-slate-400">{r.label}</p>
            <p className="mt-0.5 font-mono text-base font-bold tabular-nums text-slate-900 dark:text-slate-100">
              {r.value}
            </p>
            <p className="mt-0.5 text-[10px] leading-snug text-slate-400 dark:text-slate-500">{r.hint}</p>
          </div>
        ))}
      </section>

      <section className={`grid min-w-0 gap-4 lg:grid-cols-2 ${loading && !summary ? 'hidden' : ''}`}>
        <div className={`min-w-0 ${pfChartCard}`}>
          <h2 className={chartTitle}>Net worth composition</h2>
          <p className={chartSub}>Cash, bank, investments, fixed assets, and loans you lent</p>
          <div className="mt-3 h-[280px] min-h-[280px] min-w-0 w-full">
            {compositionPieData.length === 0 ? (
              <p className="flex h-full items-center justify-center text-sm text-slate-500 dark:text-slate-400">
                No balances to show yet
              </p>
            ) : (
              <ResponsiveContainer width="100%" height="100%" minWidth={48} minHeight={220}>
                <PieChart>
                  <Pie
                    data={compositionPieData}
                    dataKey="value"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    innerRadius={56}
                    outerRadius={92}
                    paddingAngle={2}
                    stroke={isDark ? '#1e293b' : '#fff'}
                    strokeWidth={2}
                    label={(props) => {
                      const name = props?.name != null ? String(props.name) : ''
                      const pct = typeof props?.percent === 'number' ? props.percent : 0
                      return `${name} ${(pct * 100).toFixed(0)}%`
                    }}
                  >
                    {compositionPieData.map((_, i) => (
                      <Cell key={i} fill={COMPOSITION_COLORS[i % COMPOSITION_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(v) => formatInr(v)} contentStyle={tooltipBox} />
                  <Legend verticalAlign="bottom" height={28} />
                </PieChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>
        <div className={`min-w-0 ${pfChartCard}`}>
          <h2 className={chartTitle}>Assets, liabilities & net worth</h2>
          <p className={chartSub}>
            Liabilities use today&apos;s balance; bars follow the net worth window ({nwHorizon === 6 ? '6' : nwHorizon === 36 ? '36' : '12'}{' '}
            months max).
          </p>
          <div className="mt-3 h-[280px] min-h-[280px] min-w-0 w-full">
            {overviewAssetsLiabData.length === 0 ? (
              <p className="flex h-full items-center justify-center text-sm text-slate-500 dark:text-slate-400">
                No trend data for this year yet
              </p>
            ) : (
              <ResponsiveContainer width="100%" height="100%" minWidth={48} minHeight={220}>
                <BarChart data={overviewAssetsLiabData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke={isDark ? '#334155' : '#e2e8f0'} />
                  <XAxis
                    dataKey="month"
                    tick={{ fontSize: 10, fill: isDark ? '#94a3b8' : '#64748b' }}
                    stroke={isDark ? '#94a3b8' : '#64748b'}
                    angle={-35}
                    textAnchor="end"
                    height={56}
                  />
                  <YAxis
                    tick={{ fontSize: 11, fill: isDark ? '#94a3b8' : '#64748b' }}
                    stroke={isDark ? '#94a3b8' : '#64748b'}
                    tickFormatter={(v) => `₹${(v / 1000).toFixed(0)}k`}
                  />
                  <Tooltip formatter={(v) => formatInr(v)} contentStyle={tooltipBox} />
                  <Legend />
                  <Bar dataKey="assets" name="Assets (book)" fill="#0ea5e9" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="liabilities" name="Liabilities" fill="#f97316" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="netWorth" name="Net worth" fill="#6366f1" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>
      </section>

      <div
        className={`flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between ${loading && !summary ? 'hidden' : ''}`}
      >
        <p className={`${chartSub} !mt-0`}>Net worth & allocation · {dashYear}</p>
        <div className="flex flex-wrap gap-1 rounded-xl bg-slate-100 p-1 dark:bg-slate-800/90">
          {[
            { m: 6, label: '6 months' },
            { m: 12, label: '1 year' },
            { m: 36, label: '3 years' },
          ].map(({ m, label }) => (
            <button
              key={m}
              type="button"
              onClick={() => setNwHorizon(m)}
              className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
                nwHorizon === m
                  ? 'bg-white text-slate-900 shadow dark:bg-slate-700 dark:text-slate-100'
                  : 'text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-200'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {dashStage >= 1 ? (
        <Suspense
          fallback={
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2" aria-hidden>
              {[1, 2, 3, 4].map((i) => (
                <div
                  key={i}
                  className={`${pfChartCard} h-[300px] animate-pulse bg-slate-200/50 dark:bg-slate-700/40`}
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
            dashYear={dashYear}
            dashMonthLabel={dashMonthLabel}
            filterBankName={filterBankName}
            bankFilter={bankFilter}
            pfChartCard={pfChartCard}
            chartTitleCls={chartTitle}
            chartSubCls={chartSub}
          />
        </Suspense>
      ) : null}

      {dashStage >= 2 ? (
        <>
          <section className={pfChartCard} aria-label="Monthly financial summary">
            <h2 className={chartTitle}>Monthly financial summary</h2>
            <p className={chartSub}>
              Income, expense, EMI ({dashMonthLabel} only), savings, and month-on-month net worth change · {dashYear}
            </p>
            <div className="mt-3 h-[320px] min-h-[320px] min-w-0 w-full">
              {monthlyFinanceBarData.length === 0 ? (
                <p className="flex h-full items-center justify-center text-sm text-slate-500 dark:text-slate-400">
                  No monthly data yet
                </p>
              ) : (
                <ResponsiveContainer width="100%" height="100%" minWidth={48} minHeight={260}>
                  <ComposedChart data={monthlyFinanceBarData} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke={isDark ? '#334155' : '#e2e8f0'} />
                    <XAxis
                      dataKey="month"
                      tick={{ fontSize: 9, fill: isDark ? '#94a3b8' : '#64748b' }}
                      stroke={isDark ? '#94a3b8' : '#64748b'}
                      angle={-35}
                      textAnchor="end"
                      height={52}
                    />
                    <YAxis
                      yAxisId="left"
                      tick={{ fontSize: 10, fill: isDark ? '#94a3b8' : '#64748b' }}
                      stroke={isDark ? '#94a3b8' : '#64748b'}
                      tickFormatter={(v) => `₹${(v / 1000).toFixed(0)}k`}
                    />
                    <YAxis
                      yAxisId="right"
                      orientation="right"
                      tick={{ fontSize: 10, fill: isDark ? '#94a3b8' : '#64748b' }}
                      stroke={isDark ? '#94a3b8' : '#64748b'}
                      tickFormatter={(v) => `₹${(v / 1000).toFixed(0)}k`}
                    />
                    <Tooltip formatter={(v) => formatInr(v)} contentStyle={tooltipBox} />
                    <Legend verticalAlign="bottom" height={36} />
                    <Bar yAxisId="left" dataKey="income" name="Income" fill="#22c55e" maxBarSize={28} radius={[4, 4, 0, 0]} />
                    <Bar yAxisId="left" dataKey="expense" name="Expense" fill="#ea580c" maxBarSize={28} radius={[4, 4, 0, 0]} />
                    <Bar yAxisId="left" dataKey="emi" name="EMI" fill="#db2777" maxBarSize={28} radius={[4, 4, 0, 0]} />
                    <Bar yAxisId="left" dataKey="savings" name="Savings" fill="#2563eb" maxBarSize={28} radius={[4, 4, 0, 0]} />
                    <Line
                      yAxisId="right"
                      type="monotone"
                      dataKey="nwChange"
                      name="NW Δ"
                      stroke="#a855f7"
                      strokeWidth={2}
                      dot={{ r: 2 }}
                    />
                  </ComposedChart>
                </ResponsiveContainer>
              )}
            </div>
          </section>

          {insightsList.length > 0 ? (
            <section
              className={`${pfChartCard} border-sky-200/60 dark:border-sky-800/50`}
              aria-label="Insights"
            >
              <h2 className={chartTitle}>Insights</h2>
              <p className={chartSub}>Rule-based highlights from your current numbers</p>
              <ul className="mt-3 list-inside list-disc space-y-1.5 text-sm text-slate-700 dark:text-slate-300">
                {insightsList.map((line) => (
                  <li key={line}>{line}</li>
                ))}
              </ul>
            </section>
          ) : null}

          {upcomingPaymentsRows.length > 0 ? (
            <section className={pfChartCard} aria-label="Upcoming payments">
              <h2 className={chartTitle}>Upcoming payments</h2>
              <p className={chartSub}>Credit card and EMI obligations with due dates</p>
              <div className={`mt-3 ${pfTableWrap}`}>
                <table className={`${pfTable} min-w-[480px] text-sm`}>
                  <thead>
                    <tr>
                      <th className={pfTh}>Type</th>
                      <th className={pfTh}>Name</th>
                      <th className={pfTh}>Due</th>
                      <th className={pfThRight}>Amount</th>
                    </tr>
                  </thead>
                  <tbody>
                    {upcomingPaymentsRows.map((row, idx) => (
                      <tr key={`${row.type}-${row.name}-${row.due}-${idx}`} className={pfTrHover}>
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

          <section aria-label="Recent transactions" className={pfChartCard}>
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
                <div className={`mt-4 hidden md:block ${pfTableWrap}`}>
                  <table className={`${pfTable} min-w-[520px]`}>
                    <thead>
                      <tr>
                        <th className={pfTh}>Type</th>
                        <th className={pfTh}>Date</th>
                        <th className={pfTh}>Category</th>
                        <th className={pfThRight}>Amount</th>
                      </tr>
                    </thead>
                    <tbody>
                      {summary.recent_transactions.map((tx) => (
                        <tr key={`${tx.kind}-${tx.id}`} className={pfTrHover}>
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
        </>
      ) : null}
        </>
      )}

      {activeTab === 'cashflow' && (
        <>
          <section aria-label="Cashflow summary KPIs" className="space-y-3">
            <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
              <KpiCard
                title={`Income · ${dashMonthLabel}`}
                value={formatInr(summary?.total_income)}
                subtitle={bankFilter ? filterBankName || 'Account' : 'Recorded in period'}
                icon={ArrowTrendingUpIcon}
                gradientClass="md:bg-gradient-to-br md:from-emerald-700 md:to-green-600"
              />
              <KpiCard
                title={`Expense · ${dashMonthLabel}`}
                value={formatInr(summary?.total_expense)}
                subtitle="All expenses in period"
                icon={CreditCardIcon}
                gradientClass="md:bg-gradient-to-br md:from-rose-700 md:to-red-600"
              />
              <KpiCard
                title="EMI"
                value={formatInr(cashflowMonth?.emi_expense_month)}
                subtitle="EMI-tagged expense this month"
                icon={ReceiptPercentIcon}
                gradientClass="md:bg-gradient-to-br md:from-orange-600 md:to-amber-600"
              />
              <KpiCard
                title="Savings"
                value={formatInr(incomeM - expenseM)}
                subtitle="Income − expense (before EMI carve-out in rate)"
                icon={BanknotesIcon}
                gradientClass="md:bg-gradient-to-br md:from-slate-600 md:to-slate-800"
              />
              <KpiCard
                title="Savings rate"
                value={
                  incomeM > 0.01 && savingsRateFormula != null
                    ? `${(savingsRateFormula * 100).toFixed(1)}%`
                    : '—'
                }
                subtitle="(Income − expense − EMI) / income"
                icon={ChartPieIcon}
                gradientClass="md:bg-gradient-to-br md:from-indigo-700 md:to-violet-700"
              />
              <KpiCard
                title="Expense ratio"
                value={
                  incomeM > 0.01 ? `${((expenseM / incomeM) * 100).toFixed(1)}%` : '—'
                }
                subtitle="Expense / income"
                icon={ScaleIcon}
                gradientClass="md:bg-gradient-to-br md:from-sky-700 md:to-blue-800"
              />
            </div>
          </section>

          {dashStage >= 1 ? (
            <Suspense
              fallback={
                <div className={`${pfChartCard} h-[280px] animate-pulse bg-slate-200/50 dark:bg-slate-700/40`} aria-hidden />
              }
            >
              <LazyDashboardCharts
                chartMode="cashflow"
                isDark={isDark}
                barIeData={barIeData}
                pieData={pieData}
                networthData={networthData}
                invBarData={invBarData}
                cashflowTrendData={cashflowTrendData}
                dashYear={dashYear}
                dashMonthLabel={dashMonthLabel}
                filterBankName={filterBankName}
                bankFilter={bankFilter}
                pfChartCard={pfChartCard}
                chartTitleCls={chartTitle}
                chartSubCls={chartSub}
              />
            </Suspense>
          ) : null}

          <section className={pfChartCard} aria-label="Expense by account">
            <h2 className={chartTitle}>Expense by account</h2>
            <p className={chartSub}>
              Splitting spend by linked bank account needs a dedicated aggregation endpoint; for now, use the category pie
              above and assign accounts on the Expenses page.
            </p>
          </section>

          <section aria-label="Month cashflow snapshot" className="space-y-4">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <KpiCard
                title={`Expense · ${dashMonthLabel}`}
                value={formatInr(cashflowMonth?.total_expense_month)}
                subtitle="All recorded expenses in this period"
                icon={CreditCardIcon}
                gradientClass="md:bg-gradient-to-br md:from-[#dc2626] md:to-[#ef4444]"
              />
              <KpiCard
                title="CC expenses (swipes)"
                value={formatInr(cashflowMonth?.credit_card_expense_month)}
                subtitle={'P&L on swipe date — bank not debited yet'}
                icon={CreditCardIcon}
                gradientClass="md:bg-gradient-to-br md:from-fuchsia-600 md:to-purple-700"
              />
              <KpiCard
                title="CC bill payments"
                value={formatInr(cashflowMonth?.credit_card_bill_payments_month)}
                subtitle="Cash paid to card issuer this month"
                icon={BanknotesIcon}
                gradientClass="md:bg-gradient-to-br md:from-violet-600 md:to-indigo-800"
              />
              <KpiCard
                title="External deposits"
                value={formatInr(cashflowMonth?.external_deposit_month)}
                subtitle="Money into accounts from outside (ledger: EXTERNAL_DEPOSIT)"
                icon={ArrowTrendingUpIcon}
                gradientClass="md:bg-gradient-to-br md:from-teal-500 md:to-cyan-600"
              />
              <KpiCard
                title="External withdrawals"
                value={formatInr(cashflowMonth?.external_withdrawal_month)}
                subtitle="Money out to outside world (ledger: EXTERNAL_WITHDRAWAL)"
                icon={ArrowTrendingDownIcon}
                gradientClass="md:bg-gradient-to-br md:from-orange-500 md:to-red-600"
              />
              <KpiCard
                title="Food & groceries"
                value={formatInr(cashflowMonth?.food_expense)}
                subtitle="Category total"
                icon={ChartPieIcon}
                gradientClass="md:bg-gradient-to-br md:from-lime-500 md:to-green-600"
              />
              <KpiCard
                title="EMI expenses"
                value={formatInr(cashflowMonth?.emi_expense_month)}
                subtitle="EMI – Loans + Credit Card + EMI-like labels"
                icon={ReceiptPercentIcon}
                gradientClass="md:bg-gradient-to-br md:from-red-500 md:to-rose-600"
              />
              <KpiCard
                title="Dairy (farm + feed)"
                value={formatInr(cashflowMonth?.dairy_expense)}
                subtitle="Dairy Farm + Feed categories"
                icon={TruckIcon}
                gradientClass="md:bg-gradient-to-br md:from-emerald-600 md:to-teal-700"
              />
              <KpiCard
                title="Pending EMIs (receivable)"
                value={formatInr(cashflowMonth?.pending_emis_receivable)}
                subtitle="Unpaid installments you are owed (loans you gave)"
                icon={CalendarDaysIcon}
                gradientClass="md:bg-gradient-to-br md:from-amber-500 md:to-yellow-600"
              />
              <KpiCard
                title="Cash-style accounts"
                value={formatInr(cashflowMonth?.cash_balance)}
                subtitle="Accounts named cash / wallet / petty (heuristic)"
                icon={BanknotesIcon}
                gradientClass="md:bg-gradient-to-br md:from-green-600 md:to-emerald-700"
              />
              <KpiCard
                title="Bank-style accounts"
                value={formatInr(cashflowMonth?.bank_balance)}
                subtitle="Other account types (remaining balance sum)"
                icon={BuildingLibraryIcon}
                gradientClass="md:bg-gradient-to-br md:from-sky-600 md:to-blue-700"
              />
            </div>
          </section>

          <section aria-label="Month cashflow charts" className="grid min-w-0 gap-4 lg:grid-cols-2">
            <div className={`min-w-0 ${pfChartCard}`}>
              <h2 className={chartTitle}>{dashMonthLabel} · amounts at a glance</h2>
              <p className={chartSub}>Same buckets as the cards (₹)</p>
              <div className="mt-3 h-[320px] min-h-[320px] min-w-0 w-full">
                {cashflowBarData.length === 0 || cashflowBarData.every((d) => d.value === 0) ? (
                  <p className="flex h-full items-center justify-center text-sm text-slate-500">
                    No expense data for {dashMonthLabel} yet
                  </p>
                ) : (
                  <ResponsiveContainer width="100%" height="100%" minWidth={48} minHeight={240}>
                    <BarChart
                      data={cashflowBarData}
                      layout="vertical"
                      margin={{ top: 8, right: 16, left: 8, bottom: 0 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" stroke={isDark ? '#334155' : '#e2e8f0'} />
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
                      <Bar dataKey="value" name="Amount" fill="#004080" radius={[0, 4, 4, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </div>
            </div>

            <div className={`min-w-0 ${pfChartCard}`}>
              <h2 className={chartTitle}>Month breakdown · table</h2>
              <p className={chartSub}>Quick copy-friendly totals</p>
              <div className={`mt-3 ${pfTableWrap}`}>
                <table className={`${pfTable} min-w-[280px]`}>
                  <thead>
                    <tr>
                      <th className={pfTh}>Metric</th>
                      <th className={pfThRight}>Amount</th>
                    </tr>
                  </thead>
                  <tbody>
                    {cashflowTableRows.map((row) => (
                      <tr key={row.label} className={pfTrHover}>
                        <td className={`${pfTd} text-slate-700`}>{row.label}</td>
                        <td className={pfTdRight}>{formatInr(row.value)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </section>

          <section className={pfChartCard} aria-label="Monthly cashflow table">
            <h2 className={chartTitle}>Monthly summary · {dashYear}</h2>
            <p className={chartSub}>Income, expense, EMI ({dashMonthLabel} row only), savings</p>
            <div className={`mt-3 ${pfTableWrap}`}>
              <table className={`${pfTable} min-w-[520px] text-sm`}>
                <thead>
                  <tr>
                    <th className={pfTh}>Month</th>
                    <th className={pfThRight}>Income</th>
                    <th className={pfThRight}>Expense</th>
                    <th className={pfThRight}>EMI</th>
                    <th className={pfThRight}>Savings</th>
                  </tr>
                </thead>
                <tbody>
                  {cashflowMonthlyTableRows.map((row) => (
                    <tr key={row.month} className={pfTrHover}>
                      <td className={`${pfTd} font-medium tabular-nums`}>{row.month}</td>
                      <td className={pfTdRight}>{formatInr(row.income)}</td>
                      <td className={pfTdRight}>{formatInr(row.expense)}</td>
                      <td className={pfTdRight}>{formatInr(row.emi)}</td>
                      <td className={pfTdRight}>{formatInr(row.savings)}</td>
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
                gradientClass="md:bg-gradient-to-br md:from-slate-700 md:to-slate-900"
              />
              <KpiCard
                title="Credit used"
                value={formatInr(creditCardsSummary?.used_limit)}
                subtitle="Billed + unbilled"
                icon={CreditCardIcon}
                gradientClass="md:bg-gradient-to-br md:from-fuchsia-700 md:to-purple-800"
              />
              <KpiCard
                title="Utilization"
                value={creditCardsSummary?.utilization_pct != null ? `${creditCardsSummary.utilization_pct}%` : '—'}
                subtitle={creditCardsSummary?.credit_health ?? '—'}
                icon={ChartPieIcon}
                gradientClass="md:bg-gradient-to-br md:from-amber-600 md:to-orange-600"
              />
              <KpiCard
                title="CC overdue"
                value={formatInr(creditCardsSummary?.overdue_amount)}
                subtitle="Statements past due"
                icon={ExclamationTriangleIcon}
                gradientClass="md:bg-gradient-to-br md:from-rose-700 md:to-red-800"
              />
              <KpiCard
                title="Loan given (principal)"
                value={formatInr(loanAnalytics?.total_loan_given)}
                subtitle="Money you lent out"
                icon={BanknotesIcon}
                gradientClass="md:bg-gradient-to-br md:from-sky-600 md:to-blue-700"
              />
              <KpiCard
                title="Loan collected"
                value={formatInr(loanAnalytics?.total_collected)}
                subtitle="All-time repayments"
                icon={ArrowTrendingUpIcon}
                gradientClass="md:bg-gradient-to-br md:from-green-600 md:to-emerald-700"
              />
              <KpiCard
                title="Loan outstanding"
                value={formatInr(loanAnalytics?.total_remaining_receivable)}
                subtitle="Still to collect"
                icon={ScaleIcon}
                gradientClass="md:bg-gradient-to-br md:from-cyan-600 md:to-teal-700"
              />
              <KpiCard
                title="EMI due (month)"
                value={formatInr(loanAnalytics?.emi_due_this_month)}
                subtitle="Unpaid EMIs due this calendar month"
                icon={CalendarDaysIcon}
                gradientClass="md:bg-gradient-to-br md:from-orange-600 md:to-amber-600"
              />
            </div>
          </section>

          <section className={pfChartCard} aria-label="Credit utilization trend">
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
              className={`${pfChartCard} border-sky-200/80 dark:border-slate-600`}
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
              className={`${pfChartCard} border-fuchsia-200/80 dark:border-fuchsia-900/40`}
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
            <section className={pfChartCard} aria-label="Next credit card statement">
              <h2 className={chartTitle}>Next statement (earliest due)</h2>
              <p className={chartSub}>
                {creditCardsSummary.current_bill.card_name} · period {creditCardsSummary.current_bill.bill_period} · due{' '}
                {creditCardsSummary.current_bill.due_date} · remaining {formatInr(creditCardsSummary.current_bill.remaining)}{' '}
                of {formatInr(creditCardsSummary.current_bill.total_amount)}
              </p>
            </section>
          ) : null}

          {cashflowMonth != null ? (
            <section className={pfChartCard} aria-label="EMI receivable vs expense">
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
            <section className={pfChartCard} aria-label="Upcoming EMIs">
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

          <section aria-label="Loan exposure mix" className={pfChartCard}>
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
                gradientClass="md:bg-gradient-to-br md:from-sky-600 md:to-blue-700"
              />
              <KpiCard
                title="Interest profit (book)"
                value={formatInr(loanAnalytics?.total_interest_profit)}
                subtitle="Expected interest on scheduled loans"
                icon={ReceiptPercentIcon}
                gradientClass="md:bg-gradient-to-br md:from-amber-500 md:to-orange-600"
              />
              <KpiCard
                title="Total expected"
                value={formatInr(loanAnalytics?.total_amount_expected)}
                subtitle="Principal + interest (book)"
                icon={ScaleIcon}
                gradientClass="md:bg-gradient-to-br md:from-indigo-600 md:to-violet-700"
              />
              <KpiCard
                title="Total collected"
                value={formatInr(loanAnalytics?.total_collected)}
                subtitle="All EMI / payments recorded"
                icon={ArrowTrendingUpIcon}
                gradientClass="md:bg-gradient-to-br md:from-green-600 md:to-emerald-700"
              />
              <KpiCard
                title="Remaining receivable"
                value={formatInr(loanAnalytics?.total_remaining_receivable)}
                subtitle="Unpaid EMIs or latest balance"
                icon={ChartPieIcon}
                gradientClass="md:bg-gradient-to-br md:from-cyan-600 md:to-teal-700"
              />
              <KpiCard
                title="Active loans"
                value={loanAnalytics?.active_loans != null ? String(loanAnalytics.active_loans) : '—'}
                subtitle="Not closed"
                icon={UsersIcon}
                gradientClass="md:bg-gradient-to-br md:from-blue-600 md:to-slate-700"
              />
              <KpiCard
                title="Closed loans"
                value={loanAnalytics?.closed_loans != null ? String(loanAnalytics.closed_loans) : '—'}
                subtitle="Fully settled"
                icon={CheckCircleIcon}
                gradientClass="md:bg-gradient-to-br md:from-slate-500 md:to-slate-700"
              />
              <KpiCard
                title="This month collection"
                value={formatInr(loanAnalytics?.this_month_collection)}
                subtitle="Payments in the current calendar month"
                icon={CalendarDaysIcon}
                gradientClass="md:bg-gradient-to-br md:from-rose-500 md:to-pink-600"
              />
              <KpiCard
                title="EMI due this month"
                value={formatInr(loanAnalytics?.emi_due_this_month)}
                subtitle="Unpaid installments due in the current calendar month"
                icon={CalendarDaysIcon}
                gradientClass="md:bg-gradient-to-br md:from-cyan-500 md:to-sky-600"
              />
              <KpiCard
                title="Principal collected (lifetime)"
                value={formatInr(loanAnalytics?.principal_collected_lifetime)}
                subtitle="Principal portion of all recorded repayments"
                icon={BanknotesIcon}
                gradientClass="md:bg-gradient-to-br md:from-slate-600 md:to-slate-800"
              />
              <KpiCard
                title="Interest collected (lifetime)"
                value={formatInr(loanAnalytics?.interest_collected_lifetime)}
                subtitle="Interest portion of repayments (lending profit)"
                icon={ReceiptPercentIcon}
                gradientClass="md:bg-gradient-to-br md:from-amber-600 md:to-yellow-700"
              />
              <KpiCard
                title="Overdue EMI (receivable)"
                value={formatInr(loanAnalytics?.overdue_emi_amount)}
                subtitle="Unpaid installments past due date"
                icon={ExclamationTriangleIcon}
                gradientClass="md:bg-gradient-to-br md:from-red-600 md:to-orange-600"
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
                gradientClass="md:bg-gradient-to-br md:from-violet-600 md:to-purple-700"
              />
            </div>
          </section>

          <section aria-label="Loan charts" className="grid min-w-0 gap-4 lg:grid-cols-2">
            <div className={`min-w-0 ${pfChartCard}`}>
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

            <div className={`min-w-0 ${pfChartCard}`}>
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

            <div className={`min-w-0 ${pfChartCard}`}>
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

            <div className={`min-w-0 ${pfChartCard}`}>
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

          <section aria-label="Your loans table" className={pfChartCard}>
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
