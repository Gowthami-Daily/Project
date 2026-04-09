import { ArrowTrendingDownIcon, ArrowTrendingUpIcon, ChartBarIcon, ChartPieIcon, PresentationChartLineIcon } from '@heroicons/react/24/solid'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, Legend, Line, LineChart, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { getPfAnalyticsDistribution, getPfAnalyticsInsights, getPfAnalyticsSummary, getPfAnalyticsTrend } from '../api.js'
import PfSegmentedControl from '../PfSegmentedControl.jsx'
import { formatInr } from '../pfFormat.js'
import { cardCls, pfTable, pfTableWrap, pfTd, pfTdRight, pfTh, pfThRight, pfTrHover } from '../pfFormStyles.js'
import { chartGridStroke, chartTooltipBox } from '../../../components/dashboard/chartTheme.js'

const DONUT_COLS = ['#2563eb', '#22c55e', '#f97316', '#a855f7', '#0ea5e9', '#ec4899', '#64748b', '#14b8a6']
const ENTITY_COLS = ['#22c55e', '#3b82f6', '#f97316', '#a855f7', '#06b6d4', '#f43f5e', '#84cc16']
const BREAKDOWN_TABS = [
  { key: 'all', label: 'All' },
  { key: 'banks', label: 'Banks' },
  { key: 'cards', label: 'Cards' },
  { key: 'expenses', label: 'Expenses' },
  { key: 'income', label: 'Income' },
  { key: 'investments', label: 'Investments' },
  { key: 'loans', label: 'Loans' },
  { key: 'chit', label: 'Chit' },
]

function defaultMonthStr() {
  const t = new Date()
  return `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, '0')}`
}

