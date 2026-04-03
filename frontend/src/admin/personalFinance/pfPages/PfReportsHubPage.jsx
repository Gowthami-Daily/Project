import {
  ArrowTrendingDownIcon,
  ArrowTrendingUpIcon,
  MinusSmallIcon,
} from '@heroicons/react/24/solid'
import { useCallback, useEffect, useMemo, useState } from 'react'
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
  getReportsSummary,
  listFinanceAccounts,
  listPfExpenseCategories,
  pfFetchBlob,
  setPfToken,
  triggerDownloadBlob,
} from '../api.js'
import PfExportMenu from '../PfExportMenu.jsx'
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
import { formatInr } from '../pfFormat.js'
import { usePfRefresh } from '../pfRefreshContext.jsx'
import { usePfTheme } from '../PfThemeContext.jsx'

const PIE_COLORS = ['#0ea5e9', '#8b5cf6', '#f59e0b', '#10b981', '#f43f5e', '#6366f1', '#ec4899', '#14b8a6', '#64748b']

function firstOfMonth() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`
}

function todayISODate() {
  const d = new Date()
  return d.toISOString().slice(0, 10)
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

function RatioGauge({ label, valuePct, goodMax = 100 }) {
  const v = valuePct == null || Number.isNaN(valuePct) ? null : Math.min(100, Math.max(0, valuePct))
  const width = v == null ? 0 : v
  return (
    <div className="rounded-xl border border-slate-200/80 bg-white px-3 py-2 dark:border-slate-700 dark:bg-slate-900/40">
      <p className="text-[10px] font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400">{label}</p>
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
  const [start, setStart] = useState(firstOfMonth)
  const [end, setEnd] = useState(todayISODate)
  const [accountId, setAccountId] = useState('')
  const [categoryId, setCategoryId] = useState('')
  const [person, setPerson] = useState('')
  const [accounts, setAccounts] = useState([])
  const [categories, setCategories] = useState([])
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [showFilters, setShowFilters] = useState(true)
  const [reportsExportBusy, setReportsExportBusy] = useState(false)

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
  }, [start, end, accountId, categoryId, person, onSessionInvalid])

  useEffect(() => {
    load()
  }, [load, tick])

  const monthly = Array.isArray(data?.income_vs_expense_monthly) ? data.income_vs_expense_monthly : []
  const monthlyFull = Array.isArray(data?.monthly_summary) ? data.monthly_summary : []
  const byCat = Array.isArray(data?.expense_by_category) ? data.expense_by_category : []
  const byPerson = Array.isArray(data?.expense_by_person) ? data.expense_by_person : []
  const byAcc = Array.isArray(data?.expense_by_account) ? data.expense_by_account : []
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
  const loanBar = Array.isArray(data?.loan_activity_bar) ? data.loan_activity_bar : []
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

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-slate-900 dark:text-slate-100 sm:text-2xl">Reports & analytics</h1>
          <p className="mt-1 max-w-3xl text-sm text-slate-500 dark:text-slate-400">
            Business-intelligence style analytics: a clear cashflow story (income, spend, EMI, savings), book-keeping trends
            (net worth, cards, loans), and drill-downs — scoped by your filters and compared to the prior window of equal length.
          </p>
        </div>
        <PfExportMenu
          busy={reportsExportBusy}
          items={[
            { key: 'pdf', label: 'Export PDF', onClick: () => handleReportsExport('pdf') },
            { key: 'xlsx', label: 'Export Excel', onClick: () => handleReportsExport('excel') },
          ]}
        />
      </div>

      <div className={cardCls}>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-base font-bold text-slate-900 dark:text-slate-50">Filters</h2>
          <button
            type="button"
            onClick={() => setShowFilters((v) => !v)}
            className={`${btnSecondary} px-3 text-xs sm:text-sm`}
          >
            {showFilters ? 'Collapse' : 'Expand'}
          </button>
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
                onChange={(e) => setStart(e.target.value)}
              />
            </div>
            <div>
              <label htmlFor="rep-end" className={labelCls}>To</label>
              <input id="rep-end" type="date" className={inputCls} value={end} onChange={(e) => setEnd(e.target.value)} />
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

      <SectionTitle id="rep-kpi">KPI summary</SectionTitle>
      <section aria-labelledby="rep-kpi" className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-4">
        <KpiTile title="Total income" block={k.total_income} higherIsBetter />
        <KpiTile title="Total expense" block={k.total_expense} higherIsBetter={false} />
        <KpiTile title="Net savings" subtitle="Income − expense" block={k.net_savings} higherIsBetter />
        <KpiTile
          title="EMI & repayments"
          subtitle="Ledger EMI + liability payments"
          block={k.emi_paid}
          higherIsBetter={false}
        />
        <KpiTile title="Interest paid" subtitle="On liabilities" block={k.interest_paid} higherIsBetter={false} />
        <KpiTile
          title="Loan given"
          subtitle="New loans (start date in window)"
          block={k.loan_given}
          higherIsBetter={false}
        />
        <KpiTile title="Loan received" subtitle="Collections on loans you gave" block={k.loan_received} higherIsBetter />
        <KpiTile title="Investments added" subtitle="By investment date" block={k.investments_added} higherIsBetter />
        <div className={pfChartCard}>
          <p className="text-[11px] font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400">Savings (after EMI)</p>
          <p className="mt-1 text-lg font-bold tabular-nums text-slate-900 dark:text-slate-50 sm:text-xl">
            {formatInr(adv.savings_after_emi)}
          </p>
          <p className="mt-0.5 text-[10px] text-slate-500 dark:text-slate-400">Income − expense − ledger EMI</p>
        </div>
        <div className={pfChartCard}>
          <p className="text-[11px] font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400">Savings rate</p>
          <p className="mt-1 text-lg font-bold tabular-nums text-slate-900 dark:text-slate-50 sm:text-xl">
            {adv.savings_rate_after_emi != null ? `${(Number(adv.savings_rate_after_emi) * 100).toFixed(1)}%` : '—'}
          </p>
          <p className="mt-0.5 text-[10px] text-slate-500 dark:text-slate-400">After ledger EMI</p>
        </div>
        <div className={pfChartCard}>
          <p className="text-[11px] font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400">Credit utilization</p>
          <p className="mt-1 text-lg font-bold tabular-nums text-slate-900 dark:text-slate-50 sm:text-xl">
            {adv.credit_utilization_pct != null ? `${Number(adv.credit_utilization_pct).toFixed(1)}%` : '—'}
          </p>
          <p className="mt-0.5 text-[10px] text-slate-500 dark:text-slate-400">Cards tracked in app</p>
        </div>
        <div className={pfChartCard}>
          <p className="text-[11px] font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400">Runway</p>
          <p className="mt-1 text-lg font-bold tabular-nums text-slate-900 dark:text-slate-50 sm:text-xl">
            {adv.runway_months != null ? `${adv.runway_months} mo` : '—'}
          </p>
          <p className="mt-0.5 text-[10px] text-slate-500 dark:text-slate-400">Cash ÷ monthlyized expense</p>
        </div>
      </section>

      <div className="space-y-2">
        <SectionTitle id="rep-ratios">Financial ratios</SectionTitle>
        <p className="text-xs text-slate-500 dark:text-slate-400">Quick gauges (percent of income or limits where noted).</p>
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
          <RatioGauge label="Savings rate (after EMI)" valuePct={gauges.savings_rate_pct} />
          <RatioGauge label="Expense ÷ income" valuePct={gauges.expense_ratio_pct} />
          <RatioGauge label="EMI ÷ income" valuePct={gauges.debt_to_income_emi_pct} />
          <RatioGauge label="Credit utilization" valuePct={gauges.credit_utilization_pct} />
          <RatioGauge label="Investments ÷ assets (est.)" valuePct={gauges.investment_ratio_pct} />
        </div>
      </div>

      <div className="space-y-3">
        <SectionTitle id="rep-cashflow">Cashflow &amp; income vs expense</SectionTitle>
        <div className="grid gap-4 lg:grid-cols-2">
          <div className={`${cardCls} min-h-[300px] lg:col-span-2`}>
            <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">Cashflow trend (by month in range)</h3>
            <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">Income, expense, ledger EMI, and savings after EMI</p>
            <div className="mt-2 h-[280px] w-full min-w-0">
              {cashflowTrend.length === 0 ? (
                <p className="py-12 text-center text-sm text-slate-500">No monthly slices in range.</p>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={cashflowTrend} margin={{ top: 8, right: 8, left: 0, bottom: 4 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke={gridStroke} opacity={0.5} />
                    <XAxis dataKey="label" tick={{ fontSize: 10, fill: axisStroke }} interval={0} angle={-18} textAnchor="end" height={52} />
                    <YAxis tick={{ fontSize: 10, fill: axisStroke }} tickFormatter={(v) => (v >= 100000 ? `${(v / 100000).toFixed(1)}L` : `${(v / 1000).toFixed(0)}k`)} />
                    <Tooltip formatter={(v) => formatInr(v)} contentStyle={tooltipBox} />
                    <Legend wrapperStyle={{ fontSize: 11 }} />
                    <Line type="monotone" dataKey="income" name="Income" stroke="#22c55e" strokeWidth={2} dot={false} />
                    <Line type="monotone" dataKey="expense" name="Expense" stroke="#f43f5e" strokeWidth={2} dot={false} />
                    <Line type="monotone" dataKey="emi" name="EMI (ledger)" stroke="#a855f7" strokeWidth={2} dot={false} />
                    <Line type="monotone" dataKey="savings" name="Savings" stroke="#0ea5e9" strokeWidth={2} dot />
                  </LineChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>

          <div className={`${cardCls} min-h-[300px] lg:col-span-2`}>
            <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">Cumulative cashflow (daily)</h3>
            <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">Running sum of scoped income − expense per day</p>
            <div className="mt-2 h-[260px] w-full min-w-0">
              {cumulativeDaily.length === 0 ? (
                <p className="py-12 text-center text-sm text-slate-500">No days in range.</p>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={cumulativeDaily} margin={{ top: 8, right: 8, left: 0, bottom: 4 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke={gridStroke} opacity={0.5} />
                    <XAxis dataKey="date" tick={{ fontSize: 9, fill: axisStroke }} interval="preserveStartEnd" />
                    <YAxis tick={{ fontSize: 10, fill: axisStroke }} tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
                    <Tooltip formatter={(v) => formatInr(v)} contentStyle={tooltipBox} />
                    <Legend wrapperStyle={{ fontSize: 11 }} />
                    <Line type="monotone" dataKey="cumulative" name="Cumulative" stroke="#0ea5e9" strokeWidth={2} dot={false} />
                  </LineChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>

          <div className={`${cardCls} min-h-[300px]`}>
            <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">Income vs expense (bars)</h3>
            <div className="mt-2 h-[260px] w-full min-w-0">
              {monthly.length === 0 ? (
                <p className="py-12 text-center text-sm text-slate-500">No data in range.</p>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={monthly} margin={{ top: 8, right: 8, left: 0, bottom: 4 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke={gridStroke} opacity={0.5} />
                    <XAxis dataKey="label" tick={{ fontSize: 10, fill: axisStroke }} interval={0} angle={-22} textAnchor="end" height={56} />
                    <YAxis tick={{ fontSize: 10, fill: axisStroke }} tickFormatter={(v) => (v >= 100000 ? `${(v / 100000).toFixed(1)}L` : `${(v / 1000).toFixed(0)}k`)} />
                    <Tooltip formatter={(v) => formatInr(v)} contentStyle={tooltipBox} />
                    <Legend wrapperStyle={{ fontSize: 12 }} />
                    <Bar dataKey="income" name="Income" fill="#0ea5e9" radius={[6, 6, 0, 0]} />
                    <Bar dataKey="expense" name="Expense" fill="#f43f5e" radius={[6, 6, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>

          <div className={`${cardCls} min-h-[300px]`}>
            <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">Expense by category (stacked)</h3>
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

          <div className={`${cardCls} min-h-[280px] lg:col-span-2`}>
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
      </div>

      <div className="space-y-3">
        <SectionTitle id="rep-expense">Expense analysis</SectionTitle>
        <div className="grid gap-4 lg:grid-cols-2">
          <div className={`${cardCls} min-h-[300px]`}>
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
          <div className={`${cardCls} min-h-[300px]`}>
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
          <div className={`${cardCls} min-h-[300px]`}>
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
          <div className={`${cardCls} min-h-[280px]`}>
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
      </div>

      <div className="space-y-3">
        <SectionTitle id="rep-accounts">Account balances &amp; payment mix</SectionTitle>
        <div className={`${cardCls} min-h-[280px]`}>
          <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">Current account balances (snapshot)</h3>
          <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">Not a historical trend — books as of now</p>
          <div className="mt-2 h-[260px] w-full min-w-0">
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

      <div className="space-y-3">
        <SectionTitle id="rep-loans">Loan &amp; credit analysis</SectionTitle>
        <div className="grid gap-4 lg:grid-cols-2">
          <div className={`${cardCls} min-h-[260px]`}>
            <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">Loan activity</h3>
            <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">New loans booked vs collections received</p>
            <div className="mt-2 h-[220px] w-full min-w-0">
              {loanBar.every((x) => !x.value) ? (
                <p className="py-12 text-center text-sm text-slate-500">No activity in range.</p>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={loanBar} margin={{ top: 8, right: 8, left: 0, bottom: 4 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke={gridStroke} opacity={0.5} />
                    <XAxis dataKey="name" tick={{ fontSize: 10, fill: axisStroke }} interval={0} angle={-12} textAnchor="end" height={48} />
                    <YAxis tick={{ fontSize: 10, fill: axisStroke }} tickFormatter={(v) => formatInr(v)} />
                    <Tooltip formatter={(v) => formatInr(v)} contentStyle={tooltipBox} />
                    <Bar dataKey="value" fill="#6366f1" radius={[6, 6, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>
          <div className={`${cardCls} min-h-[260px]`}>
            <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">EMI ÷ income (period)</h3>
            <p className="mt-1 font-mono text-2xl font-bold tabular-nums text-slate-900 dark:text-slate-50">
              {data?.emi_vs_income_pct != null ? `${data.emi_vs_income_pct}%` : '—'}
            </p>
            <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">Ledger EMI categories only ÷ total income in filters</p>
          </div>
          <div className={`${cardCls} min-h-[260px]`}>
            <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">Interest collected (loans you gave)</h3>
            <div className="mt-2 h-[220px] w-full min-w-0">
              {interestMo.length === 0 ? (
                <p className="py-12 text-center text-sm text-slate-500">No months.</p>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={interestMo} margin={{ top: 8, right: 8, left: 0, bottom: 4 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke={gridStroke} opacity={0.5} />
                    <XAxis dataKey="label" tick={{ fontSize: 10, fill: axisStroke }} />
                    <YAxis tick={{ fontSize: 10, fill: axisStroke }} tickFormatter={(v) => formatInr(v)} />
                    <Tooltip formatter={(v) => formatInr(v)} contentStyle={tooltipBox} />
                    <Line type="monotone" dataKey="interest" name="Interest" stroke="#10b981" strokeWidth={2} dot />
                  </LineChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>
          <div className={`${cardCls} min-h-[260px]`}>
            <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">Credit utilization (book series)</h3>
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
          <div className={`${cardCls} min-h-[280px] lg:col-span-2`}>
            <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">Net worth trend (accounting series)</h3>
            <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">From monthly financial tables · cash rolls month to month</p>
            <div className="mt-2 h-[260px] w-full min-w-0">
              {bsTrend.length === 0 ? (
                <p className="py-12 text-center text-sm text-slate-500">No rows (try a longer range spanning full months).</p>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={bsTrend} margin={{ top: 8, right: 8, left: 0, bottom: 4 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke={gridStroke} opacity={0.5} />
                    <XAxis dataKey="label" tick={{ fontSize: 10, fill: axisStroke }} interval={0} angle={-16} textAnchor="end" height={48} />
                    <YAxis tick={{ fontSize: 10, fill: axisStroke }} tickFormatter={(v) => formatInr(v)} />
                    <Tooltip formatter={(v) => formatInr(v)} contentStyle={tooltipBox} />
                    <Line type="monotone" dataKey="net_worth" name="Net worth" stroke="#0ea5e9" strokeWidth={2} dot />
                  </LineChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>
        </div>
      </div>

      {mom ? (
        <div className={cardCls}>
          <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">Month-over-month</h3>
          <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
            Last month in window vs previous: {mom.this_label} vs {mom.prev_label}
          </p>
          <div className={`mt-3 ${pfTableWrap} overflow-x-auto`}>
            <table className={`${pfTable} min-w-[28rem]`}>
              <thead>
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
          <div className={`mt-2 ${pfTableWrap}`}>
            <table className={`${pfTable} min-w-[18rem]`}>
              <thead>
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
          <div className={`mt-2 ${pfTableWrap}`}>
            <table className={`${pfTable} min-w-[18rem]`}>
              <thead>
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
          <div className={`mt-2 ${pfTableWrap}`}>
            <table className={`${pfTable} min-w-[18rem]`}>
              <thead>
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
          <div className={`mt-2 ${pfTableWrap}`}>
            <table className={`${pfTable} min-w-[18rem]`}>
              <thead>
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
        <div className={`mt-2 ${pfTableWrap} overflow-x-auto`}>
          <table className={`${pfTable} min-w-[32rem]`}>
            <thead>
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
