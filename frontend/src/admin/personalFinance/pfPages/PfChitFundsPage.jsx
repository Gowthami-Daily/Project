import { BoltIcon, PlusIcon, SparklesIcon } from '@heroicons/react/24/solid'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { useOutletContext } from 'react-router-dom'
import { Bar, BarChart, CartesianGrid, Cell, Legend, Line, LineChart, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import {
  createChitFund,
  deleteChitFund,
  listChitFundContributions,
  listChitFunds,
  listFinanceAccounts,
  patchChitFund,
  postChitFundContribution,
  postChitFundDividend,
  postChitFundForemanCommission,
  setPfToken,
} from '../api.js'
import { AppButton, AppModal } from '../pfDesignSystem/index.js'
import { btnDanger, btnPrimary, btnSecondary, cardCls, inputCls, labelCls, pfChartCard } from '../pfFormStyles.js'
import { formatInr } from '../pfFormat.js'
import { usePfRefresh } from '../pfRefreshContext.jsx'
import { PageHeader } from '../../../components/ui/PageHeader.jsx'
import { PremiumSelect } from '../../../components/ui/PremiumSelect.jsx'

const PIE_COLORS = ['#3b82f6', '#8b5cf6', '#10b981', '#f59e0b']

function num(v) {
  if (v == null || v === '') return 0
  const n = Number(v)
  return Number.isFinite(n) ? n : 0
}

function monthKey(dateLike) {
  const d = new Date(`${String(dateLike).slice(0, 10)}T12:00:00`)
  if (Number.isNaN(d.getTime())) return null
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

function monthLabel(k) {
  const [y, m] = String(k).split('-')
  const d = new Date(Number(y), Number(m) - 1, 1, 12, 0, 0, 0)
  return d.toLocaleDateString('en-IN', { month: 'short', year: '2-digit' })
}

function xirr(cashflows) {
  if (!Array.isArray(cashflows) || cashflows.length < 2) return null
  const hasPos = cashflows.some((c) => c.amount > 0)
  const hasNeg = cashflows.some((c) => c.amount < 0)
  if (!hasPos || !hasNeg) return null
  const flows = cashflows
    .map((c) => ({ amount: Number(c.amount), date: new Date(`${String(c.date).slice(0, 10)}T12:00:00`) }))
    .filter((f) => Number.isFinite(f.amount) && !Number.isNaN(f.date.getTime()))
    .sort((a, b) => a.date - b.date)
  if (flows.length < 2) return null
  const d0 = flows[0].date
  const npv = (rate) => {
    let s = 0
    for (const f of flows) {
      const t = (f.date.getTime() - d0.getTime()) / (365.25 * 86400000)
      s += f.amount / (1 + rate) ** t
    }
    return s
  }
  let lo = -0.95
  let hi = 5
  let fLo = npv(lo)
  let fHi = npv(hi)
  let guard = 0
  while (fLo * fHi > 0 && guard < 20) {
    hi *= 1.8
    fHi = npv(hi)
    guard += 1
  }
  if (fLo * fHi > 0) return null
  for (let i = 0; i < 80; i += 1) {
    const mid = (lo + hi) / 2
    const fMid = npv(mid)
    if (Math.abs(fMid) < 1e-6) return mid
    if (fLo * fMid <= 0) {
      hi = mid
      fHi = fMid
    } else {
      lo = mid
      fLo = fMid
    }
  }
  return (lo + hi) / 2
}

function emptyChitForm() {
  return {
    chit_name: '',
    total_value: '',
    monthly_amount: '',
    start_date: new Date().toISOString().slice(0, 10),
    duration_months: '',
    auction_taken: false,
    auction_month: '',
    amount_received: '',
    foreman_commission: '',
    dividend_received: '',
    status: 'RUNNING',
    auction_receipt_finance_account_id: '',
    auction_booking_date: '',
    notes: '',
  }
}

export default function PfChitFundsPage() {
  const { onSessionInvalid } = useOutletContext() || {}
  const { tick, refresh } = usePfRefresh()
  const [rows, setRows] = useState([])
  const [accounts, setAccounts] = useState([])
  const [contributionsMap, setContributionsMap] = useState(new Map())
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const [showChitModal, setShowChitModal] = useState(false)
  const [chitEditId, setChitEditId] = useState(null)
  const [chitForm, setChitForm] = useState(emptyChitForm)
  const [chitSubmitting, setChitSubmitting] = useState(false)

  const [ledgerChitId, setLedgerChitId] = useState(null)
  const [ledgerKind, setLedgerKind] = useState(null)
  const [ledgerDate, setLedgerDate] = useState(() => new Date().toISOString().slice(0, 10))
  const [ledgerAmount, setLedgerAmount] = useState('')
  const [ledgerAccountId, setLedgerAccountId] = useState('')
  const [ledgerMode, setLedgerMode] = useState('BANK')
  const [ledgerBusy, setLedgerBusy] = useState(false)

  const editingChit = useMemo(() => (chitEditId ? rows.find((c) => c.id === chitEditId) : null), [rows, chitEditId])
  const ledgerTarget = useMemo(() => (ledgerChitId ? rows.find((c) => c.id === ledgerChitId) : null), [rows, ledgerChitId])

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const [chits, acc] = await Promise.all([listChitFunds(), listFinanceAccounts().catch(() => [])])
      const list = Array.isArray(chits) ? chits : []
      setRows(list)
      setAccounts(Array.isArray(acc) ? acc : [])
      const pairs = await Promise.all(
        list.map(async (ch) => {
          const cs = await listChitFundContributions(ch.id).catch(() => [])
          return [ch.id, Array.isArray(cs) ? cs : []]
        }),
      )
      setContributionsMap(new Map(pairs))
    } catch (e) {
      if (e.status === 401) {
        setPfToken(null)
        onSessionInvalid?.()
      } else {
        setError(e.message || 'Failed to load chit funds')
      }
    } finally {
      setLoading(false)
    }
  }, [onSessionInvalid])

  useEffect(() => {
    load()
  }, [load, tick])

  const metrics = useMemo(() => {
    const totalPaid = rows.reduce((s, c) => s + num(c.total_paid), 0)
    const totalReceived = rows.reduce((s, c) => s + num(c.total_received), 0)
    const totalValue = rows.reduce((s, c) => s + num(c.total_value), 0)
    const dividend = rows.reduce((s, c) => s + num(c.dividend_received), 0)
    const commission = rows.reduce((s, c) => s + num(c.foreman_commission), 0)
    const discount = rows.reduce((s, c) => s + num(c.discount_computed), 0)
    const remainingLiability = rows.reduce((s, c) => s + num(c.liability_outstanding), 0)
    const monthlyCommitment = rows.length ? rows.reduce((s, c) => s + num(c.monthly_amount), 0) / rows.length : 0
    const expectedMaturity = Math.max(0, totalValue - totalPaid)
    const profitLoss = dividend - discount
    const netPosition = totalReceived - totalPaid
    return {
      totalPaid,
      totalReceived,
      totalValue,
      dividend,
      commission,
      discount,
      remainingLiability,
      monthlyCommitment,
      expectedMaturity,
      profitLoss,
      netPosition,
    }
  }, [rows])

  const liquidityStatus = useMemo(() => {
    const postAuction = rows.filter((r) => r.auction_taken).length
    if (!rows.length) return { tone: 'slate', text: 'No active chits' }
    if (postAuction === 0) return { tone: 'emerald', text: 'Pre-auction (Asset heavy)' }
    if (postAuction === rows.length) return { tone: 'rose', text: 'Post-auction (Liability heavy)' }
    return { tone: 'amber', text: 'Mixed stage' }
  }, [rows])

  const combinedCashflows = useMemo(() => {
    const flows = []
    for (const c of rows) {
      const contributions = contributionsMap.get(c.id) || []
      for (const x of contributions) {
        flows.push({ date: x.contribution_date || c.start_date, amount: -Math.abs(num(x.amount)) })
      }
      if (num(c.dividend_received) > 0) flows.push({ date: c.start_date, amount: num(c.dividend_received) })
      if (num(c.foreman_commission) > 0) flows.push({ date: c.start_date, amount: -num(c.foreman_commission) })
      if (num(c.amount_received) > 0) flows.push({ date: c.start_date, amount: num(c.amount_received) })
      const terminal = num(c.net_asset_value) - num(c.liability_outstanding)
      if (terminal !== 0) flows.push({ date: new Date().toISOString().slice(0, 10), amount: terminal })
    }
    return flows
  }, [rows, contributionsMap])

  const effectiveRoi = useMemo(() => xirr(combinedCashflows), [combinedCashflows])

  const chartCashflow = useMemo(() => {
    const bucket = new Map()
    const add = (k, key, val) => {
      if (!k) return
      if (!bucket.has(k)) bucket.set(k, { month: monthLabel(k), outflow: 0, inflow: 0 })
      bucket.get(k)[key] += val
    }
    for (const c of rows) {
      const contributions = contributionsMap.get(c.id) || []
      for (const x of contributions) add(monthKey(x.contribution_date || c.start_date), 'outflow', num(x.amount))
      add(monthKey(c.start_date), 'inflow', num(c.amount_received))
      add(monthKey(c.start_date), 'inflow', num(c.dividend_received))
      add(monthKey(c.start_date), 'outflow', num(c.foreman_commission))
    }
    return [...bucket.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([, v]) => ({ ...v, outflow: Math.round(v.outflow * 100) / 100, inflow: Math.round(v.inflow * 100) / 100 }))
  }, [rows, contributionsMap])

  const chartPaidRemaining = useMemo(
    () => [
      { name: 'Paid', value: metrics.totalPaid },
      { name: 'Remaining', value: Math.max(0, metrics.totalValue - metrics.totalPaid) },
    ],
    [metrics.totalPaid, metrics.totalValue],
  )

  const chartProfitTrend = useMemo(() => {
    const bucket = new Map()
    const add = (k, v) => {
      if (!k) return
      bucket.set(k, (bucket.get(k) || 0) + v)
    }
    for (const c of rows) {
      add(monthKey(c.start_date), num(c.dividend_received) - num(c.foreman_commission) - num(c.discount_computed))
    }
    let cum = 0
    return [...bucket.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([k, v]) => {
        cum += v
        return { month: monthLabel(k), profit: Math.round(cum * 100) / 100 }
      })
  }, [rows])

  const chartAuctionImpact = useMemo(() => {
    const pre = rows.reduce((s, c) => s + num(c.total_paid), 0)
    const afterAsset = rows.reduce((s, c) => s + num(c.net_asset_value), 0)
    const afterLiability = rows.reduce((s, c) => s + num(c.liability_outstanding), 0)
    return [
      { name: 'Before auction', asset: pre, liability: 0 },
      { name: 'After auction', asset: afterAsset, liability: afterLiability },
    ]
  }, [rows])

  const breakEvenMonths = useMemo(() => {
    const remaining = Math.max(0, -metrics.netPosition)
    const monthlyNet = Math.max(1, metrics.monthlyCommitment * 0.08 + (metrics.dividend - metrics.commission) / Math.max(rows.length, 1))
    return Math.ceil(remaining / monthlyNet)
  }, [metrics.netPosition, metrics.monthlyCommitment, metrics.dividend, metrics.commission, rows.length])

  const benchmarkDelta = useMemo(() => {
    if (effectiveRoi == null) return null
    const fd = 0.07
    return effectiveRoi - fd
  }, [effectiveRoi])

  const nextPaymentDue = useMemo(() => {
    const running = rows.filter((r) => String(r.status || '').toUpperCase() === 'RUNNING')
    if (!running.length) return null
    const now = new Date()
    let minDays = null
    for (const c of running) {
      const start = new Date(`${String(c.start_date).slice(0, 10)}T12:00:00`)
      if (Number.isNaN(start.getTime())) continue
      const dom = start.getDate()
      const due = new Date(now.getFullYear(), now.getMonth(), dom, 12, 0, 0, 0)
      if (due < now) due.setMonth(due.getMonth() + 1)
      const days = Math.ceil((due.getTime() - now.getTime()) / 86400000)
      minDays = minDays == null ? days : Math.min(minDays, days)
    }
    return minDays
  }, [rows])

  function openChitAdd() {
    setChitEditId(null)
    setChitForm(emptyChitForm())
    setShowChitModal(true)
  }

  function openChitEdit(c) {
    setChitEditId(c.id)
    setChitForm({
      chit_name: c.chit_name ?? '',
      total_value: String(c.total_value ?? ''),
      monthly_amount: String(c.monthly_amount ?? ''),
      start_date: c.start_date ? String(c.start_date).slice(0, 10) : '',
      duration_months: String(c.duration_months ?? ''),
      auction_taken: Boolean(c.auction_taken),
      auction_month: c.auction_month != null ? String(c.auction_month) : '',
      amount_received: c.amount_received != null ? String(c.amount_received) : '',
      foreman_commission: String(c.foreman_commission ?? ''),
      dividend_received: String(c.dividend_received ?? ''),
      status: String(c.status || 'RUNNING').toUpperCase(),
      auction_receipt_finance_account_id: '',
      auction_booking_date: '',
      notes: c.notes ?? '',
    })
    setShowChitModal(true)
  }

  async function handleChitSave(e) {
    e.preventDefault()
    setChitSubmitting(true)
    setError('')
    try {
      const accId = chitForm.auction_receipt_finance_account_id ? Number(chitForm.auction_receipt_finance_account_id) : null
      const payload = {
        chit_name: chitForm.chit_name.trim(),
        total_value: num(chitForm.total_value),
        monthly_amount: num(chitForm.monthly_amount),
        start_date: chitForm.start_date,
        duration_months: Math.max(0, parseInt(String(chitForm.duration_months || '0'), 10) || 0),
        auction_taken: Boolean(chitForm.auction_taken),
        auction_month: chitForm.auction_month === '' ? null : Number(chitForm.auction_month),
        amount_received: chitForm.amount_received === '' ? null : num(chitForm.amount_received),
        foreman_commission: num(chitForm.foreman_commission),
        dividend_received: num(chitForm.dividend_received),
        status: String(chitForm.status || 'RUNNING').toUpperCase(),
        notes: chitForm.notes?.trim() || null,
        ...(chitForm.auction_taken && accId != null ? { auction_receipt_finance_account_id: accId } : {}),
        ...(chitForm.auction_taken && (chitForm.auction_booking_date || chitForm.start_date)
          ? { auction_booking_date: chitForm.auction_booking_date || chitForm.start_date }
          : {}),
      }
      if (chitEditId) await patchChitFund(chitEditId, payload)
      else await createChitFund(payload)
      setShowChitModal(false)
      await load()
      refresh()
    } catch (err) {
      if (err.status === 401) {
        setPfToken(null)
        onSessionInvalid?.()
      } else {
        setError(err.message || 'Could not save chit')
      }
    } finally {
      setChitSubmitting(false)
    }
  }

  async function handleChitDelete(c) {
    if (!window.confirm(`Delete chit "${c.chit_name}"?`)) return
    try {
      await deleteChitFund(c.id)
      await load()
      refresh()
    } catch (err) {
      if (err.status === 401) {
        setPfToken(null)
        onSessionInvalid?.()
      } else {
        window.alert(err.message || 'Delete failed')
      }
    }
  }

  function openLedger(chitId, kind) {
    setLedgerChitId(chitId)
    setLedgerKind(kind)
    setLedgerDate(new Date().toISOString().slice(0, 10))
    setLedgerAmount('')
    setLedgerMode('BANK')
    setLedgerAccountId(accounts[0]?.id != null ? String(accounts[0].id) : '')
  }

  async function submitLedger(e) {
    e.preventDefault()
    if (!ledgerChitId || !ledgerKind) return
    const amt = num(ledgerAmount)
    if (amt <= 0) {
      setError('Enter a valid amount')
      return
    }
    const acc = ledgerAccountId ? Number(ledgerAccountId) : null
    setLedgerBusy(true)
    setError('')
    try {
      if (ledgerKind === 'contribution') {
        await postChitFundContribution(ledgerChitId, {
          contribution_date: ledgerDate,
          amount: amt,
          payment_mode: ledgerMode,
          finance_account_id: ledgerMode === 'BANK' ? acc : acc || null,
        })
      } else if (ledgerKind === 'dividend') {
        await postChitFundDividend(ledgerChitId, { entry_date: ledgerDate, amount: amt, finance_account_id: acc })
      } else {
        await postChitFundForemanCommission(ledgerChitId, { entry_date: ledgerDate, amount: amt, finance_account_id: acc })
      }
      setLedgerKind(null)
      setLedgerChitId(null)
      await load()
      refresh()
    } catch (err) {
      if (err.status === 401) {
        setPfToken(null)
        onSessionInvalid?.()
      } else {
        setError(err.message || 'Could not save entry')
      }
    } finally {
      setLedgerBusy(false)
    }
  }

  const kpiGlass = 'rounded-2xl border p-4 shadow-[var(--pf-shadow)] backdrop-blur-md transition dark:border-[var(--pf-border)] dark:bg-white/[0.04]'

  return (
    <div className="space-y-8">
      <PageHeader
        title="Chit funds"
        description="Dedicated member dashboard for chit performance, obligations, ROI, and lifecycle decisions."
        action={
          <button type="button" onClick={openChitAdd} className={`${btnPrimary} inline-flex items-center gap-2`}>
            <PlusIcon className="h-5 w-5" />
            Add chit fund
          </button>
        }
      />

      {error ? <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-100">{error}</div> : null}

      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
        <div className={kpiGlass}><p className="text-[11px] font-bold uppercase tracking-wider text-[var(--pf-text-muted)]">Total invested</p><p className="mt-2 font-mono text-lg font-bold">{formatInr(metrics.totalPaid)}</p></div>
        <div className={kpiGlass}><p className="text-[11px] font-bold uppercase tracking-wider text-[var(--pf-text-muted)]">Total received</p><p className="mt-2 font-mono text-lg font-bold">{formatInr(metrics.totalReceived)}</p></div>
        <div className={kpiGlass}><p className="text-[11px] font-bold uppercase tracking-wider text-[var(--pf-text-muted)]">Net position</p><p className={`mt-2 font-mono text-lg font-bold ${metrics.netPosition >= 0 ? 'text-emerald-500' : 'text-rose-400'}`}>{formatInr(metrics.netPosition)}</p></div>
        <div className={kpiGlass}><p className="text-[11px] font-bold uppercase tracking-wider text-[var(--pf-text-muted)]">Expected maturity value</p><p className="mt-2 font-mono text-lg font-bold">{formatInr(metrics.expectedMaturity)}</p></div>
        <div className={kpiGlass}><p className="text-[11px] font-bold uppercase tracking-wider text-[var(--pf-text-muted)]">Total profit/loss</p><p className="mt-2 font-mono text-lg font-bold">{formatInr(metrics.profitLoss)}</p></div>
        <div className={kpiGlass}><p className="text-[11px] font-bold uppercase tracking-wider text-[var(--pf-text-muted)]">Effective ROI (IRR)</p><p className="mt-2 font-mono text-lg font-bold">{effectiveRoi == null ? '—' : `${(effectiveRoi * 100).toFixed(2)}%`}</p></div>
        <div className={kpiGlass}><p className="text-[11px] font-bold uppercase tracking-wider text-[var(--pf-text-muted)]">Monthly commitment</p><p className="mt-2 font-mono text-lg font-bold">{formatInr(metrics.monthlyCommitment)}</p></div>
        <div className={kpiGlass}><p className="text-[11px] font-bold uppercase tracking-wider text-[var(--pf-text-muted)]">Remaining liability</p><p className="mt-2 font-mono text-lg font-bold">{formatInr(metrics.remainingLiability)}</p></div>
        <div className={`${kpiGlass} ${liquidityStatus.tone === 'emerald' ? 'border-emerald-500/30' : liquidityStatus.tone === 'rose' ? 'border-rose-500/30' : 'border-amber-500/30'}`}><p className="text-[11px] font-bold uppercase tracking-wider text-[var(--pf-text-muted)]">Liquidity status</p><p className="mt-2 text-sm font-bold">{liquidityStatus.text}</p></div>
      </section>

      <section className="grid gap-6 lg:grid-cols-2">
        <div className={`${pfChartCard} min-h-[300px]`}>
          <p className="text-sm font-bold">Cash flow timeline</p>
          <div className="mt-4 h-[240px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartCashflow}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-[var(--pf-border)] opacity-40" />
                <XAxis dataKey="month" tick={{ fontSize: 10 }} />
                <YAxis tick={{ fontSize: 10 }} tickFormatter={(v) => formatInr(v)} width={70} />
                <Tooltip formatter={(v) => formatInr(v)} />
                <Legend />
                <Bar dataKey="outflow" fill="#f59e0b" name="Outflow" />
                <Bar dataKey="inflow" fill="#10b981" name="Inflow" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
        <div className={`${pfChartCard} min-h-[300px]`}>
          <p className="text-sm font-bold">Paid vs remaining</p>
          <div className="mt-4 h-[240px]">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={chartPaidRemaining} dataKey="value" nameKey="name" outerRadius={90} label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}>
                  {chartPaidRemaining.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                </Pie>
                <Tooltip formatter={(v) => formatInr(v)} />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>
        <div className={`${pfChartCard} min-h-[300px]`}>
          <p className="text-sm font-bold">Profit trend</p>
          <div className="mt-4 h-[240px]">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartProfitTrend}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-[var(--pf-border)] opacity-40" />
                <XAxis dataKey="month" tick={{ fontSize: 10 }} />
                <YAxis tick={{ fontSize: 10 }} tickFormatter={(v) => formatInr(v)} width={70} />
                <Tooltip formatter={(v) => formatInr(v)} />
                <Line type="monotone" dataKey="profit" stroke="#8b5cf6" strokeWidth={2.5} dot />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
        <div className={`${pfChartCard} min-h-[300px]`}>
          <p className="text-sm font-bold">Auction impact</p>
          <div className="mt-4 h-[240px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartAuctionImpact}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-[var(--pf-border)] opacity-40" />
                <XAxis dataKey="name" tick={{ fontSize: 10 }} />
                <YAxis tick={{ fontSize: 10 }} tickFormatter={(v) => formatInr(v)} width={80} />
                <Tooltip formatter={(v) => formatInr(v)} />
                <Legend />
                <Bar dataKey="asset" fill="#38bdf8" name="Asset side" />
                <Bar dataKey="liability" fill="#f43f5e" name="Liability side" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </section>

      <section className={`${cardCls} space-y-2`}>
        <h3 className="inline-flex items-center gap-2 text-base font-bold"><SparklesIcon className="h-4 w-4 text-violet-400" />Insights & analysis</h3>
        <p className="text-sm text-[var(--pf-text-muted)]">You are currently in <strong>{metrics.profitLoss >= 0 ? 'profit' : 'loss'}</strong> of <strong>{formatInr(metrics.profitLoss)}</strong>.</p>
        <p className="text-sm text-[var(--pf-text-muted)]">Effective return estimate is <strong>{effectiveRoi == null ? '—' : `${(effectiveRoi * 100).toFixed(2)}% annually`}</strong>.</p>
        <p className="text-sm text-[var(--pf-text-muted)]">Estimated break-even in <strong>{Number.isFinite(breakEvenMonths) ? `${breakEvenMonths} months` : '—'}</strong>.</p>
        <p className="text-sm text-[var(--pf-text-muted)]">Against FD benchmark (7%), this is <strong>{benchmarkDelta == null ? 'not enough data' : benchmarkDelta >= 0 ? 'better' : 'worse'}</strong>{benchmarkDelta == null ? '' : ` by ${Math.abs(benchmarkDelta * 100).toFixed(2)}%` }.</p>
        {nextPaymentDue != null ? <p className="inline-flex items-center gap-1 text-xs text-amber-300"><BoltIcon className="h-4 w-4" />Next payment due in {nextPaymentDue} day(s).</p> : null}
      </section>

      {loading ? (
        <div className={`${cardCls} py-16 text-center text-[var(--pf-text-muted)]`}>Loading…</div>
      ) : rows.length === 0 ? (
        <div className={`${cardCls} py-16 text-center`}>
          <p className="text-sm text-[var(--pf-text-muted)]">No chit funds yet.</p>
        </div>
      ) : (
        <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {rows.map((c) => {
            const completion = num(c.duration_months) > 0 ? Math.min(100, (num(c.months_paid || c.contributions_count) / num(c.duration_months)) * 100) : 0
            const paidPct = num(c.total_value) > 0 ? Math.min(100, (num(c.total_paid) / num(c.total_value)) * 100) : 0
            return (
              <div key={c.id} className="rounded-2xl border border-[var(--pf-border)] bg-white/[0.03] p-5 shadow-[var(--pf-shadow)] transition hover:-translate-y-0.5 hover:shadow-lg">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <h3 className="font-bold">{c.chit_name}</h3>
                    <p className="text-xs text-[var(--pf-text-muted)]">{formatInr(c.total_value)} pot · {formatInr(c.monthly_amount)}/month</p>
                  </div>
                  <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${String(c.status).toUpperCase() === 'COMPLETED' ? 'bg-emerald-500/15 text-emerald-300' : 'bg-sky-500/15 text-sky-300'}`}>{String(c.status || 'RUNNING').toUpperCase()}</span>
                </div>
                <dl className="mt-4 space-y-1 text-sm">
                  <div className="flex justify-between"><dt className="text-[var(--pf-text-muted)]">Paid</dt><dd className="font-mono">{formatInr(c.total_paid)}</dd></div>
                  <div className="flex justify-between"><dt className="text-[var(--pf-text-muted)]">Received</dt><dd className="font-mono">{formatInr(c.total_received)}</dd></div>
                  <div className="flex justify-between"><dt className="text-[var(--pf-text-muted)]">Net P/L</dt><dd className="font-mono">{formatInr(c.net_position ?? c.profit_loss)}</dd></div>
                  <div className="flex justify-between"><dt className="text-[var(--pf-text-muted)]">Remaining months</dt><dd className="font-mono">{c.remaining_months ?? '—'}</dd></div>
                </dl>
                <div className="mt-3 space-y-2">
                  <div>
                    <div className="mb-1 flex justify-between text-[10px]"><span className="text-[var(--pf-text-muted)]">Completion</span><span>{completion.toFixed(0)}%</span></div>
                    <div className="h-2 overflow-hidden rounded-full bg-white/10"><div className="h-full bg-sky-500" style={{ width: `${completion}%` }} /></div>
                  </div>
                  <div>
                    <div className="mb-1 flex justify-between text-[10px]"><span className="text-[var(--pf-text-muted)]">Paid %</span><span>{paidPct.toFixed(0)}%</span></div>
                    <div className="h-2 overflow-hidden rounded-full bg-white/10"><div className="h-full bg-emerald-500" style={{ width: `${paidPct}%` }} /></div>
                  </div>
                </div>
                <div className="mt-4 grid grid-cols-2 gap-2">
                  <button type="button" className={`${btnSecondary} px-2 py-1.5 text-xs`} onClick={() => openLedger(c.id, 'contribution')}>Pay installment</button>
                  <button type="button" className={`${btnSecondary} px-2 py-1.5 text-xs`} onClick={() => openLedger(c.id, 'dividend')}>Add dividend</button>
                  <button type="button" className={`${btnSecondary} px-2 py-1.5 text-xs`} onClick={() => openLedger(c.id, 'commission')}>Add commission</button>
                  <button type="button" className={`${btnSecondary} px-2 py-1.5 text-xs`} onClick={() => openChitEdit(c)}>{c.auction_taken ? 'Edit auction' : 'Mark auction'}</button>
                  <button type="button" className={`${btnSecondary} px-2 py-1.5 text-xs`} onClick={() => openChitEdit(c)}>Edit</button>
                  <button type="button" className={`${btnDanger} px-2 py-1.5 text-xs`} onClick={() => handleChitDelete(c)}>Delete</button>
                </div>
              </div>
            )
          })}
        </section>
      )}

      <button type="button" onClick={openChitAdd} className="fixed bottom-24 right-6 z-20 inline-flex items-center gap-2 rounded-full bg-[var(--pf-primary)] px-4 py-3 text-sm font-bold text-white shadow-xl transition hover:translate-y-[-1px]">
        <PlusIcon className="h-5 w-5" />
        Add Chit Fund
      </button>

      <AppModal
        open={showChitModal}
        onClose={() => !chitSubmitting && setShowChitModal(false)}
        maxWidthClass="max-w-2xl"
        title={chitEditId ? 'Edit chit fund' : 'Add chit fund'}
        footer={
          <>
            <button type="button" className={btnSecondary} disabled={chitSubmitting} onClick={() => setShowChitModal(false)}>Cancel</button>
            <AppButton type="submit" variant="primary" disabled={chitSubmitting} form="pf-chit-form">{chitSubmitting ? 'Saving…' : 'Save'}</AppButton>
          </>
        }
      >
        <form id="pf-chit-form" onSubmit={handleChitSave} className="grid max-h-[70vh] gap-4 overflow-y-auto sm:grid-cols-2">
          <div className="sm:col-span-2"><label className={labelCls}>Chit name</label><input className={inputCls} value={chitForm.chit_name} onChange={(e) => setChitForm((f) => ({ ...f, chit_name: e.target.value }))} required /></div>
          <div><label className={labelCls}>Total chit value (₹)</label><input type="number" min="0" step="0.01" className={inputCls} value={chitForm.total_value} onChange={(e) => setChitForm((f) => ({ ...f, total_value: e.target.value }))} /></div>
          <div><label className={labelCls}>Monthly contribution (₹)</label><input type="number" min="0" step="0.01" className={inputCls} value={chitForm.monthly_amount} onChange={(e) => setChitForm((f) => ({ ...f, monthly_amount: e.target.value }))} /></div>
          <div><label className={labelCls}>Start date</label><input type="date" className={inputCls} value={chitForm.start_date} onChange={(e) => setChitForm((f) => ({ ...f, start_date: e.target.value }))} required /></div>
          <div><label className={labelCls}>Duration (months)</label><input type="number" min="0" className={inputCls} value={chitForm.duration_months} onChange={(e) => setChitForm((f) => ({ ...f, duration_months: e.target.value }))} /></div>
          <div className="sm:col-span-2 flex items-center gap-2"><input type="checkbox" checked={chitForm.auction_taken} onChange={(e) => setChitForm((f) => ({ ...f, auction_taken: e.target.checked }))} /><label className="text-sm">Auction received?</label></div>
          {chitForm.auction_taken ? (
            <>
              <div><label className={labelCls}>Auction month</label><input type="number" min="1" className={inputCls} value={chitForm.auction_month} onChange={(e) => setChitForm((f) => ({ ...f, auction_month: e.target.value }))} /></div>
              <div><label className={labelCls}>Amount received (₹)</label><input type="number" min="0" step="0.01" className={inputCls} value={chitForm.amount_received} onChange={(e) => setChitForm((f) => ({ ...f, amount_received: e.target.value }))} /></div>
              <div><label className={labelCls}>Auction booking date</label><input type="date" className={inputCls} value={chitForm.auction_booking_date || chitForm.start_date} onChange={(e) => setChitForm((f) => ({ ...f, auction_booking_date: e.target.value }))} /></div>
              <div className="sm:col-span-2">
                <PremiumSelect
                  label="Auction receipt account"
                  labelClassName={labelCls}
                  value={chitForm.auction_receipt_finance_account_id}
                  onChange={(v) => setChitForm((f) => ({ ...f, auction_receipt_finance_account_id: v }))}
                  options={accounts.map((a) => ({ value: String(a.id), label: a.account_name || `Account ${a.id}` }))}
                />
              </div>
            </>
          ) : null}
          <div><label className={labelCls}>Foreman commission (₹)</label><input type="number" min="0" step="0.01" className={inputCls} value={chitForm.foreman_commission} onChange={(e) => setChitForm((f) => ({ ...f, foreman_commission: e.target.value }))} /></div>
          <div><label className={labelCls}>Dividend received (₹)</label><input type="number" min="0" step="0.01" className={inputCls} value={chitForm.dividend_received} onChange={(e) => setChitForm((f) => ({ ...f, dividend_received: e.target.value }))} /></div>
          <div className="sm:col-span-2">
            <PremiumSelect
              label="Status"
              labelClassName={labelCls}
              value={chitForm.status}
              onChange={(v) => setChitForm((f) => ({ ...f, status: v }))}
              options={[{ value: 'RUNNING', label: 'Running' }, { value: 'COMPLETED', label: 'Completed' }]}
            />
          </div>
          <div className="sm:col-span-2"><label className={labelCls}>Notes</label><textarea rows={2} className={`${inputCls} resize-y`} value={chitForm.notes} onChange={(e) => setChitForm((f) => ({ ...f, notes: e.target.value }))} /></div>
        </form>
      </AppModal>

      <AppModal
        open={Boolean(ledgerKind)}
        onClose={() => {
          if (!ledgerBusy) {
            setLedgerKind(null)
            setLedgerChitId(null)
          }
        }}
        maxWidthClass="max-w-md"
        title={ledgerKind === 'contribution' ? 'Pay installment' : ledgerKind === 'dividend' ? 'Record dividend' : 'Record commission'}
        footer={
          <>
            <button type="button" className={btnSecondary} disabled={ledgerBusy} onClick={() => { setLedgerKind(null); setLedgerChitId(null) }}>Cancel</button>
            <AppButton type="submit" variant="primary" disabled={ledgerBusy} form="pf-chit-ledger-form">{ledgerBusy ? 'Saving…' : 'Save'}</AppButton>
          </>
        }
      >
        <form id="pf-chit-ledger-form" onSubmit={submitLedger} className="space-y-4">
          <p className="text-xs text-[var(--pf-text-muted)]">{ledgerTarget?.chit_name || 'Chit fund'}</p>
          <div><label className={labelCls}>Date</label><input type="date" className={inputCls} value={ledgerDate} onChange={(e) => setLedgerDate(e.target.value)} required /></div>
          <div><label className={labelCls}>Amount (₹)</label><input type="number" min="0" step="0.01" className={inputCls} value={ledgerAmount} onChange={(e) => setLedgerAmount(e.target.value)} required /></div>
          {ledgerKind === 'contribution' ? (
            <PremiumSelect
              label="Payment mode"
              labelClassName={labelCls}
              value={ledgerMode}
              onChange={(v) => setLedgerMode(v)}
              options={[{ value: 'BANK', label: 'Bank' }, { value: 'CASH', label: 'Cash' }]}
            />
          ) : null}
          <PremiumSelect
            label="Account"
            labelClassName={labelCls}
            value={ledgerAccountId}
            onChange={(v) => setLedgerAccountId(v)}
            options={accounts.map((a) => ({ value: String(a.id), label: a.account_name || `Account ${a.id}` }))}
          />
        </form>
      </AppModal>

    </div>
  )
}