export default function PfCashFlowPage() {
  const [monthStr, setMonthStr] = useState(defaultMonthStr)
  const [view, setView] = useState('daily')
  const [chartMode, setChartMode] = useState('line')
  const [breakdown, setBreakdown] = useState('all')
  const [preset, setPreset] = useState('this-month')
  const [hiddenEntities, setHiddenEntities] = useState({})
  const [summary, setSummary] = useState(null)
  const [trend, setTrend] = useState(null)
  const [distribution, setDistribution] = useState(null)
  const [insights, setInsights] = useState(null)
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState('')

  const year = useMemo(() => Number(monthStr.split('-')[0]) || new Date().getFullYear(), [monthStr])

  const load = useCallback(async () => {
    setLoading(true)
    setErr('')
    try {
      const q = { month: monthStr, breakdown }
      const [s, t, d, i] = await Promise.all([
        getPfAnalyticsSummary('cash-flow', q),
        getPfAnalyticsTrend('cash-flow', { ...q, type: view, year }),
        getPfAnalyticsDistribution('cash-flow', q),
        getPfAnalyticsInsights('cash-flow', q),
      ])
      setSummary(s || null)
      setTrend(t || null)
      setDistribution(d || null)
      setInsights(i || null)
      setHiddenEntities({})
    } catch (e) {
      setErr(e?.message || 'Failed to load cash flow')
      setSummary(null)
      setTrend(null)
      setDistribution(null)
      setInsights(null)
    } finally {
      setLoading(false)
    }
  }, [monthStr, view, year, breakdown])

  useEffect(() => {
    load()
  }, [load])

  const kpis = summary?.kpis || {}
  const slices = distribution?.slices || []
  const series = trend?.series || []
  const entities = trend?.entities || []
  const detailedRows = trend?.detailed_rows || []
  const accountFlow = (summary?.entity_totals || summary?.account_flow || []).slice(0, 12)
  const mom = summary?.comparison?.month_over_month_pct
  const net = Number(kpis.net_change) || 0
  const inflow = Number(kpis.inflow) || 0
  const outflow = Number(kpis.outflow) || 0
  const burn = Number(kpis.burn_rate) || Math.max(0, -net)
  const avg = Number(kpis.average) || 0

  const noData = !loading && !err && !series.length && !detailedRows.length

  const heroData = useMemo(
    () =>
      (series || []).map((r) => ({
        period: r.label || r.date || r.month,
        inflow: Number(r.inflow) || 0,
        outflow: Number(r.outflow) || 0,
        net: Number(r.net) || 0,
      })),
    [series],
  )

  const entityNames = useMemo(() => entities.map((e) => e.name), [entities])
  const multiLineData = useMemo(() => {
    if (!entities.length) return []
    const keys = [...new Set(entities.flatMap((e) => e.series.map((x) => x.label)))]
    return keys.map((k) => {
      const row = { period: k }
      for (const e of entities) {
        const p = e.series.find((x) => x.label === k)
        row[e.name] = Number(p?.net || 0)
      }
      row.total = Object.keys(row)
        .filter((x) => x !== 'period')
        .reduce((s, key) => s + Number(row[key] || 0), 0)
      return row
    })
  }, [entities])

  const visibleEntityNames = useMemo(
    () => entityNames.filter((n) => !hiddenEntities[n]).slice(0, 6),
    [entityNames, hiddenEntities],
  )

  function toggleEntity(name) {
    setHiddenEntities((m) => ({ ...m, [name]: !m[name] }))
  }

  const accountBarData = useMemo(
    () =>
      accountFlow.map((x) => ({
        name: String(x.name || 'Entity').slice(0, 28),
        net: Number(x.net) || 0,
        inflow: Number(x.inflow) || 0,
        outflow: Number(x.outflow) || 0,
      })),
    [accountFlow],
  )

  function applyPreset(v) {
    setPreset(v)
    const now = new Date()
    if (v === 'this-month') {
      setMonthStr(`${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`)
      setView('daily')
      return
    }
    if (v === 'last-month') {
      now.setMonth(now.getMonth() - 1)
      setMonthStr(`${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`)
      setView('daily')
      return
    }
    if (v === 'last-3m') {
      setView('monthly')
    }
  }

  const rows = breakdown === 'all' ? heroData : detailedRows

  return (
    <div className="mx-auto max-w-[1440px] space-y-5">
      <header className="sticky top-0 z-20 rounded-xl border border-[var(--pf-border)] bg-[var(--pf-header)]/75 px-4 py-3 backdrop-blur-xl">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <h1 className="text-xl font-bold text-[var(--pf-text)] sm:text-2xl">Cash Flow</h1>
            <p className="text-sm text-[var(--pf-text-muted)]">Global money movement with deep visibility across banks, cards, modules, loans, investments, and chit funds.</p>
          </div>
          <div className="flex flex-wrap items-end gap-2">
            <button type="button" className={`${preset === 'this-month' ? 'bg-[var(--pf-primary)] text-white' : 'bg-[var(--pf-card-hover)] text-[var(--pf-text-muted)]'} rounded-lg px-3 py-1.5 text-xs font-semibold`} onClick={() => applyPreset('this-month')}>This month</button>
            <button type="button" className={`${preset === 'last-month' ? 'bg-[var(--pf-primary)] text-white' : 'bg-[var(--pf-card-hover)] text-[var(--pf-text-muted)]'} rounded-lg px-3 py-1.5 text-xs font-semibold`} onClick={() => applyPreset('last-month')}>Last month</button>
            <button type="button" className={`${preset === 'last-3m' ? 'bg-[var(--pf-primary)] text-white' : 'bg-[var(--pf-card-hover)] text-[var(--pf-text-muted)]'} rounded-lg px-3 py-1.5 text-xs font-semibold`} onClick={() => applyPreset('last-3m')}>Last 3 months</button>
            <label className="flex flex-col gap-1 text-xs font-semibold text-[var(--pf-text-muted)]">
              Month
              <input type="month" className="rounded-lg border border-[var(--pf-border)] bg-[var(--pf-card)] px-2 py-1.5 text-sm text-[var(--pf-text)]" value={monthStr} onChange={(e) => setMonthStr(e.target.value)} />
            </label>
            <div className="min-w-[11rem]">
              <p className="mb-1 text-xs font-semibold text-[var(--pf-text-muted)]">View</p>
              <PfSegmentedControl value={view} onChange={setView} options={[{ value: 'daily', label: 'Daily' }, { value: 'monthly', label: 'Monthly' }]} />
            </div>
            <div className="min-w-[11rem]">
              <p className="mb-1 text-xs font-semibold text-[var(--pf-text-muted)]">Chart</p>
              <PfSegmentedControl value={chartMode} onChange={setChartMode} options={[{ value: 'line', label: 'Line view' }, { value: 'stacked', label: 'Stacked view' }]} />
            </div>
          </div>
        </div>
      </header>

      <div className={`${cardCls} !p-3`}>
        <div className="flex flex-wrap gap-2">
          {BREAKDOWN_TABS.map((t) => (
            <button key={t.key} type="button" onClick={() => setBreakdown(t.key)} className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors ${breakdown === t.key ? 'bg-[var(--pf-primary)] text-white' : 'bg-[var(--pf-card-hover)] text-[var(--pf-text-muted)] hover:text-[var(--pf-text)]'}`}>
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {err ? <div className="rounded-[12px] border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-200">{err}</div> : null}

      <section className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        <div className={cardCls}><p className="text-[11px] font-semibold uppercase text-[var(--pf-text-muted)]">Total inflow</p><p className="mt-1 text-2xl font-bold text-emerald-400">{formatInr(inflow)}</p></div>
        <div className={cardCls}><p className="text-[11px] font-semibold uppercase text-[var(--pf-text-muted)]">Total outflow</p><p className="mt-1 text-2xl font-bold text-red-400">{formatInr(outflow)}</p></div>
        <div className={`${cardCls} col-span-2 lg:col-span-1`}><p className="text-[11px] font-semibold uppercase text-[var(--pf-text-muted)]">Net cashflow</p><p className={`mt-1 text-2xl font-bold ${net >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>{formatInr(net)}</p>{mom != null ? <p className="mt-1 inline-flex items-center gap-1 text-xs text-[var(--pf-text-muted)]">{mom >= 0 ? <ArrowTrendingUpIcon className="h-3.5 w-3.5 text-emerald-400" /> : <ArrowTrendingDownIcon className="h-3.5 w-3.5 text-red-400" />} {mom > 0 ? '+' : ''}{mom}% vs previous period</p> : null}</div>
        <div className={cardCls}><p className="text-[11px] font-semibold uppercase text-[var(--pf-text-muted)]">Avg daily cashflow</p><p className={`mt-1 text-2xl font-bold ${avg >= 0 ? 'text-sky-400' : 'text-amber-300'}`}>{formatInr(avg)}</p></div>
        <div className={cardCls}><p className="text-[11px] font-semibold uppercase text-[var(--pf-text-muted)]">Burn rate</p><p className={`mt-1 text-2xl font-bold ${burn > 0 ? 'text-orange-400' : 'text-[var(--pf-text)]'}`}>{formatInr(burn)}</p></div>
      </section>

      {loading ? (
        <div className={`${cardCls} py-16 text-center text-[var(--pf-text-muted)]`}>Loading cash flow…</div>
      ) : (
        <>
          <section className={cardCls}>
            <div className="mb-2 flex items-center gap-2"><PresentationChartLineIcon className="h-4 w-4 text-[var(--pf-primary)]" /><h2 className="text-[13px] font-semibold text-[var(--pf-text)]">Cash flow trend</h2></div>
            {breakdown !== 'all' && visibleEntityNames.length ? (
              <div className="mb-2 flex flex-wrap gap-2">
                {visibleEntityNames.map((name, idx) => (
                  <button key={name} type="button" onClick={() => toggleEntity(name)} className="inline-flex items-center gap-1 rounded-full border border-[var(--pf-border)] bg-[var(--pf-card-hover)] px-2 py-0.5 text-[10px] text-[var(--pf-text)]">
                    <span className="inline-block h-2 w-2 rounded-full" style={{ backgroundColor: ENTITY_COLS[idx % ENTITY_COLS.length] }} />
                    {name}
                  </button>
                ))}
              </div>
            ) : null}
            <div style={{ height: 330 }}>
              {noData ? (
                <div className="flex h-full items-center justify-center text-sm text-[var(--pf-text-muted)]">No transactions found for this period</div>
              ) : breakdown === 'all' ? (
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={heroData}>
                    <defs>
                      <linearGradient id="gIn" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#22c55e" stopOpacity={0.35} /><stop offset="95%" stopColor="#22c55e" stopOpacity={0.02} /></linearGradient>
                      <linearGradient id="gOut" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#ef4444" stopOpacity={0.28} /><stop offset="95%" stopColor="#ef4444" stopOpacity={0.02} /></linearGradient>
                    </defs>
                    <CartesianGrid stroke={chartGridStroke} strokeDasharray="3 3" />
                    <XAxis dataKey="period" tick={{ fontSize: 10 }} />
                    <YAxis tick={{ fontSize: 10 }} width={62} />
                    <Tooltip contentStyle={chartTooltipBox} formatter={(v) => formatInr(v)} />
                    <Legend />
                    <Area type="monotone" dataKey="inflow" stroke="#22c55e" fill="url(#gIn)" strokeWidth={2} />
                    <Area type="monotone" dataKey="outflow" stroke="#ef4444" fill="url(#gOut)" strokeWidth={2} />
                    <Line type="monotone" dataKey="net" stroke="#3b82f6" strokeWidth={2.8} dot={false} />
                  </AreaChart>
                </ResponsiveContainer>
              ) : chartMode === 'stacked' ? (
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={multiLineData}>
                    <CartesianGrid stroke={chartGridStroke} strokeDasharray="3 3" />
                    <XAxis dataKey="period" tick={{ fontSize: 10 }} />
                    <YAxis tick={{ fontSize: 10 }} width={62} />
                    <Tooltip contentStyle={chartTooltipBox} formatter={(v) => formatInr(v)} />
                    <Legend />
                    {visibleEntityNames.map((name, idx) => (
                      <Area key={name} type="monotone" stackId="1" dataKey={name} stroke={ENTITY_COLS[idx % ENTITY_COLS.length]} fill={ENTITY_COLS[idx % ENTITY_COLS.length]} fillOpacity={0.24} strokeWidth={2} />
                    ))}
                  </AreaChart>
                </ResponsiveContainer>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={multiLineData}>
                    <CartesianGrid stroke={chartGridStroke} strokeDasharray="3 3" />
                    <XAxis dataKey="period" tick={{ fontSize: 10 }} />
                    <YAxis tick={{ fontSize: 10 }} width={62} />
                    <Tooltip contentStyle={chartTooltipBox} formatter={(v) => formatInr(v)} />
                    <Legend />
                    {visibleEntityNames.map((name, idx) => (
                      <Line key={name} type="monotone" dataKey={name} stroke={ENTITY_COLS[idx % ENTITY_COLS.length]} strokeWidth={2.2} dot={false} />
                    ))}
                  </LineChart>
                </ResponsiveContainer>
              )}
            </div>
          </section>

          <section className="grid grid-cols-1 gap-4 xl:grid-cols-2">
            <div className={cardCls}>
              <div className="mb-2 flex items-center gap-2"><ChartBarIcon className="h-4 w-4 text-[var(--pf-primary)]" /><h2 className="text-[13px] font-semibold text-[var(--pf-text)]">Inflow vs outflow</h2></div>
              <div style={{ height: 260 }}>
                {noData ? <div className="flex h-full items-center justify-center text-sm text-[var(--pf-text-muted)]">No data for this period</div> : (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={heroData}>
                      <CartesianGrid stroke={chartGridStroke} strokeDasharray="3 3" />
                      <XAxis dataKey="period" tick={{ fontSize: 10 }} />
                      <YAxis tick={{ fontSize: 10 }} width={62} />
                      <Tooltip contentStyle={chartTooltipBox} formatter={(v) => formatInr(v)} />
                      <Legend />
                      <Bar dataKey="inflow" fill="#22c55e" radius={[4, 4, 0, 0]} />
                      <Bar dataKey="outflow" fill="#ef4444" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </div>
            </div>
            <div className={cardCls}>
              <div className="mb-2 flex items-center gap-2"><ChartPieIcon className="h-4 w-4 text-[var(--pf-primary)]" /><h2 className="text-[13px] font-semibold text-[var(--pf-text)]">Cashflow distribution</h2></div>
              <div style={{ height: 260 }}>
                {!slices.length ? <div className="flex h-full items-center justify-center text-sm text-[var(--pf-text-muted)]">No distribution for this period</div> : (
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie data={slices} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={58} outerRadius={88} paddingAngle={2}>
                        {slices.map((_, i) => <Cell key={i} fill={DONUT_COLS[i % DONUT_COLS.length]} />)}
                      </Pie>
                      <Tooltip contentStyle={chartTooltipBox} formatter={(v) => formatInr(v)} />
                    </PieChart>
                  </ResponsiveContainer>
                )}
              </div>
            </div>
          </section>

          <section className={cardCls}>
            <div className="mb-2 flex items-center gap-2"><ChartBarIcon className="h-4 w-4 text-[var(--pf-primary)]" /><h2 className="text-[13px] font-semibold text-[var(--pf-text)]">Account / entity flow</h2></div>
            <div style={{ height: 300 }}>
              {!accountBarData.length ? <div className="flex h-full items-center justify-center text-sm text-[var(--pf-text-muted)]">No entity flow in this period</div> : (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={accountBarData} layout="vertical" margin={{ left: 8, right: 16 }}>
                    <CartesianGrid stroke={chartGridStroke} strokeDasharray="3 3" />
                    <XAxis type="number" tick={{ fontSize: 10 }} />
                    <YAxis type="category" dataKey="name" width={130} tick={{ fontSize: 10 }} />
                    <Tooltip contentStyle={chartTooltipBox} formatter={(v) => formatInr(v)} />
                    <Legend />
                    <Bar dataKey="inflow" fill="#22c55e" radius={[0, 4, 4, 0]} />
                    <Bar dataKey="outflow" fill="#ef4444" radius={[0, 4, 4, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>
          </section>

          <section className={cardCls}>
            <h2 className="mb-3 text-[13px] font-semibold text-[var(--pf-text)]">{view === 'daily' ? 'Daily' : 'Monthly'} cashflow table</h2>
            <div className={pfTableWrap}>
              <table className={pfTable}>
                <thead>
                  <tr>
                    <th className={pfTh}>{view === 'daily' ? 'Date' : 'Month'}</th>
                    {breakdown === 'all' ? null : <th className={pfTh}>Source</th>}
                    {breakdown === 'all' ? null : <th className={pfTh}>Type</th>}
                    <th className={pfThRight}>Inflow</th>
                    <th className={pfThRight}>Outflow</th>
                    <th className={pfThRight}>Net</th>
                  </tr>
                </thead>
                <tbody>
                  {!rows.length ? (
                    <tr className={pfTrHover}><td colSpan={breakdown === 'all' ? 4 : 6} className={`${pfTd} text-[var(--pf-text-muted)]`}>No rows for this period</td></tr>
                  ) : (
                    rows.map((r, i) => (
                      <tr key={i} className={pfTrHover}>
                        <td className={pfTd}>{r.label || r.date || r.month || r.period}</td>
                        {breakdown === 'all' ? null : <td className={pfTd}>{r.source || '—'}</td>}
                        {breakdown === 'all' ? null : <td className={pfTd}>{r.type || '—'}</td>}
                        <td className={`${pfTdRight} text-emerald-400`}>{formatInr(r.inflow)}</td>
                        <td className={`${pfTdRight} text-red-400`}>{formatInr(r.outflow)}</td>
                        <td className={`${pfTdRight} ${(Number(r.net) || 0) >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>{formatInr(r.net)}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </section>

          <section className={cardCls}>
            <h2 className="mb-3 text-[13px] font-semibold text-[var(--pf-text)]">Insights</h2>
            <ul className="space-y-2 text-sm text-[var(--pf-text)]">
              {(insights?.insights || []).map((t, i) => (
                <li key={i} className="flex gap-2"><span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-[var(--pf-primary)]" /><span>{t}</span></li>
              ))}
              {(insights?.warnings || []).map((t, i) => (
                <li key={`w-${i}`} className="flex gap-2 text-amber-200"><span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-amber-500" /><span>{t}</span></li>
              ))}
              {!insights?.insights?.length && !insights?.warnings?.length ? <li className="text-[var(--pf-text-muted)]">No insights for this selection.</li> : null}
            </ul>
          </section>
        </>
      )}
    </div>
  )
}
