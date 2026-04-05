import { useCallback, useEffect, useMemo, useState } from 'react'
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
  createPfBudget,
  getPfBudgetDistribution,
  getPfBudgetInsights,
  getPfBudgetSummary,
  getPfBudgetTable,
  getPfBudgetTrend,
  listPfExpenseCategories,
} from '../api.js'
import { AppButton, AppInput, AppModal } from '../pfDesignSystem/index.js'
import PfSegmentedControl from '../PfSegmentedControl.jsx'
import { formatInr } from '../pfFormat.js'
import { pfSelectCompact, pfTable, pfTableWrap, pfTd, pfTdRight, pfTh, pfThRight, pfTrHover } from '../pfFormStyles.js'
import { chartGridStroke, chartTooltipBox } from '../../../components/dashboard/chartTheme.js'

const COL_BUD = '#2563eb'
const COL_SPENT = '#ef4444'
const COL_SAVE = '#a855f7'
const DONUT = ['#2563eb', '#22c55e', '#eab308', '#a855f7', '#f97316']

const card =
  'rounded-[12px] border border-[var(--pf-border)] bg-[var(--pf-card)]/85 p-5 shadow-[var(--pf-shadow)] backdrop-blur-md dark:bg-white/[0.04]'

function monthFirstDay(ym) {
  return `${ym}-01`
}

