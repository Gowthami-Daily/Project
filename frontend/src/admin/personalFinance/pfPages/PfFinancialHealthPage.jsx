import { useCallback, useEffect, useState } from 'react'
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import {
  getPfFinancialHealthInsights,
  getPfFinancialHealthSummary,
  getPfFinancialHealthTable,
  getPfFinancialHealthTrend,
  postPfFinancialHealthRecalculate,
} from '../api.js'
import PfSegmentedControl from '../PfSegmentedControl.jsx'
import { formatInr } from '../pfFormat.js'
import { pfTable, pfTableWrap, pfTd, pfTdRight, pfTh, pfThRight, pfTrHover } from '../pfFormStyles.js'
import { chartGridStroke, chartTooltipBox } from '../../../components/dashboard/chartTheme.js'

const card =
  'rounded-[12px] border border-[var(--pf-border)] bg-[var(--pf-card)]/85 p-5 shadow-[var(--pf-shadow)] backdrop-blur-md dark:bg-white/[0.04]'

export default function PfFinancialHealthPage() {
  const [year, setYear] = useState(() => new Date().getFullYear())
  const [granularity, setGranularity] = useState('monthly')
  const [summary, setSummary] = useState(null)
  const [trend, setTrend] = useState(null)
  const [table, setTable] = useState(null)
  const [insights, setInsights] = useState(null)
  const [err, setErr] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    setErr('')
    try {
      const [s, tr, tb, ins] = await Promise.all([
        getPfFinancialHealthSummary(),
        getPfFinancialHealthTrend({ year, type: granularity }),
        getPfFinancialHealthTable(year),
        getPfFinancialHealthInsights(),
      ])
      setSummary(s)
      setTrend(tr)
      setTable(tb)
      setInsights(ins)
    } catch (e) {
      setErr(e?.message || 'Failed to load financial health')
    } finally {
      setLoading(false)
    }
  }, [year, granularity])

  useEffect(() => {
    load()
  }, [load])

  const hero = summary?.hero
  const m = summary?.metrics
  const bd = m?.breakdown_scores || {}
  const scoreSeries = trend?.series || []
  const nw = trend?.net_worth_trend || []
  const sr = trend?.savings_rate_trend || []

  const onRecalc = async () => {
    setSaving(true)
    try {
      await postPfFinancialHealthRecalculate()
      await load()
    } catch (e) {
      setErr(e?.message || 'Could not save snapshot')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="mx-auto max-w-[1400px] space-y-5">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-[var(--pf-text)]">Financial health</h1>
          <p className="mt-1 text-sm text-[var(--pf-text-muted)]">
            Composite 0–100 score from savings, liquidity, credit, debt, investments, and stability.
          </p>
        </div>
        <button
          type="button"
          onClick={onRecalc}
          disabled={saving}
          className="rounded-xl bg-[var(--pf-primary)] px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
        >
          {saving ? 'Saving…' : 'Save snapshot'}
        </button>
      </header>

      <div className={`${card} flex flex-wrap items-end gap-4`}>
        <label className="text-xs font-semibold text-[var(--pf-text-muted)]">
          Year
          <input
            type="number"
            className="ml-2 w-24 rounded-lg border border-[var(--pf-border)] bg-[var(--pf-card)] px-2 py-1 text-sm"
            value={year}
            min={2020}
            max={2035}
            onChange={(e) => setYear(Number(e.target.value))}
          />
        </label>
        <div>
          <p className="mb-1 text-xs font-semibold text-[var(--pf-text-muted)]">Trend granularity</p>
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

      {err ? <div className="rounded-[12px] border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm">{err}</div> : null}
      {loading ? <p className="text-sm text-[var(--pf-text-muted)]">Loading…</p> : null}

      {!loading && m ? (
        <>
          <div
            className={`${card} bg-gradient-to-br from-violet-600/15 to-[var(--pf-card)]`}
            style={{ borderColor: 'rgba(139, 92, 246, 0.35)' }}
          >
            <p className="text-xs font-bold uppercase tracking-wider text-violet-700 dark:text-violet-300">Health score</p>
            <div className="mt-2 flex flex-wrap items-end gap-6">
              <p className="text-5xl font-black tabular-nums text-[var(--pf-text)]">{hero?.score ?? m.score}</p>
              <div>
                <p className="text-sm font-semibold text-[var(--pf-text-muted)]">/ 100</p>
                <p className="text-lg font-bold text-violet-600 dark:text-violet-300">{hero?.status ?? m.status}</p>
              </div>
            </div>
            <p className="mt-3 text-xs text-[var(--pf-text-muted)]">
              Liquid ≈ {formatInr(m.context?.liquid_total)} · Avg monthly expense (6m) ≈{' '}
              {formatInr(m.context?.avg_monthly_expense_6m)}
            </p>
          </div>

          <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-6">
            {[
              ['Savings rate', bd.savings_rate],
              ['Emergency fund', bd.emergency_fund_months],
              ['Credit util.', bd.credit_utilization],
              ['Debt / income', bd.debt_to_income],
              ['Investments', bd.investment_ratio],
              ['Stability', bd.expense_stability],
            ].map(([label, val]) => (
              <div key={label} className={card}>
                <p className="text-[11px] font-semibold text-[var(--pf-text-muted)]">{label}</p>
                <p className="mt-1 text-xl font-bold text-[var(--pf-text)]">{val ?? '—'}</p>
                <p className="text-[10px] text-[var(--pf-text-muted)]">sub-score</p>
              </div>
            ))}
          </div>

          <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
            <div className={card}>
              <h3 className="text-sm font-semibold text-[var(--pf-text)]">Score trend</h3>
              <div className="mt-2" style={{ height: 260 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={scoreSeries.length ? scoreSeries : [{ label: '-', score: m.score }]}>
                    <CartesianGrid stroke={chartGridStroke} strokeDasharray="3 3" />
                    <XAxis dataKey="label" tick={{ fontSize: 10 }} />
                    <YAxis domain={[0, 100]} tick={{ fontSize: 10 }} width={36} />
                    <Tooltip contentStyle={chartTooltipBox} />
                    <Line type="monotone" dataKey="score" name="Score" stroke="#8b5cf6" strokeWidth={2} dot />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>
            <div className={card}>
              <h3 className="text-sm font-semibold text-[var(--pf-text)]">Net worth (proxy series)</h3>
              <div className="mt-2" style={{ height: 260 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={nw.length ? nw : [{ label: '-', net_worth: 0 }]}>
                    <CartesianGrid stroke={chartGridStroke} strokeDasharray="3 3" />
                    <XAxis dataKey="label" tick={{ fontSize: 10 }} />
                    <YAxis tick={{ fontSize: 10 }} width={52} />
                    <Tooltip contentStyle={chartTooltipBox} formatter={(v) => formatInr(v)} />
                    <Legend />
                    <Line type="monotone" dataKey="net_worth" name="Net worth" stroke="#2563eb" strokeWidth={2} dot={false} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>
            <div className={card}>
              <h3 className="text-sm font-semibold text-[var(--pf-text)]">Savings rate trend</h3>
              <div className="mt-2" style={{ height: 260 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={sr.length ? sr : [{ label: '-', savings_rate: 0 }]}>
                    <CartesianGrid stroke={chartGridStroke} strokeDasharray="3 3" />
                    <XAxis dataKey="label" tick={{ fontSize: 10 }} />
                    <YAxis tick={{ fontSize: 10 }} width={40} />
                    <Tooltip contentStyle={chartTooltipBox} />
                    <Line type="monotone" dataKey="savings_rate" name="Rate" stroke="#22c55e" strokeWidth={2} dot={false} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>
            <div className={card}>
              <h3 className="text-sm font-semibold text-[var(--pf-text)]">Debt vs income (proxy)</h3>
              <div className="mt-2" style={{ height: 260 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart
                    data={
                      trend?.debt_to_income_trend?.length
                        ? trend.debt_to_income_trend
                        : [{ label: '-', debt_to_income: m?.debt_to_income ?? 0 }]
                    }
                  >
                    <CartesianGrid stroke={chartGridStroke} strokeDasharray="3 3" />
                    <XAxis dataKey="label" tick={{ fontSize: 10 }} />
                    <YAxis tick={{ fontSize: 10 }} width={40} />
                    <Tooltip contentStyle={chartTooltipBox} />
                    <Line type="monotone" dataKey="debt_to_income" name="DTI" stroke="#f97316" strokeWidth={2} dot={false} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>

          <div className={card}>
            <h3 className="mb-3 text-sm font-semibold text-[var(--pf-text)]">Metrics table</h3>
            <div className={pfTableWrap}>
              <table className={pfTable}>
                <thead>
                  <tr>
                    <th className={pfTh}>Date</th>
                    <th className={pfThRight}>Score</th>
                    <th className={pfThRight}>Savings rate</th>
                    <th className={pfThRight}>E-fund mo</th>
                    <th className={pfThRight}>Credit %</th>
                    <th className={pfThRight}>DTI</th>
                  </tr>
                </thead>
                <tbody>
                  {(table?.rows || []).map((r, i) => (
                    <tr key={i} className={pfTrHover}>
                      <td className={pfTd}>{r.date}</td>
                      <td className={pfTdRight}>{r.score}</td>
                      <td className={pfTdRight}>{r.savings_rate ?? '—'}</td>
                      <td className={pfTdRight}>{r.emergency_fund_months ?? '—'}</td>
                      <td className={pfTdRight}>{r.credit_utilization ?? '—'}</td>
                      <td className={pfTdRight}>{r.debt_to_income ?? '—'}</td>
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
                <li key={i}>• {t}</li>
              ))}
            </ul>
          </div>
        </>
      ) : null}
    </div>
  )
}
