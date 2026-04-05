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
  getPfTaxDistribution,
  getPfTaxInsights,
  getPfTaxSummary,
  getPfTaxTable,
  getPfTaxTrend,
} from '../api.js'
import PfSegmentedControl from '../PfSegmentedControl.jsx'
import { formatInr } from '../pfFormat.js'
import { pfSelectCompact, pfTable, pfTableWrap, pfTd, pfTdRight, pfTh, pfThRight, pfTrHover } from '../pfFormStyles.js'
import { chartGridStroke, chartTooltipBox } from '../../../components/dashboard/chartTheme.js'

const COL_INCOME = '#22c55e'
const COL_TAX = '#eab308'
const COL_CG = '#f97316'
const COL_DED = '#3b82f6'
const DONUT = ['#3b82f6', '#22c55e', '#eab308', '#a855f7', '#f97316', '#0ea5e9']

const card =
  'rounded-[12px] border border-[var(--pf-border)] bg-[var(--pf-card)]/85 p-5 shadow-[var(--pf-shadow)] backdrop-blur-md dark:bg-white/[0.04]'

function fyStartFromToday() {
  const t = new Date()
  const m = t.getMonth() + 1
  const y = t.getFullYear()
  return m >= 4 ? y : y - 1
}

export default function PfTaxDashboardPage() {
  const [fyStart, setFyStart] = useState(fyStartFromToday)
  const [monthStr, setMonthStr] = useState(() => {
    const t = new Date()
    return `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, '0')}`
  })
  const [regime, setRegime] = useState('old')
  const [granularity, setGranularity] = useState('daily')

  const { year, month } = useMemo(() => {
    const [y, m] = monthStr.split('-').map(Number)
    return { year: y, month: m }
  }, [monthStr])

  const [summary, setSummary] = useState(null)
  const [trend, setTrend] = useState(null)
  const [distribution, setDistribution] = useState(null)
  const [table, setTable] = useState(null)
  const [insights, setInsights] = useState(null)
  const [err, setErr] = useState('')
  const [loading, setLoading] = useState(true)

  const fyOptions = useMemo(() => {
    const base = fyStartFromToday()
    return [base - 2, base - 1, base, base + 1]
  }, [])

  const load = useCallback(async () => {
    setLoading(true)
    setErr('')
    try {
      const base = { fyStart, year, month, regime }
      const [s, tr, dist, tb, ins] = await Promise.all([
        getPfTaxSummary({ ...base, type: granularity }),
        getPfTaxTrend({ ...base, type: granularity }),
        getPfTaxDistribution(base),
        getPfTaxTable({ ...base, type: granularity }),
        getPfTaxInsights(base),
      ])
      setSummary(s)
      setTrend(tr)
      setDistribution(dist)
      setTable(tb)
      setInsights(ins)
    } catch (e) {
      setErr(e?.message || 'Failed to load tax dashboard')
      setSummary(null)
    } finally {
      setLoading(false)
    }
  }, [fyStart, year, month, regime, granularity])

  useEffect(() => {
    load()
  }, [load])

  const hero = summary?.hero
  const kpis = summary?.kpis
  const progress = summary?.savings_progress || {}
  const trendSeries = trend?.series || []
  const slices = distribution?.slices || []
  const rows = table?.rows || []

  const incomeVsTaxData = useMemo(() => {
    if (!trendSeries.length) return []
    if (trendSeries[0].income != null) {
      return trendSeries.map((r) => ({
        label: r.label || r.date || r.month,
        income: r.income,
        tax_paid: r.tax_paid,
      }))
    }
    return []
  }, [trendSeries])

  const cgBarData = useMemo(() => {
    if (!trendSeries.length) return []
    if (trendSeries[0].capital_gains != null) {
      return trendSeries.map((r) => ({
        label: r.label || r.month,
        gains: r.capital_gains,
        tax: r.capital_gains_tax,
      }))
    }
    return rows
      .filter((r) => r.capital_gains > 0 || r.capital_gains_tax > 0)
      .map((r) => ({ label: r.date, gains: r.capital_gains, tax: r.capital_gains_tax }))
  }, [trendSeries, rows])

  const lineTrend = useMemo(() => {
    return trendSeries.map((r) => ({
      label: r.label || r.date || r.month,
      tax_paid: r.tax_paid ?? r.tax ?? 0,
      income: r.income ?? 0,
    }))
  }, [trendSeries])

  return (
    <div className="mx-auto max-w-[1400px] space-y-5">
      <header>
        <h1 className="text-2xl font-bold tracking-tight text-[var(--pf-text)]">Tax dashboard</h1>
        <p className="mt-1 text-sm text-[var(--pf-text-muted)]">
          Indian FY (Apr–Mar), old/new regime estimate, deductions and capital gains — verify with a CA before filing.
        </p>
      </header>

      <div className={`${card} flex flex-col gap-4 lg:flex-row lg:flex-wrap lg:items-end`}>
        <label className="flex flex-col gap-1 text-xs font-semibold text-[var(--pf-text-muted)]">
          Financial year (start year)
          <select value={fyStart} onChange={(e) => setFyStart(Number(e.target.value))} className={pfSelectCompact}>
            {fyOptions.map((y) => (
              <option key={y} value={y}>
                FY {y}–{String(y + 1).slice(-2)}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-xs font-semibold text-[var(--pf-text-muted)]">
          Month (calendar)
          <input type="month" value={monthStr} onChange={(e) => setMonthStr(e.target.value)} className={pfSelectCompact} />
        </label>
        <div>
          <p className="mb-1 text-xs font-semibold text-[var(--pf-text-muted)]">Regime</p>
          <PfSegmentedControl
            value={regime}
            onChange={setRegime}
            options={[
              { value: 'old', label: 'Old' },
              { value: 'new', label: 'New' },
            ]}
          />
        </div>
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
      </div>

      {err ? (
        <div className="rounded-[12px] border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm text-amber-900 dark:text-amber-100">
          {err}
        </div>
      ) : null}

      {loading ? (
        <p className="text-sm text-[var(--pf-text-muted)]">Loading…</p>
      ) : (
        <>
          <div className={`${card} border-[#eab308]/30 bg-gradient-to-br from-[var(--pf-card)] to-amber-500/5`}>
            <p className="text-xs font-bold uppercase tracking-wider text-[#ca8a04] dark:text-[#fde047]">
              Tax summary · FY {summary?.period?.fy ?? ''}
            </p>
            <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
              <div>
                <p className="text-[11px] font-semibold text-[var(--pf-text-muted)]">Taxable income</p>
                <p className="text-xl font-bold text-[var(--pf-text)]">{formatInr(hero?.taxable_income)}</p>
              </div>
              <div>
                <p className="text-[11px] font-semibold text-[var(--pf-text-muted)]">Total tax (incl. cess)</p>
                <p className="text-xl font-bold text-[#ca8a04]">{formatInr(hero?.total_tax_liability)}</p>
              </div>
              <div>
                <p className="text-[11px] font-semibold text-[var(--pf-text-muted)]">Tax paid</p>
                <p className="text-xl font-bold text-emerald-600 dark:text-emerald-400">{formatInr(hero?.tax_paid)}</p>
              </div>
              <div>
                <p className="text-[11px] font-semibold text-[var(--pf-text-muted)]">Remaining</p>
                <p className="text-xl font-bold text-red-600 dark:text-red-400">{formatInr(hero?.tax_remaining)}</p>
              </div>
              <div>
                <p className="text-[11px] font-semibold text-[var(--pf-text-muted)]">Effective rate</p>
                <p className="text-xl font-bold text-[var(--pf-text)]">{hero?.effective_tax_rate_pct ?? 0}%</p>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            {[
              ['Total income', kpis?.total_income, COL_INCOME],
              ['Deductions', kpis?.deductions, COL_DED],
              ['Taxable', kpis?.taxable_income, COL_DED],
              ['Tax liability', kpis?.tax_liability, COL_TAX],
              ['Tax paid', kpis?.tax_paid, COL_INCOME],
              ['Remaining', kpis?.tax_remaining, '#ef4444'],
              ['Tax saved (est.)', kpis?.tax_saved, '#a855f7'],
              ['CGT', kpis?.capital_gains_tax, COL_CG],
            ].map(([label, val, color]) => (
              <div key={label} className={card}>
                <p className="text-[11px] font-semibold uppercase tracking-wide text-[var(--pf-text-muted)]">{label}</p>
                <p className="mt-1 text-lg font-bold tabular-nums" style={{ color }}>
                  {formatInr(val)}
                </p>
              </div>
            ))}
          </div>

          <div className={card}>
            <h2 className="text-sm font-semibold text-[var(--pf-text)]">Tax savings progress (old regime caps)</h2>
            <div className="mt-4 space-y-4">
              {['80C', '80D', '80CCD', '24'].map((key) => {
                const p = progress[key]
                if (!p) return null
                return (
                  <div key={key}>
                    <div className="flex justify-between text-xs font-medium text-[var(--pf-text)]">
                      <span>
                        {key} — {formatInr(p.used)} / {formatInr(p.cap)}
                      </span>
                      <span className="text-[var(--pf-text-muted)]">{p.pct}%</span>
                    </div>
                    <div className="mt-1 h-2 overflow-hidden rounded-full bg-[var(--pf-card-hover)]">
                      <div
                        className="h-full rounded-full bg-[#3b82f6] transition-all"
                        style={{ width: `${Math.min(100, p.pct)}%` }}
                      />
                    </div>
                    <p className="mt-0.5 text-[11px] text-[var(--pf-text-muted)]">Room left: {formatInr(p.remaining)}</p>
                  </div>
                )
              })}
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
            <div className={card}>
              <h3 className="text-sm font-semibold text-[var(--pf-text)]">Income vs tax paid</h3>
              <div className="mt-2" style={{ height: 260 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={incomeVsTaxData.length ? incomeVsTaxData : [{ label: '—', income: 0, tax_paid: 0 }]}>
                    <CartesianGrid stroke={chartGridStroke} strokeDasharray="3 3" />
                    <XAxis dataKey="label" tick={{ fontSize: 10 }} />
                    <YAxis tick={{ fontSize: 10 }} width={48} />
                    <Tooltip contentStyle={chartTooltipBox} formatter={(v) => formatInr(v)} />
                    <Legend />
                    <Bar dataKey="income" name="Income" fill={COL_INCOME} radius={[4, 4, 0, 0]} />
                    <Bar dataKey="tax_paid" name="Tax paid" fill={COL_TAX} radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
            <div className={card}>
              <h3 className="text-sm font-semibold text-[var(--pf-text)]">Deductions breakdown</h3>
              <div className="mt-2" style={{ height: 260 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={slices.length ? slices : [{ name: '—', value: 1 }]}
                      dataKey="value"
                      nameKey="name"
                      innerRadius={56}
                      outerRadius={88}
                      paddingAngle={2}
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
              <h3 className="text-sm font-semibold text-[var(--pf-text)]">Tax paid trend</h3>
              <div className="mt-2" style={{ height: 260 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={lineTrend.length ? lineTrend : [{ label: '-', tax_paid: 0 }]}>
                    <CartesianGrid stroke={chartGridStroke} strokeDasharray="3 3" />
                    <XAxis dataKey="label" tick={{ fontSize: 10 }} />
                    <YAxis tick={{ fontSize: 10 }} width={48} />
                    <Tooltip contentStyle={chartTooltipBox} formatter={(v) => formatInr(v)} />
                    <Legend />
                    <Line type="monotone" dataKey="tax_paid" name="Tax paid" stroke={COL_TAX} strokeWidth={2} dot={false} />
                    <Line type="monotone" dataKey="income" name="Income" stroke={COL_INCOME} strokeWidth={2} dot={false} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>
            <div className={card}>
              <h3 className="text-sm font-semibold text-[var(--pf-text)]">Capital gains vs tax</h3>
              <div className="mt-2" style={{ height: 260 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={cgBarData.length ? cgBarData : [{ label: '—', gains: 0, tax: 0 }]}>
                    <CartesianGrid stroke={chartGridStroke} strokeDasharray="3 3" />
                    <XAxis dataKey="label" tick={{ fontSize: 10 }} />
                    <YAxis tick={{ fontSize: 10 }} width={48} />
                    <Tooltip contentStyle={chartTooltipBox} formatter={(v) => formatInr(v)} />
                    <Legend />
                    <Bar dataKey="gains" name="Gains" fill={COL_CG} radius={[4, 4, 0, 0]} />
                    <Bar dataKey="tax" name="Tax" fill={COL_TAX} radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>

          <div className={card}>
            <h3 className="mb-3 text-sm font-semibold text-[var(--pf-text)]">
              {granularity === 'daily' ? 'Daily' : 'Monthly'} detail
            </h3>
            <div className={pfTableWrap}>
              <table className={pfTable}>
                <thead>
                  <tr>
                    {granularity === 'daily' ? (
                      <>
                        <th className={pfTh}>Date</th>
                        <th className={pfThRight}>Income</th>
                        <th className={pfThRight}>Deductions</th>
                        <th className={pfThRight}>Tax paid</th>
                        <th className={pfThRight}>CG</th>
                        <th className={pfThRight}>CGT</th>
                      </>
                    ) : (
                      <>
                        <th className={pfTh}>Month</th>
                        <th className={pfThRight}>Income</th>
                        <th className={pfThRight}>Deductions</th>
                        <th className={pfThRight}>Tax paid</th>
                        <th className={pfThRight}>CG</th>
                        <th className={pfThRight}>CGT</th>
                      </>
                    )}
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r, i) => (
                    <tr key={i} className={pfTrHover}>
                      <td className={pfTd}>{r.date || r.label || r.month}</td>
                      <td className={pfTdRight}>{formatInr(r.income)}</td>
                      <td className={pfTdRight}>{formatInr(r.deductions)}</td>
                      <td className={pfTdRight}>{formatInr(r.tax_paid)}</td>
                      <td className={pfTdRight}>{formatInr(r.capital_gains)}</td>
                      <td className={pfTdRight}>{formatInr(r.capital_gains_tax)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className={card}>
            <h3 className="mb-2 text-sm font-semibold text-[var(--pf-text)]">Insights</h3>
            <ul className="space-y-2 text-sm text-[var(--pf-text)]">
              {(insights?.insights || []).map((t, i) => (
                <li key={i} className="flex gap-2">
                  <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-[#eab308]" />
                  {t}
                </li>
              ))}
              {(insights?.warnings || []).map((t, i) => (
                <li key={`w-${i}`} className="text-amber-800 dark:text-amber-200">
                  {t}
                </li>
              ))}
            </ul>
          </div>
        </>
      )}
    </div>
  )
}
