import { ChevronDownIcon } from '@heroicons/react/24/outline'
import { InformationCircleIcon, WalletIcon } from '@heroicons/react/24/solid'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useOutletContext, useSearchParams } from 'react-router-dom'
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
  ReferenceLine,
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

/** Tab title + subtitle — “what question does this answer?” */
const TAB_INTROS = {
  income: {
    title: 'Income statement',
    subtitle:
      'Answers: Am I profitable? Shows revenue-style income, total spend, and profit (income − expenses) for the year.',
  },
  cashflow: {
    title: 'Cash flow statement',
    subtitle:
      'Answers: Where did cash move? Operating (income − spend), investing (allocations), and financing (debt repayments) with an estimated cash roll-forward.',
  },
  balancesheet: {
    title: 'Balance sheet',
    subtitle:
      'Answers: What do I own vs owe? Assets, liabilities, and equity (net worth) — latest book positions repeat in monthly columns until full history exists.',
  },
  networth: {
    title: 'Net worth',
    subtitle:
      'Answers: Am I getting richer? Trend of net worth plus how assets and liabilities are allocated today.',
  },
  ledger: {
    title: 'Ledger',
    subtitle:
      'Answers: What exactly happened? Chronological income and expense lines with an optional running balance.',
  },
}

const RATIO_HELP = {
  'Savings rate': '(Income − expenses) ÷ income for the year to date. Higher means more of earnings left after spend.',
  'Debt to income (EMI)': 'Total EMI-tagged expenses ÷ income YTD — share of earnings going to EMI.',
  'Expense ratio': 'Total expenses ÷ income YTD.',
  'Credit utilization': 'Card balances ÷ total credit limits across cards in the app.',
  'Liquidity (mo.)': 'Estimated cash ÷ average monthly expense — rough months of coverage.',
  'Investments / assets': 'Investments ÷ total assets — allocation signal, not advice.',
}

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

function rowPersonKey(r) {
  if (r.kind === 'income') return String(r.received_from ?? '').trim()
  return String(r.paid_by ?? '').trim()
}

function RatioHint({ label }) {
  const tip = RATIO_HELP[label]
  if (!tip) return null
  return (
    <span title={tip} className="group inline-flex align-middle">
      <InformationCircleIcon className="ml-0.5 h-3.5 w-3.5 shrink-0 text-slate-400 opacity-70 group-hover:opacity-100 dark:text-slate-500" />
    </span>
  )
}

function StatementSectionHeader({ tabId }) {
  const meta = TAB_INTROS[tabId]
  if (!meta) return null
  return (
    <div className="mb-5 border-b border-slate-200/80 pb-4 dark:border-[var(--pf-border)]">
      <h2 className="text-lg font-bold tracking-tight text-slate-900 dark:text-[var(--pf-text)]">{meta.title}</h2>
      <p className="mt-1 max-w-3xl text-sm leading-relaxed text-slate-600 dark:text-[var(--pf-text-muted)]">
        {meta.subtitle}
      </p>
    </div>
  )
}

const premiumTriggerCls =
  'flex h-10 min-h-10 w-full items-center justify-between gap-2 rounded-xl border px-3 py-2 text-left text-sm font-semibold shadow-sm outline-none transition-all duration-200 ' +
  'border-slate-200/90 bg-white text-slate-900 hover:border-sky-400/50 hover:bg-slate-50/90 focus-visible:ring-2 focus-visible:ring-sky-400/40 ' +
  'dark:border-white/10 dark:bg-white/[0.06] dark:text-slate-100 dark:hover:border-sky-400/35 dark:hover:bg-white/[0.1] dark:focus-visible:ring-sky-400/30'

const premiumPanelCls =
  'absolute left-0 z-[100] mt-1.5 max-h-72 min-w-full overflow-y-auto rounded-xl border border-slate-200/90 bg-white py-1.5 shadow-2xl ring-1 ring-slate-900/5 ' +
  'dark:border-white/10 dark:bg-slate-950 dark:ring-white/10'

function PremiumSelect({
  id,
  ariaLabel,
  value,
  onChange,
  options,
  className = '',
  icon: Icon,
  /** 'simple' = text-only rows; 'account' = wallet / totals glyph per row */
  variant = 'simple',
}) {
  const [open, setOpen] = useState(false)
  const wrapRef = useRef(null)
  useEffect(() => {
    if (!open) return
    function onDoc(e) {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(false)
    }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [open])

  const selected = options.find((o) => o.value === value)
  const showLabel = selected?.label ?? '—'

  return (
    <div className={`relative ${className}`} ref={wrapRef}>
      <button
        type="button"
        id={id}
        aria-label={ariaLabel}
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => setOpen((x) => !x)}
        className={premiumTriggerCls}
      >
        <span className="flex min-w-0 flex-1 items-center gap-2">
          {Icon ? <Icon className="h-4 w-4 shrink-0 text-sky-600 opacity-90 dark:text-sky-400" aria-hidden /> : null}
          <span className="min-w-0 truncate">{showLabel}</span>
        </span>
        <ChevronDownIcon
          className={`h-4 w-4 shrink-0 text-slate-500 opacity-70 transition-transform dark:text-slate-400 ${open ? 'rotate-180' : ''}`}
          aria-hidden
        />
      </button>
      {open ? (
        <ul role="listbox" aria-labelledby={id} className={premiumPanelCls}>
          {options.map((o) => {
            const active = value === o.value
            return (
              <li key={o.value === '' ? '__all__' : String(o.value)} role="presentation">
                <button
                  type="button"
                  role="option"
                  aria-selected={active}
                  className={
                    'flex w-full items-center gap-2.5 rounded-lg px-3 py-2.5 text-left text-sm transition-colors ' +
                    (active
                      ? 'mx-1 bg-sky-500/15 font-semibold text-sky-900 dark:bg-sky-400/15 dark:text-sky-100'
                      : 'mx-1 text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-white/10')
                  }
                  onClick={() => {
                    onChange(o.value)
                    setOpen(false)
                  }}
                >
                  {variant === 'account' ? (
                    o.value !== '' && o.value != null ? (
                      <WalletIcon className="h-4 w-4 shrink-0 text-sky-600/80 dark:text-sky-400/90" aria-hidden />
                    ) : (
                      <span className="flex h-4 w-4 shrink-0 items-center justify-center rounded-md bg-slate-200/80 text-[10px] font-bold text-slate-600 dark:bg-white/10 dark:text-slate-300">
                        ∑
                      </span>
                    )
                  ) : (
                    <span className="h-4 w-4 shrink-0 rounded-full bg-sky-500/20 dark:bg-sky-400/15" aria-hidden />
                  )}
                  <span className="min-w-0 flex-1">
                    <span className="block truncate">{o.label}</span>
                    {o.sub ? <span className="mt-0.5 block truncate text-[11px] font-normal text-slate-500 dark:text-slate-400">{o.sub}</span> : null}
                  </span>
                </button>
              </li>
            )
          })}
        </ul>
      ) : null}
    </div>
  )
}

