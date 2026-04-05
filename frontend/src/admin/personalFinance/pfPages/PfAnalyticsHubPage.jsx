import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  ArrowTrendingDownIcon,
  ArrowTrendingUpIcon,
  ChartBarIcon,
  ChartPieIcon,
  PresentationChartLineIcon,
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
import {
  getPfAnalyticsDistribution,
  getPfAnalyticsInsights,
  getPfAnalyticsSummary,
  getPfAnalyticsTable,
  getPfAnalyticsTrend,
  listCreditCards,
  listFinanceAccounts,
  listPfExpenseCategories,
  listPfIncomeCategories,
} from '../api.js'
import PfBankAccountSelect from '../PfBankAccountSelect.jsx'
import PfSegmentedControl from '../PfSegmentedControl.jsx'
import { formatInr } from '../pfFormat.js'
import { pfSelectCompact, pfTable, pfTableWrap, pfTd, pfTdRight, pfTh, pfThRight, pfTrHover } from '../pfFormStyles.js'
import { chartGridStroke, chartTooltipBox } from '../../../components/dashboard/chartTheme.js'

const MODULES = [
  { slug: 'expenses', label: 'Expenses' },
  { slug: 'income', label: 'Income' },
  { slug: 'accounts', label: 'Accounts' },
  { slug: 'movements', label: 'Money movement' },
  { slug: 'credit-cards', label: 'Credit cards' },
  { slug: 'loans', label: 'Loans' },
  { slug: 'investments', label: 'Investments' },
  { slug: 'assets', label: 'Fixed assets' },
  { slug: 'liabilities', label: 'Loans & liabilities' },
  { slug: 'financial-statement', label: 'Financial statement' },
  { slug: 'reports', label: 'Reports' },
]

const COL_INFLOW = '#22c55e'
const COL_OUTFLOW = '#ef4444'
const COL_ASSET = '#2563eb'
const DONUT_COLS = ['#2563eb', '#22c55e', '#f97316', '#a855f7', '#0ea5e9', '#ec4899', '#64748b', '#14b8a6']

const cardShell =
  'rounded-[12px] border border-[var(--pf-border)] bg-[var(--pf-card)]/80 p-5 shadow-[var(--pf-shadow)] backdrop-blur-md dark:bg-white/[0.04]'

function kpiCard({ label, value, sub, tone }) {
  const toneCls =
    tone === 'inflow'
      ? 'text-emerald-600 dark:text-emerald-400'
      : tone === 'outflow'
        ? 'text-red-600 dark:text-red-400'
        : tone === 'asset'
          ? 'text-blue-600 dark:text-blue-400'
          : tone === 'liab'
            ? 'text-orange-600 dark:text-orange-400'
            : 'text-[var(--pf-text)]'
  return (
    <div className={cardShell}>
      <p className="text-[11px] font-semibold uppercase tracking-wide text-[var(--pf-text-muted)]">{label}</p>
      <p className={`mt-1 text-2xl font-bold tabular-nums tracking-tight ${toneCls}`}>{value}</p>
      {sub ? <p className="mt-1 text-xs text-[var(--pf-text-muted)]">{sub}</p> : null}
    </div>
  )
}

function defaultMonthStr() {
  const t = new Date()
  return `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, '0')}`
}

