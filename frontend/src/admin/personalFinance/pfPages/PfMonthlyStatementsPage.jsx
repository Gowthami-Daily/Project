import { useCallback, useEffect, useMemo, useState } from 'react'
import { useOutletContext } from 'react-router-dom'
import {
  getMonthLedger,
  getMonthlyFinancialTables,
  getPfToken,
  listFinanceAccounts,
  setPfToken,
} from '../api.js'
import {
  cardCls,
  inputCls,
  labelCls,
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

const MONTH_SHORT = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec',
]

const STATEMENT_TABS = [
  { id: 'daily', label: 'Daily' },
  { id: 'monthly', label: 'Monthly' },
]

function monthColumnHeading(row) {
  const mi = row.month_index
  const key = row.month_key
  if (mi >= 1 && mi <= 12 && key) {
    const y = key.split('-')[0]
    return `${MONTH_SHORT[mi - 1]}-${String(y).slice(-2)}`
  }
  return row.label ?? ''
}

function formatDayHeading(isoDate) {
  if (!isoDate) return ''
  const d = new Date(`${isoDate}T12:00:00`)
  if (Number.isNaN(d.getTime())) return isoDate
  return d.toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })
}

function buildMergedLedger(income, expenses) {
  const inc = (income ?? []).map((r) => ({ ...r, kind: 'income' }))
  const exp = (expenses ?? []).map((r) => ({ ...r, kind: 'expense' }))
  return [...inc, ...exp].sort((a, b) => {
    const da = String(a.entry_date ?? '')
    const db = String(b.entry_date ?? '')
    if (da !== db) return db.localeCompare(da)
    return (Number(b.id) || 0) - (Number(a.id) || 0)
  })
}

function groupByDateDesc(rows) {
  const m = new Map()
  for (const r of rows) {
    const d = String(r.entry_date ?? '')
    if (!m.has(d)) m.set(d, [])
    m.get(d).push(r)
  }
  return [...m.entries()].sort((a, b) => b[0].localeCompare(a[0]))
}

function rowDetail(r) {
  if (r.kind === 'income') {
    const parts = [r.received_from, r.description].filter(Boolean)
    return parts.length ? parts.join(' · ') : '—'
  }
  const bits = [r.paid_by, r.payment_instrument_label, r.description].filter(Boolean)
  if (r.payment_status && String(r.payment_status).toUpperCase() === 'PENDING') {
    bits.push('Pending')
  }
  return bits.length ? bits.join(' · ') : '—'
}

/** Sticky row label + month columns (financial tables) */
const tableShell = `mt-4 ${pfTableWrap}`
const thCorner =
  'sticky left-0 z-20 min-w-[8.5rem] bg-sky-100 px-3 py-3 text-left text-[11px] font-bold uppercase tracking-wider text-sky-950 border-b border-sky-200/90 border-r border-sky-200/60'
const thMonth =
  'bg-sky-100 px-3 py-3 text-right text-[11px] font-bold uppercase tracking-wider text-sky-950 border-b border-sky-200/90 whitespace-nowrap min-w-[5.5rem]'
const tdLabel =
  'sticky left-0 z-10 bg-sky-50/90 px-3 py-2.5 text-sm font-semibold text-slate-800 border-b border-sky-100 border-r border-sky-100/80 shadow-[2px_0_8px_-2px_rgba(14,165,233,0.08)]'
const tdVal =
  'border-b border-sky-100/90 px-3 py-2.5 text-right text-sm font-mono tabular-nums text-slate-800'