export default function PfBudgetDashboardPage() {
  const [monthStr, setMonthStr] = useState(() => {
    const t = new Date()
    return `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, '0')}`
  })
  const [granularity, setGranularity] = useState('daily')
  const [catId, setCatId] = useState('')
  const [cats, setCats] = useState([])
  const [summary, setSummary] = useState(null)
  const [trend, setTrend] = useState(null)
  const [distribution, setDistribution] = useState(null)
  const [table, setTable] = useState(null)
  const [insights, setInsights] = useState(null)
  const [err, setErr] = useState('')
  const [loading, setLoading] = useState(true)
  const [addOpen, setAddOpen] = useState(false)
  const [addName, setAddName] = useState('')
  const [addCatId, setAddCatId] = useState('')
  const [addLabel, setAddLabel] = useState('')
  const [addAmount, setAddAmount] = useState('')
  const [addStart, setAddStart] = useState(() => monthFirstDay(`${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}`))
  const [addEnd, setAddEnd] = useState('')
  const [addSubmitting, setAddSubmitting] = useState(false)
  const [addErr, setAddErr] = useState('')

  useEffect(() => {
    listPfExpenseCategories().then(setCats).catch(() => setCats([]))
  }, [])

  const q = useMemo(
    () => ({
      month: monthStr,
      type: granularity,
      expenseCategoryId: catId || undefined,
    }),
    [monthStr, granularity, catId],
  )

  const load = useCallback(async () => {
    setLoading(true)
    setErr('')
    try {
      const [s, tr, dist, tb, ins] = await Promise.all([
        getPfBudgetSummary(q),
        getPfBudgetTrend(q),
        getPfBudgetDistribution(q),
        getPfBudgetTable(q),
        getPfBudgetInsights(q),
      ])
      setSummary(s)
      setTrend(tr)
      setDistribution(dist)
      setTable(tb)
      setInsights(ins)
    } catch (e) {
      setErr(e?.message || 'Failed to load budgets')
    } finally {
      setLoading(false)
    }
  }, [q])

  useEffect(() => {
    load()
  }, [load])

  useEffect(() => {
    if (addOpen) {
      setAddStart(monthFirstDay(monthStr))
      setAddErr('')
    }
  }, [addOpen, monthStr])

  async function handleCreateBudget(e) {
    e.preventDefault()
    setAddErr('')
    const amt = Number(String(addAmount).replace(/,/g, ''))
    if (!amt || Number.isNaN(amt) || amt <= 0) {
      setAddErr('Enter a positive monthly budget amount.')
      return
    }
    const idNum = addCatId ? Number(addCatId) : NaN
    if (!addCatId && !addLabel.trim()) {
      setAddErr('Choose an expense category or enter a custom category label.')
      return
    }
    setAddSubmitting(true)
    try {
      await createPfBudget({
        name: addName.trim() || undefined,
        expenseCategoryId: addCatId && !Number.isNaN(idNum) ? idNum : undefined,
        categoryLabel: addCatId ? undefined : addLabel.trim(),
        monthlyBudget: amt,
        startDate: addStart,
        endDate: addEnd.trim() || null,
      })
      setAddOpen(false)
      setAddName('')
      setAddCatId('')
      setAddLabel('')
      setAddAmount('')
      setAddEnd('')
      await load()
    } catch (er) {
      setAddErr(er?.message || 'Could not save budget')
    } finally {
      setAddSubmitting(false)
    }
  }

  const kpis = summary?.kpis
  const slices = distribution?.slices || []
  const trendSeries = trend?.series || []
  const rows = table?.rows || []
  const categoryRows = summary?.category_rows || []

  const budgetVsActual = useMemo(() => {
    if (granularity === 'monthly') {
      return trendSeries.map((r) => ({
        label: r.label,
        budget: r.budget,
        spent: r.spent,
      }))
    }
    return categoryRows.map((r) => ({
      label: r.category.slice(0, 14),
      budget: r.budget,
      spent: r.spent,
    }))
  }, [granularity, trendSeries, categoryRows])

  const lineDaily = useMemo(() => {
    const pace = trend?.daily_budget_pace
    return trendSeries.map((r) => ({
      label: r.label,
      spent: r.spent,
      pace: pace || 0,
    }))
  }, [trendSeries, trend])

  const overOnly = useMemo(() => categoryRows.filter((r) => r.status === 'over'), [categoryRows])

  return (
    <div className="mx-auto max-w-[1400px] space-y-5">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-[var(--pf-text)]">Budget</h1>
          <p className="mt-1 text-sm text-[var(--pf-text-muted)]">Category budgets vs actual spend — daily and monthly views.</p>
        </div>
        <button
          type="button"
          onClick={() => setAddOpen(true)}
          className="inline-flex shrink-0 items-center justify-center rounded-[10px] bg-[var(--pf-primary)] px-4 py-2 text-sm font-semibold text-white shadow-sm hover:opacity-95"
        >
          + Add budget
        </button>
      </header>

      <AppModal open={addOpen} onClose={() => !addSubmitting && setAddOpen(false)} title="Add budget">
        <form onSubmit={handleCreateBudget} className="space-y-3">
          <p className="text-xs text-[var(--pf-text-muted)]">
            Set a monthly limit for an expense category. Spend is matched using your expense entries for the selected month.
          </p>
          {addErr ? <p className="text-sm text-red-600 dark:text-red-400">{addErr}</p> : null}
          <label className="block text-xs font-semibold text-[var(--pf-text-muted)]">
            Label (optional)
            <AppInput className="mt-1 w-full" value={addName} onChange={(e) => setAddName(e.target.value)} placeholder="e.g. Groceries cap" />
          </label>
          <label className="block text-xs font-semibold text-[var(--pf-text-muted)]">
            Expense category
            <select
              value={addCatId}
              onChange={(e) => {
                setAddCatId(e.target.value)
                if (e.target.value) setAddLabel('')
              }}
              className={`${pfSelectCompact} mt-1 w-full`}
            >
              <option value="">— Pick category —</option>
              {cats.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </label>
          <p className="text-[11px] text-[var(--pf-text-muted)]">Or, if the category is not in the list:</p>
          <label className="block text-xs font-semibold text-[var(--pf-text-muted)]">
            Custom category name
            <AppInput
              className="mt-1 w-full"
              value={addLabel}
              onChange={(e) => setAddLabel(e.target.value)}
              placeholder="Only if you did not pick a category above"
              disabled={Boolean(addCatId)}
            />
          </label>
          <label className="block text-xs font-semibold text-[var(--pf-text-muted)]">
            Monthly budget (₹)
            <AppInput
              className="mt-1 w-full"
              inputMode="decimal"
              value={addAmount}
              onChange={(e) => setAddAmount(e.target.value)}
              placeholder="e.g. 15000"
              required
            />
          </label>
          <label className="block text-xs font-semibold text-[var(--pf-text-muted)]">
            Effective from
            <input type="date" className={`${pfSelectCompact} mt-1 w-full`} value={addStart} onChange={(e) => setAddStart(e.target.value)} required />
          </label>
          <label className="block text-xs font-semibold text-[var(--pf-text-muted)]">
            Until (optional)
            <input type="date" className={`${pfSelectCompact} mt-1 w-full`} value={addEnd} onChange={(e) => setAddEnd(e.target.value)} />
          </label>
          <div className="flex justify-end gap-2 pt-2">
            <AppButton type="button" variant="ghost" disabled={addSubmitting} onClick={() => setAddOpen(false)}>
              Cancel
            </AppButton>
            <AppButton type="submit" disabled={addSubmitting}>
              {addSubmitting ? 'Saving…' : 'Save budget'}
            </AppButton>
          </div>
        </form>
      </AppModal>

      <div className={`${card} flex flex-col gap-4 lg:flex-row lg:flex-wrap lg:items-end`}>
        <label className="flex flex-col gap-1 text-xs font-semibold text-[var(--pf-text-muted)]">
          Month
          <input type="month" value={monthStr} onChange={(e) => setMonthStr(e.target.value)} className={pfSelectCompact} />
        </label>
        <div>
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
        <label className="min-w-[12rem] flex flex-col gap-1 text-xs font-semibold text-[var(--pf-text-muted)]">
          Category filter
          <select value={catId} onChange={(e) => setCatId(e.target.value)} className={pfSelectCompact}>
            <option value="">All</option>
            {cats.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </label>
      </div>

      {err ? <div className="rounded-[12px] border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-800">{err}</div> : null}
      {loading ? <p className="text-sm text-[var(--pf-text-muted)]">Loading…</p> : null}

      {!loading && !err ? (
        <>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
            {[
              ['Total budget', kpis?.total_budget, COL_BUD, 'inr'],
              ['Total spent', kpis?.total_spent, COL_SPENT, 'inr'],
              ['Remaining', kpis?.remaining_budget, COL_SAVE, 'inr'],
              ['Over-budget lines', kpis?.over_budget_categories, '#f97316', 'int'],
              ['Savings potential', kpis?.savings_potential, COL_SAVE, 'inr'],
            ].map(([label, val, color, kind]) => (
              <div key={label} className={card}>
                <p className="text-[11px] font-semibold uppercase tracking-wide text-[var(--pf-text-muted)]">{label}</p>
                <p className="mt-1 text-lg font-bold tabular-nums" style={{ color }}>
                  {kind === 'int' ? String(val ?? 0) : formatInr(val)}
                </p>
              </div>
            ))}
          </div>

          <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
            <div className={card}>
              <h3 className="text-sm font-semibold text-[var(--pf-text)]">Budget vs actual</h3>
              <div className="mt-2" style={{ height: 260 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={budgetVsActual.length ? budgetVsActual : [{ label: '—', budget: 0, spent: 0 }]}>
                    <CartesianGrid stroke={chartGridStroke} strokeDasharray="3 3" />
                    <XAxis dataKey="label" tick={{ fontSize: 10 }} />
                    <YAxis tick={{ fontSize: 10 }} width={48} />
                    <Tooltip contentStyle={chartTooltipBox} formatter={(v) => formatInr(v)} />
                    <Legend />
                    <Bar dataKey="budget" name="Budget" fill={COL_BUD} radius={[4, 4, 0, 0]} />
                    <Bar dataKey="spent" name="Spent" fill={COL_SPENT} radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
            <div className={card}>
              <h3 className="text-sm font-semibold text-[var(--pf-text)]">Budget distribution</h3>
              <div className="mt-2" style={{ height: 260 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={slices.length ? slices : [{ name: '—', value: 1 }]}
                      dataKey="value"
                      nameKey="name"
                      innerRadius={52}
                      outerRadius={86}
                    >
                      {(slices.length ? slices : [{ name: '—', value: 1 }]).map((_, i) => (
                        <Cell key={i} fill={DONUT[i % DONUT.length]} />
                      ))}
                    </Pie>
                    <Tooltip contentStyle={chartTooltipBox} formatter={(v) => formatInr(v)} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </div>
            <div className={card}>
              <h3 className="text-sm font-semibold text-[var(--pf-text)]">Spend vs daily pace</h3>
              <div className="mt-2" style={{ height: 260 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={lineDaily.length ? lineDaily : [{ label: '-', spent: 0, pace: 0 }]}>
                    <CartesianGrid stroke={chartGridStroke} strokeDasharray="3 3" />
                    <XAxis dataKey="label" tick={{ fontSize: 10 }} />
                    <YAxis tick={{ fontSize: 10 }} width={48} />
                    <Tooltip contentStyle={chartTooltipBox} formatter={(v) => formatInr(v)} />
                    <Legend />
                    <Line type="monotone" dataKey="spent" name="Spent" stroke={COL_SPENT} strokeWidth={2} dot={false} />
                    <Line type="monotone" dataKey="pace" name="Daily budget pace" stroke={COL_BUD} strokeWidth={2} dot={false} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>
            <div className={card}>
              <h3 className="text-sm font-semibold text-[var(--pf-text)]">Top over-budget</h3>
              <div className="mt-2" style={{ height: 260 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={
                      overOnly.length
                        ? overOnly.map((r) => ({
                            name: r.category.slice(0, 12),
                            over: Math.max(0, r.spent - r.budget),
                          }))
                        : [{ name: '—', over: 0 }]
                    }
                    layout="vertical"
                    margin={{ left: 8 }}
                  >
                    <CartesianGrid stroke={chartGridStroke} strokeDasharray="3 3" />
                    <XAxis type="number" tick={{ fontSize: 10 }} />
                    <YAxis type="category" dataKey="name" width={88} tick={{ fontSize: 10 }} />
                    <Tooltip contentStyle={chartTooltipBox} formatter={(v) => formatInr(v)} />
                    <Bar dataKey="over" name="Over budget" fill="#f97316" radius={[0, 4, 4, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>

          <div className={card}>
            <h3 className="mb-3 text-sm font-semibold text-[var(--pf-text)]">Category table</h3>
            <div className={pfTableWrap}>
              <table className={pfTable}>
                <thead>
                  <tr>
                    <th className={pfTh}>Category</th>
                    <th className={pfThRight}>Budget</th>
                    <th className={pfThRight}>Spent</th>
                    <th className={pfThRight}>Remaining</th>
                    <th className={pfThRight}>% used</th>
                    <th className={pfTh}>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {categoryRows.map((r) => (
                    <tr key={r.budget_id} className={pfTrHover}>
                      <td className={pfTd}>{r.category}</td>
                      <td className={pfTdRight}>{formatInr(r.budget)}</td>
                      <td className={pfTdRight}>{formatInr(r.spent)}</td>
                      <td className={pfTdRight}>{formatInr(r.remaining)}</td>
                      <td className={pfTdRight}>{r.pct_used}%</td>
                      <td className={pfTd}>{r.status}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {granularity === 'daily' && rows.length ? (
              <>
                <h4 className="mb-2 mt-6 text-xs font-semibold uppercase text-[var(--pf-text-muted)]">Daily lines</h4>
                <div className={pfTableWrap}>
                  <table className={pfTable}>
                    <thead>
                      <tr>
                        <th className={pfTh}>Date</th>
                        <th className={pfThRight}>Spent</th>
                      </tr>
                    </thead>
                    <tbody>
                      {rows.map((r, i) => (
                        <tr key={i} className={pfTrHover}>
                          <td className={pfTd}>{r.date || r.label}</td>
                          <td className={pfTdRight}>{formatInr(r.spent)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            ) : null}
          </div>

          <div className={card}>
            <h3 className="mb-2 text-sm font-semibold text-[var(--pf-text)]">Insights</h3>
            <ul className="space-y-2 text-sm">
              {(insights?.insights || []).map((t, i) => (
                <li key={i} className="text-[var(--pf-text)]">
                  • {t}
                </li>
              ))}
            </ul>
          </div>
        </>
      ) : null}
    </div>
  )
}
