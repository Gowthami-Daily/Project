import {
  ArrowDownCircleIcon,
  BanknotesIcon,
  ChartBarIcon,
  ChartPieIcon,
  DocumentTextIcon,
  PencilSquareIcon,
  PlusCircleIcon,
  PlusIcon,
  TrashIcon,
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
  createFinanceInvestment,
  deleteFinanceInvestment,
  getInvestmentMonthlyFlow,
  listFinanceInvestments,
  pfFetchBlob,
  setPfToken,
  triggerDownloadBlob,
  updateFinanceInvestment,
} from '../api.js'
import PfExportMenu from '../PfExportMenu.jsx'
import { AppButton, AppDropdown, AppInput, AppModal, AppTextarea } from '../pfDesignSystem/index.js'
import {
  btnDanger,
  btnPrimary,
  btnSecondary,
  cardCls,
  labelCls,
  pfActionRow,
  pfChartCard,
  pfTable,
  pfTableWrap,
  pfTd,
  pfTdActions,
  pfTdRight,
  pfTh,
  pfThRight,
  pfTrHover,
} from '../pfFormStyles.js'
import { formatInr } from '../pfFormat.js'
import { usePfRefresh } from '../pfRefreshContext.jsx'
import { PageHeader } from '../../../components/ui/PageHeader.jsx'
import {
  InvestmentAddMoneyModal,
  InvestmentStatementModal,
  InvestmentWithdrawModal,
} from './PfInvestmentActionModals.jsx'

const INVESTMENT_TYPE_OPTIONS = [
  { value: 'MUTUAL_FUND', label: 'Mutual funds' },
  { value: 'STOCK', label: 'Stocks' },
  { value: 'GOLD', label: 'Gold' },
  { value: 'FD', label: 'Fixed deposits' },
  { value: 'PPF', label: 'PPF' },
  { value: 'EPF', label: 'EPF' },
  { value: 'NPS', label: 'NPS' },
  { value: 'REAL_ESTATE', label: 'Real estate' },
  { value: 'BOND', label: 'Bonds / debt' },
  { value: 'CRYPTO', label: 'Crypto' },
  { value: 'OTHER', label: 'Other' },
]

const PIE_COLORS = ['#3b82f6', '#8b5cf6', '#10b981', '#f59e0b', '#ec4899', '#64748b', '#06b6d4', '#84cc16']

function todayISODate() {
  const d = new Date()
  return d.toISOString().slice(0, 10)
}

function formatDisplayDate(iso) {
  if (!iso) return '—'
  const [y, m, d] = String(iso).split('-')
  if (!y || !m || !d) return iso
  return `${d}-${m}-${y}`
}

function emptyFormState() {
  return {
    investmentType: 'MUTUAL_FUND',
    name: '',
    investedAmount: '',
    currentValue: '',
    sipMonthlyAmount: '',
    sipStartDate: '',
    sipDayOfMonth: '',
    sipFrequency: 'MONTHLY',
    sipAutoCreate: false,
    investmentDate: todayISODate(),
    platform: '',
    notes: '',
  }
}

function effectiveCurrent(r) {
  const inv = Number(r.invested_amount) || 0
  if (r.current_value != null && r.current_value !== '' && !Number.isNaN(Number(r.current_value))) {
    const c = Number(r.current_value)
    return c >= 0 ? c : inv
  }
  return inv
}

function gainAmount(r) {
  return effectiveCurrent(r) - (Number(r.invested_amount) || 0)
}

function returnPct(r) {
  const inv = Number(r.invested_amount) || 0
  if (inv <= 0) return null
  return ((effectiveCurrent(r) - inv) / inv) * 100
}

function cumulativeInvestedSeries(rows) {
  if (!rows.length) return []
  const events = rows
    .map((r) => ({
      d: new Date(`${String(r.investment_date).slice(0, 10)}T12:00:00`),
      v: Number(r.invested_amount) || 0,
    }))
    .filter((x) => !Number.isNaN(x.d.getTime()))
  if (!events.length) return []
  const minT = Math.min(...events.map((x) => x.d.getTime()))
  const start = new Date(minT)
  start.setDate(1)
  start.setHours(12, 0, 0, 0)
  const end = new Date()
  end.setHours(12,      0, 0, 0)
  const out = []
  for (let cur = new Date(start); cur <= end; cur = new Date(cur.getFullYear(), cur.getMonth() + 1, 1, 12, 0, 0, 0)) {
    const y = cur.getFullYear()
    const m = cur.getMonth()
    const last = new Date(y, m + 1, 0, 12, 0, 0, 0)
    let cum = 0
    for (const { d, v } of events) {
      if (d <= last) cum += v
    }
    out.push({
      month: cur.toLocaleDateString('en-IN', { month: 'short', year: '2-digit' }),
      invested: Math.round(cum * 100) / 100,
    })
  }
  return out
}

