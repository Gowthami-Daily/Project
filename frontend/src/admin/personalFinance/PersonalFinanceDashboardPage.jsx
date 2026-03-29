import { useCallback, useEffect, useMemo, useState } from 'react'
import { useOutletContext } from 'react-router-dom'
import {
  ArrowTrendingUpIcon,
  BanknotesIcon,
  BuildingLibraryIcon,
  CalendarDaysIcon,
  ChartPieIcon,
  CheckCircleIcon,
  CreditCardIcon,
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
import { formatInr } from './pfFormat.js'
import {
  pfChartCard,
  pfTable,
  pfTableWrap,
  pfTd,
  pfTdRight,
  pfTh,
  pfThRight,
  pfTrHover,
} from './pfFormStyles.js'
import { usePfRefresh } from './pfRefreshContext.jsx'

const CHART_COLORS = ['#004080', '#0ea5e9', '#22c55e', '#a855f7', '#f59e0b', '#ec4899', '#64748b']

const chartTitle = 'text-base font-bold text-sky-950'
const chartSub = 'mt-0.5 text-xs text-slate-500'
const tooltipBox = { borderRadius: 12, border: '1px solid #bae6fd', background: '#fff' }

const DASH_TABS = [
  { id: 'dashboard', label: 'Dashboard' },
  { id: 'cashflow', label: 'This month · cashflow snapshot' },
  { id: 'loans', label: 'Loans (you lend)' },
]

export default function PersonalFinanceDashboardPage() {
  const { onSessionInvalid } = useOutletContext() || {}
  const { tick } = usePfRefresh()
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

  const year = useMemo(() => new Date().getFullYear(), [])
  const accountQuery = bankFilter === '' ? undefined : bankFilter

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
    setLoading(true)
    setLoadError('')
    try {
      const [s, ie, ec, nw, ia, la, cf, loans] = await Promise.all([
        getDashboardSummary(accountQuery),
        getIncomeVsExpense(year, accountQuery),
        getExpenseByCategory(undefined, undefined, accountQuery),
        getNetworthGrowth(year, accountQuery),
        getInvestmentAllocation(),
        getLoanDashboardAnalytics(year),
        getCashflowMonthSummary(),
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
    } catch (e) {
      if (e.status === 401) {
        setPfToken(null)
        onSessionInvalid?.()
        setLoadError('Session expired — sign in again.')
      } else {
        setLoadError(e.message || 'Failed to load dashboard')
      }
    } finally {
      setLoading(false)
    }
  }, [year, onSessionInvalid, accountQuery])

  useEffect(() => {
    loadAll()
  }, [loadAll, tick])

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
      { label: 'Expense (this month)', value: cashflowMonth?.total_expense_month },
      { label: 'Food & groceries', value: cashflowMonth?.food_expense },
      { label: 'EMI expenses', value: cashflowMonth?.emi_expense_month },
      { label: 'Dairy (farm + feed)', value: cashflowMonth?.dairy_expense },
      { label: 'Pending EMIs (receivable)', value: cashflowMonth?.pending_emis_receivable },
      { label: 'Cash-style accounts', value: cashflowMonth?.cash_balance },
      { label: 'Bank-style accounts', value: cashflowMonth?.bank_balance },
    ],
    [cashflowMonth],
  )

  const filterBankName = useMemo(() => {
    if (!bankFilter) return ''
    return accounts.find((a) => String(a.id) === bankFilter)?.account_name ?? ''
  }, [accounts, bankFilter])

  const periodLabel = summary
    ? `${summary.period_start?.slice?.(0, 10) ?? ''} → ${summary.period_end?.slice?.(0, 10) ?? ''}`
    : ''

  const unallocInc = Number(summary?.unallocated_income_ytd) || 0
  const unallocExp = Number(summary?.unallocated_expense_ytd) || 0
  const showUnallocatedHint = !bankFilter && (unallocInc > 0 || unallocExp > 0)

  const txSubtitle = bankFilter
    ? `Transactions for ${filterBankName || 'selected bank'} only`
    : 'Latest income and expense rows · add more from Income or Expenses in the sidebar'

  return (
    <div className="mx-auto max-w-[1600px] space-y-6 lg:space-y-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">Dashboard</h1>
          <p className="mt-1 text-sm text-slate-500 sm:text-base">
            Profile-scoped summary — income, spending, investments, and loans. Period: {periodLabel}
            {loading ? <span className="ml-2 text-slate-400">· updating…</span> : null}
          </p>
        </div>
        <div className="flex flex-col gap-1 sm:items-end">
          <label htmlFor="pf-bank-filter" className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            Bank / account
          </label>
          <select
            id="pf-bank-filter"
            className="min-w-[14rem] rounded-xl border border-sky-200/80 bg-white px-3 py-2 text-sm font-medium text-slate-800 shadow-sm outline-none ring-sky-500/25 focus:ring-2"
            value={bankFilter}
            onChange={(e) => setBankFilter(e.target.value)}
          >
            <option value="">All banks (combined)</option>
            {accounts.map((a) => (
              <option key={a.id} value={String(a.id)}>
                {a.account_name} ({a.account_type})
              </option>
            ))}
          </select>
        </div>
      </div>

      {bankFilter ? (
        <p className="rounded-xl border border-sky-200 bg-sky-50 px-4 py-2 text-sm text-sky-900">
          Filter active: <span className="font-semibold">{filterBankName || 'Selected account'}</span>. Income, expense,
          cash, charts and recent activity below are for this account only. Net worth, investments, assets, loans, and
          liabilities stay <span className="font-medium">profile-wide</span>.
        </p>
      ) : null}

      {showUnallocatedHint ? (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950">
          <p className="font-semibold text-amber-900">Cash total may look low vs income/expense</p>
          <p className="mt-1 text-amber-900/90">
            You have{' '}
            {unallocInc > 0 ? (
              <>
                {formatInr(unallocInc)} income YTD{' '}
                {unallocExp > 0 ? 'and ' : ''}
              </>
            ) : null}
            {unallocExp > 0 ? <>{formatInr(unallocExp)} expenses YTD </> : null}
            not linked to any bank account. <strong className="font-medium">Cash in accounts</strong> only sums stored
            account balances (updated when you add income/expenses <em>with</em> an account selected). Re-enter or edit
            past rows in Income/Expenses with an account, or adjust balances on the Accounts page.
          </p>
        </div>
      ) : null}

      {loadError ? (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">{loadError}</div>
      ) : null}

      <nav
        className="flex flex-col gap-1.5 rounded-2xl border border-sky-200/70 bg-sky-50/40 p-1.5 shadow-sm shadow-sky-950/[0.03] sm:flex-row sm:flex-wrap"
        aria-label="Dashboard sections"
        role="tablist"
      >
        {DASH_TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            role="tab"
            aria-selected={activeTab === t.id}
            onClick={() => setActiveTab(t.id)}
            className={`min-h-[44px] flex-1 rounded-xl px-3 py-2.5 text-center text-sm font-semibold transition sm:min-w-0 sm:px-4 ${
              activeTab === t.id
                ? 'bg-[#004080] text-white shadow-sm'
                : 'text-slate-600 hover:bg-white hover:text-sky-950'
            }`}
          >
            {t.label}
          </button>
        ))}
      </nav>

      {activeTab === 'dashboard' && (
        <>
      <section aria-label="Financial summary">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <KpiCard
            title="Net worth"
            value={formatInr(summary?.net_worth)}
            subtitle={
              bankFilter
                ? 'Profile-wide — cash + assets + investments + loan receivable − liabilities'
                : 'Cash + fixed assets + investments + loan receivable − liabilities'
            }
            icon={ScaleIcon}
            gradientClass="bg-gradient-to-br from-violet-600 to-indigo-600"
          />
          <KpiCard
            title="Income (YTD)"
            value={formatInr(summary?.total_income)}
            subtitle={bankFilter ? `This bank only · ${filterBankName || 'selected account'}` : 'Recorded in active profile'}
            icon={ArrowTrendingUpIcon}
            gradientClass="bg-gradient-to-br from-emerald-500 to-teal-600"
          />
          <KpiCard
            title="Expense (YTD)"
            value={formatInr(summary?.total_expense)}
            subtitle={bankFilter ? `This bank only · ${filterBankName || 'selected account'}` : 'Recorded in active profile'}
            icon={CreditCardIcon}
            gradientClass="bg-gradient-to-br from-rose-500 to-orange-500"
          />
          <KpiCard
            title="Cash in accounts"
            value={formatInr(summary?.cash_balance)}
            subtitle={
              bankFilter
                ? `Balance in ${filterBankName || 'this account'} (updates when you add income/expenses here)`
                : 'Sum of all account balances (updated when you add income or expenses with an account selected)'
            }
            icon={BanknotesIcon}
            gradientClass="bg-gradient-to-br from-sky-500 to-blue-600"
          />
          <KpiCard
            title="Investments (market value)"
            value={formatInr(summary?.total_investment)}
            subtitle={bankFilter ? 'Profile-wide (not filtered by bank)' : 'Current value aggregate'}
            icon={ChartPieIcon}
            gradientClass="bg-gradient-to-br from-cyan-500 to-blue-500"
          />
          <KpiCard
            title="Fixed assets"
            value={formatInr(summary?.total_assets)}
            subtitle={bankFilter ? 'Profile-wide (not filtered by bank)' : 'Recorded asset rows'}
            icon={BuildingLibraryIcon}
            gradientClass="bg-gradient-to-br from-amber-500 to-yellow-600"
          />
          <KpiCard
            title="Liabilities"
            value={formatInr(summary?.total_liabilities)}
            subtitle={bankFilter ? 'Profile-wide (not filtered by bank)' : 'Non-loan liabilities'}
            icon={ReceiptPercentIcon}
            gradientClass="bg-gradient-to-br from-slate-600 to-slate-800"
          />
          <KpiCard
            title="Loan receivable"
            value={formatInr(summary?.loan_outstanding)}
            subtitle={
              bankFilter
                ? 'Profile-wide — principal still due from borrowers (you lent)'
                : 'Still to collect on loans you gave (EMI schedule or latest balance)'
            }
            icon={CreditCardIcon}
            gradientClass="bg-gradient-to-br from-teal-600 to-emerald-700"
          />
        </div>
      </section>

      <section aria-label="Charts" className="grid gap-4 lg:grid-cols-2">
        <div className={pfChartCard}>
          <h2 className={chartTitle}>Income vs expense</h2>
          <p className={chartSub}>
            Monthly · {year}
            {bankFilter ? ` · ${filterBankName || 'filtered account'}` : ''}
          </p>
          <div className="mt-3 h-[280px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={barIeData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="month" tick={{ fontSize: 10 }} stroke="#64748b" angle={-35} textAnchor="end" height={56} />
                <YAxis tick={{ fontSize: 11 }} stroke="#64748b" tickFormatter={(v) => `₹${(v / 1000).toFixed(0)}k`} />
                <Tooltip
                  formatter={(v) => formatInr(v)}
                  contentStyle={tooltipBox}
                />
                <Legend />
                <Bar dataKey="income" name="Income" fill="#22c55e" radius={[4, 4, 0, 0]} />
                <Bar dataKey="expense" name="Expense" fill="#f97316" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className={pfChartCard}>
          <h2 className={chartTitle}>Expense by category</h2>
          <p className={chartSub}>
            {bankFilter ? `This bank · ${filterBankName || 'filtered'}` : 'All time in window (default)'}
          </p>
          <div className="mt-3 h-[280px] w-full">
            {pieData.length === 0 ? (
              <p className="flex h-full items-center justify-center text-sm text-slate-500">No expense data yet</p>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={pieData}
                    dataKey="value"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    outerRadius={100}
                    label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                  >
                    {pieData.map((_, i) => (
                      <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(v) => formatInr(v)} />
                </PieChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        <div className={pfChartCard}>
          <h2 className={chartTitle}>{bankFilter ? 'Account cashflow (cumulative)' : 'Net worth trend'}</h2>
          <p className={chartSub}>
            {bankFilter
              ? `Running income − expense by month · ${filterBankName || 'this account'} · ${year}`
              : `Base includes assets, investments, loan receivable, liabilities; plus cumulative savings · ${year}`}
          </p>
          <div className="mt-3 h-[280px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={networthData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="month" tick={{ fontSize: 10 }} stroke="#64748b" angle={-35} textAnchor="end" height={56} />
                <YAxis tick={{ fontSize: 11 }} stroke="#64748b" tickFormatter={(v) => `₹${(v / 1000).toFixed(0)}k`} />
                <Tooltip formatter={(v) => formatInr(v)} contentStyle={tooltipBox} />
                <Line type="monotone" dataKey="netWorth" name="Net worth" stroke="#004080" strokeWidth={2.5} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className={pfChartCard}>
          <h2 className={chartTitle}>Investment allocation</h2>
          <p className={chartSub}>
            {bankFilter ? 'Profile-wide by instrument type (bank filter does not apply)' : 'By instrument type'}
          </p>
          <div className="mt-3 h-[280px] w-full">
            {invBarData.length === 0 ? (
              <p className="flex h-full items-center justify-center text-sm text-slate-500">No investments yet</p>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={invBarData} layout="vertical" margin={{ top: 8, right: 8, left: 8, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis type="number" tick={{ fontSize: 11 }} stroke="#64748b" tickFormatter={(v) => `₹${(v / 1000).toFixed(0)}k`} />
                  <YAxis type="category" dataKey="type" width={100} tick={{ fontSize: 11 }} stroke="#64748b" />
                  <Tooltip formatter={(v) => formatInr(v)} contentStyle={tooltipBox} />
                  <Bar dataKey="value" name="Value" fill="#0ea5e9" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>
      </section>

      <section aria-label="Recent transactions" className={pfChartCard}>
        <h2 className={chartTitle}>Recent transactions</h2>
        <p className={chartSub}>{txSubtitle}</p>
        <div className={`mt-4 ${pfTableWrap}`}>
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
              {(summary?.recent_transactions ?? []).length === 0 ? (
                <tr>
                  <td colSpan={4} className="border-b border-sky-100/90 px-3 py-8 text-center text-slate-500 first:pl-4">
                    No transactions yet — use the sidebar to add income or expenses (create an account first if needed).
                  </td>
                </tr>
              ) : (
                summary.recent_transactions.map((tx) => (
                  <tr key={`${tx.kind}-${tx.id}`} className={pfTrHover}>
                    <td className={pfTd}>
                      <span
                        className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
                          tx.kind === 'income' ? 'bg-emerald-100 text-emerald-800' : 'bg-orange-100 text-orange-800'
                        }`}
                      >
                        {tx.kind}
                      </span>
                    </td>
                    <td className={`${pfTd} text-slate-600`}>{tx.date}</td>
                    <td className={pfTd}>{tx.category}</td>
                    <td className={pfTdRight}>{formatInr(tx.amount)}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>
        </>
      )}

      {activeTab === 'cashflow' && (
        <>
          <section aria-label="Month cashflow snapshot" className="space-y-4">
            <div className="rounded-2xl border border-sky-200/60 bg-white px-4 py-3 shadow-sm shadow-sky-950/[0.03] ring-1 ring-sky-100/40 sm:px-5">
              <h2 className="text-lg font-bold text-sky-950">This month · cashflow snapshot</h2>
              <p className="mt-0.5 text-xs text-slate-500">
                Profile-wide calendar month (ignores bank filter)
                {cashflowMonth?.period_start && cashflowMonth?.period_end
                  ? ` · ${cashflowMonth.period_start} → ${cashflowMonth.period_end}`
                  : null}
              </p>
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <KpiCard
                title="Expense (this month)"
                value={formatInr(cashflowMonth?.total_expense_month)}
                subtitle="All recorded expenses in range"
                icon={CreditCardIcon}
                gradientClass="bg-gradient-to-br from-rose-500 to-orange-500"
              />
              <KpiCard
                title="Food & groceries"
                value={formatInr(cashflowMonth?.food_expense)}
                subtitle="Category total"
                icon={ChartPieIcon}
                gradientClass="bg-gradient-to-br from-lime-500 to-green-600"
              />
              <KpiCard
                title="EMI expenses"
                value={formatInr(cashflowMonth?.emi_expense_month)}
                subtitle="EMI – Loans + Credit Card + EMI-like labels"
                icon={ReceiptPercentIcon}
                gradientClass="bg-gradient-to-br from-red-500 to-rose-600"
              />
              <KpiCard
                title="Dairy (farm + feed)"
                value={formatInr(cashflowMonth?.dairy_expense)}
                subtitle="Dairy Farm + Feed categories"
                icon={TruckIcon}
                gradientClass="bg-gradient-to-br from-emerald-600 to-teal-700"
              />
              <KpiCard
                title="Pending EMIs (receivable)"
                value={formatInr(cashflowMonth?.pending_emis_receivable)}
                subtitle="Unpaid installments you are owed (loans you gave)"
                icon={CalendarDaysIcon}
                gradientClass="bg-gradient-to-br from-amber-500 to-yellow-600"
              />
              <KpiCard
                title="Cash-style accounts"
                value={formatInr(cashflowMonth?.cash_balance)}
                subtitle="Accounts named cash / wallet / petty (heuristic)"
                icon={BanknotesIcon}
                gradientClass="bg-gradient-to-br from-green-600 to-emerald-700"
              />
              <KpiCard
                title="Bank-style accounts"
                value={formatInr(cashflowMonth?.bank_balance)}
                subtitle="Other account types (remaining balance sum)"
                icon={BuildingLibraryIcon}
                gradientClass="bg-gradient-to-br from-sky-600 to-blue-700"
              />
            </div>
          </section>

          <section aria-label="Month cashflow charts" className="grid gap-4 lg:grid-cols-2">
            <div className={pfChartCard}>
              <h2 className={chartTitle}>This month · amounts at a glance</h2>
              <p className={chartSub}>Same buckets as the cards (₹)</p>
              <div className="mt-3 h-[320px] w-full">
                {cashflowBarData.length === 0 || cashflowBarData.every((d) => d.value === 0) ? (
                  <p className="flex h-full items-center justify-center text-sm text-slate-500">No data for this month yet</p>
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
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

            <div className={pfChartCard}>
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
            <div className="rounded-2xl border border-sky-200/60 bg-white px-4 py-3 shadow-sm shadow-sky-950/[0.03] ring-1 ring-sky-100/40 sm:px-5">
              <h2 className="text-lg font-bold text-sky-950">Loans (you lend)</h2>
              <p className="text-xs text-slate-500">
                Profile-wide lending · charts use {year}
                {bankFilter ? ' (unchanged by bank filter)' : ''}
              </p>
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <KpiCard
                title="Total loan given"
                value={formatInr(loanAnalytics?.total_loan_given)}
                subtitle="Sum of principal (loan amounts)"
                icon={BanknotesIcon}
                gradientClass="bg-gradient-to-br from-sky-600 to-blue-700"
              />
              <KpiCard
                title="Interest profit (book)"
                value={formatInr(loanAnalytics?.total_interest_profit)}
                subtitle="Expected interest on scheduled loans"
                icon={ReceiptPercentIcon}
                gradientClass="bg-gradient-to-br from-amber-500 to-orange-600"
              />
              <KpiCard
                title="Total expected"
                value={formatInr(loanAnalytics?.total_amount_expected)}
                subtitle="Principal + interest (book)"
                icon={ScaleIcon}
                gradientClass="bg-gradient-to-br from-indigo-600 to-violet-700"
              />
              <KpiCard
                title="Total collected"
                value={formatInr(loanAnalytics?.total_collected)}
                subtitle="All EMI / payments recorded"
                icon={ArrowTrendingUpIcon}
                gradientClass="bg-gradient-to-br from-green-600 to-emerald-700"
              />
              <KpiCard
                title="Remaining receivable"
                value={formatInr(loanAnalytics?.total_remaining_receivable)}
                subtitle="Unpaid EMIs or latest balance"
                icon={ChartPieIcon}
                gradientClass="bg-gradient-to-br from-cyan-600 to-teal-700"
              />
              <KpiCard
                title="Active loans"
                value={loanAnalytics?.active_loans != null ? String(loanAnalytics.active_loans) : '—'}
                subtitle="Not closed"
                icon={UsersIcon}
                gradientClass="bg-gradient-to-br from-blue-600 to-slate-700"
              />
              <KpiCard
                title="Closed loans"
                value={loanAnalytics?.closed_loans != null ? String(loanAnalytics.closed_loans) : '—'}
                subtitle="Fully settled"
                icon={CheckCircleIcon}
                gradientClass="bg-gradient-to-br from-slate-500 to-slate-700"
              />
              <KpiCard
                title="This month collection"
                value={formatInr(loanAnalytics?.this_month_collection)}
                subtitle="Payments in the current calendar month"
                icon={CalendarDaysIcon}
                gradientClass="bg-gradient-to-br from-rose-500 to-pink-600"
              />
            </div>
          </section>

          <section aria-label="Loan charts" className="grid gap-4 lg:grid-cols-2">
            <div className={pfChartCard}>
              <h2 className={chartTitle}>Loan: given vs collected vs remaining</h2>
              <p className={chartSub}>Portfolio totals (₹)</p>
              <div className="mt-3 h-[280px] w-full">
                <ResponsiveContainer width="100%" height="100%">
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

            <div className={pfChartCard}>
              <h2 className={chartTitle}>Monthly EMI collection</h2>
              <p className={chartSub}>{year} · total paid per month</p>
              <div className="mt-3 h-[280px] w-full">
                <ResponsiveContainer width="100%" height="100%">
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

            <div className={pfChartCard}>
              <h2 className={chartTitle}>Interest collected by month</h2>
              <p className={chartSub}>{year} · from payment records</p>
              <div className="mt-3 h-[280px] w-full">
                <ResponsiveContainer width="100%" height="100%">
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

            <div className={pfChartCard}>
              <h2 className={chartTitle}>Active vs closed loans</h2>
              <p className={chartSub}>Loan count</p>
              <div className="mt-3 h-[280px] w-full">
                {(() => {
                  const pieLoan = (loanAnalytics?.active_vs_closed_pie ?? []).filter((x) => Number(x.value) > 0)
                  return pieLoan.length === 0 ? (
                    <p className="flex h-full items-center justify-center text-sm text-slate-500">No loans yet</p>
                  ) : (
                    <ResponsiveContainer width="100%" height="100%">
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
                            <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
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
    </div>
  )
}
