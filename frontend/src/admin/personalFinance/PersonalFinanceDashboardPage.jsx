import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useOutletContext } from 'react-router-dom'
import {
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
import { Bar, BarChart, CartesianGrid, Cell, Legend, Line, LineChart, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
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
  { id: 'dashboard', label: 'Dashboard' },
  { id: 'cashflow', label: 'This month · cashflow snapshot' },
  { id: 'loans', label: 'Loans (you lend)' },
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
  const [activeTab, setActiveTab] = useState('dashboard')
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

  const dashTabs = useMemo(
    () =>
      DASH_TABS.map((t) =>
        t.id === 'cashflow'
          ? {
              ...t,
              label: `${new Date(dashYear, dashMonth - 1, 1).toLocaleString(undefined, { month: 'short', year: 'numeric' })} · cashflow snapshot`,
            }
          : t,
      ),
    [dashYear, dashMonth],
  )

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
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setMonthModalOpen(true)}
            className={`${pfSelectCompact} min-w-[6.5rem] text-left font-bold text-slate-900 transition hover:bg-slate-50 active:scale-[0.97]`}
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
          options={dashTabs.map((t) => ({ id: t.id, label: t.label }))}
          value={activeTab}
          onChange={setActiveTab}
        />
      </div>

      {activeTab === 'dashboard' && (
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
        <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
          <KpiCard
            wrapperClassName="col-span-2 xl:col-span-1"
            title="Net worth"
            value={formatInr(summary?.net_worth)}
            subtitle={bankFilter ? 'Profile-wide' : 'Assets − liabilities'}
            icon={ScaleIcon}
            iconTintClass="bg-violet-100 text-violet-700 md:bg-white/20 md:text-white"
            gradientClass="md:bg-gradient-to-br md:from-[#7c3aed] md:to-[#4f46e5]"
          />
          <KpiCard
            title="This month income"
            value={formatInr(summary?.total_income)}
            subtitle={bankFilter ? filterBankName || 'Account' : dashMonthLabel}
            icon={ArrowTrendingUpIcon}
            iconTintClass="bg-emerald-100 text-emerald-700 md:bg-white/20 md:text-white"
            gradientClass="md:bg-gradient-to-br md:from-[#059669] md:to-[#10b981]"
          />
          <KpiCard
            title="This month expense"
            value={formatInr(summary?.total_expense)}
            subtitle={bankFilter ? filterBankName || 'Account' : dashMonthLabel}
            icon={CreditCardIcon}
            iconTintClass="bg-rose-100 text-rose-600 md:bg-white/20 md:text-white"
            gradientClass="md:bg-gradient-to-br md:from-[#dc2626] md:to-[#ef4444]"
          />
          <KpiCard
            title="EMI due"
            value={formatInr(cashflowMonth?.emi_expense_month)}
            subtitle="Expense · EMI categories"
            icon={CalendarDaysIcon}
            iconTintClass="bg-orange-100 text-orange-700 md:bg-white/20 md:text-white"
            gradientClass="md:bg-gradient-to-br md:from-[#d97706] md:to-[#f59e0b]"
          />
          <KpiCard
            title="Cash balance"
            value={formatInr(summary?.balance_cash ?? summary?.cash_balance)}
            subtitle={bankFilter ? filterBankName || 'This account' : 'Cash-style accounts'}
            icon={BanknotesIcon}
            iconTintClass="bg-sky-100 text-sky-700 md:bg-white/20 md:text-white"
            gradientClass="md:bg-gradient-to-br md:from-[#2563eb] md:to-[#3b82f6]"
          />
          <KpiCard
            title="Bank balance"
            value={formatInr(summary?.balance_bank ?? 0)}
            subtitle={bankFilter ? filterBankName || 'This account' : 'Bank / other accounts'}
            icon={BanknotesIcon}
            iconTintClass="bg-indigo-100 text-indigo-800 md:bg-white/20 md:text-white"
            gradientClass="md:bg-gradient-to-br md:from-[#4338ca] md:to-[#6366f1]"
          />
          <KpiCard
            title="Total balance"
            value={formatInr(summary?.balance_total ?? summary?.cash_balance)}
            subtitle={bankFilter ? filterBankName || 'This account' : 'All accounts'}
            icon={BanknotesIcon}
            iconTintClass="bg-cyan-100 text-cyan-800 md:bg-white/20 md:text-white"
            gradientClass="md:bg-gradient-to-br md:from-[#0369a1] md:to-[#0ea5e9]"
          />
          <KpiCard
            wrapperClassName="hidden md:block"
            title="Investments"
            value={formatInr(summary?.total_investment)}
            subtitle="Market value"
            icon={ChartPieIcon}
            iconTintClass="bg-cyan-100 text-cyan-700 md:bg-white/20 md:text-white"
            gradientClass="md:bg-gradient-to-br md:from-cyan-500 md:to-blue-500"
          />
          <KpiCard
            wrapperClassName="hidden md:block"
            title="Fixed assets"
            value={formatInr(summary?.total_assets)}
            subtitle="Effective value (incl. depreciation)"
            icon={BuildingLibraryIcon}
            iconTintClass="bg-amber-100 text-amber-700 md:bg-white/20 md:text-white"
            gradientClass="md:bg-gradient-to-br md:from-amber-500 md:to-yellow-600"
          />
          <KpiCard
            wrapperClassName="hidden md:block"
            title="Liabilities (outstanding)"
            value={formatInr(summary?.total_liabilities)}
            subtitle={
              summary?.liability_overdue_amount != null
                ? `Overdue ${formatInr(summary.liability_overdue_amount)} · Due this week: ${Array.isArray(summary?.liability_due_this_week) ? summary.liability_due_this_week.length : '—'}`
                : 'Active balances you owe'
            }
            icon={ReceiptPercentIcon}
            iconTintClass="bg-slate-200 text-slate-700 md:bg-white/20 md:text-white"
            gradientClass="md:bg-gradient-to-br md:from-slate-600 md:to-slate-800"
          />
          <KpiCard
            wrapperClassName="hidden md:block"
            title="Loan receivable"
            value={formatInr(summary?.loan_outstanding)}
            subtitle="Still to collect"
            icon={CreditCardIcon}
            iconTintClass="bg-teal-100 text-teal-700 md:bg-white/20 md:text-white"
            gradientClass="md:bg-gradient-to-br md:from-teal-600 md:to-emerald-700"
          />
        </div>
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
            isDark={isDark}
            barIeData={barIeData}
            pieData={pieData}
            networthData={networthData}
            invBarData={invBarData}
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
                      <linearGradient id="pfEmiPaid" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#22c55e" />
                        <stop offset="100%" stopColor="#15803d" />
                      </linearGradient>
                      <linearGradient id="pfEmiPending" x1="0" y1="0" x2="0" y2="1">
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
                      fill="url(#pfEmiPaid)"
                      radius={[6, 6, 0, 0]}
                      animationDuration={800}
                    />
                    <Bar
                      dataKey="pending"
                      name="Pending receivable"
                      fill="url(#pfEmiPending)"
                      radius={[6, 6, 0, 0]}
                      animationDuration={800}
                    />
                  </BarChart>
                </ResponsiveContainer>
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
                      <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                      <XAxis
                        type="number"
                        tick={{ fontSize: 11 }}
                        stroke="#64748b"
                        tickFormatter={(v) => `₹${(v / 1000).toFixed(0)}k`}
                      />
                      <YAxis type="category" dataKey="name" width={92} tick={{ fontSize: 10 }} stroke="#64748b" />
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
        </>
      )}

      {activeTab === 'loans' && (
        <>
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