function investmentCardShell(gain) {
  if (gain > 0.01) {
    return 'border-emerald-500/35 bg-gradient-to-br from-emerald-500/[0.08] to-transparent shadow-[0_8px_30px_rgba(16,185,129,0.08)]'
  }
  if (gain < -0.01) {
    return 'border-red-500/35 bg-gradient-to-br from-red-500/[0.07] to-transparent shadow-[0_8px_30px_rgba(239,68,68,0.07)]'
  }
  return 'border-[var(--pf-border)] bg-white/[0.03] shadow-[var(--pf-shadow)] dark:bg-white/[0.03]'
}

function HoldingCard({
  r,
  typeLabel,
  onEdit,
  onDelete,
  onAddMoney,
  onWithdraw,
  onStatement,
  deletingId,
}) {
  const g = gainAmount(r)
  const pct = returnPct(r)
  const gainCls = g > 0.01 ? 'text-emerald-600 dark:text-emerald-400' : g < -0.01 ? 'text-red-600 dark:text-red-400' : 'text-[var(--pf-text-muted)]'
  const inv = Number(r.invested_amount) || 0
  const cur = effectiveCurrent(r)
  const t = inv + cur
  const sipAmt = r.sip_monthly_amount != null && r.sip_monthly_amount !== '' ? Number(r.sip_monthly_amount) : 0
  const sipActive = (Number.isFinite(sipAmt) && sipAmt > 0) || Boolean(r.sip_auto_create)

  return (
    <div
      className={`flex flex-col rounded-2xl border p-5 backdrop-blur-md transition hover:-translate-y-0.5 hover:shadow-lg ${investmentCardShell(g)}`}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-base font-bold text-[var(--pf-text)]">{r.name || '—'}</h3>
            {sipActive ? (
              <span className="rounded-md bg-violet-500/15 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-violet-700 dark:text-violet-300">
                SIP
              </span>
            ) : null}
          </div>
          <p className="mt-0.5 text-xs text-[var(--pf-text-muted)]">{typeLabel(r.investment_type)}</p>
          {r.last_transaction_date ? (
            <p className="mt-1 text-[10px] text-[var(--pf-text-muted)]">
              Last activity {formatDisplayDate(r.last_transaction_date)}
            </p>
          ) : null}
        </div>
        {r.platform ? (
          <span className="shrink-0 rounded-full border border-[var(--pf-border)] bg-white/10 px-2.5 py-0.5 text-[10px] font-semibold text-[var(--pf-text-muted)]">
            {r.platform}
          </span>
        ) : null}
      </div>
      <dl className="mt-4 space-y-2 text-sm">
        <div className="flex justify-between gap-2">
          <dt className="text-[var(--pf-text-muted)]">Invested</dt>
          <dd className="font-mono font-semibold tabular-nums text-[var(--pf-text)]">{formatInr(r.invested_amount)}</dd>
        </div>
        <div className="flex justify-between gap-2">
          <dt className="text-[var(--pf-text-muted)]">Current</dt>
          <dd className="font-mono font-semibold tabular-nums text-[var(--pf-text)]">{formatInr(effectiveCurrent(r))}</dd>
        </div>
        <div className="flex justify-between gap-2 border-t border-[var(--pf-border)]/50 pt-2">
          <dt className="font-medium text-[var(--pf-text-muted)]">Gain / loss</dt>
          <dd className={`font-mono font-bold tabular-nums ${gainCls}`}>
            {g >= 0 ? '+' : ''}
            {formatInr(g)}
            {pct != null ? ` (${pct >= 0 ? '+' : ''}${pct.toFixed(1)}%)` : ''}
          </dd>
        </div>
      </dl>
      {t > 0 ? (
        <div
          className="mt-3 flex h-2.5 w-full overflow-hidden rounded-full bg-black/10 dark:bg-white/10"
          title="Invested vs current (segment widths)"
        >
          <div className="h-full bg-sky-500/85" style={{ width: `${(inv / t) * 100}%` }} />
          <div
            className={`h-full ${g >= 0 ? 'bg-emerald-500/90' : 'bg-red-500/85'}`}
            style={{ width: `${(cur / t) * 100}%` }}
          />
        </div>
      ) : null}
      <div className="mt-4 grid grid-cols-2 gap-2 border-t border-[var(--pf-border)]/60 pt-4">
        <button
          type="button"
          onClick={() => onAddMoney(r)}
          className={`${btnPrimary} inline-flex items-center justify-center gap-1 px-2 py-2 text-xs`}
        >
          <PlusCircleIcon className="h-4 w-4 shrink-0" />
          Add money
        </button>
        <button
          type="button"
          onClick={() => onWithdraw(r)}
          className={`${btnSecondary} inline-flex items-center justify-center gap-1 px-2 py-2 text-xs`}
        >
          <ArrowDownCircleIcon className="h-4 w-4 shrink-0" />
          Withdraw
        </button>
        <button
          type="button"
          onClick={() => onStatement(r)}
          className={`${btnSecondary} inline-flex items-center justify-center gap-1 px-2 py-2 text-xs`}
        >
          <DocumentTextIcon className="h-4 w-4 shrink-0" />
          Statement
        </button>
        <button
          type="button"
          onClick={() => onEdit(r)}
          className={`${btnSecondary} inline-flex items-center justify-center gap-1 px-2 py-2 text-xs`}
        >
          <PencilSquareIcon className="h-4 w-4 shrink-0" />
          Edit
        </button>
      </div>
      <div className="mt-2 flex justify-end">
        <button
          type="button"
          disabled={deletingId === r.id}
          onClick={() => onDelete(r)}
          className={`${btnDanger} inline-flex items-center justify-center gap-1 px-3 py-1.5 text-xs`}
        >
          <TrashIcon className="h-3.5 w-3.5" />
          Delete fund
        </button>
      </div>
    </div>
  )
}