export default function PfMonthlyStatementsPage() {
  const { onSessionInvalid } = useOutletContext() || {}
  const { tick, refresh } = usePfRefresh()
  const [activeTab, setActiveTab] = useState('daily')
  const now = new Date()
  const [year, setYear] = useState(() => now.getFullYear())
  const [month, setMonth] = useState(() => now.getMonth() + 1)
  const [bankFilter, setBankFilter] = useState('')
  const [accounts, setAccounts] = useState([])
  const [monthlyData, setMonthlyData] = useState(null)
  const [dailyData, setDailyData] = useState(null)
  const [monthlyLoading, setMonthlyLoading] = useState(false)
  const [dailyLoading, setDailyLoading] = useState(false)
  const [error, setError] = useState('')

  const yearOptions = useMemo(() => {
    const y = new Date().getFullYear()
    return [y - 2, y - 1, y, y + 1]
  }, [])

  const accountNameById = useMemo(() => {
    const m = new Map()
    for (const a of accounts) m.set(a.id, a.account_name)
    return m
  }, [accounts])

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

  const loadMonthlyTables = useCallback(async () => {
    if (!getPfToken()) return
    setMonthlyLoading(true)
    setError('')
    try {
      const q = bankFilter === '' ? undefined : bankFilter
      const res = await getMonthlyFinancialTables(year, q)
      setMonthlyData(res)
    } catch (e) {
      if (e.status === 401) {
        setPfToken(null)
        onSessionInvalid?.()
      } else {
        setError(e.message || 'Failed to load monthly tables')
      }
      setMonthlyData(null)
    } finally {
      setMonthlyLoading(false)
    }
  }, [year, bankFilter, onSessionInvalid])

  const loadDailyLedger = useCallback(async () => {
    if (!getPfToken()) return
    setDailyLoading(true)
    setError('')
    try {
      const q = bankFilter === '' ? undefined : bankFilter
      const res = await getMonthLedger(year, month, q)
      setDailyData(res)
    } catch (e) {
      if (e.status === 401) {
        setPfToken(null)
        onSessionInvalid?.()
      } else {
        setError(e.message || 'Failed to load daily transactions')
      }
      setDailyData(null)
    } finally {
      setDailyLoading(false)
    }
  }, [year, month, bankFilter, onSessionInvalid])

  useEffect(() => {
    loadAccounts()
  }, [loadAccounts, tick])

  useEffect(() => {
    if (activeTab !== 'daily') return
    loadDailyLedger()
  }, [activeTab, loadDailyLedger, tick])

  useEffect(() => {
    if (activeTab !== 'monthly') return
    loadMonthlyTables()
  }, [activeTab, loadMonthlyTables, tick])

  const mergedDaily = useMemo(
    () => buildMergedLedger(dailyData?.income, dailyData?.expenses),
    [dailyData],
  )
  const byDay = useMemo(() => groupByDateDesc(mergedDaily), [mergedDaily])

  const rows = Array.isArray(monthlyData?.rows) ? monthlyData.rows : []
  const filterName = bankFilter
    ? accounts.find((a) => String(a.id) === bankFilter)?.account_name ?? ''
    : ''

  const loading = activeTab === 'daily' ? dailyLoading : monthlyLoading

  function handleReload() {
    refresh()
    if (activeTab === 'daily') loadDailyLedger()
    else loadMonthlyTables()
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0 flex-1">
          <h1 className="text-xl font-bold text-slate-900 sm:text-2xl">Financial statement</h1>
          <p className="mt-1 text-sm text-slate-500">
            <strong className="font-medium text-slate-700">Daily</strong> shows every income and expense in the selected
            month. <strong className="font-medium text-slate-700">Monthly</strong> is the income statement, cash flow, and
            balance sheet with months across the top.
          </p>
        </div>
        <div className="flex shrink-0 flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-end sm:justify-end">
          <div>
            <label htmlFor="pf-fs-year" className={labelCls}>
              Year
            </label>
            <select
              id="pf-fs-year"
              className={`${inputCls} mt-1 min-w-[5.5rem]`}
              value={year}
              onChange={(e) => setYear(Number(e.target.value))}
            >
              {yearOptions.map((y) => (
                <option key={y} value={y}>
                  {y}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="pf-fs-bank" className={labelCls}>
              Bank / account
            </label>
            <select
              id="pf-fs-bank"
              className={`${inputCls} mt-1 min-w-[12rem] sm:min-w-[14rem]`}
              value={bankFilter}
              onChange={(e) => setBankFilter(e.target.value)}
            >
              <option value="">All banks (combined)</option>
              {accounts.map((a) => (
                <option key={a.id} value={String(a.id)}>
                  {a.account_name}
                </option>
              ))}
            </select>
          </div>
          <button
            type="button"
            onClick={handleReload}
            disabled={loading}
            className="rounded-xl border border-sky-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 shadow-sm hover:bg-sky-50 disabled:opacity-50"
          >
            {loading ? 'Loading…' : 'Reload'}
          </button>
        </div>
      </div>

      <nav
        className="flex flex-wrap gap-1 rounded-2xl border border-sky-200/70 bg-sky-50/50 p-1.5"
        aria-label="Statement type"
        role="tablist"
      >
        {STATEMENT_TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            role="tab"
            aria-selected={activeTab === t.id}
            onClick={() => setActiveTab(t.id)}
            className={`rounded-xl px-4 py-2.5 text-sm font-semibold transition ${
              activeTab === t.id
                ? 'bg-[#004080] text-white shadow-sm'
                : 'text-slate-600 hover:bg-white hover:text-sky-950'
            }`}
          >
            {t.label}
          </button>
        ))}
      </nav>

      {activeTab === 'daily' ? (
        <div className={`${cardCls} flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end`}>
          <div>
            <label htmlFor="pf-fs-month" className={labelCls}>
              Month
            </label>
            <select
              id="pf-fs-month"
              className={`${inputCls} mt-1 min-w-[11rem]`}
              value={month}
              onChange={(e) => setMonth(Number(e.target.value))}
            >
              {MONTH_SHORT.map((name, i) => (
                <option key={name} value={i + 1}>
                  {name}
                </option>
              ))}
            </select>
          </div>
          <p className="text-sm text-slate-600 sm:ml-auto sm:pt-6">
            <span className="font-medium text-slate-800">
              {MONTH_SHORT[month - 1]} {year}
            </span>
            {dailyData?.period_start && dailyData?.period_end ? (
              <span className="text-slate-500"> · {dailyData.period_start} → {dailyData.period_end}</span>
            ) : null}
            {bankFilter ? (
              <span className="block text-xs text-sky-800 sm:mt-0 sm:inline sm:ml-2">
                Filter: {filterName || 'Selected account'}
              </span>
            ) : null}
          </p>
        </div>
      ) : (
        <p className="text-sm text-slate-600">
          Tables below use the full calendar year <strong className="font-medium text-slate-800">{year}</strong>
          {bankFilter ? (
            <>
              {' '}
              · bank filter: <strong className="font-medium text-slate-800">{filterName || 'selected account'}</strong>
            </>
          ) : null}
          .
        </p>
      )}

      {error ? (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">{error}</div>
      ) : null}

      {activeTab === 'daily' ? (
        <section className={cardCls} aria-labelledby="pf-daily-heading">
          <h2 id="pf-daily-heading" className="text-base font-bold text-sky-950">
            Daily transactions
          </h2>
          <p className="mt-0.5 text-xs text-slate-500">
            Newest days first. One request loads this month only (fast). Pending expenses are included with a note.
          </p>
          {dailyLoading && !dailyData ? (
            <p className="mt-4 text-sm text-slate-500">Loading…</p>
          ) : byDay.length === 0 ? (
            <p className="mt-4 text-sm text-slate-500">No income or expense rows in this month for the current filter.</p>
          ) : (
            <div className="mt-4 space-y-6">
              {byDay.map(([dayIso, dayRows]) => (
                <div key={dayIso}>
                  <h3 className="mb-2 border-b border-sky-200/80 pb-1 text-sm font-bold text-sky-950">
                    {formatDayHeading(dayIso)}
                  </h3>
                  <div className={pfTableWrap}>
                    <table className={`${pfTable} min-w-[36rem]`}>
                      <thead>
                        <tr>
                          <th className={pfTh}>Type</th>
                          <th className={pfTh}>Category</th>
                          <th className={pfTh}>Account</th>
                          <th className={pfTh}>Detail</th>
                          <th className={pfThRight}>Amount</th>
                        </tr>
                      </thead>
                      <tbody>
                        {dayRows.map((r) => (
                          <tr key={`${r.kind}-${r.id}`} className={pfTrHover}>
                            <td className={pfTd}>
                              <span
                                className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
                                  r.kind === 'income'
                                    ? 'bg-emerald-100 text-emerald-800'
                                    : 'bg-orange-100 text-orange-800'
                                }`}
                              >
                                {r.kind}
                              </span>
                            </td>
                            <td className={pfTd}>{r.category}</td>
                            <td className={`${pfTd} text-slate-600`}>
                              {r.account_id != null ? accountNameById.get(r.account_id) ?? `#${r.account_id}` : '—'}
                            </td>
                            <td className={`${pfTd} max-w-[14rem] text-xs text-slate-600 sm:max-w-md`}>{rowDetail(r)}</td>
                            <td
                              className={`${pfTdRight} ${
                                r.kind === 'income' ? 'text-emerald-800' : 'text-orange-900'
                              }`}
                            >
                              {r.kind === 'income' ? '+' : '−'}
                              {formatInr(r.amount)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      ) : null}

      {activeTab === 'monthly' ? (
        <>
          {monthlyData?.opening_cash_estimate != null && rows.length > 0 ? (
            <p className="text-sm text-slate-600">
              Opening cash (1 Jan {year}
              {bankFilter ? ` · ${filterName || 'filtered account'}` : ''}):{' '}
              <span className="font-mono font-semibold text-slate-900">{formatInr(monthlyData.opening_cash_estimate)}</span>
            </p>
          ) : null}

          {monthlyData?.note ? <p className="text-sm text-slate-500">{monthlyData.note}</p> : null}

          {monthlyLoading && !monthlyData ? (
            <p className="text-sm text-slate-500">Loading…</p>
          ) : null}

          {rows.length === 0 && !monthlyLoading && !error ? (
            <p className="text-sm text-slate-500">No months to show for this year yet.</p>
          ) : null}

          {rows.length > 0 ? (
            <>
              <section className={cardCls} aria-labelledby="pf-is-heading">
            <h2 id="pf-is-heading" className="text-base font-bold text-sky-950">
              Income statement (monthly)
            </h2>
                <p className="mt-0.5 text-xs text-slate-500">
                  Recognized income and expenses{bankFilter ? ` · ${filterName || 'selected bank'}` : ''}.
                </p>
                <div className={tableShell}>
                  <table className="w-full min-w-max border-collapse text-left">
                    <thead>
                      <tr>
                        <th scope="col" className={thCorner}>
                          Month
                        </th>
                        {rows.map((r) => (
                          <th key={`is-h-${r.month_key}`} scope="col" className={thMonth}>
                            {monthColumnHeading(r)}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      <tr>
                        <th scope="row" className={tdLabel}>
                          Income
                        </th>
                        {rows.map((r) => (
                          <td key={`is-i-${r.month_key}`} className={tdVal}>
                            {formatInr(r.income_statement?.income)}
                          </td>
                        ))}
                      </tr>
                      <tr>
                        <th scope="row" className={tdLabel}>
                          Expense
                        </th>
                        {rows.map((r) => (
                          <td key={`is-e-${r.month_key}`} className={tdVal}>
                            {formatInr(r.income_statement?.expense)}
                          </td>
                        ))}
                      </tr>
                      <tr>
                        <th scope="row" className={tdLabel}>
                          Net income
                        </th>
                        {rows.map((r) => (
                          <td key={`is-n-${r.month_key}`} className={tdVal}>
                            {formatInr(r.income_statement?.net_income)}
                          </td>
                        ))}
                      </tr>
                    </tbody>
                  </table>
                </div>
              </section>

              <section className={cardCls} aria-labelledby="pf-cf-heading">
            <h2 id="pf-cf-heading" className="text-base font-bold text-sky-950">
              Cash flow (monthly, operating)
            </h2>
                <p className="mt-0.5 text-xs text-slate-500">
                  Cash-in from income, cash-out from expenses; closing cash is the rolled-forward estimate.
                </p>
                <div className={tableShell}>
                  <table className="w-full min-w-max border-collapse text-left">
                    <thead>
                      <tr>
                        <th scope="col" className={thCorner}>
                          Month
                        </th>
                        {rows.map((r) => (
                          <th key={`cf-h-${r.month_key}`} scope="col" className={thMonth}>
                            {monthColumnHeading(r)}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      <tr>
                        <th scope="row" className={tdLabel}>
                          Cash in
                        </th>
                        {rows.map((r) => (
                          <td key={`cf-i-${r.month_key}`} className={tdVal}>
                            {formatInr(r.cash_flow?.cash_in_operating)}
                          </td>
                        ))}
                      </tr>
                      <tr>
                        <th scope="row" className={tdLabel}>
                          Cash out
                        </th>
                        {rows.map((r) => (
                          <td key={`cf-o-${r.month_key}`} className={tdVal}>
                            {formatInr(r.cash_flow?.cash_out_operating)}
                          </td>
                        ))}
                      </tr>
                      <tr>
                        <th scope="row" className={tdLabel}>
                          Net operating
                        </th>
                        {rows.map((r) => (
                          <td key={`cf-n-${r.month_key}`} className={tdVal}>
                            {formatInr(r.cash_flow?.net_operating_cash_flow)}
                          </td>
                        ))}
                      </tr>
                      <tr>
                        <th scope="row" className={tdLabel}>
                          Closing cash (est.)
                        </th>
                        {rows.map((r) => (
                          <td key={`cf-c-${r.month_key}`} className={tdVal}>
                            {formatInr(r.cash_flow?.closing_cash_estimate)}
                          </td>
                        ))}
                      </tr>
                    </tbody>
                  </table>
                </div>
              </section>

              <section className={cardCls} aria-labelledby="pf-bs-heading">
                <h2 id="pf-bs-heading" className="text-base font-bold text-sky-950">
                  Balance sheet (monthly, simplified)
                </h2>
                <p className="mt-0.5 text-xs text-slate-500">
                  Cash follows the month-end estimate. Investments, fixed assets, liabilities, and loans use{' '}
                  <strong className="font-medium text-slate-600">current</strong> profile totals in every column.
                </p>
                <div className={tableShell}>
                  <table className="w-full min-w-max border-collapse text-left">
                    <thead>
                      <tr>
                        <th scope="col" className={thCorner}>
                          Month
                        </th>
                        {rows.map((r) => (
                          <th key={`bs-h-${r.month_key}`} scope="col" className={thMonth}>
                            {monthColumnHeading(r)}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {[
                        { label: 'Cash (est.)', get: (r) => r.balance_sheet?.cash_estimate },
                        { label: 'Investments', get: (r) => r.balance_sheet?.investments },
                        { label: 'Fixed assets', get: (r) => r.balance_sheet?.fixed_assets },
                        { label: 'Total assets', get: (r) => r.balance_sheet?.total_assets },
                        { label: 'Liabilities', get: (r) => r.balance_sheet?.liabilities },
                        { label: 'Loans', get: (r) => r.balance_sheet?.loans_outstanding },
                        { label: 'Net worth', get: (r) => r.balance_sheet?.net_worth },
                      ].map((line) => (
                        <tr key={line.label}>
                          <th scope="row" className={tdLabel}>
                            {line.label}
                          </th>
                          {rows.map((r) => (
                            <td key={`${line.label}-${r.month_key}`} className={tdVal}>
                              {formatInr(line.get(r))}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>
            </>
          ) : null}
        </>
      ) : null}
    </div>
  )
}