export default function PfAnalyticsHubPage() {
  const [module, setModule] = useState('expenses')
  const [monthStr, setMonthStr] = useState(defaultMonthStr)
  const [granularity, setGranularity] = useState('daily')
  const [accountId, setAccountId] = useState('')
  const [expenseCat, setExpenseCat] = useState('')
  const [incomeCat, setIncomeCat] = useState('')
  const [accounts, setAccounts] = useState([])
  const [expCats, setExpCats] = useState([])
  const [incCats, setIncCats] = useState([])
  const [creditCards, setCreditCards] = useState([])
  const [creditCardId, setCreditCardId] = useState('')

  const [summary, setSummary] = useState(null)
  const [trend, setTrend] = useState(null)
  const [distribution, setDistribution] = useState(null)
  const [table, setTable] = useState(null)
  const [insights, setInsights] = useState(null)
  const [err, setErr] = useState('')
  const [loading, setLoading] = useState(true)

  const year = useMemo(() => Number(monthStr.split('-')[0]) || new Date().getFullYear(), [monthStr])

  const baseParams = useMemo(() => {
    const p = { month: monthStr }
    if (accountId) p.accountId = accountId
    if (module === 'expenses' && expenseCat) p.expenseCategoryId = expenseCat
    if (module === 'income' && incomeCat) p.incomeCategoryId = incomeCat
    if (module === 'credit-cards' && creditCardId) p.cardId = creditCardId
    return p
  }, [monthStr, accountId, module, expenseCat, incomeCat, creditCardId])

  const trendTableParams = useMemo(() => {
    const p = { ...baseParams, type: granularity, year }
    return p
  }, [baseParams, granularity, year])

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const [ac, ec, ic, cc] = await Promise.all([
          listFinanceAccounts({ limit: 300 }),
          listPfExpenseCategories(),
          listPfIncomeCategories(),
          listCreditCards({ limit: 200 }),
        ])
        if (!cancelled) {
          setAccounts(ac || [])
          setExpCats(ec || [])
          setIncCats(ic || [])
          setCreditCards(Array.isArray(cc) ? cc : [])
        }
      } catch {
        if (!cancelled) {
          setAccounts([])
          setExpCats([])
          setIncCats([])
          setCreditCards([])
        }
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  const load = useCallback(async () => {
    setLoading(true)
    setErr('')
    try {
      const [s, tr, dist, tb, ins] = await Promise.all([
        getPfAnalyticsSummary(module, baseParams),
        getPfAnalyticsTrend(module, trendTableParams),
        getPfAnalyticsDistribution(module, baseParams),
        getPfAnalyticsTable(module, trendTableParams),
        getPfAnalyticsInsights(module, baseParams),
      ])
      setSummary(s)
      setTrend(tr)
      setDistribution(dist)
      setTable(tb)
      setInsights(ins)
    } catch (e) {
      setErr(e?.message || 'Failed to load analytics')
      setSummary(null)
      setTrend(null)
      setDistribution(null)
      setTable(null)
      setInsights(null)
    } finally {
      setLoading(false)
    }
  }, [module, baseParams, trendTableParams])

  useEffect(() => {
    load()
  }, [load])

  useEffect(() => {
    if (module !== 'credit-cards') setCreditCardId('')
  }, [module])

  const kpis = summary?.kpis
  const series = trend?.series || []
  const slices = distribution?.slices || []
  const rows = table?.rows || []
  const mom = summary?.comparison?.month_over_month_pct
  const partial = Boolean(summary?.partial || trend?.partial)
  const noTrendData = !loading && !err && series.length === 0
  const noSliceData = !loading && !err && slices.length === 0
  const noTableRows = !loading && !err && rows.length === 0
  const tableColCount =
    1 +
    (rows[0]?.amount != null || series[0]?.amount != null ? 1 : 0) +
    (rows[0]?.inflow != null || series[0]?.inflow != null ? 3 : 0)

  const barCompareData = useMemo(() => {
    if (!series.length) return []
    if (series[0].inflow != null) {
      return series.map((r) => ({
        label: r.label || r.date || r.month,
        inflow: r.inflow,
        outflow: r.outflow,
      }))
    }
    return series.map((r) => ({
      label: r.label || r.date || r.month,
      amount: r.amount,
    }))
  }, [series])

  const distBarData = useMemo(
    () => slices.map((s) => ({ name: s.name?.slice(0, 24) || '—', value: s.value })).slice(0, 12),
    [slices],
  )

  return (
    <div className="mx-auto max-w-[1400px] space-y-5">
      <header className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-[var(--pf-text)] sm:text-2xl">Analytics</h1>
          <p className="mt-1 text-sm text-[var(--pf-text-muted)]">
            Daily and monthly views per module — trends, breakdowns, and insights.
          </p>
        </div>
        {partial ? (
          <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/15 px-3 py-1 text-xs font-semibold text-amber-800 dark:text-amber-200">
            Partial data for this module
          </span>
        ) : null}
      </header>

      {/* z-40: dropdown must stack above KPI/chart cards below (sibling paint order + backdrop-blur layers) */}
      <div className={`${cardShell} relative z-40 !p-4`}>
        <div className="flex flex-wrap gap-2 border-b border-[var(--pf-border)] pb-3">
          {MODULES.map((m) => (
            <button
              key={m.slug}
              type="button"
              onClick={() => setModule(m.slug)}
              className={[
                'rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors',
                module === m.slug
                  ? 'bg-[var(--pf-primary)] text-white shadow-sm'
                  : 'bg-[var(--pf-card-hover)]/80 text-[var(--pf-text-muted)] hover:text-[var(--pf-text)]',
              ].join(' ')}
            >
              {m.label}
            </button>
          ))}
        </div>

        <div className="mt-4 flex flex-col gap-4 lg:flex-row lg:flex-wrap lg:items-end">
          <label className="flex min-w-[10rem] flex-col gap-1 text-xs font-semibold text-[var(--pf-text-muted)]">
            Month
            <input
              type="month"
              value={monthStr}
              onChange={(e) => setMonthStr(e.target.value)}
              className={pfSelectCompact}
            />
          </label>
          <div className="min-w-[12rem]">
            <p className="mb-1 text-xs font-semibold text-[var(--pf-text-muted)]">View</p>
            <PfSegmentedControl
              value={granularity}
              onChange={setGranularity}
              options={[
                { value: 'daily', label: 'Daily' },
                { value: 'monthly', label: 'Monthly' },
              ]}
            />
          </div>
          <div className="min-w-[12rem] flex-1">
            <p className="mb-1 text-xs font-semibold text-[var(--pf-text-muted)]">Account / bank</p>
            <PfBankAccountSelect value={accountId} onChange={setAccountId} accounts={accounts} />
          </div>
          {module === 'credit-cards' ? (
            <label className="flex min-w-[14rem] flex-1 flex-col gap-1 text-xs font-semibold text-[var(--pf-text-muted)]">
              Credit card
              <select
                value={creditCardId}
                onChange={(e) => setCreditCardId(e.target.value)}
                className={pfSelectCompact}
              >
                <option value="">All cards</option>
                {creditCards.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.card_name || `Card #${c.id}`}
                  </option>
                ))}
              </select>
            </label>
          ) : null}
          {module === 'expenses' ? (
            <label className="flex min-w-[10rem] flex-col gap-1 text-xs font-semibold text-[var(--pf-text-muted)]">
              Category
              <select
                value={expenseCat}
                onChange={(e) => setExpenseCat(e.target.value)}
                className={pfSelectCompact}
              >
                <option value="">All categories</option>
                {expCats.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </label>
          ) : null}
          {module === 'income' ? (
            <label className="flex min-w-[10rem] flex-col gap-1 text-xs font-semibold text-[var(--pf-text-muted)]">
              Category
              <select value={incomeCat} onChange={(e) => setIncomeCat(e.target.value)} className={pfSelectCompact}>
                <option value="">All categories</option>
                {incCats.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </label>
          ) : null}
        </div>
      </div>

      {err ? (
        <div className="rounded-[12px] border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-800 dark:text-red-200">
          {err}
        </div>
      ) : null}

      {loading ? (
        <div className="flex min-h-[24vh] items-center justify-center text-sm text-[var(--pf-text-muted)]">
          Loading analytics…
        </div>
      ) : (
        <>
          {/* KPI row */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
            {kpis
              ? [
                  kpiCard({
                    label:
                      module === 'credit-cards'
                        ? 'Credit limit'
                        : module === 'accounts'
                          ? 'Total balance'
                          : module === 'financial-statement'
                            ? 'Total activity'
                            : module === 'loans'
                              ? 'Repayments (month)'
                              : 'Total',
                    value: formatInr(kpis.total_amount),
                    sub:
                      module === 'credit-cards' && summary?.utilization_pct != null
                        ? `${summary.utilization_pct}% utilized`
                        : module === 'accounts'
                          ? 'Book balance (filtered account or all)'
                          : module === 'financial-statement'
                            ? 'Income + expense in scope'
                            : module === 'loans' && summary?.portfolio?.outstanding_lent != null
                              ? `Outstanding lent ${formatInr(summary.portfolio.outstanding_lent)}`
                            : undefined,
                    tone: 'asset',
                  }),
                  kpiCard({
                    label:
                      module === 'credit-cards'
                        ? 'Payments (month)'
                        : module === 'financial-statement'
                          ? 'Income'
                          : 'Inflow',
                    value: formatInr(kpis.inflow),
                    tone: 'inflow',
                  }),
                  kpiCard({
                    label:
                      module === 'credit-cards'
                        ? 'Spend (month)'
                        : module === 'financial-statement'
                          ? 'Expense'
                          : 'Outflow',
                    value: formatInr(kpis.outflow),
                    tone: 'outflow',
                  }),
                  kpiCard({
                    label: module === 'accounts' || module === 'financial-statement' ? 'Net (month)' : 'Net',
                    value: formatInr(kpis.net_change),
                    sub:
                      mom != null ? (
                        <span className="inline-flex items-center gap-1">
                          {mom >= 0 ? (
                            <ArrowTrendingUpIcon className="h-3.5 w-3.5 text-emerald-500" />
                          ) : (
                            <ArrowTrendingDownIcon className="h-3.5 w-3.5 text-red-500" />
                          )}
                          MoM {mom > 0 ? '+' : ''}
                          {mom}%
                        </span>
                      ) : null,
                    tone: kpis.net_change >= 0 ? 'inflow' : 'outflow',
                  }),
                  kpiCard({
                    label: module === 'accounts' || module === 'financial-statement' ? 'Avg daily net' : 'Average',
                    value: formatInr(kpis.average),
                    sub:
                      module === 'accounts' || module === 'financial-statement'
                        ? 'Income − expense, all days in month'
                        : module === 'credit-cards' && creditCardId
                          ? 'Mean daily spend (calendar days)'
                          : undefined,
                    tone: undefined,
                  }),
                  kpiCard({
                    label: module === 'accounts' || module === 'financial-statement' ? 'Best day net' : 'Highest',
                    value: formatInr(kpis.highest),
                    sub:
                      module === 'accounts' || module === 'financial-statement'
                        ? 'Strongest single day'
                        : module === 'credit-cards' && creditCardId
                          ? 'Highest spend day'
                          : undefined,
                    tone: undefined,
                  }),
                  kpiCard({
                    label: module === 'accounts' || module === 'financial-statement' ? 'Lowest day net' : 'Lowest',
                    value: formatInr(kpis.lowest),
                    sub:
                      module === 'accounts' || module === 'financial-statement'
                        ? 'Weakest single day'
                        : module === 'credit-cards' && creditCardId
                          ? 'Lowest spend day (incl. zero)'
                          : undefined,
                    tone: undefined,
                  }),
                ]
              : null}
          </div>

          {module === 'credit-cards' && summary?.utilization_pct != null ? (
            <p className="text-xs text-[var(--pf-text-muted)]">
              {summary.card_label ? (
                <>
                  <span className="font-semibold text-[var(--pf-text)]">{summary.card_label}</span>
                  {' · '}
                </>
              ) : null}
              Utilization {summary.utilization_pct}% · used {formatInr(summary.used)} · available{' '}
              {formatInr(summary.available)}
            </p>
          ) : null}

          {/* Charts row */}
          <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
            <div className={cardShell}>
              <div className="mb-2 flex items-center gap-2">
                <PresentationChartLineIcon className="h-4 w-4 text-[var(--pf-primary)]" />
                <h2 className="text-[13px] font-semibold text-[var(--pf-text)]">Trend</h2>
              </div>
              <div style={{ height: 260 }} className="relative">
                {noTrendData ? (
                  <div className="flex h-full items-center justify-center text-sm text-[var(--pf-text-muted)]">
                    No data for this period
                  </div>
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    {barCompareData[0]?.inflow != null ? (
                      <LineChart data={barCompareData}>
                        <CartesianGrid stroke={chartGridStroke} strokeDasharray="3 3" />
                        <XAxis dataKey="label" tick={{ fontSize: 10 }} />
                        <YAxis tick={{ fontSize: 10 }} width={48} />
                        <Tooltip contentStyle={chartTooltipBox} formatter={(v) => formatInr(v)} />
                        <Legend />
                        <Line type="monotone" dataKey="inflow" name="Inflow" stroke={COL_INFLOW} strokeWidth={2} dot={false} />
                        <Line type="monotone" dataKey="outflow" name="Outflow" stroke={COL_OUTFLOW} strokeWidth={2} dot={false} />
                      </LineChart>
                    ) : (
                      <LineChart data={barCompareData}>
                        <CartesianGrid stroke={chartGridStroke} strokeDasharray="3 3" />
                        <XAxis dataKey="label" tick={{ fontSize: 10 }} />
                        <YAxis tick={{ fontSize: 10 }} width={48} />
                        <Tooltip contentStyle={chartTooltipBox} formatter={(v) => formatInr(v)} />
                        <Line type="monotone" dataKey="amount" name="Amount" stroke={COL_ASSET} strokeWidth={2} dot={false} />
                      </LineChart>
                    )}
                  </ResponsiveContainer>
                )}
              </div>
            </div>

            <div className={cardShell}>
              <div className="mb-2 flex items-center gap-2">
                <ChartPieIcon className="h-4 w-4 text-[var(--pf-primary)]" />
                <h2 className="text-[13px] font-semibold text-[var(--pf-text)]">Breakdown</h2>
              </div>
              <div style={{ height: 260 }} className="relative">
                {noSliceData ? (
                  <div className="flex h-full items-center justify-center text-sm text-[var(--pf-text-muted)]">
                    No breakdown for this period
                  </div>
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={slices}
                        dataKey="value"
                        nameKey="name"
                        cx="50%"
                        cy="50%"
                        innerRadius={58}
                        outerRadius={88}
                        paddingAngle={2}
                      >
                        {slices.map((_, i) => (
                          <Cell key={i} fill={DONUT_COLS[i % DONUT_COLS.length]} />
                        ))}
                      </Pie>
                      <Tooltip contentStyle={chartTooltipBox} formatter={(v) => formatInr(v)} />
                    </PieChart>
                  </ResponsiveContainer>
                )}
              </div>
            </div>

            <div className={cardShell}>
              <div className="mb-2 flex items-center gap-2">
                <ChartBarIcon className="h-4 w-4 text-[var(--pf-primary)]" />
                <h2 className="text-[13px] font-semibold text-[var(--pf-text)]">Inflow vs outflow</h2>
              </div>
              <div style={{ height: 260 }} className="relative">
                {noTrendData ? (
                  <div className="flex h-full items-center justify-center text-sm text-[var(--pf-text-muted)]">
                    No data for this period
                  </div>
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={barCompareData}>
                      <CartesianGrid stroke={chartGridStroke} strokeDasharray="3 3" />
                      <XAxis dataKey="label" tick={{ fontSize: 10 }} />
                      <YAxis tick={{ fontSize: 10 }} width={48} />
                      <Tooltip contentStyle={chartTooltipBox} formatter={(v) => formatInr(v)} />
                      <Legend />
                      {barCompareData[0]?.inflow != null ? (
                        <>
                          <Bar dataKey="inflow" name="Inflow" fill={COL_INFLOW} radius={[4, 4, 0, 0]} />
                          <Bar dataKey="outflow" name="Outflow" fill={COL_OUTFLOW} radius={[4, 4, 0, 0]} />
                        </>
                      ) : (
                        <Bar dataKey="amount" name="Amount" fill={COL_ASSET} radius={[4, 4, 0, 0]} />
                      )}
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </div>
            </div>

            <div className={cardShell}>
              <div className="mb-2 flex items-center gap-2">
                <ChartBarIcon className="h-4 w-4 text-[var(--pf-primary)]" />
                <h2 className="text-[13px] font-semibold text-[var(--pf-text)]">Distribution</h2>
              </div>
              <div style={{ height: 260 }} className="relative">
                {noSliceData ? (
                  <div className="flex h-full items-center justify-center text-sm text-[var(--pf-text-muted)]">
                    No distribution for this period
                  </div>
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={distBarData} layout="vertical" margin={{ left: 8, right: 16 }}>
                      <CartesianGrid stroke={chartGridStroke} strokeDasharray="3 3" />
                      <XAxis type="number" tick={{ fontSize: 10 }} />
                      <YAxis type="category" dataKey="name" width={100} tick={{ fontSize: 10 }} />
                      <Tooltip contentStyle={chartTooltipBox} formatter={(v) => formatInr(v)} />
                      <Bar dataKey="value" fill={COL_ASSET} radius={[0, 4, 4, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </div>
            </div>
          </div>

          {/* Table */}
          <div className={cardShell}>
            <h2 className="mb-3 text-[13px] font-semibold text-[var(--pf-text)]">
              {granularity === 'daily' ? 'Daily' : 'Monthly'} table
            </h2>
            <div className={pfTableWrap}>
              <table className={pfTable}>
                <thead>
                  <tr>
                    <th className={pfTh}>Period</th>
                    {rows[0]?.amount != null ? <th className={pfThRight}>Amount</th> : null}
                    {rows[0]?.inflow != null ? (
                      <>
                        <th className={pfThRight}>Inflow</th>
                        <th className={pfThRight}>Outflow</th>
                        <th className={pfThRight}>Net</th>
                      </>
                    ) : null}
                  </tr>
                </thead>
                <tbody>
                  {noTableRows ? (
                    <tr className={pfTrHover}>
                      <td colSpan={Math.max(tableColCount, 1)} className={`${pfTd} text-[var(--pf-text-muted)]`}>
                        No rows for this period
                      </td>
                    </tr>
                  ) : (
                    rows.map((r, i) => (
                      <tr key={i} className={pfTrHover}>
                        <td className={pfTd}>{r.label || r.date || r.month}</td>
                        {r.amount != null ? <td className={pfTdRight}>{formatInr(r.amount)}</td> : null}
                        {r.inflow != null ? (
                          <>
                            <td className={`${pfTdRight} text-emerald-600 dark:text-emerald-400`}>{formatInr(r.inflow)}</td>
                            <td className={`${pfTdRight} text-red-600 dark:text-red-400`}>{formatInr(r.outflow)}</td>
                            <td className={pfTdRight}>{formatInr(r.net)}</td>
                          </>
                        ) : null}
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Insights */}
          <div className={cardShell}>
            <h2 className="mb-3 text-[13px] font-semibold text-[var(--pf-text)]">Insights</h2>
            <ul className="space-y-2 text-sm text-[var(--pf-text)]">
              {(insights?.insights || []).map((t, i) => (
                <li key={i} className="flex gap-2">
                  <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-[var(--pf-primary)]" />
                  <span>{t}</span>
                </li>
              ))}
              {(insights?.warnings || []).map((t, i) => (
                <li key={`w-${i}`} className="flex gap-2 text-amber-800 dark:text-amber-200">
                  <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-amber-500" />
                  <span>{t}</span>
                </li>
              ))}
              {!insights?.insights?.length && !insights?.warnings?.length ? (
                <li className="text-[var(--pf-text-muted)]">No insights for this selection.</li>
              ) : null}
            </ul>
          </div>
        </>
      )}
    </div>
  )
}