export default function PfInvestmentsPage() {
  const { onSessionInvalid } = useOutletContext() || {}
  const { tick, refresh } = usePfRefresh()
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [deletingId, setDeletingId] = useState(null)
  const [investmentType, setInvestmentType] = useState('MUTUAL_FUND')
  const [name, setName] = useState('')
  const [investedAmount, setInvestedAmount] = useState('')
  const [currentValue, setCurrentValue] = useState('')
  const [sipMonthlyAmount, setSipMonthlyAmount] = useState('')
  const [investmentDate, setInvestmentDate] = useState(todayISODate)
  const [platform, setPlatform] = useState('')
  const [notes, setNotes] = useState('')
  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState(null)
  const [invExportBusy, setInvExportBusy] = useState(false)
  const [monthlyFlow, setMonthlyFlow] = useState([])
  const [statementInv, setStatementInv] = useState(null)
  const [addMoneyInv, setAddMoneyInv] = useState(null)
  const [addMoneyTab, setAddMoneyTab] = useState('topup')
  const [withdrawInv, setWithdrawInv] = useState(null)
  const [sipStartDate, setSipStartDate] = useState('')
  const [sipDayOfMonth, setSipDayOfMonth] = useState('')
  const [sipFrequency, setSipFrequency] = useState('MONTHLY')
  const [sipAutoCreate, setSipAutoCreate] = useState(false)

  const typeLabel = (v) => INVESTMENT_TYPE_OPTIONS.find((o) => o.value === v)?.label || v

  const investmentTypeDropdownOptions = useMemo(
    () => INVESTMENT_TYPE_OPTIONS.map((o) => ({ value: o.value, label: o.label })),
    [],
  )

  const totals = useMemo(() => {
    let invested = 0
    let current = 0
    let sip = 0
    const now = new Date()
    const ym = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
    let thisMonth = 0
    for (const r of rows) {
      const inv = Number(r.invested_amount) || 0
      invested += inv
      current += effectiveCurrent(r)
      const s = r.sip_monthly_amount != null && r.sip_monthly_amount !== '' ? Number(r.sip_monthly_amount) : 0
      if (!Number.isNaN(s) && s > 0) sip += s
      const id = String(r.investment_date || '').slice(0, 7)
      if (id === ym) thisMonth += inv
    }
    const pl = current - invested
    const retPct = invested > 0.01 ? (pl / invested) * 100 : null
    return { invested, current, pl, retPct, thisMonth, sip }
  }, [rows])

  const allocationPie = useMemo(() => {
    const m = new Map()
    for (const r of rows) {
      const t = r.investment_type || 'OTHER'
      const v = effectiveCurrent(r)
      m.set(t, (m.get(t) || 0) + v)
    }
    return [...m.entries()]
      .filter(([, v]) => v > 0)
      .map(([name, value]) => ({ name: typeLabel(name), value: Math.round(value * 100) / 100 }))
  }, [rows])

  const growthSeries = useMemo(() => cumulativeInvestedSeries(rows), [rows])

  const monthlyBarData = useMemo(
    () =>
      (Array.isArray(monthlyFlow) ? monthlyFlow : []).map((r) => ({
        label: r.month_label || `M${r.month}`,
        invested: Number(r.invested) || 0,
      })),
    [monthlyFlow],
  )

  const groupedRows = useMemo(() => {
    const order = INVESTMENT_TYPE_OPTIONS.map((o) => o.value)
    const m = new Map()
    for (const r of rows) {
      const t = r.investment_type || 'OTHER'
      if (!m.has(t)) m.set(t, [])
      m.get(t).push(r)
    }
    return order.filter((k) => m.has(k) && m.get(k).length).map((k) => ({ key: k, label: typeLabel(k), items: m.get(k) }))
  }, [rows])

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const data = await listFinanceInvestments()
      setRows(Array.isArray(data) ? data : [])
      try {
        const yr = new Date().getFullYear()
        const mf = await getInvestmentMonthlyFlow(yr)
        setMonthlyFlow(Array.isArray(mf) ? mf : [])
      } catch {
        setMonthlyFlow([])
      }
    } catch (e) {
      if (e.status === 401) {
        setPfToken(null)
        onSessionInvalid?.()
      } else {
        setError(e.message || 'Failed to load investments')
      }
    } finally {
      setLoading(false)
    }
  }, [onSessionInvalid])

  useEffect(() => {
    load()
  }, [load, tick])

  function resetFormToEmpty() {
    const s = emptyFormState()
    setInvestmentType(s.investmentType)
    setName(s.name)
    setInvestedAmount(s.investedAmount)
    setCurrentValue(s.currentValue)
    setSipMonthlyAmount(s.sipMonthlyAmount)
    setSipStartDate(s.sipStartDate)
    setSipDayOfMonth(s.sipDayOfMonth)
    setSipFrequency(s.sipFrequency)
    setSipAutoCreate(s.sipAutoCreate)
    setInvestmentDate(s.investmentDate)
    setPlatform(s.platform)
    setNotes(s.notes)
    setEditingId(null)
  }

  function openAddForm() {
    resetFormToEmpty()
    setShowForm(true)
  }

  function openEditForm(r) {
    setEditingId(r.id)
    setInvestmentType(r.investment_type || 'OTHER')
    setName(r.name ?? '')
    setInvestedAmount(String(r.invested_amount ?? ''))
    setCurrentValue(r.current_value != null && r.current_value !== '' ? String(r.current_value) : '')
    setSipMonthlyAmount(r.sip_monthly_amount != null && r.sip_monthly_amount !== '' ? String(r.sip_monthly_amount) : '')
    setSipStartDate(r.sip_start_date ? String(r.sip_start_date).slice(0, 10) : '')
    setSipDayOfMonth(r.sip_day_of_month != null && r.sip_day_of_month !== '' ? String(r.sip_day_of_month) : '')
    setSipFrequency(r.sip_frequency || 'MONTHLY')
    setSipAutoCreate(Boolean(r.sip_auto_create))
    setInvestmentDate(r.investment_date ? String(r.investment_date).slice(0, 10) : todayISODate())
    setPlatform(r.platform ?? '')
    setNotes(r.notes ?? '')
    setShowForm(true)
  }

  function closeForm() {
    setShowForm(false)
    resetFormToEmpty()
  }

  function buildPayload() {
    const cv =
      currentValue === '' || currentValue == null ? null : Math.max(0, Number(currentValue))
    const sip =
      sipMonthlyAmount === '' || sipMonthlyAmount == null ? null : Math.max(0, Number(sipMonthlyAmount))
    const dom =
      sipDayOfMonth === '' || sipDayOfMonth == null
        ? null
        : Math.min(28, Math.max(1, Math.floor(Number(sipDayOfMonth))))
    return {
      type: investmentType.trim(),
      name: name.trim(),
      invested_amount: Number(investedAmount),
      current_value: cv != null && !Number.isNaN(cv) ? cv : null,
      sip_monthly_amount: sip != null && !Number.isNaN(sip) ? sip : null,
      sip_start_date: sipStartDate.trim() ? sipStartDate.trim() : null,
      sip_day_of_month: dom != null && !Number.isNaN(dom) ? dom : null,
      sip_frequency: (sipFrequency || 'MONTHLY').trim().toUpperCase().slice(0, 24) || 'MONTHLY',
      sip_auto_create: Boolean(sipAutoCreate),
      investment_date: investmentDate,
      platform: platform.trim() || null,
      notes: notes.trim() || null,
    }
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setSubmitting(true)
    setError('')
    try {
      const payload = buildPayload()
      if (editingId != null) {
        await updateFinanceInvestment(editingId, payload)
      } else {
        await createFinanceInvestment(payload)
      }
      await load()
      refresh()
      closeForm()
    } catch (err) {
      if (err.status === 401) {
        setPfToken(null)
        onSessionInvalid?.()
      } else {
        setError(err.message || 'Could not save investment')
      }
    } finally {
      setSubmitting(false)
    }
  }

  async function handleDelete(r) {
    const ok = window.confirm(`Delete “${r.name}”? This cannot be undone.`)
    if (!ok) return
    setDeletingId(r.id)
    setError('')
    try {
      await deleteFinanceInvestment(r.id)
      await load()
      refresh()
    } catch (err) {
      if (err.status === 401) {
        setPfToken(null)
        onSessionInvalid?.()
      } else {
        setError(err.message || 'Could not delete investment')
      }
    } finally {
      setDeletingId(null)
    }
  }

  async function handleInvestmentsExport() {
    setInvExportBusy(true)
    try {
      const { blob, filename } = await pfFetchBlob('/pf/export/investments/excel')
      triggerDownloadBlob(blob, filename || 'Investments.xlsx')
    } catch (e) {
      if (e.status === 401) {
        setPfToken(null)
        onSessionInvalid?.()
      } else {
        window.alert(e.message || 'Export failed')
      }
    } finally {
      setInvExportBusy(false)
    }
  }

  const kpiGlass =
    'rounded-2xl border p-4 shadow-[var(--pf-shadow)] backdrop-blur-md transition dark:border-[var(--pf-border)] dark:bg-white/[0.04]'
  const chartTitle = 'text-sm font-bold text-slate-900 dark:text-[var(--pf-text)]'
  const chartSub = 'mt-0.5 text-xs text-slate-500 dark:text-[var(--pf-text-muted)]'

  return (
    <div className="space-y-10">
      <PageHeader
        title="Investments"
        description="Portfolio ledger — add money, withdrawals, statements per fund, SIP metadata, and monthly contribution view."
        action={
          <div className="flex flex-wrap items-center gap-2">
            <PfExportMenu
              busy={invExportBusy}
              items={[{ key: 'xlsx', label: 'Export Excel', onClick: handleInvestmentsExport }]}
            />
            <button type="button" onClick={openAddForm} className={`${btnPrimary} inline-flex items-center gap-2`}>
              <PlusIcon className="h-5 w-5" />
              Add investment
            </button>
          </div>
        }
      />

      {error ? (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:border-amber-900/40 dark:bg-amber-950/30 dark:text-amber-100">
          {error}
        </div>
      ) : null}

      <section aria-label="Summary" className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        <div className={kpiGlass}>
          <p className="text-[11px] font-bold uppercase tracking-wider text-[var(--pf-text-muted)]">Total invested</p>
          <p className="mt-2 font-mono text-lg font-bold tabular-nums text-[var(--pf-text)] sm:text-xl">
            {formatInr(totals.invested)}
          </p>
        </div>
        <div className={kpiGlass}>
          <p className="text-[11px] font-bold uppercase tracking-wider text-[var(--pf-text-muted)]">Current value</p>
          <p className="mt-2 font-mono text-lg font-bold tabular-nums text-sky-600 dark:text-sky-300 sm:text-xl">
            {formatInr(totals.current)}
          </p>
          <p className="mt-1 text-[10px] text-[var(--pf-text-muted)]">Manual NAV when set; else cost</p>
        </div>
        <div
          className={`${kpiGlass} ${
            totals.pl > 0.01
              ? 'border-emerald-500/30 bg-emerald-500/[0.05]'
              : totals.pl < -0.01
                ? 'border-red-500/30 bg-red-500/[0.05]'
                : ''
          }`}
        >
          <p className="text-[11px] font-bold uppercase tracking-wider text-[var(--pf-text-muted)]">Profit / loss</p>
          <p
            className={`mt-2 font-mono text-lg font-bold tabular-nums sm:text-xl ${
              totals.pl > 0.01
                ? 'text-emerald-600 dark:text-emerald-400'
                : totals.pl < -0.01
                  ? 'text-red-600 dark:text-red-400'
                  : 'text-[var(--pf-text)]'
            }`}
          >
            {totals.pl >= 0 ? '+' : ''}
            {formatInr(totals.pl)}
          </p>
        </div>
        <div className={kpiGlass}>
          <p className="text-[11px] font-bold uppercase tracking-wider text-[var(--pf-text-muted)]">Return %</p>
          <p className="mt-2 font-mono text-lg font-bold tabular-nums text-[var(--pf-text)] sm:text-xl">
            {totals.retPct != null ? `${totals.retPct >= 0 ? '+' : ''}${totals.retPct.toFixed(2)}%` : '—'}
          </p>
        </div>
        <div className={kpiGlass}>
          <p className="text-[11px] font-bold uppercase tracking-wider text-[var(--pf-text-muted)]">Added this month</p>
          <p className="mt-2 font-mono text-lg font-bold tabular-nums text-amber-700 dark:text-amber-300 sm:text-xl">
            {formatInr(totals.thisMonth)}
          </p>
        </div>
        <div className={kpiGlass}>
          <p className="text-[11px] font-bold uppercase tracking-wider text-[var(--pf-text-muted)]">Monthly SIP (est.)</p>
          <p className="mt-2 font-mono text-lg font-bold tabular-nums text-violet-700 dark:text-violet-300 sm:text-xl">
            {totals.sip > 0 ? formatInr(totals.sip) : '—'}
          </p>
          <p className="mt-1 text-[10px] text-[var(--pf-text-muted)]">Sum of SIP fields on holdings</p>
        </div>
      </section>

      {!loading && rows.length > 0 ? (
        <section className="grid gap-6 lg:grid-cols-2 xl:grid-cols-3" aria-label="Charts">
          <div className={`${pfChartCard} min-h-[300px]`}>
            <div className="flex items-center gap-2">
              <ChartPieIcon className="h-5 w-5 text-[var(--pf-primary)]" aria-hidden />
              <div>
                <p className={chartTitle}>Portfolio allocation</p>
                <p className={chartSub}>By current / book value per type</p>
              </div>
            </div>
            <div className="mt-4 h-[240px] w-full">
              {allocationPie.length === 0 ? (
                <p className="flex h-full items-center justify-center text-sm text-[var(--pf-text-muted)]">No data</p>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={allocationPie}
                      dataKey="value"
                      nameKey="name"
                      cx="50%"
                      cy="50%"
                      outerRadius={88}
                      label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                    >
                      {allocationPie.map((_, i) => (
                        <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(v) => formatInr(v)} />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>
          <div className={`${pfChartCard} min-h-[300px]`}>
            <div className="flex items-center gap-2">
              <BanknotesIcon className="h-5 w-5 text-[var(--pf-primary)]" aria-hidden />
              <div>
                <p className={chartTitle}>Capital deployed</p>
                <p className={chartSub}>Cumulative invested amount by month</p>
              </div>
            </div>
            <div className="mt-4 h-[240px] w-full">
              {growthSeries.length === 0 ? (
                <p className="flex h-full items-center justify-center text-sm text-[var(--pf-text-muted)]">No data</p>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={growthSeries} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-[var(--pf-border)] opacity-40" />
                    <XAxis dataKey="month" tick={{ fontSize: 10 }} stroke="var(--pf-text-muted)" />
                    <YAxis tick={{ fontSize: 10 }} tickFormatter={(v) => formatInr(v)} width={68} />
                    <Tooltip
                      formatter={(v) => formatInr(v)}
                      contentStyle={{
                        background: 'var(--pf-card)',
                        border: '1px solid var(--pf-border)',
                        borderRadius: '12px',
                      }}
                    />
                    <Line
                      type="stepAfter"
                      dataKey="invested"
                      name="Cumulative invested"
                      stroke="var(--pf-primary)"
                      strokeWidth={2.5}
                      dot={false}
                    />
                  </LineChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>
          <div className={`${pfChartCard} min-h-[300px]`}>
            <div className="flex items-center gap-2">
              <ChartBarIcon className="h-5 w-5 text-[var(--pf-primary)]" aria-hidden />
              <div>
                <p className={chartTitle}>Monthly investments</p>
                <p className={chartSub}>SIP + lump sum + top-up ({new Date().getFullYear()})</p>
              </div>
            </div>
            <div className="mt-4 h-[240px] w-full">
              {monthlyBarData.length === 0 || monthlyBarData.every((x) => x.invested <= 0) ? (
                <p className="flex h-full items-center justify-center text-sm text-[var(--pf-text-muted)]">
                  No purchase flows this year
                </p>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={monthlyBarData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-[var(--pf-border)] opacity-40" />
                    <XAxis dataKey="label" tick={{ fontSize: 9 }} stroke="var(--pf-text-muted)" interval={0} angle={-22} textAnchor="end" height={56} />
                    <YAxis tick={{ fontSize: 10 }} tickFormatter={(v) => formatInr(v)} width={68} />
                    <Tooltip
                      formatter={(v) => formatInr(v)}
                      contentStyle={{
                        background: 'var(--pf-card)',
                        border: '1px solid var(--pf-border)',
                        borderRadius: '12px',
                      }}
                    />
                    <Bar dataKey="invested" name="Invested" fill="var(--pf-primary)" radius={[6, 6, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>
        </section>
      ) : null}

      <AppModal
        open={showForm}
        onClose={() => !submitting && closeForm()}
        title={editingId != null ? 'Edit investment' : 'Add investment'}
        subtitle="Log cost basis, optional mark-to-market value, and recurring SIP for planning."
        maxWidthClass="max-w-xl"
        footer={
          <>
            <AppButton type="button" variant="ghost" disabled={submitting} onClick={closeForm}>
              Cancel
            </AppButton>
            <AppButton type="submit" variant="primary" disabled={submitting} form="pf-investment-form">
              {submitting ? 'Saving…' : editingId != null ? 'Save changes' : 'Save investment'}
            </AppButton>
          </>
        }
      >
        <form id="pf-investment-form" onSubmit={handleSubmit} className="grid gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor="inv-type-dd" className={labelCls}>
              Type
            </label>
            <AppDropdown
              id="inv-type-dd"
              value={investmentType}
              onChange={setInvestmentType}
              options={
                !INVESTMENT_TYPE_OPTIONS.some((o) => o.value === investmentType) && investmentType
                  ? [{ value: investmentType, label: investmentType }, ...investmentTypeDropdownOptions]
                  : investmentTypeDropdownOptions
              }
              aria-label="Investment type"
            />
          </div>
          <AppInput
            id="inv-date"
            label="Date"
            type="date"
            variant="boxed"
            value={investmentDate}
            onChange={(e) => setInvestmentDate(e.target.value)}
            required
          />
          <div className="sm:col-span-2">
            <AppInput
              id="inv-name"
              label="Name"
              variant="boxed"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. HDFC Nifty 50 Index Fund"
              required
            />
          </div>
          <AppInput
            id="inv-invested"
            label="Invested amount (₹)"
            type="number"
            step="0.01"
            min="0"
            amount
            value={investedAmount}
            onChange={(e) => setInvestedAmount(e.target.value)}
            required
          />
          <AppInput
            id="inv-current"
            label="Current value (₹)"
            hint="Optional — leave empty to use invested amount"
            type="number"
            step="0.01"
            min="0"
            amount
            value={currentValue}
            onChange={(e) => setCurrentValue(e.target.value)}
          />
          <AppInput
            id="inv-sip"
            label="SIP / month (₹)"
            hint="Optional — plan amount (also set when you record SIP from the card)"
            type="number"
            step="0.01"
            min="0"
            amount
            value={sipMonthlyAmount}
            onChange={(e) => setSipMonthlyAmount(e.target.value)}
          />
          <AppInput
            id="inv-sip-start"
            label="SIP start date"
            type="date"
            variant="boxed"
            value={sipStartDate}
            onChange={(e) => setSipStartDate(e.target.value)}
          />
          <AppInput
            id="inv-sip-dom"
            label="SIP day of month"
            hint="1–28"
            type="number"
            min="1"
            max="28"
            variant="boxed"
            value={sipDayOfMonth}
            onChange={(e) => setSipDayOfMonth(e.target.value)}
          />
          <div className="sm:col-span-2">
            <label className={labelCls}>SIP frequency</label>
            <p className="mt-1 rounded-xl border border-[var(--pf-border)] bg-[var(--pf-card)] px-3 py-2 text-sm text-[var(--pf-text-muted)]">
              {sipFrequency || 'MONTHLY'} (monthly only for now)
            </p>
          </div>
          <label className="flex cursor-pointer items-center gap-2 sm:col-span-2">
            <input
              type="checkbox"
              checked={sipAutoCreate}
              onChange={(e) => setSipAutoCreate(e.target.checked)}
            />
            <span className="text-sm text-[var(--pf-text)]">SIP auto-create flag (future automation)</span>
          </label>
          <div className="sm:col-span-2">
            <AppInput
              id="inv-plat"
              label="Platform / broker"
              variant="boxed"
              value={platform}
              onChange={(e) => setPlatform(e.target.value)}
              placeholder="e.g. Groww, Zerodha"
            />
          </div>
          <AppTextarea
            id="inv-notes"
            className="sm:col-span-2"
            label={
              <>
                Notes <span className="font-normal text-slate-400">(optional)</span>
              </>
            }
            rows={3}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Optional"
            variant="boxed"
          />
        </form>
      </AppModal>

      <div className={cardCls}>
        <h2 className="text-base font-bold text-[var(--pf-text)]">Holdings</h2>
        <p className="mt-1 text-sm text-[var(--pf-text-muted)]">
          Grouped by asset class — cards for quick read, table for detail.
        </p>
        {loading ? (
          <p className="mt-6 text-sm text-[var(--pf-text-muted)]">Loading…</p>
        ) : rows.length === 0 ? (
          <p className="mt-6 text-sm text-[var(--pf-text-muted)]">No investments yet — use Add investment.</p>
        ) : (
          <>
            <div className="mt-8 space-y-10">
              {groupedRows.map((g) => (
                <div key={g.key}>
                  <h3 className="text-xs font-bold uppercase tracking-[0.14em] text-[var(--pf-text-muted)]">{g.label}</h3>
                  <div className="mt-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                    {g.items.map((r) => (
                      <HoldingCard
                        key={r.id}
                        r={r}
                        typeLabel={typeLabel}
                        onEdit={openEditForm}
                        onDelete={handleDelete}
                        onAddMoney={(row) => {
                          setAddMoneyTab('topup')
                          setAddMoneyInv(row)
                        }}
                        onWithdraw={(row) => setWithdrawInv(row)}
                        onStatement={(row) => setStatementInv(row)}
                        deletingId={deletingId}
                      />
                    ))}
                  </div>
                </div>
              ))}
            </div>

            <h3 className="mt-12 text-sm font-bold text-[var(--pf-text)]">All holdings</h3>
            <div className={`${pfTableWrap} mt-3`}>
              <table className={`${pfTable} min-w-[900px]`}>
                <thead>
                  <tr>
                    <th className={pfTh}>Name</th>
                    <th className={pfTh}>Type</th>
                    <th className={pfTh}>Platform</th>
                    <th className={pfThRight}>Invested</th>
                    <th className={pfThRight}>Current</th>
                    <th className={pfThRight}>Gain / loss</th>
                    <th className={pfThRight}>Return %</th>
                    <th className={pfThRight}>Date</th>
                    <th className={pfThRight}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => {
                    const g = gainAmount(r)
                    const p = returnPct(r)
                    const gainCls =
                      g > 0.01
                        ? 'text-emerald-600 dark:text-emerald-400'
                        : g < -0.01
                          ? 'text-red-600 dark:text-red-400'
                          : 'text-[var(--pf-text-muted)]'
                    return (
                      <tr key={r.id} className={pfTrHover}>
                        <td className={`${pfTd} font-bold text-[var(--pf-text)]`}>{r.name || '—'}</td>
                        <td className={pfTd}>{typeLabel(r.investment_type)}</td>
                        <td className={`${pfTd} text-[var(--pf-text-muted)]`}>{r.platform ?? '—'}</td>
                        <td className={`${pfTdRight} font-mono tabular-nums`}>{formatInr(r.invested_amount)}</td>
                        <td className={`${pfTdRight} font-mono font-medium tabular-nums`}>
                          {formatInr(effectiveCurrent(r))}
                        </td>
                        <td className={`${pfTdRight} font-mono font-semibold tabular-nums ${gainCls}`}>
                          {g >= 0 ? '+' : ''}
                          {formatInr(g)}
                        </td>
                        <td className={`${pfTdRight} font-mono text-sm tabular-nums ${gainCls}`}>
                          {p != null ? `${p >= 0 ? '+' : ''}${p.toFixed(1)}%` : '—'}
                        </td>
                        <td className={`${pfTdRight} text-sm`}>{formatDisplayDate(r.investment_date)}</td>
                        <td className={pfTdActions}>
                          <div className={pfActionRow}>
                            <button
                              type="button"
                              onClick={() => openEditForm(r)}
                              className={`${btnSecondary} inline-flex items-center gap-1 px-2.5 py-1.5 text-xs`}
                            >
                              <PencilSquareIcon className="h-3.5 w-3.5" />
                              Edit
                            </button>
                            <button
                              type="button"
                              disabled={deletingId === r.id}
                              onClick={() => handleDelete(r)}
                              className={`${btnDanger} px-2.5 py-1.5 text-xs`}
                            >
                              {deletingId === r.id ? '…' : 'Delete'}
                            </button>
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>

      <InvestmentStatementModal
        open={statementInv != null}
        investment={statementInv}
        onClose={() => setStatementInv(null)}
        onSessionInvalid={onSessionInvalid}
        onChanged={() => {
          load()
          refresh()
        }}
      />
      <InvestmentAddMoneyModal
        open={addMoneyInv != null}
        investment={addMoneyInv}
        defaultTab={addMoneyTab}
        onClose={() => setAddMoneyInv(null)}
        onSessionInvalid={onSessionInvalid}
        onSaved={() => {
          load()
          refresh()
        }}
      />
      <InvestmentWithdrawModal
        open={withdrawInv != null}
        investment={withdrawInv}
        onClose={() => setWithdrawInv(null)}
        onSessionInvalid={onSessionInvalid}
        onSaved={() => {
          load()
          refresh()
        }}
      />
    </div>
  )
}
