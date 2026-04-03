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
  getDailyLedger,
  getMonthlyFinancialTables,
  getPfToken,
  listFinanceAccounts,
  listFinanceExpenses,
  listFinanceIncome,
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
  pfChartCard,
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

const REPORT_TABS = [
  { id: 'income', label: 'Income statement' },
  { id: 'cashflow', label: 'Cash flow' },
  { id: 'balancesheet', label: 'Balance sheet' },
  { id: 'networth', label: 'Net worth' },
  { id: 'ledger', label: 'Ledger' },
]

const PIE_COLORS = ['#0ea5e9', '#22c55e', '#a855f7', '#f97316', '#eab308', '#64748b', '#ef4444', '#14b8a6']

const chartTitle = 'text-base font-bold text-slate-900 dark:text-[var(--pf-text)]'
const chartSub = 'mt-0.5 text-xs text-slate-500 dark:text-[var(--pf-text-muted)]'

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
  const [reportTab, setReportTab] = useState('income')
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
  const [drill, setDrill] = useState(null)
  const [drillRows, setDrillRows] = useState([])
  const [drillLoading, setDrillLoading] = useState(false)

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
    if (reportTab !== 'ledger') return
    loadDailyLedger()
  }, [reportTab, loadDailyLedger, tick])

  useEffect(() => {
    if (reportTab === 'ledger') return
    loadMonthlyTables()
  }, [reportTab, loadMonthlyTables, tick])

  const mergedDaily = useMemo(
    () => buildMergedLedger(dailyData?.income, dailyData?.expenses),
    [dailyData],
  )
  const byDay = useMemo(() => groupByDateDesc(mergedDaily), [mergedDaily])

  const rows = Array.isArray(monthlyData?.rows) ? monthlyData.rows : []
  const filterName = bankFilter
    ? accounts.find((a) => String(a.id) === bankFilter)?.account_name ?? ''
    : ''

  const loading = reportTab === 'ledger' ? dailyLoading : monthlyLoading

  const trendChartData = useMemo(
    () =>
      rows.map((r) => ({
        label: monthColumnHeading(r),
        monthKey: r.month_key,
        income: Number(r.income_statement?.income) || 0,
        expense: Number(r.income_statement?.expense) || 0,
        net: Number(r.income_statement?.net_income) || 0,
        netWorth: Number(r.balance_sheet?.net_worth) || 0,
      })),
    [rows],
  )

  const savingsRateTrend = useMemo(
    () =>
      rows.map((r) => {
        const inc = Number(r.income_statement?.income) || 0
        const net = Number(r.income_statement?.net_income) || 0
        return {
          label: monthColumnHeading(r),
          rate: inc > 0.01 ? Math.round((net / inc) * 1000) / 10 : 0,
        }
      }),
    [rows],
  )

  const cashFlowActivityData = useMemo(
    () =>
      rows.map((r) => ({
        label: monthColumnHeading(r),
        Operating: Number(r.cash_flow?.net_operating_cash_flow) || 0,
        Investing: Number(r.cash_flow?.investing_cash_flow) || 0,
        Financing: Number(r.cash_flow?.financing_cash_flow) || 0,
        Net:
          (Number(r.cash_flow?.net_operating_cash_flow) || 0) +
          (Number(r.cash_flow?.investing_cash_flow) || 0) +
          (Number(r.cash_flow?.financing_cash_flow) || 0),
      })),
    [rows],
  )

  const expensePie = useMemo(() => {
    const raw = monthlyData?.expense_by_category_ytd || []
    return raw
      .map((x) => ({ name: x.category || 'Other', value: Number(x.amount) || 0 }))
      .filter((x) => x.value > 0)
      .sort((a, b) => b.value - a.value)
  }, [monthlyData])

  const incomePie = useMemo(() => {
    const raw = monthlyData?.income_by_category_ytd || []
    return raw
      .map((x) => ({ name: x.category || 'Other', value: Number(x.amount) || 0 }))
      .filter((x) => x.value > 0)
      .sort((a, b) => b.value - a.value)
  }, [monthlyData])

  const monthlyCompareRows = useMemo(
    () =>
      rows.map((r) => ({
        month: monthColumnHeading(r),
        monthKey: r.month_key,
        income: Number(r.income_statement?.income) || 0,
        expense: Number(r.income_statement?.expense) || 0,
        emi: Number(r.income_statement?.expense_emi) || 0,
        savings: Number(r.income_statement?.net_income) || 0,
        netWorth: Number(r.balance_sheet?.net_worth) || 0,
      })),
    [rows],
  )

  const lastBs = rows.length ? rows[rows.length - 1]?.balance_sheet : null
  const ratios = monthlyData?.ratios_ytd

  const assetsVsLiabData = useMemo(() => {
    if (!lastBs) return []
    const assets = Number(lastBs.total_assets) || 0
    const liab = Number(lastBs.liabilities) || 0
    return [{ name: 'Assets', amt: assets }, { name: 'Liabilities', amt: liab }]
  }, [lastBs])

  const netWorthAssetsComposition = useMemo(() => {
    if (!lastBs) return []
    return [
      { name: 'Cash & bank (est.)', value: Number(lastBs.cash_estimate) || 0 },
      { name: 'Investments', value: Number(lastBs.investments) || 0 },
      { name: 'Fixed assets', value: Number(lastBs.fixed_assets) || 0 },
      { name: 'Loans given', value: Number(lastBs.loans_given_receivable ?? lastBs.loans_outstanding) || 0 },
    ].filter((x) => x.value > 0.01)
  }, [lastBs])

  const netWorthLiabComposition = useMemo(() => {
    if (!lastBs) return []
    return [
      { name: 'Credit cards', value: Number(lastBs.credit_cards_liabilities) || 0 },
      { name: 'Loans & other', value: Number(lastBs.loans_other_liabilities) || 0 },
      { name: 'EMI due (sched.)', value: Number(lastBs.emi_installments_due) || 0 },
    ].filter((x) => x.value > 0.01)
  }, [lastBs])

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
    if (reportTab === 'ledger') loadDailyLedger()
    else loadMonthlyTables()
  }

  const yearDateBounds = useMemo(() => {
    const y = year
    const lastRow = rows[rows.length - 1]
    const lastM = lastRow?.month_index || 12
    const from = `${y}-01-01`
    const to =
      lastRow?.period_end ||
      `${y}-${String(lastM).padStart(2, '0')}-${String(new Date(y, lastM, 0).getDate()).padStart(2, '0')}`
    return { from, to }
  }, [year, rows])

  async function openDrill({ kind, category, monthKey }) {
    setDrill({ kind, category, monthKey })
    setDrillRows([])
    setDrillLoading(true)
    try {
      let from = yearDateBounds.from
      let to = yearDateBounds.to
      if (monthKey) {
        const [yy, mm] = monthKey.split('-').map(Number)
        from = `${yy}-${String(mm).padStart(2, '0')}-01`
        const lastD = new Date(yy, mm, 0).getDate()
        to = `${yy}-${String(mm).padStart(2, '0')}-${String(lastD).padStart(2, '0')}`
      }
      const acc = bankFilter === '' ? undefined : Number(bankFilter)
      if (kind === 'expense') {
        const list = await listFinanceExpenses({
          skip: 0,
          limit: 500,
          dateFrom: from,
          dateTo: to,
          accountId: acc,
          category: category || undefined,
        })
        setDrillRows(Array.isArray(list) ? list : [])
      } else {
        const list = await listFinanceIncome({
          skip: 0,
          limit: 500,
          dateFrom: from,
          dateTo: to,
          accountId: acc,
          category: category || undefined,
        })
        setDrillRows(Array.isArray(list) ? list : [])
      }
    } catch (e) {
      setDrillRows([])
      window.alert(e.message || 'Could not load lines')
    } finally {
      setDrillLoading(false)
    }
  }

  function formatRatio(v) {
    if (v == null || Number.isNaN(v)) return '—'
    return `${(Number(v) * 100).toFixed(1)}%`
  }

  const dailyRangeLabel = useMemo(() => {
    const a = new Date(`${dailyFrom}T12:00:00`)
    const b = new Date(`${dailyTo}T12:00:00`)
    if (Number.isNaN(a.getTime()) || Number.isNaN(b.getTime())) return `${dailyFrom} – ${dailyTo}`
    const opts = { day: 'numeric', month: 'short', year: 'numeric' }
    return `${a.toLocaleDateString('en-IN', opts)} → ${b.toLocaleDateString('en-IN', opts)}`
  }, [dailyFrom, dailyTo])

  const statementExportMonth = useMemo(() => {
    if (reportTab === 'ledger' && dailyFrom.slice(0, 7) === dailyTo.slice(0, 7)) {
      const m = Number(dailyFrom.split('-')[1])
      return Number.isFinite(m) ? m : undefined
    }
    return undefined
  }, [reportTab, dailyFrom, dailyTo])

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

  const showMonthly = reportTab !== 'ledger'

  return (
    <div className="space-y-4 md:space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-slate-900 dark:text-slate-100 sm:text-2xl">Financial statement</h1>
          <p className="mt-1 max-w-2xl text-xs text-slate-500 dark:text-[var(--pf-text-muted)]">
            Reports mirror accounting layouts: P&amp;L, cash flow (operating / investing / financing activity), balance
            sheet, and net-worth analytics. Export downloads the combined workbook/PDF for the selected year.
          </p>
        </div>
        <PfExportMenu
          busy={fsExportBusy}
          items={[
            {
              key: 'pdf-full',
              label: 'Full report (PDF)',
              onClick: () => handleFinancialStatementExport('pdf'),
            },
            {
              key: 'xlsx-full',
              label: 'Full report (Excel)',
              onClick: () => handleFinancialStatementExport('excel'),
            },
            {
              key: 'pdf-is',
              label: 'Income statement (PDF — same workbook)',
              onClick: () => handleFinancialStatementExport('pdf'),
            },
            {
              key: 'xlsx-ledger',
              label: 'Year details (Excel)',
              onClick: () => handleFinancialStatementExport('excel'),
            },
          ]}
        />
      </div>

      <div className="flex flex-wrap items-center gap-2 rounded-[14px] border border-slate-200/80 bg-white/80 px-3 py-2 dark:border-[var(--pf-border)] dark:bg-[var(--pf-card)]">
        <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-[var(--pf-text-muted)]">
          Filters
        </span>
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
          Account
        </label>
        <select
          id="pf-fs-bank"
          className={`${pfSelectCompact} min-w-[6rem] flex-1 sm:max-w-[14rem]`}
          value={bankFilter}
          onChange={(e) => setBankFilter(e.target.value)}
        >
          <option value="">All accounts</option>
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

      <div className="min-w-0 overflow-x-auto pb-1" aria-label="Report sections">
        <PfSegmentedControl
          options={REPORT_TABS}
          value={reportTab}
          onChange={setReportTab}
          className="w-full min-w-[min(100%,520px)]"
        />
      </div>

      {reportTab === 'ledger' ? (
        <div className="flex flex-col gap-3 rounded-[16px] border border-slate-200/80 bg-white p-4 shadow-[var(--pf-shadow)] sm:flex-row sm:flex-wrap sm:items-end sm:justify-between dark:border-[var(--pf-border)] dark:bg-[var(--pf-card)]">
          <p className="text-xs text-slate-600 sm:text-sm dark:text-[var(--pf-text-muted)]">
            <span className="font-semibold text-slate-800 dark:text-[var(--pf-text)]">Ledger range:</span> {dailyRangeLabel}
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

      {reportTab === 'ledger' && !dailyLoading && mergedDaily.length > 0 ? (
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

      {showMonthly && monthlyYtd && rows.length > 0 ? (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
          <div className={cardCls}>
            <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500 dark:text-[var(--pf-text-muted)]">
              Income (YTD)
            </p>
            <p className="mt-1 font-mono text-base font-bold tabular-nums text-emerald-600 dark:text-emerald-400 sm:text-lg">
              {formatInr(monthlyYtd.inc)}
            </p>
          </div>
          <div className={cardCls}>
            <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500 dark:text-[var(--pf-text-muted)]">
              Expense (YTD)
            </p>
            <p className="mt-1 font-mono text-base font-bold tabular-nums text-[#EF4444] dark:text-red-400 sm:text-lg">
              {formatInr(monthlyYtd.exp)}
            </p>
          </div>
          <div className={cardCls}>
            <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500 dark:text-[var(--pf-text-muted)]">
              Net income
            </p>
            <p className="mt-1 font-mono text-base font-bold tabular-nums text-slate-900 dark:text-[var(--pf-text)] sm:text-lg">
              {formatInr(monthlyYtd.net)}
            </p>
          </div>
          <div className={cardCls}>
            <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500 dark:text-[var(--pf-text-muted)]">
              Savings rate
            </p>
            <p className="mt-1 font-mono text-base font-bold tabular-nums text-sky-700 dark:text-sky-300 sm:text-lg">
              {formatRatio(ratios?.savings_rate)}
            </p>
          </div>
          <div className={cardCls}>
            <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500 dark:text-[var(--pf-text-muted)]">
              Cash (est.)
            </p>
            <p className="mt-1 font-mono text-base font-bold tabular-nums text-slate-900 dark:text-[var(--pf-text)] sm:text-lg">
              {formatInr(lastBs?.cash_estimate)}
            </p>
          </div>
          <div className={cardCls}>
            <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500 dark:text-[var(--pf-text-muted)]">
              Net worth
            </p>
            <p className="mt-1 font-mono text-base font-bold tabular-nums text-slate-900 dark:text-[var(--pf-text)] sm:text-lg">
              {formatInr(lastBs?.net_worth)}
            </p>
          </div>
        </div>
      ) : null}

      {showMonthly && ratios && rows.length > 0 ? (
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
          {[
            { k: 'Savings rate', v: formatRatio(ratios.savings_rate) },
            { k: 'Debt to income (EMI)', v: formatRatio(ratios.debt_to_income_emi) },
            { k: 'Expense ratio', v: formatRatio(ratios.expense_ratio) },
            { k: 'Credit utilization', v: formatRatio(ratios.credit_utilization) },
            {
              k: 'Liquidity (mo.)',
              v: ratios.liquidity_months != null ? `${ratios.liquidity_months} mo` : '—',
            },
            { k: 'Investments / assets', v: formatRatio(ratios.investment_to_assets) },
          ].map((x) => (
            <div
              key={x.k}
              className="rounded-xl border border-slate-200/80 bg-white px-3 py-2 dark:border-[var(--pf-border)] dark:bg-[var(--pf-card)]"
            >
              <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500 dark:text-[var(--pf-text-muted)]">
                {x.k}
              </p>
              <p className="mt-0.5 font-mono text-sm font-bold tabular-nums text-slate-900 dark:text-[var(--pf-text)]">
                {x.v}
              </p>
            </div>
          ))}
        </div>
      ) : null}

      {error ? (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">{error}</div>
      ) : null}

      {reportTab === 'ledger' ? (
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

      {showMonthly ? (
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
              {reportTab === 'income' ? (
                <div className="grid gap-4 lg:grid-cols-2">
                  <div className={`${cardCls} ${pfChartCard}`}>
                    <h2 className={chartTitle}>Income vs expense</h2>
                    <p className={chartSub}>Month | Income | Expense | Net income</p>
                    <div className="mt-3 h-64 w-full min-w-0">
                      <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={trendChartData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                          <CartesianGrid strokeDasharray="3 3" className="opacity-40" />
                          <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                          <YAxis tick={{ fontSize: 11 }} width={48} tickFormatter={(v) => formatInr(v)} />
                          <Tooltip formatter={(v) => formatInr(v)} />
                          <Legend />
                          <Line type="monotone" dataKey="income" name="Income" stroke="#22c55e" dot={false} strokeWidth={2} />
                          <Line type="monotone" dataKey="expense" name="Expense" stroke="#ef4444" dot={false} strokeWidth={2} />
                          <Line type="monotone" dataKey="net" name="Net" stroke="#0ea5e9" dot={false} strokeWidth={2} />
                        </LineChart>
                      </ResponsiveContainer>
                    </div>
                  </div>
                  <div className={`${cardCls} ${pfChartCard}`}>
                    <h2 className={chartTitle}>Savings rate trend</h2>
                    <p className={chartSub}>Net income ÷ income (%)</p>
                    <div className="mt-3 h-64 w-full min-w-0">
                      <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={savingsRateTrend} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                          <CartesianGrid strokeDasharray="3 3" className="opacity-40" />
                          <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                          <YAxis tick={{ fontSize: 11 }} width={40} unit="%" />
                          <Tooltip formatter={(v) => `${v}%`} />
                          <Line type="monotone" dataKey="rate" name="Savings %" stroke="#a855f7" dot strokeWidth={2} />
                        </LineChart>
                      </ResponsiveContainer>
                    </div>
                  </div>
                  <div className={`${cardCls} ${pfChartCard}`}>
                    <h2 className={chartTitle}>Expense breakdown (YTD)</h2>
                    <p className={chartSub}>Click a slice to drill into transactions</p>
                    <div className="mt-3 h-64 w-full min-w-0">
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie
                            data={expensePie}
                            dataKey="value"
                            nameKey="name"
                            cx="50%"
                            cy="50%"
                            innerRadius={48}
                            outerRadius={76}
                            paddingAngle={2}
onClick={(_, idx) => {
                              const s = expensePie[idx]
                              if (s) openDrill({ kind: 'expense', category: s.name, monthKey: null })
                            }}
                          >
                            {expensePie.map((_, i) => (
                              <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                            ))}
                          </Pie>
                          <Tooltip formatter={(v) => formatInr(v)} />
                        </PieChart>
                      </ResponsiveContainer>
                    </div>
                  </div>
                  <div className={`${cardCls} ${pfChartCard}`}>
                    <h2 className={chartTitle}>Income sources (YTD)</h2>
                    <p className={chartSub}>Click a slice to drill into lines</p>
                    <div className="mt-3 h-64 w-full min-w-0">
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie
                            data={incomePie}
                            dataKey="value"
                            nameKey="name"
                            cx="50%"
                            cy="50%"
                            innerRadius={48}
                            outerRadius={76}
                            paddingAngle={2}
                            onClick={(_, idx) => {
                              const s = incomePie[idx]
                              if (s) openDrill({ kind: 'income', category: s.name, monthKey: null })
                            }}
                          >
                            {incomePie.map((_, i) => (
                              <Cell key={i} fill={PIE_COLORS[(i + 2) % PIE_COLORS.length]} />
                            ))}
                          </Pie>
                          <Tooltip formatter={(v) => formatInr(v)} />
                        </PieChart>
                      </ResponsiveContainer>
                    </div>
                  </div>
                  <div className={`${cardCls} ${pfChartCard} lg:col-span-2`}>
                    <h2 className={chartTitle}>Expense by category (YTD)</h2>
                    <div className="mt-3 h-72 w-full min-w-0">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={expensePie.slice(0, 12)} layout="vertical" margin={{ left: 8, right: 16 }}>
                          <CartesianGrid strokeDasharray="3 3" className="opacity-40" />
                          <XAxis type="number" tickFormatter={(v) => formatInr(v)} />
                          <YAxis type="category" dataKey="name" width={100} tick={{ fontSize: 11 }} />
                          <Tooltip formatter={(v) => formatInr(v)} />
                          <Bar
                            dataKey="value"
                            name="Expense"
                            fill="#f97316"
                            radius={[0, 4, 4, 0]}
                            onClick={(d) => d && openDrill({ kind: 'expense', category: d.name, monthKey: null })}
                          />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  </div>
                  <div className={`${cardCls} ${pfChartCard} lg:col-span-2`}>
                    <h2 className={chartTitle}>Monthly comparison</h2>
                    <p className={chartSub}>Click a month row to open ledger lines for that month</p>
                    <div className="mt-3 h-64 w-full min-w-0">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={monthlyCompareRows}>
                          <CartesianGrid strokeDasharray="3 3" className="opacity-40" />
                          <XAxis dataKey="month" tick={{ fontSize: 10 }} />
                          <YAxis tick={{ fontSize: 10 }} width={44} tickFormatter={(v) => formatInr(v)} />
                          <Tooltip formatter={(v) => formatInr(v)} />
                          <Legend />
                          <Bar dataKey="income" name="Income" fill="#22c55e" radius={[4, 4, 0, 0]} />
                          <Bar dataKey="expense" name="Expense" fill="#ef4444" radius={[4, 4, 0, 0]} />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                    <div className={`${pfTableWrap} mt-4 max-h-56 overflow-auto`}>
                      <table className={pfTable}>
                        <thead>
                          <tr>
                            <th className={pfTh}>Month</th>
                            <th className={pfThRight}>Income</th>
                            <th className={pfThRight}>Expense</th>
                            <th className={pfThRight}>EMI</th>
                            <th className={pfThRight}>Savings</th>
                            <th className={pfThRight}>Net worth</th>
                          </tr>
                        </thead>
                        <tbody>
                          {monthlyCompareRows.map((r) => (
                            <tr
                              key={r.monthKey}
                              className={`${pfTrHover} cursor-pointer`}
                              onClick={() => openDrill({ kind: 'expense', category: null, monthKey: r.monthKey })}
                              title="Drill: expenses for this month"
                            >
                              <td className={pfTd}>{r.month}</td>
                              <td className={pfTdRight}>{formatInr(r.income)}</td>
                              <td className={pfTdRight}>{formatInr(r.expense)}</td>
                              <td className={pfTdRight}>{formatInr(r.emi)}</td>
                              <td className={pfTdRight}>{formatInr(r.savings)}</td>
                              <td className={pfTdRight}>{formatInr(r.netWorth)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              ) : null}

              {reportTab === 'cashflow' ? (
                <div className="grid gap-4 lg:grid-cols-2">
                  <div className={`${cardCls} ${pfChartCard} lg:col-span-2`}>
                    <h2 className={chartTitle}>Cash flow — operating, investing, financing</h2>
                    <p className={chartSub}>
                      Operating = income − expense. Investing = −new investments. Financing = −(loan + liability + credit
                      card payments).
                    </p>
                    <div className="mt-3 h-72 w-full min-w-0">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={cashFlowActivityData}>
                          <CartesianGrid strokeDasharray="3 3" className="opacity-40" />
                          <XAxis dataKey="label" tick={{ fontSize: 10 }} />
                          <YAxis tick={{ fontSize: 10 }} width={48} tickFormatter={(v) => formatInr(v)} />
                          <Tooltip formatter={(v) => formatInr(v)} />
                          <Legend />
                          <Bar dataKey="Operating" stackId="a" fill="#22c55e" radius={[0, 0, 0, 0]} />
                          <Bar dataKey="Investing" stackId="a" fill="#0ea5e9" radius={[0, 0, 0, 0]} />
                          <Bar dataKey="Financing" stackId="a" fill="#a855f7" radius={[4, 4, 0, 0]} />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  </div>
                </div>
              ) : null}

              {reportTab === 'balancesheet' ? (
                <div className="grid gap-4 lg:grid-cols-2">
                  <div className={`${cardCls} ${pfChartCard}`}>
                    <h2 className={chartTitle}>Assets vs liabilities (latest)</h2>
                    <div className="mt-3 h-56 w-full min-w-0">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={assetsVsLiabData}>
                          <CartesianGrid strokeDasharray="3 3" className="opacity-40" />
                          <XAxis dataKey="name" />
                          <YAxis tickFormatter={(v) => formatInr(v)} width={48} />
                          <Tooltip formatter={(v) => formatInr(v)} />
                          <Bar dataKey="amt" fill="#38bdf8" radius={[4, 4, 0, 0]} />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  </div>
                  {lastBs ? (
                    <div className={cardCls}>
                      <h2 className="text-base font-bold text-slate-900 dark:text-[var(--pf-text)]">
                        Balance sheet (current book)
                      </h2>
                      <p className="mt-1 text-xs text-slate-500 dark:text-[var(--pf-text-muted)]">
                        Non-cash lines repeat the latest profile snapshot each month until history is tracked.
                      </p>
                      <ul className="mt-3 space-y-2 text-sm">
                        <li className="font-semibold text-slate-800 dark:text-[var(--pf-text)]">ASSETS</li>
                        <li className="flex justify-between border-b border-slate-100 py-1 dark:border-[var(--pf-border)]">
                          <span>Cash &amp; bank (reported)</span>
                          <span className="font-mono">{formatInr(monthlyData?.cash_bank_reported?.total)}</span>
                        </li>
                        <li className="flex justify-between border-b border-slate-100 py-1 dark:border-[var(--pf-border)]">
                          <span>Cash (wallet / hand)</span>
                          <span className="font-mono">{formatInr(lastBs.cash_wallet)}</span>
                        </li>
                        <li className="flex justify-between border-b border-slate-100 py-1 dark:border-[var(--pf-border)]">
                          <span>Bank accounts</span>
                          <span className="font-mono">{formatInr(lastBs.bank_accounts)}</span>
                        </li>
                        <li className="flex justify-between border-b border-slate-100 py-1 dark:border-[var(--pf-border)]">
                          <span>Investments</span>
                          <span className="font-mono">{formatInr(lastBs.investments)}</span>
                        </li>
                        <li className="flex justify-between border-b border-slate-100 py-1 dark:border-[var(--pf-border)]">
                          <span>Fixed assets</span>
                          <span className="font-mono">{formatInr(lastBs.fixed_assets)}</span>
                        </li>
                        <li className="flex justify-between border-b border-slate-100 py-1 dark:border-[var(--pf-border)]">
                          <span>Loans given (receivable)</span>
                          <span className="font-mono">{formatInr(lastBs.loans_given_receivable ?? lastBs.loans_outstanding)}</span>
                        </li>
                        <li className="flex justify-between py-1 font-semibold">
                          <span>Total assets</span>
                          <span className="font-mono">{formatInr(lastBs.total_assets)}</span>
                        </li>
                        <li className="pt-2 font-semibold text-slate-800 dark:text-[var(--pf-text)]">LIABILITIES</li>
                        <li className="flex justify-between border-b border-slate-100 py-1 dark:border-[var(--pf-border)]">
                          <span>Credit cards</span>
                          <span className="font-mono">{formatInr(lastBs.credit_cards_liabilities)}</span>
                        </li>
                        <li className="flex justify-between border-b border-slate-100 py-1 dark:border-[var(--pf-border)]">
                          <span>Loans &amp; other</span>
                          <span className="font-mono">{formatInr(lastBs.loans_other_liabilities)}</span>
                        </li>
                        <li className="flex justify-between border-b border-slate-100 py-1 dark:border-[var(--pf-border)]">
                          <span>EMI outstanding (schedule)</span>
                          <span className="font-mono">{formatInr(lastBs.emi_installments_due)}</span>
                        </li>
                        <li className="flex justify-between py-1 font-semibold">
                          <span>Total liabilities</span>
                          <span className="font-mono">{formatInr(lastBs.liabilities)}</span>
                        </li>
                        <li className="flex justify-between border-t border-slate-200 pt-2 font-bold dark:border-[var(--pf-border)]">
                          <span>NET WORTH</span>
                          <span className="font-mono">{formatInr(lastBs.net_worth)}</span>
                        </li>
                      </ul>
                    </div>
                  ) : null}
                </div>
              ) : null}

              {reportTab === 'networth' ? (
                <div className="grid gap-4 lg:grid-cols-2">
                  <div className={`${cardCls} ${pfChartCard} lg:col-span-2`}>
                    <h2 className={chartTitle}>Net worth trend</h2>
                    <div className="mt-3 h-64 w-full min-w-0">
                      <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={trendChartData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                          <CartesianGrid strokeDasharray="3 3" className="opacity-40" />
                          <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                          <YAxis tick={{ fontSize: 11 }} width={52} tickFormatter={(v) => formatInr(v)} />
                          <Tooltip formatter={(v) => formatInr(v)} />
                          <Line type="monotone" dataKey="netWorth" name="Net worth" stroke="#0ea5e9" strokeWidth={2} dot />
                        </LineChart>
                      </ResponsiveContainer>
                    </div>
                  </div>
                  <div className={`${cardCls} ${pfChartCard}`}>
                    <h2 className={chartTitle}>Assets allocation</h2>
                    <div className="mt-3 h-56 w-full min-w-0">
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie
                            data={netWorthAssetsComposition}
                            dataKey="value"
                            nameKey="name"
                            cx="50%"
                            cy="50%"
                            outerRadius={70}
                          >
                            {netWorthAssetsComposition.map((_, i) => (
                              <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                            ))}
                          </Pie>
                          <Tooltip formatter={(v) => formatInr(v)} />
                        </PieChart>
                      </ResponsiveContainer>
                    </div>
                  </div>
                  <div className={`${cardCls} ${pfChartCard}`}>
                    <h2 className={chartTitle}>Liabilities breakdown</h2>
                    <div className="mt-3 h-56 w-full min-w-0">
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie
                            data={netWorthLiabComposition}
                            dataKey="value"
                            nameKey="name"
                            cx="50%"
                            cy="50%"
                            outerRadius={70}
                          >
                            {netWorthLiabComposition.map((_, i) => (
                              <Cell key={i} fill={PIE_COLORS[(i + 3) % PIE_COLORS.length]} />
                            ))}
                          </Pie>
                          <Tooltip formatter={(v) => formatInr(v)} />
                        </PieChart>
                      </ResponsiveContainer>
                    </div>
                  </div>
                  <div className={`${cardCls} lg:col-span-2`}>
                    <h2 className="text-base font-bold text-slate-900 dark:text-[var(--pf-text)]">Net worth change</h2>
                    <div className={pfTableWrap}>
                      <table className={pfTable}>
                        <thead>
                          <tr>
                            <th className={pfTh}>Month</th>
                            <th className={pfThRight}>Net worth</th>
                            <th className={pfThRight}>Δ vs prev</th>
                          </tr>
                        </thead>
                        <tbody>
                          {trendChartData.map((r, i) => {
                            const prev = i > 0 ? trendChartData[i - 1].netWorth : null
                            const d = prev != null ? r.netWorth - prev : null
                            return (
                              <tr key={r.label} className={pfTrHover}>
                                <td className={pfTd}>{r.label}</td>
                                <td className={pfTdRight}>{formatInr(r.netWorth)}</td>
                                <td className={pfTdRight}>{d == null ? '—' : formatInr(d)}</td>
                              </tr>
                            )
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              ) : null}

              {reportTab === 'income' ? (
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
                          EMI / debt service (expense)
                        </th>
                        {rows.map((r) => (
                          <td key={`is-em-${r.month_key}`} className={tdVal}>
                            {formatInr(r.income_statement?.expense_emi)}
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
              ) : null}

              {reportTab === 'cashflow' ? (
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
                          Investing (est.)
                        </th>
                        {rows.map((r) => (
                          <td key={`cf-inv-${r.month_key}`} className={tdVal}>
                            {formatInr(r.cash_flow?.investing_cash_flow)}
                          </td>
                        ))}
                      </tr>
                      <tr>
                        <th scope="row" className={tdLabel}>
                          Financing (est.)
                        </th>
                        {rows.map((r) => (
                          <td key={`cf-fin-${r.month_key}`} className={tdVal}>
                            {formatInr(r.cash_flow?.financing_cash_flow)}
                          </td>
                        ))}
                      </tr>
                      <tr>
                        <th scope="row" className={tdLabel}>
                          Activity (O+I+F)
                        </th>
                        {rows.map((r) => (
                          <td key={`cf-sum-${r.month_key}`} className={tdVal}>
                            {formatInr(r.cash_flow?.net_cash_activity)}
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
              ) : null}

              {reportTab === 'balancesheet' ? (
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
                        { label: 'Loans given', get: (r) => r.balance_sheet?.loans_given_receivable ?? r.balance_sheet?.loans_outstanding },
                        { label: 'Total assets', get: (r) => r.balance_sheet?.total_assets },
                        { label: 'Credit cards', get: (r) => r.balance_sheet?.credit_cards_liabilities },
                        { label: 'Loans & other', get: (r) => r.balance_sheet?.loans_other_liabilities },
                        { label: 'Total liabilities', get: (r) => r.balance_sheet?.liabilities },
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
              ) : null}
            </>
          ) : null}
        </>
      ) : null}

      {drill ? (
        <div className="fixed inset-0 z-[120] flex items-start justify-center overflow-y-auto bg-black/50 p-4 sm:p-8">
          <div
            className={`${cardCls} relative mt-6 w-full max-w-2xl space-y-3 p-4 sm:p-5`}
            role="dialog"
            aria-modal="true"
          >
            <div className="flex items-start justify-between gap-2">
              <h2 className="text-base font-bold text-slate-900 dark:text-[var(--pf-text)]">
                {drill.kind === 'expense' ? 'Expense' : 'Income'} lines
                {drill.category ? ` · ${drill.category}` : ''}
                {drill.monthKey ? ` · ${drill.monthKey}` : ''}
              </h2>
              <button
                type="button"
                className="text-sm text-slate-500 hover:text-slate-800 dark:text-[var(--pf-text-muted)]"
                onClick={() => setDrill(null)}
              >
                Close
              </button>
            </div>
            {drillLoading ? (
              <p className="text-sm text-slate-500">Loading…</p>
            ) : (
              <div className={pfTableWrap}>
                <table className={pfTable}>
                  <thead>
                    <tr>
                      <th className={pfTh}>Date</th>
                      <th className={pfTh}>Category</th>
                      <th className={pfThRight}>Amount</th>
                    </tr>
                  </thead>
                  <tbody>
                    {drillRows.map((r) => (
                      <tr key={r.id} className={pfTrHover}>
                        <td className={pfTd}>{r.entry_date}</td>
                        <td className={pfTd}>{r.category}</td>
                        <td className={pfTdRight}>{formatInr(r.amount)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {!drillRows.length ? (
                  <p className="p-3 text-sm text-slate-500 dark:text-[var(--pf-text-muted)]">No rows.</p>
                ) : null}
              </div>
            )}
          </div>
        </div>
      ) : null}

      {monthlyData?.reconciliation_warning ? (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950 dark:border-amber-900/50 dark:bg-amber-950/30 dark:text-amber-100">
          {monthlyData.reconciliation_warning}
        </div>
      ) : null}
    </div>
  )
}