function pctDeltaLabel(cur, prev) {
  if (prev == null || cur == null || !Number.isFinite(prev) || !Number.isFinite(cur)) return null
  if (Math.abs(prev) < 0.01) return null
  const p = Math.round(1000 * ((cur - prev) / prev)) / 10
  if (!Number.isFinite(p)) return null
  return p
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
  const [searchParams, setSearchParams] = useSearchParams()
  const statementsDeepLinkApplied = useRef(false)
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
  const [compareYear, setCompareYear] = useState('')
  const [compareMonthlyData, setCompareMonthlyData] = useState(null)
  const [compareLoading, setCompareLoading] = useState(false)
  const [ledgerAccountId, setLedgerAccountId] = useState('')
  const [ledgerCategory, setLedgerCategory] = useState('')
  const [ledgerType, setLedgerType] = useState('')
  const [ledgerPerson, setLedgerPerson] = useState('')
  const [ledgerAmtMin, setLedgerAmtMin] = useState('')
  const [ledgerAmtMax, setLedgerAmtMax] = useState('')

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

  const loadCompareMonthly = useCallback(async () => {
    if (!getPfToken()) return
    if (!compareYear || Number(compareYear) === Number(year)) {
      setCompareMonthlyData(null)
      setCompareLoading(false)
      return
    }
    setCompareLoading(true)
    try {
      const q = bankFilter === '' ? undefined : bankFilter
      const res = await getMonthlyFinancialTables(Number(compareYear), q)
      setCompareMonthlyData(res)
    } catch {
      setCompareMonthlyData(null)
    } finally {
      setCompareLoading(false)
    }
  }, [compareYear, year, bankFilter])

  const loadDailyLedger = useCallback(async () => {
    if (!getPfToken()) return
    setDailyLoading(true)
    setError('')
    try {
      const accRaw = ledgerAccountId !== '' ? ledgerAccountId : bankFilter
      const q = accRaw === '' ? undefined : accRaw
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
  }, [dailyFrom, dailyTo, bankFilter, ledgerAccountId, onSessionInvalid])

  useEffect(() => {
    loadAccounts()
  }, [loadAccounts, tick])

  useEffect(() => {
    if (statementsDeepLinkApplied.current) return
    const tab = searchParams.get('tab')
    const aid = searchParams.get('account_id')
    if (tab !== 'ledger' && !aid) return
    if (tab === 'ledger') setReportTab('ledger')
    if (aid) {
      setBankFilter(aid)
      setLedgerAccountId(aid)
    }
    statementsDeepLinkApplied.current = true
    const next = new URLSearchParams(searchParams)
    next.delete('tab')
    next.delete('account_id')
    setSearchParams(next, { replace: true })
  }, [searchParams, setSearchParams])

  useEffect(() => {
    if (reportTab !== 'ledger') return
    loadDailyLedger()
  }, [reportTab, loadDailyLedger, tick])

  useEffect(() => {
    if (reportTab === 'ledger') return
    loadMonthlyTables()
  }, [reportTab, loadMonthlyTables, tick])

  useEffect(() => {
    if (reportTab === 'ledger') return
    loadCompareMonthly()
  }, [reportTab, loadCompareMonthly, tick])

  const mergedDaily = useMemo(
    () => buildMergedLedger(dailyData?.income, dailyData?.expenses),
    [dailyData],
  )

  const rows = Array.isArray(monthlyData?.rows) ? monthlyData.rows : []
  const filterName = bankFilter
    ? accounts.find((a) => String(a.id) === bankFilter)?.account_name ?? ''
    : ''

  const yearPremiumOptions = useMemo(
    () => yearOptions.map((y) => ({ value: String(y), label: String(y) })),
    [yearOptions],
  )

  const comparePremiumOptions = useMemo(
    () => [
      { value: '', label: 'No comparison', sub: 'Current year only' },
      ...yearOptions
        .filter((y) => y !== year)
        .map((y) => ({ value: String(y), label: `vs ${y}`, sub: 'YTD delta %' })),
    ],
    [yearOptions, year],
  )

  const accountPremiumOptions = useMemo(
    () => [
      { value: '', label: 'All accounts', sub: 'Consolidated · all books' },
      ...accounts.map((a) => ({
        value: String(a.id),
        label: a.account_name,
        sub: 'Single account scope',
      })),
    ],
    [accounts],
  )

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

  const assetsVsLiabTrend = useMemo(
    () =>
      rows.map((r) => ({
        label: monthColumnHeading(r),
        assets: Number(r.balance_sheet?.total_assets) || 0,
        liabilities: Number(r.balance_sheet?.liabilities) || 0,
      })),
    [rows],
  )

  const closingCashTrend = useMemo(
    () =>
      rows.map((r) => ({
        label: monthColumnHeading(r),
        closing: Number(r.cash_flow?.closing_cash_estimate) || 0,
      })),
    [rows],
  )

  const liquidInvestLoanData = useMemo(() => {
    if (!lastBs) return []
    return [
      { name: 'Liquid (cash est.)', value: Number(lastBs.cash_estimate) || 0 },
      { name: 'Investments', value: Number(lastBs.investments) || 0 },
      { name: 'Loans given', value: Number(lastBs.loans_given_receivable ?? lastBs.loans_outstanding) || 0 },
    ].filter((x) => x.value > 0.01)
  }, [lastBs])

  const latestCfBridge = useMemo(() => {
    if (!rows.length || !monthlyData) return null
    const i = rows.length - 1
    const r = rows[i]
    const cf = r.cash_flow || {}
    const op = Number(cf.net_operating_cash_flow) || 0
    const inv = Number(cf.investing_cash_flow) || 0
    const fin = Number(cf.financing_cash_flow) || 0
    const closing = Number(cf.closing_cash_estimate) || 0
    const prevClosing =
      i > 0
        ? Number(rows[i - 1].cash_flow?.closing_cash_estimate) || 0
        : Number(monthlyData.opening_cash_estimate) || 0
    const netActivity = op + inv + fin
    return {
      monthLabel: monthColumnHeading(r),
      prevClosing,
      op,
      inv,
      fin,
      netActivity,
      closing,
      checkOk: Math.abs(prevClosing + netActivity - closing) < 1,
    }
  }, [rows, monthlyData])

  const ledgerCategories = useMemo(() => {
    const s = new Set()
    for (const r of mergedDaily) {
      const c = String(r.category ?? '').trim()
      if (c) s.add(c)
    }
    return [...s].sort((a, b) => a.localeCompare(b))
  }, [mergedDaily])

  const ledgerAccountPremiumOptions = useMemo(
    () => [
      {
        value: '',
        label: 'Same as header filter',
        sub: bankFilter ? filterName || 'Account in filter bar' : 'All accounts · consolidated',
      },
      ...accounts.map((a) => ({
        value: String(a.id),
        label: a.account_name,
        sub: 'Load this account only',
      })),
    ],
    [accounts, bankFilter, filterName],
  )

  const ledgerCategoryOptions = useMemo(
    () => [
      { value: '', label: 'All categories' },
      ...ledgerCategories.map((c) => ({ value: c, label: c })),
    ],
    [ledgerCategories],
  )

  const ledgerTypeOptions = useMemo(
    () => [
      { value: '', label: 'All types' },
      { value: 'income', label: 'Income' },
      { value: 'expense', label: 'Expense' },
    ],
    [],
  )

  const ledgerFilteredWithBalance = useMemo(() => {
    const minA = ledgerAmtMin === '' ? null : Number(ledgerAmtMin)
    const maxA = ledgerAmtMax === '' ? null : Number(ledgerAmtMax)
    const cat = ledgerCategory.trim()
    const person = ledgerPerson.trim().toLowerCase()
    const filtered = mergedDaily.filter((r) => {
      if (ledgerType === 'income' && r.kind !== 'income') return false
      if (ledgerType === 'expense' && r.kind !== 'expense') return false
      if (cat && String(r.category ?? '') !== cat) return false
      if (person && !rowPersonKey(r).toLowerCase().includes(person)) return false
      const amt = Number(r.amount) || 0
      if (minA != null && Number.isFinite(minA) && amt < minA) return false
      if (maxA != null && Number.isFinite(maxA) && amt > maxA) return false
      return true
    })
    const sorted = [...filtered].sort((a, b) => {
      const c = String(a.entry_date ?? '').localeCompare(String(b.entry_date ?? ''))
      if (c !== 0) return c
      return (Number(a.id) || 0) - (Number(b.id) || 0)
    })
    let bal = 0
    return sorted.map((r) => {
      if (r.kind === 'income') bal += Number(r.amount) || 0
      else bal -= Number(r.amount) || 0
      return { ...r, balance: bal }
    })
  }, [
    mergedDaily,
    ledgerCategory,
    ledgerType,
    ledgerPerson,
    ledgerAmtMin,
    ledgerAmtMax,
  ])

  const ledgerDisplayDesc = useMemo(() => [...ledgerFilteredWithBalance].reverse(), [ledgerFilteredWithBalance])

  const dailyTotalsFiltered = useMemo(() => {
    let inc = 0
    let exp = 0
    for (const r of ledgerFilteredWithBalance) {
      if (r.kind === 'income') inc += Number(r.amount) || 0
      else exp += Number(r.amount) || 0
    }
    return { inc, exp, net: inc - exp }
  }, [ledgerFilteredWithBalance])

  const ledgerFiltersActive = useMemo(
    () =>
      Boolean(
        ledgerCategory ||
          ledgerType ||
          ledgerPerson.trim() ||
          ledgerAmtMin !== '' ||
          ledgerAmtMax !== '',
      ),
    [ledgerCategory, ledgerType, ledgerPerson, ledgerAmtMin, ledgerAmtMax],
  )

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

  const incomeStatementYtd = useMemo(() => {
    let inc = 0
    let exp = 0
    let emi = 0
    for (const row of rows) {
      inc += Number(row.income_statement?.income) || 0
      exp += Number(row.income_statement?.expense) || 0
      emi += Number(row.income_statement?.expense_emi) || 0
    }
    const operating = inc - exp
    return { inc, exp, emi, operating, net: operating }
  }, [rows])

  const compareRows = Array.isArray(compareMonthlyData?.rows) ? compareMonthlyData.rows : []

  const compareYtd = useMemo(() => {
    if (!compareRows.length) return null
    let inc = 0
    let exp = 0
    for (const row of compareRows) {
      inc += Number(row.income_statement?.income) || 0
      exp += Number(row.income_statement?.expense) || 0
    }
    const last = compareRows[compareRows.length - 1]
    return {
      inc,
      exp,
      net: inc - exp,
      netWorth: Number(last?.balance_sheet?.net_worth) || 0,
    }
  }, [compareRows])

  const yoyDeltas = useMemo(() => {
    if (!monthlyYtd || !compareYtd || !compareYear) return null
    return {
      income: pctDeltaLabel(monthlyYtd.inc, compareYtd.inc),
      expense: pctDeltaLabel(monthlyYtd.exp, compareYtd.exp),
      net: pctDeltaLabel(monthlyYtd.net, compareYtd.net),
      netWorth: pctDeltaLabel(
        lastBs != null ? Number(lastBs.net_worth) : null,
        compareYtd.netWorth,
      ),
    }
  }, [monthlyYtd, compareYtd, compareYear, lastBs])

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
    else {
      loadMonthlyTables()
      loadCompareMonthly()
    }
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
              key: 'pdf-pack',
              label: 'Financial pack (PDF)',
              onClick: () => handleFinancialStatementExport('pdf'),
            },
            {
              key: 'xlsx-pack',
              label: 'Financial pack (Excel)',
              onClick: () => handleFinancialStatementExport('excel'),
            },
            {
              key: 'pdf-pl',
              label: 'P&L / income statement (PDF)',
              onClick: () => handleFinancialStatementExport('pdf'),
            },
            {
              key: 'pdf-cf',
              label: 'Cash flow & monthly (PDF)',
              onClick: () => handleFinancialStatementExport('pdf'),
            },
            {
              key: 'pdf-bs',
              label: 'Balance sheet context (PDF)',
              onClick: () => handleFinancialStatementExport('pdf'),
            },
            {
              key: 'xlsx-ledger',
              label: 'Ledger & detail tabs (Excel)',
              onClick: () => handleFinancialStatementExport('excel'),
            },
          ]}
        />
      </div>

      <div className="rounded-2xl border border-slate-200/85 bg-gradient-to-br from-white via-white to-slate-50/35 p-4 shadow-[var(--pf-shadow)] dark:border-[var(--pf-border)] dark:from-[var(--pf-card)] dark:via-[var(--pf-card)] dark:to-slate-950/40 sm:p-4">
        <div className="flex flex-col gap-4 sm:flex-row sm:flex-wrap sm:items-end sm:justify-between">
          <div className="min-w-0 flex-1">
            <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-slate-500 dark:text-[var(--pf-text-muted)]">
              Statement filters
            </p>
            <p className="mt-0.5 hidden text-xs text-slate-500 dark:text-[var(--pf-text-muted)] sm:block">
              Choose the fiscal year, optional YoY compare, and which account books to include.
            </p>
            <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:max-w-md">
              <div>
                <label className="mb-1.5 block text-[10px] font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                  Year
                </label>
                <PremiumSelect
                  id="pf-fs-year"
                  ariaLabel="Statement year"
                  value={String(year)}
                  onChange={(v) => setYear(Number(v))}
                  options={yearPremiumOptions}
                  variant="simple"
                />
              </div>
              <div>
                <label className="mb-1.5 block text-[10px] font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                  Compare
                </label>
                <PremiumSelect
                  id="pf-fs-compare"
                  ariaLabel="Compare to prior year"
                  value={compareYear}
                  onChange={setCompareYear}
                  options={comparePremiumOptions}
                  variant="simple"
                />
              </div>
            </div>
          </div>
          <div className="min-w-0 w-full sm:w-[min(100%,20rem)] lg:w-[min(100%,22rem)]">
            <label className="mb-1.5 block text-[10px] font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400">
              Account scope
            </label>
            <PremiumSelect
              id="pf-fs-bank"
              ariaLabel="Finance account filter"
              value={bankFilter}
              onChange={setBankFilter}
              options={accountPremiumOptions}
              icon={WalletIcon}
              variant="account"
              className="w-full"
            />
          </div>
          <div className="flex w-full items-end sm:w-auto">
            <button
              type="button"
              onClick={handleReload}
              disabled={loading}
              className="h-10 min-h-10 w-full rounded-xl border border-slate-200/90 bg-white px-4 text-sm font-semibold text-slate-800 shadow-sm transition hover:border-sky-400/40 hover:bg-slate-50 disabled:opacity-50 dark:border-white/10 dark:bg-white/[0.06] dark:text-slate-100 dark:hover:bg-white/10 sm:w-auto"
            >
              {loading ? '…' : 'Reload'}
            </button>
          </div>
        </div>
      </div>

      {reportTab !== 'ledger' && monthlyYtd && rows.length > 0 ? (
        <div className="rounded-2xl border border-slate-200/80 bg-gradient-to-b from-white to-slate-50/40 p-4 shadow-[var(--pf-shadow)] dark:border-[var(--pf-border)] dark:from-[var(--pf-card)] dark:to-[var(--pf-card)] sm:p-5">
          <div className="flex flex-wrap items-end justify-between gap-3 border-b border-slate-200/70 pb-3 dark:border-[var(--pf-border)]">
            <div>
              <h2 className="text-sm font-bold uppercase tracking-wide text-slate-500 dark:text-[var(--pf-text-muted)]">
                Year summary ({year})
              </h2>
              <p className="mt-0.5 text-xs text-slate-500 dark:text-[var(--pf-text-muted)]">
                Same figures on each statement tab — grouped for quick scanning.
              </p>
            </div>
            {compareYear && compareLoading ? (
              <span className="text-xs text-slate-500">Loading {compareYear}…</span>
            ) : null}
          </div>
          {compareYear && yoyDeltas ? (
            <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-700 dark:text-[var(--pf-text)]">
              <span className="font-semibold text-slate-500 dark:text-[var(--pf-text-muted)]">
                vs {compareYear} (YTD):
              </span>
              {[
                ['Income', yoyDeltas.income],
                ['Expense', yoyDeltas.expense],
                ['Net income', yoyDeltas.net],
                ['Net worth', yoyDeltas.netWorth],
              ].map(([label, p]) =>
                p == null ? (
                  <span key={label}>
                    {label}: <span className="text-slate-400">n/a</span>
                  </span>
                ) : (
                  <span key={label}>
                    {label}{' '}
                    <span className={p > 0 ? 'font-semibold text-emerald-600' : 'font-semibold text-rose-600'}>
                      {p > 0 ? '↑' : '↓'} {Math.abs(p)}%
                    </span>
                  </span>
                ),
              )}
            </div>
          ) : null}
          <div className="mt-4 grid gap-4 lg:grid-cols-3">
            <div className="rounded-xl border border-slate-200/60 bg-white/90 p-3 dark:border-[var(--pf-border)] dark:bg-[var(--pf-card)]">
              <p className="text-[11px] font-bold uppercase tracking-wider text-sky-700 dark:text-sky-400">Performance</p>
              <div className="mt-3 grid grid-cols-2 gap-2">
                <div className="rounded-lg bg-slate-50/80 px-2 py-2 dark:bg-[var(--pf-card-hover)]">
                  <p className="text-[10px] font-semibold text-slate-500 dark:text-[var(--pf-text-muted)]">Income</p>
                  <p className="mt-0.5 font-mono text-sm font-bold tabular-nums text-emerald-700 dark:text-emerald-400">
                    {formatInr(monthlyYtd.inc)}
                  </p>
                </div>
                <div className="rounded-lg bg-slate-50/80 px-2 py-2 dark:bg-[var(--pf-card-hover)]">
                  <p className="text-[10px] font-semibold text-slate-500 dark:text-[var(--pf-text-muted)]">Expense</p>
                  <p className="mt-0.5 font-mono text-sm font-bold tabular-nums text-rose-600 dark:text-rose-400">
                    {formatInr(monthlyYtd.exp)}
                  </p>
                </div>
                <div className="rounded-lg bg-slate-50/80 px-2 py-2 dark:bg-[var(--pf-card-hover)]">
                  <p className="text-[10px] font-semibold text-slate-500 dark:text-[var(--pf-text-muted)]">Net income</p>
                  <p className="mt-0.5 font-mono text-sm font-bold tabular-nums text-slate-900 dark:text-[var(--pf-text)]">
                    {formatInr(monthlyYtd.net)}
                  </p>
                </div>
                <div className="rounded-lg bg-slate-50/80 px-2 py-2 dark:bg-[var(--pf-card-hover)]">
                  <p className="flex items-center text-[10px] font-semibold text-slate-500 dark:text-[var(--pf-text-muted)]">
                    Savings rate
                    <RatioHint label="Savings rate" />
                  </p>
                  <p className="mt-0.5 font-mono text-sm font-bold tabular-nums text-sky-700 dark:text-sky-300">
                    {formatRatio(ratios?.savings_rate)}
                  </p>
                </div>
              </div>
            </div>
            <div className="rounded-xl border border-slate-200/60 bg-white/90 p-3 dark:border-[var(--pf-border)] dark:bg-[var(--pf-card)]">
              <p className="text-[11px] font-bold uppercase tracking-wider text-amber-800 dark:text-amber-400">Risk</p>
              <ul className="mt-3 space-y-2 text-xs">
                {[
                  ['Debt to income (EMI)', formatRatio(ratios?.debt_to_income_emi), 'Debt to income (EMI)'],
                  ['Expense ratio', formatRatio(ratios?.expense_ratio), 'Expense ratio'],
                  ['Credit utilization', formatRatio(ratios?.credit_utilization), 'Credit utilization'],
                  [
                    'Liquidity',
                    ratios?.liquidity_months != null ? `${ratios.liquidity_months} mo` : '—',
                    'Liquidity (mo.)',
                  ],
                ].map(([label, val, helpKey]) => (
                  <li key={label} className="flex items-center justify-between gap-2 border-b border-slate-100 pb-1 last:border-0 dark:border-[var(--pf-border)]">
                    <span className="flex items-center font-medium text-slate-600 dark:text-[var(--pf-text-muted)]">
                      {label}
                      <RatioHint label={helpKey} />
                    </span>
                    <span className="font-mono font-semibold tabular-nums text-slate-900 dark:text-[var(--pf-text)]">{val}</span>
                  </li>
                ))}
              </ul>
            </div>
            <div className="rounded-xl border border-slate-200/60 bg-white/90 p-3 dark:border-[var(--pf-border)] dark:bg-[var(--pf-card)]">
              <p className="text-[11px] font-bold uppercase tracking-wider text-violet-800 dark:text-violet-400">Wealth</p>
              <div className="mt-3 space-y-2 text-xs">
                <div className="flex justify-between gap-2 border-b border-slate-100 pb-1 dark:border-[var(--pf-border)]">
                  <span className="text-slate-600 dark:text-[var(--pf-text-muted)]">Cash (est.)</span>
                  <span className="font-mono font-semibold tabular-nums text-slate-900 dark:text-[var(--pf-text)]">
                    {formatInr(lastBs?.cash_estimate)}
                  </span>
                </div>
                <div className="flex justify-between gap-2 border-b border-slate-100 pb-1 dark:border-[var(--pf-border)]">
                  <span className="flex items-center text-slate-600 dark:text-[var(--pf-text-muted)]">
                    Investments
                    <RatioHint label="Investments / assets" />
                  </span>
                  <span className="font-mono font-semibold tabular-nums text-slate-900 dark:text-[var(--pf-text)]">
                    {formatInr(lastBs?.investments)}
                  </span>
                </div>
                <div className="flex justify-between gap-2 pt-0.5">
                  <span className="font-semibold text-slate-800 dark:text-[var(--pf-text)]">Net worth</span>
                  <span className="font-mono text-sm font-bold tabular-nums text-slate-900 dark:text-[var(--pf-text)]">
                    {formatInr(lastBs?.net_worth)}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : null}

      <div className="min-w-0 overflow-x-auto pb-1" aria-label="Report sections">
        <PfSegmentedControl
          options={REPORT_TABS}
          value={reportTab}
          onChange={setReportTab}
          className="w-full min-w-[min(100%,520px)]"
        />
      </div>

      {reportTab === 'ledger' ? (
        <div className="rounded-2xl border border-slate-200/85 bg-gradient-to-br from-white to-slate-50/35 p-4 shadow-[var(--pf-shadow)] dark:border-[var(--pf-border)] dark:from-[var(--pf-card)] dark:to-slate-950/35">
          <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-[var(--pf-text-muted)]">
            Ledger query
          </p>
          <div className="mt-3 flex flex-col gap-4 lg:flex-row lg:flex-wrap lg:items-end">
            <p className="text-xs text-slate-600 dark:text-[var(--pf-text-muted)] lg:max-w-xs">
              <span className="font-semibold text-slate-800 dark:text-[var(--pf-text)]">Range:</span> {dailyRangeLabel}
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
            <div className="min-w-0 w-full lg:ml-auto lg:w-72">
              <label className="mb-1.5 block text-[10px] font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                Account source
              </label>
              <PremiumSelect
                id="pf-ledger-acc"
                ariaLabel="Ledger data account scope"
                value={ledgerAccountId}
                onChange={setLedgerAccountId}
                options={ledgerAccountPremiumOptions}
                variant="account"
                className="w-full"
              />
              <p className="mt-1 text-[10px] text-slate-500 dark:text-[var(--pf-text-muted)]">
                Overrides the statement header for this download only. Leave on “Same as header filter”.
              </p>
            </div>
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
              {formatInr(dailyTotalsFiltered.inc)}
            </p>
          </div>
          <div className={cardCls}>
            <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500 dark:text-[var(--pf-text-muted)]">
              Total expense
            </p>
            <p className="mt-1 font-mono text-lg font-bold tabular-nums text-[#EF4444] dark:text-red-400">
              {formatInr(dailyTotalsFiltered.exp)}
            </p>
          </div>
          <div className={`${cardCls} col-span-2 sm:col-span-2`}>
            <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500 dark:text-[var(--pf-text-muted)]">Net</p>
            <p className="mt-1 font-mono text-lg font-bold tabular-nums text-slate-900 dark:text-[var(--pf-text)]">
              {formatInr(dailyTotalsFiltered.net)}
            </p>
            {ledgerFiltersActive ? (
              <p className="mt-1 text-[10px] text-slate-500 dark:text-[var(--pf-text-muted)]">After row filters below</p>
            ) : null}
          </div>
        </div>
      ) : null}

      {error ? (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:border-amber-900/50 dark:bg-amber-950/40 dark:text-amber-100">
          {error}
        </div>
      ) : null}

      {reportTab === 'ledger' ? (
        <section className={cardCls} aria-label="Ledger entries">
          <StatementSectionHeader tabId="ledger" />
          {!dailyLoading && mergedDaily.length > 0 ? (
            <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <div>
                <label className="mb-1.5 block text-[10px] font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                  Category
                </label>
                <PremiumSelect
                  id="pf-ledger-cat"
                  ariaLabel="Filter by category"
                  value={ledgerCategory}
                  onChange={setLedgerCategory}
                  options={ledgerCategoryOptions}
                  variant="simple"
                />
              </div>
              <div>
                <label className="mb-1.5 block text-[10px] font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                  Type
                </label>
                <PremiumSelect
                  id="pf-ledger-type"
                  ariaLabel="Income or expense"
                  value={ledgerType}
                  onChange={setLedgerType}
                  options={ledgerTypeOptions}
                  variant="simple"
                />
              </div>
              <div>
                <label htmlFor="pf-ledger-person" className={labelCls}>
                  Person contains
                </label>
                <input
                  id="pf-ledger-person"
                  type="text"
                  className={inputCls}
                  placeholder="Paid by / received from"
                  value={ledgerPerson}
                  onChange={(e) => setLedgerPerson(e.target.value)}
                />
              </div>
              <div className="flex flex-wrap gap-2">
                <div className="min-w-[5.5rem] flex-1">
                  <label htmlFor="pf-ledger-min" className={labelCls}>
                    Min ₹
                  </label>
                  <input
                    id="pf-ledger-min"
                    type="number"
                    min={0}
                    className={inputCls}
                    value={ledgerAmtMin}
                    onChange={(e) => setLedgerAmtMin(e.target.value)}
                  />
                </div>
                <div className="min-w-[5.5rem] flex-1">
                  <label htmlFor="pf-ledger-max" className={labelCls}>
                    Max ₹
                  </label>
                  <input
                    id="pf-ledger-max"
                    type="number"
                    min={0}
                    className={inputCls}
                    value={ledgerAmtMax}
                    onChange={(e) => setLedgerAmtMax(e.target.value)}
                  />
                </div>
              </div>
            </div>
          ) : null}
          {dailyLoading && !dailyData ? (
            <p className="mt-4 text-sm text-slate-500 dark:text-[var(--pf-text-muted)]">Loading…</p>
          ) : mergedDaily.length === 0 ? (
            <p className="mt-4 text-sm text-slate-500 dark:text-[var(--pf-text-muted)]">
              No income or expense rows in this range for the current account scope.
            </p>
          ) : ledgerDisplayDesc.length === 0 ? (
            <p className="mt-4 text-sm text-slate-500 dark:text-[var(--pf-text-muted)]">
              No rows match your filters — adjust category, type, person, or amounts.
            </p>
          ) : (
            <>
              <p className="mt-4 text-xs text-slate-500 dark:text-[var(--pf-text-muted)]">
                Newest first. Running balance is cumulative in date order (income increases, expenses decrease).
              </p>
              <div className="mt-3 space-y-3 md:hidden">
                {ledgerDisplayDesc.map((r) => (
                  <div
                    key={`${r.kind}-${r.id}`}
                    className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm dark:border-[var(--pf-border)] dark:bg-[var(--pf-card)]"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <span className="text-xs font-medium text-slate-500 dark:text-[var(--pf-text-muted)]">
                        {formatDayHeading(r.entry_date)}
                      </span>
                      <span
                        className={`shrink-0 font-mono text-sm font-bold tabular-nums ${
                          r.kind === 'income' ? 'text-emerald-600 dark:text-emerald-400' : 'text-[#EF4444] dark:text-red-400'
                        }`}
                      >
                        {r.kind === 'income' ? '+' : '−'}
                        {formatInr(r.amount)}
                      </span>
                    </div>
                    <p className="mt-1 font-semibold text-slate-900 dark:text-[var(--pf-text)]">{r.category}</p>
                    <p className="mt-1 text-xs text-slate-500 dark:text-[var(--pf-text-muted)]">{rowDetail(r)}</p>
                    <div className="mt-2 flex items-center justify-between border-t border-slate-100 pt-2 dark:border-[var(--pf-border)]">
                      <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-semibold capitalize dark:bg-slate-700 dark:text-slate-200">
                        {r.kind}
                      </span>
                      <span className="font-mono text-xs font-semibold text-slate-700 dark:text-[var(--pf-text-muted)]">
                        Bal {formatInr(r.balance)}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
              <div className={`${pfTableWrap} mt-4 hidden max-h-[70vh] overflow-auto md:block`}>
                <table className={`${pfTable} min-w-[44rem]`}>
                  <thead className="sticky top-0 z-10">
                    <tr className="bg-sky-100 dark:bg-[var(--pf-th-bg)]">
                      <th className={pfTh}>Date</th>
                      <th className={pfTh}>Type</th>
                      <th className={pfTh}>Category</th>
                      <th className={pfTh}>Account</th>
                      <th className={pfTh}>Detail</th>
                      <th className={pfThRight}>Debit</th>
                      <th className={pfThRight}>Credit</th>
                      <th className={pfThRight}>Balance</th>
                    </tr>
                  </thead>
                  <tbody>
                    {ledgerDisplayDesc.map((r) => (
                      <tr key={`${r.kind}-${r.id}`} className={pfTrHover}>
                        <td className={`${pfTd} whitespace-nowrap text-xs`}>{r.entry_date}</td>
                        <td className={pfTd}>
                          <span
                            className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
                              r.kind === 'income'
                                ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-200'
                                : 'bg-orange-100 text-orange-800 dark:bg-orange-900/40 dark:text-orange-200'
                            }`}
                          >
                            {r.kind}
                          </span>
                        </td>
                        <td className={pfTd}>{r.category}</td>
                        <td className={`${pfTd} text-slate-600 dark:text-[var(--pf-text-muted)]`}>
                          {r.account_id != null ? accountNameById.get(r.account_id) ?? `#${r.account_id}` : '—'}
                        </td>
                        <td className={`${pfTd} max-w-[12rem] text-xs text-slate-600 sm:max-w-md dark:text-[var(--pf-text-muted)]`}>
                          {rowDetail(r)}
                        </td>
                        <td className={`${pfTdRight} text-orange-900 dark:text-orange-300`}>
                          {r.kind === 'expense' ? formatInr(r.amount) : '—'}
                        </td>
                        <td className={`${pfTdRight} text-emerald-800 dark:text-emerald-300`}>
                          {r.kind === 'income' ? formatInr(r.amount) : '—'}
                        </td>
                        <td className={`${pfTdRight} font-semibold text-slate-900 dark:text-[var(--pf-text)]`}>
                          {formatInr(r.balance)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
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
              <StatementSectionHeader tabId={reportTab} />

              {reportTab === 'income' ? (
                <div className="grid gap-4 lg:grid-cols-2">
                  <div className={`${cardCls} border-sky-200/60 bg-sky-50/30 dark:border-sky-900/40 dark:bg-sky-950/20 lg:col-span-2`}>
                    <h2 className={`${chartTitle} text-sm uppercase tracking-wide text-sky-900 dark:text-sky-200`}>
                      Income statement — {year} (year to date)
                    </h2>
                    <p className={chartSub}>
                      Classical P&amp;L layout. EMI shown for visibility — it is already included in total expenses unless you use a
                      separate carve-out in your process.
                    </p>
                    <div className="mt-4 font-mono text-sm">
                      <table className="w-full max-w-xl border-collapse text-left">
                        <tbody className="text-slate-900 dark:text-[var(--pf-text)]">
                          <tr className="border-b border-slate-200/80 dark:border-[var(--pf-border)]">
                            <th scope="row" className="py-2 pr-4 font-normal text-slate-700 dark:text-[var(--pf-text-muted)]">
                              Revenue (income)
                            </th>
                            <td className="py-2 text-right font-semibold tabular-nums">{formatInr(incomeStatementYtd.inc)}</td>
                          </tr>
                          <tr className="border-b border-slate-200/80 dark:border-[var(--pf-border)]">
                            <th scope="row" className="py-2 pr-4 font-normal text-slate-700 dark:text-[var(--pf-text-muted)]">
                              Expenses
                            </th>
                            <td className="py-2 text-right font-semibold tabular-nums">{formatInr(incomeStatementYtd.exp)}</td>
                          </tr>
                          <tr className="border-b-2 border-slate-300/80 dark:border-slate-600">
                            <th scope="row" className="py-2 pr-4 font-semibold text-slate-900 dark:text-[var(--pf-text)]">
                              Operating income
                            </th>
                            <td className="py-2 text-right text-base font-bold tabular-nums">
                              {formatInr(incomeStatementYtd.operating)}
                            </td>
                          </tr>
                          <tr className="border-b border-slate-200/80 dark:border-[var(--pf-border)]">
                            <th scope="row" className="py-2 pr-4 text-xs font-normal text-slate-600 dark:text-[var(--pf-text-muted)]">
              Debt service — EMI (ledger tagged){' '}
                              <span title="Subtotal of EMI-category expenses for transparency — not subtracted again from operating income.">
                                <InformationCircleIcon className="inline h-3.5 w-3.5 text-slate-400" />
                              </span>
                            </th>
                            <td className="py-2 text-right text-sm tabular-nums text-slate-700 dark:text-[var(--pf-text-muted)]">
                              {formatInr(incomeStatementYtd.emi)}
                            </td>
                          </tr>
                          <tr>
                            <th scope="row" className="py-2 pr-4 font-bold text-slate-900 dark:text-[var(--pf-text)]">
                              Net income
                            </th>
                            <td className="py-2 text-right text-base font-bold tabular-nums">{formatInr(incomeStatementYtd.net)}</td>
                          </tr>
                        </tbody>
                      </table>
                    </div>
                  </div>
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
                      Grouped bars per month (not stacked). Operating = income − expense. Investing = −new investments.
                      Financing = −(loan + liability + credit card payments).
                    </p>
                    <div className="mt-3 h-72 w-full min-w-0">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={cashFlowActivityData}>
                          <CartesianGrid strokeDasharray="3 3" className="opacity-40" />
                          <XAxis dataKey="label" tick={{ fontSize: 10 }} />
                          <YAxis tick={{ fontSize: 10 }} width={48} tickFormatter={(v) => formatInr(v)} />
                          <Tooltip formatter={(v) => formatInr(v)} />
                          <Legend />
                          <ReferenceLine y={0} stroke="#64748b" strokeDasharray="3 3" />
                          <Bar dataKey="Operating" fill="#22c55e" radius={[4, 4, 0, 0]} />
                          <Bar dataKey="Investing" fill="#0ea5e9" radius={[4, 4, 0, 0]} />
                          <Bar dataKey="Financing" fill="#a855f7" radius={[4, 4, 0, 0]} />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  </div>
                  <div className={`${cardCls} ${pfChartCard}`}>
                    <h2 className={chartTitle}>Closing cash trend</h2>
                    <p className={chartSub}>Month-end cash estimate after rolled-forward activity</p>
                    <div className="mt-3 h-64 w-full min-w-0">
                      <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={closingCashTrend} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                          <CartesianGrid strokeDasharray="3 3" className="opacity-40" />
                          <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                          <YAxis tick={{ fontSize: 11 }} width={48} tickFormatter={(v) => formatInr(v)} />
                          <Tooltip formatter={(v) => formatInr(v)} />
                          <Line type="monotone" dataKey="closing" name="Closing cash" stroke="#0ea5e9" strokeWidth={2} dot />
                        </LineChart>
                      </ResponsiveContainer>
                    </div>
                  </div>
                  {latestCfBridge ? (
                    <div className={`${cardCls} ${pfChartCard}`}>
                      <h2 className={chartTitle}>Latest month bridge ({latestCfBridge.monthLabel})</h2>
                      <p className={chartSub}>Contribution of each activity type in the most recent month.</p>
                      <div className="mt-3 h-56 w-full min-w-0">
                        <ResponsiveContainer width="100%" height="100%">
                          <BarChart
                            data={[
                              { name: 'Operating', v: latestCfBridge.op },
                              { name: 'Investing', v: latestCfBridge.inv },
                              { name: 'Financing', v: latestCfBridge.fin },
                            ]}
                            margin={{ top: 8, right: 8, left: 8, bottom: 8 }}
                          >
                            <CartesianGrid strokeDasharray="3 3" className="opacity-40" />
                            <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                            <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => formatInr(v)} />
                            <Tooltip formatter={(v) => formatInr(v)} />
                            <ReferenceLine y={0} stroke="#64748b" strokeDasharray="3 3" />
                            <Bar dataKey="v" radius={[4, 4, 0, 0]}>
                              {[0, 1, 2].map((i) => (
                                <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                              ))}
                            </Bar>
                          </BarChart>
                        </ResponsiveContainer>
                      </div>
                      <dl className="mt-3 grid grid-cols-2 gap-2 font-mono text-xs text-slate-700 dark:text-[var(--pf-text-muted)]">
                        <div>
                          <dt className="text-[10px] font-bold uppercase">Opening</dt>
                          <dd className="tabular-nums">{formatInr(latestCfBridge.prevClosing)}</dd>
                        </div>
                        <div>
                          <dt className="text-[10px] font-bold uppercase">Closing</dt>
                          <dd className="tabular-nums">{formatInr(latestCfBridge.closing)}</dd>
                        </div>
                        <div className="col-span-2 border-t border-slate-200/80 pt-2 dark:border-[var(--pf-border)]">
                          <dt className="text-[10px] font-bold uppercase">Check (open + O+I+F)</dt>
                          <dd
                            className={
                              latestCfBridge.checkOk
                                ? 'text-emerald-700 dark:text-emerald-400'
                                : 'text-amber-700 dark:text-amber-400'
                            }
                          >
                            {formatInr(latestCfBridge.prevClosing + latestCfBridge.netActivity)} ≈{' '}
                            {formatInr(latestCfBridge.closing)}
                            {latestCfBridge.checkOk ? '' : ' · review recon'}
                          </dd>
                        </div>
                      </dl>
                    </div>
                  ) : null}
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
                    <div
                      className={`${cardCls} border-slate-300/80 bg-white dark:border-slate-600 dark:bg-[var(--pf-card)]`}
                    >
                      <h2 className="text-sm font-bold uppercase tracking-wide text-slate-800 dark:text-[var(--pf-text)]">
                        Balance sheet — as of latest month ({year})
                      </h2>
                      <p className="mt-1 text-xs text-slate-500 dark:text-[var(--pf-text-muted)]">
                        Accounting-style presentation. Non-cash lines repeat current book until historical snapshots exist.
                      </p>
                      <div className={`${pfTableWrap} mt-4`}>
                        <table className={`${pfTable} text-sm`}>
                          <tbody>
                            <tr>
                              <td colSpan={2} className="bg-slate-100 px-3 py-2 text-xs font-bold uppercase dark:bg-slate-800">
                                Assets
                              </td>
                            </tr>
                            {[
                              ['Cash & bank (reported)', monthlyData?.cash_bank_reported?.total],
                              ['Cash (wallet / hand)', lastBs.cash_wallet],
                              ['Bank accounts', lastBs.bank_accounts],
                              ['Investments', lastBs.investments],
                              ['Fixed assets', lastBs.fixed_assets],
                              ['Loans given (receivable)', lastBs.loans_given_receivable ?? lastBs.loans_outstanding],
                            ].map(([label, v]) => (
                              <tr key={label} className={pfTrHover}>
                                <td className={pfTd}>{label}</td>
                                <td className={pfTdRight}>{formatInr(v)}</td>
                              </tr>
                            ))}
                            <tr className="border-t-2 border-slate-200 font-bold dark:border-slate-600">
                              <td className={pfTd}>Total assets</td>
                              <td className={pfTdRight}>{formatInr(lastBs.total_assets)}</td>
                            </tr>
                            <tr>
                              <td colSpan={2} className="bg-slate-100 px-3 py-2 text-xs font-bold uppercase dark:bg-slate-800">
                                Liabilities
                              </td>
                            </tr>
                            {[
                              ['Credit cards', lastBs.credit_cards_liabilities],
                              ['Loans & other', lastBs.loans_other_liabilities],
                              ['EMI outstanding (schedule)', lastBs.emi_installments_due],
                            ].map(([label, v]) => (
                              <tr key={label} className={pfTrHover}>
                                <td className={pfTd}>{label}</td>
                                <td className={pfTdRight}>{formatInr(v)}</td>
                              </tr>
                            ))}
                            <tr className="border-t-2 border-slate-200 font-bold dark:border-slate-600">
                              <td className={pfTd}>Total liabilities</td>
                              <td className={pfTdRight}>{formatInr(lastBs.liabilities)}</td>
                            </tr>
                            <tr className="border-t-2 border-sky-200 bg-sky-50/80 text-base dark:border-sky-800 dark:bg-sky-950/40">
                              <td className={`${pfTd} font-bold`}>Net worth</td>
                              <td className={`${pfTdRight} font-bold`}>{formatInr(lastBs.net_worth)}</td>
                            </tr>
                          </tbody>
                        </table>
                      </div>
                    </div>
                  ) : null}
                  <div className={`${cardCls} ${pfChartCard} lg:col-span-2`}>
                    <h2 className={chartTitle}>Total assets vs total liabilities</h2>
                    <p className={chartSub}>Month-end series — liability &amp; non-cash asset lines often flat until history is tracked.</p>
                    <div className="mt-3 h-72 w-full min-w-0">
                      <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={assetsVsLiabTrend} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                          <CartesianGrid strokeDasharray="3 3" className="opacity-40" />
                          <XAxis dataKey="label" tick={{ fontSize: 10 }} />
                          <YAxis tick={{ fontSize: 11 }} width={52} tickFormatter={(v) => formatInr(v)} />
                          <Tooltip formatter={(v) => formatInr(v)} />
                          <Legend />
                          <Line type="monotone" dataKey="assets" name="Total assets" stroke="#0ea5e9" strokeWidth={2} dot={false} />
                          <Line
                            type="monotone"
                            dataKey="liabilities"
                            name="Total liabilities"
                            stroke="#f43f5e"
                            strokeWidth={2}
                            dot={false}
                          />
                        </LineChart>
                      </ResponsiveContainer>
                    </div>
                  </div>
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
                  <div className={`${cardCls} ${pfChartCard} lg:col-span-2`}>
                    <h2 className={chartTitle}>Assets vs liabilities over time</h2>
                    <p className={chartSub}>Same series as balance sheet — useful for the &ldquo;wealth gap&rdquo; story.</p>
                    <div className="mt-3 h-64 w-full min-w-0">
                      <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={assetsVsLiabTrend} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                          <CartesianGrid strokeDasharray="3 3" className="opacity-40" />
                          <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                          <YAxis tick={{ fontSize: 11 }} width={52} tickFormatter={(v) => formatInr(v)} />
                          <Tooltip formatter={(v) => formatInr(v)} />
                          <Legend />
                          <Line type="monotone" dataKey="assets" name="Assets" stroke="#22c55e" strokeWidth={2} dot={false} />
                          <Line type="monotone" dataKey="liabilities" name="Liabilities" stroke="#ef4444" strokeWidth={2} dot={false} />
                        </LineChart>
                      </ResponsiveContainer>
                    </div>
                  </div>
                  <div className={`${cardCls} ${pfChartCard}`}>
                    <h2 className={chartTitle}>Liquid vs invested vs loans given</h2>
                    <p className={chartSub}>Latest month asset composition (cash vs investments vs receivables)</p>
                    <div className="mt-3 h-56 w-full min-w-0">
                      {liquidInvestLoanData.length === 0 ? (
                        <p className="py-12 text-center text-sm text-slate-500 dark:text-[var(--pf-text-muted)]">No asset slices.</p>
                      ) : (
                        <ResponsiveContainer width="100%" height="100%">
                          <PieChart>
                            <Pie
                              data={liquidInvestLoanData}
                              dataKey="value"
                              nameKey="name"
                              cx="50%"
                              cy="50%"
                              outerRadius={72}
                            >
                              {liquidInvestLoanData.map((_, i) => (
                                <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                              ))}
                            </Pie>
                            <Tooltip formatter={(v) => formatInr(v)} />
                          </PieChart>
                        </ResponsiveContainer>
                      )}
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
