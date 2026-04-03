import { useCallback, useEffect, useMemo, useState } from 'react'
import { useOutletContext } from 'react-router-dom'
import {
  getDailyLedger,
  getMonthlyFinancialTables,
  getPfToken,
  listFinanceAccounts,
  pfFetchBlob,
  setPfToken,
  triggerDownloadBlob,
} from '../api.js'
import PfExportMenu from '../PfExportMenu.jsx'
import {
  btnPrimary,
  cardCls,
  inputCls,
  labelCls,
  pfSelectCompact,
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
import PfSegmentedControl from '../PfSegmentedControl.jsx'

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
  'sticky left-0 z-20 min-w-[8.5rem] bg-sky-100 px-3 py-3 text-left text-[11px] font-bold uppercase tracking-wider text-sky-950 border-b border-sky-200/90 border-r border-sky-200/60 dark:border-[var(--pf-border)] dark:bg-[var(--pf-th-bg)] dark:text-[var(--pf-text-muted)]'
const thMonth =
  'bg-sky-100 px-3 py-3 text-right text-[11px] font-bold uppercase tracking-wider text-sky-950 border-b border-sky-200/90 whitespace-nowrap min-w-[5.5rem] dark:border-[var(--pf-border)] dark:bg-[var(--pf-th-bg)] dark:text-[var(--pf-text-muted)]'
const tdLabel =
  'sticky left-0 z-10 bg-sky-50/90 px-3 py-2.5 text-sm font-semibold text-slate-800 border-b border-sky-100 border-r border-sky-100/80 shadow-[2px_0_8px_-2px_rgba(14,165,233,0.08)] dark:border-[var(--pf-border)] dark:bg-[var(--pf-card-hover)] dark:text-[var(--pf-text)] dark:shadow-none'
const tdVal =
  'border-b border-sky-100/90 px-3 py-2.5 text-right text-sm font-mono tabular-nums text-slate-800 dark:border-[var(--pf-border)] dark:text-[var(--pf-text)]'

export default function PfMonthlyStatementsPage() {
  const { onSessionInvalid } = useOutletContext() || {}
  const { tick, refresh } = usePfRefresh()
  const [activeTab, setActiveTab] = useState('daily')
  const now = new Date()
  const [year, setYear] = useState(() => now.getFullYear())
  const [bankFilter, setBankFilter] = useState('')
  const [dailyFrom, setDailyFrom] = useState(() => {
    const d = new Date()
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`
  })
  const [dailyTo, setDailyTo] = useState(() => new Date().toISOString().slice(0, 10))
  const [accounts, setAccounts] = useState([])
  const [monthlyData, setMonthlyData] = useState(null)
  const [dailyData, setDailyData] = useState(null)
  const [monthlyLoading, setMonthlyLoading] = useState(false)
  const [dailyLoading, setDailyLoading] = useState(false)
  const [error, setError] = useState('')
  const [fsExportBusy, setFsExportBusy] = useState(false)

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
      const res = await getDailyLedger(dailyFrom, dailyTo, q)
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
  }, [dailyFrom, dailyTo, bankFilter, onSessionInvalid])

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

  const monthlyYtd = useMemo(() => {
    if (!rows.length) return null
    let inc = 0
    let exp = 0
    for (const row of rows) {
      inc += Number(row.income_statement?.income) || 0
      exp += Number(row.income_statement?.expense) || 0
    }
    const last = rows[rows.length - 1]
    const loanRecv = Number(last?.balance_sheet?.loans_outstanding) || 0
    return { inc, exp, net: inc - exp, loanRecv }
  }, [rows])

  const dailyTotals = useMemo(() => {
    let inc = 0
    let exp = 0
    for (const r of mergedDaily) {
      if (r.kind === 'income') inc += Number(r.amount) || 0
      else exp += Number(r.amount) || 0
    }
    return { inc, exp, net: inc - exp }
  }, [mergedDaily])

  function handleReload() {
    refresh()
    if (activeTab === 'daily') loadDailyLedger()
    else loadMonthlyTables()
  }

  const dailyRangeLabel = useMemo(() => {
    const a = new Date(`${dailyFrom}T12:00:00`)
    const b = new Date(`${dailyTo}T12:00:00`)
    if (Number.isNaN(a.getTime()) || Number.isNaN(b.getTime())) return `${dailyFrom} – ${dailyTo}`
    const opts = { day: 'numeric', month: 'short', year: 'numeric' }
    return `${a.toLocaleDateString('en-IN', opts)} → ${b.toLocaleDateString('en-IN', opts)}`
  }, [dailyFrom, dailyTo])

  const statementExportMonth = useMemo(() => {
    if (activeTab === 'daily' && dailyFrom.slice(0, 7) === dailyTo.slice(0, 7)) {
      const m = Number(dailyFrom.split('-')[1])
      return Number.isFinite(m) ? m : undefined
    }
    return undefined
  }, [activeTab, dailyFrom, dailyTo])

  async function handleFinancialStatementExport(kind) {
    setFsExportBusy(true)
    try {
      const q = new URLSearchParams({ year: String(year) })
      if (bankFilter) q.set('account_id', bankFilter)
      if (statementExportMonth != null) q.set('month', String(statementExportMonth))
      const ext = kind === 'pdf' ? 'pdf' : 'excel'
      const path = `/pf/export/financial-statement/${ext}?${q}`
      const { blob, filename } = await pfFetchBlob(path)
      const mon = statementExportMonth != null ? `_${String(statementExportMonth).padStart(2, '0')}` : ''
      const fallback =
        kind === 'pdf' ? `Financial_Statement_${year}${mon}.pdf` : `Financial_Statement_${year}${mon}.xlsx`
      triggerDownloadBlob(blob, filename || fallback)
    } catch (e) {
      if (e.status === 401) {
        setPfToken(null)
        onSessionInvalid?.()
      } else {
        window.alert(e.message || 'Export failed')
      }
    } finally {
      setFsExportBusy(false)
    }
  }

  return (
    <div className="space-y-4 md:space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <h1 className="text-xl font-bold text-slate-900 dark:text-slate-100 sm:text-2xl">Financial statement</h1>
        <PfExportMenu
          busy={fsExportBusy}
          items={[
            { key: 'pdf', label: 'Export PDF', onClick: () => handleFinancialStatementExport('pdf') },
            { key: 'xlsx', label: 'Export Excel', onClick: () => handleFinancialStatementExport('excel') },
          ]}
        />
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <label htmlFor="pf-fs-year" className="sr-only">
          Year
        </label>
        <select
          id="pf-fs-year"
          className={`${pfSelectCompact} min-w-[4.5rem]`}
          value={year}
          onChange={(e) => setYear(Number(e.target.value))}
        >
          {yearOptions.map((y) => (
            <option key={y} value={y}>
              {y}
            </option>
          ))}
        </select>
        <label htmlFor="pf-fs-bank" className="sr-only">
          Bank
        </label>
        <select
          id="pf-fs-bank"
          className={`${pfSelectCompact} min-w-[6rem] flex-1 sm:max-w-[14rem]`}
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
        <button
          type="button"
          onClick={handleReload}
          disabled={loading}
          className="rounded-[12px] border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-700 transition hover:bg-slate-50 disabled:opacity-50 dark:border-[var(--pf-border)] dark:text-[var(--pf-text)] dark:hover:bg-[var(--pf-card-hover)]"
        >
          {loading ? '…' : 'Reload'}
        </button>
      </div>

      <div className="min-w-0 overflow-x-auto" aria-label="Statement type">
        <PfSegmentedControl
          options={STATEMENT_TABS}
          value={activeTab}
          onChange={setActiveTab}
          className="w-full min-w-[200px] sm:max-w-md"
        />
      </div>

      {activeTab === 'daily' ? (
        <div className="flex flex-col gap-3 rounded-[16px] border border-slate-200/80 bg-white p-4 shadow-[var(--pf-shadow)] sm:flex-row sm:flex-wrap sm:items-end sm:justify-between dark:border-[var(--pf-border)] dark:bg-[var(--pf-card)]">
          <p className="text-xs text-slate-600 sm:text-sm dark:text-[var(--pf-text-muted)]">
            <span className="font-semibold text-slate-800 dark:text-[var(--pf-text)]">Range:</span> {dailyRangeLabel}
            {bankFilter ? ` · ${filterName || 'filtered'}` : ''}
          </p>
          <div className="flex flex-wrap items-end gap-2 sm:gap-3">
            <div className="min-w-[9rem]">
              <label htmlFor="pf-daily-from" className={labelCls}>
                From
              </label>
              <input
                id="pf-daily-from"
                type="date"
                className={inputCls}
                value={dailyFrom}
                onChange={(e) => setDailyFrom(e.target.value)}
              />
            </div>
            <div className="min-w-[9rem]">
              <label htmlFor="pf-daily-to" className={labelCls}>
                To
              </label>
              <input
                id="pf-daily-to"
                type="date"
                className={inputCls}
                value={dailyTo}
                onChange={(e) => setDailyTo(e.target.value)}
              />
            </div>
            <button
              type="button"
              onClick={() => loadDailyLedger()}
              disabled={dailyLoading}
              className={`${btnPrimary} w-full sm:w-auto`}
            >
              {dailyLoading ? 'Loading…' : 'Apply'}
            </button>
          </div>
        </div>
      ) : null}

      {activeTab === 'daily' && !dailyLoading && mergedDaily.length > 0 ? (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <div className={cardCls}>
            <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500 dark:text-[var(--pf-text-muted)]">
              Total income
            </p>
            <p className="mt-1 font-mono text-lg font-bold tabular-nums text-emerald-600 dark:text-emerald-400">
              {formatInr(dailyTotals.inc)}
            </p>
          </div>
          <div className={cardCls}>
            <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500 dark:text-[var(--pf-text-muted)]">
              Total expense
            </p>
            <p className="mt-1 font-mono text-lg font-bold tabular-nums text-[#EF4444] dark:text-red-400">
              {formatInr(dailyTotals.exp)}
            </p>
          </div>
          <div className={`${cardCls} col-span-2 sm:col-span-2`}>
            <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500 dark:text-[var(--pf-text-muted)]">Net</p>
            <p className="mt-1 font-mono text-lg font-bold tabular-nums text-slate-900 dark:text-[var(--pf-text)]">
              {formatInr(dailyTotals.net)}
            </p>
          </div>
        </div>
      ) : null}

      {activeTab === 'monthly' && monthlyYtd && rows.length > 0 ? (
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
          <div className={cardCls}>
            <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500 dark:text-[var(--pf-text-muted)]">
              Total income
            </p>
            <p className="mt-1 font-mono text-base font-bold tabular-nums text-emerald-600 dark:text-emerald-400 sm:text-lg">
              {formatInr(monthlyYtd.inc)}
            </p>
          </div>
          <div className={cardCls}>
            <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500 dark:text-[var(--pf-text-muted)]">
              Total expense
            </p>
            <p className="mt-1 font-mono text-base font-bold tabular-nums text-[#EF4444] dark:text-red-400 sm:text-lg">
              {formatInr(monthlyYtd.exp)}
            </p>
          </div>
          <div className={cardCls}>
            <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500 dark:text-[var(--pf-text-muted)]">
              Net profit
            </p>
            <p className="mt-1 font-mono text-base font-bold tabular-nums text-slate-900 dark:text-[var(--pf-text)] sm:text-lg">
              {formatInr(monthlyYtd.net)}
            </p>
          </div>
          <div className={cardCls}>
            <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500 dark:text-[var(--pf-text-muted)]">
              Loan receivable
            </p>
            <p className="mt-1 font-mono text-base font-bold tabular-nums text-slate-900 dark:text-[var(--pf-text)] sm:text-lg">
              {formatInr(monthlyYtd.loanRecv)}
            </p>
          </div>
          <div className={`${cardCls} col-span-2 lg:col-span-1`}>
            <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500 dark:text-[var(--pf-text-muted)]">
              Loan received
            </p>
            <p className="mt-1 text-sm text-slate-600 dark:text-[var(--pf-text-muted)]">
              Tracked via loan payments · see Loans
            </p>
          </div>
        </div>
      ) : null}

      {error ? (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">{error}</div>
      ) : null}

      {activeTab === 'daily' ? (
        <section className={cardCls} aria-labelledby="pf-daily-heading">
          <h2 id="pf-daily-heading" className="text-base font-bold text-slate-900 dark:text-[var(--pf-text)]">
            Daily transactions
          </h2>
          <p className="mt-0.5 hidden text-xs text-slate-500 md:block dark:text-[var(--pf-text-muted)]">
            Newest days first. Pending expenses are included with a note.
          </p>
          {dailyLoading && !dailyData ? (
            <p className="mt-4 text-sm text-slate-500 dark:text-[var(--pf-text-muted)]">Loading…</p>
          ) : byDay.length === 0 ? (
            <p className="mt-4 text-sm text-slate-500 dark:text-[var(--pf-text-muted)]">
              No income or expense rows in this month for the current filter.
            </p>
          ) : (
            <div className="mt-4 space-y-6">
              {byDay.map(([dayIso, dayRows]) => (
                <div key={dayIso}>
                  <h3 className="mb-2 border-b border-slate-200/90 pb-1 text-sm font-bold text-slate-900 dark:border-[var(--pf-border)] dark:text-[var(--pf-text)]">
                    {formatDayHeading(dayIso)}
                  </h3>
                  <div className="space-y-2 md:hidden">
                    {dayRows.map((r) => (
                      <div
                        key={`${r.kind}-${r.id}`}
                        className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm transition active:scale-[0.99] dark:border-[var(--pf-border)] dark:bg-[var(--pf-card)] dark:shadow-none"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <span className="min-w-0 flex-1 font-semibold text-slate-900 dark:text-[var(--pf-text)]">
                            {r.category}
                          </span>
                          <span
                            className={`shrink-0 font-mono text-base font-bold tabular-nums ${
                              r.kind === 'income' ? 'text-emerald-600 dark:text-emerald-400' : 'text-[#EF4444] dark:text-red-400'
                            }`}
                          >
                            {r.kind === 'income' ? '+' : '−'}
                            {formatInr(r.amount)}
                          </span>
                        </div>
                        <p className="mt-1 text-xs text-slate-500 dark:text-[var(--pf-text-muted)]">{rowDetail(r)}</p>
                        <div className="mt-2 flex items-center justify-between text-[11px] text-slate-500 dark:text-[var(--pf-text-muted)]">
                          <span className="rounded-full bg-slate-100 px-2 py-0.5 font-semibold capitalize dark:bg-slate-700 dark:text-slate-200">
                            {r.kind}
                          </span>
                          <span>{r.account_id != null ? accountNameById.get(r.account_id) ?? '' : '—'}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                  <div className={`${pfTableWrap} hidden md:block`}>
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
            <p className="text-sm text-slate-600 dark:text-[var(--pf-text-muted)]">
              Opening cash (1 Jan {year}
              {bankFilter ? ` · ${filterName || 'filtered account'}` : ''}):{' '}
              <span className="font-mono font-semibold text-slate-900 dark:text-[var(--pf-text)]">
                {formatInr(monthlyData.opening_cash_estimate)}
              </span>
            </p>
          ) : null}

          {monthlyData?.note ? (
            <p className="text-sm text-slate-500 dark:text-[var(--pf-text-muted)]">{monthlyData.note}</p>
          ) : null}

          {monthlyLoading && !monthlyData ? (
            <p className="text-sm text-slate-500">Loading…</p>
          ) : null}

          {rows.length === 0 && !monthlyLoading && !error ? (
            <p className="text-sm text-slate-500">No months to show for this year yet.</p>
          ) : null}

          {rows.length > 0 ? (
            <>
              <section className={cardCls} aria-labelledby="pf-is-heading">
            <h2 id="pf-is-heading" className="text-base font-bold text-sky-950 dark:text-[var(--pf-text)]">
              Income statement (monthly)
            </h2>
                <p className="mt-0.5 text-xs text-slate-500 dark:text-[var(--pf-text-muted)]">
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
            <h2 id="pf-cf-heading" className="text-base font-bold text-sky-950 dark:text-[var(--pf-text)]">
              Cash flow (monthly, operating)
            </h2>
                <p className="mt-0.5 text-xs text-slate-500 dark:text-[var(--pf-text-muted)]">
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
                <h2 id="pf-bs-heading" className="text-base font-bold text-sky-950 dark:text-[var(--pf-text)]">
                  Balance sheet (monthly, simplified)
                </h2>
                <p className="mt-0.5 text-xs text-slate-500 dark:text-[var(--pf-text-muted)]">
                  Cash follows the month-end estimate. Investments, fixed assets, liabilities, and loans use{' '}
                  <strong className="font-medium text-slate-600 dark:text-[var(--pf-text)]">current</strong> profile
                  totals in every column.
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
