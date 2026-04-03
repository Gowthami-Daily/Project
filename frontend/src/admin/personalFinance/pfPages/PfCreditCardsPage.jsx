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
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import {
  createCreditCard,
  createCreditCardStandaloneTransaction,
  deleteCreditCard,
  generateCreditCardBill,
  getCreditCardBilledVsPaid,
  getCreditCardCardUtilization,
  getCreditCardDashboardSummary,
  getCreditCardMonthlySpend,
  getCreditCardOutstanding,
  getCreditCardSpendByCategory,
  getCreditCardYearlySpend,
  listCreditCardBills,
  listCreditCardTransactions,
  listCreditCards,
  listFinanceAccounts,
  listPfExpenseCategories,
  payCreditCardBill,
  setPfToken,
  updateCreditCard,
} from '../api.js'
import {
  btnPrimary,
  btnSecondary,
  cardCls,
  inputCls,
  labelCls,
  pfChartCard,
  pfTable,
  pfTableWrap,
  pfTd,
  pfTh,
  pfTrHover,
} from '../pfFormStyles.js'
import { formatInr } from '../pfFormat.js'
import { usePfRefresh } from '../pfRefreshContext.jsx'

function todayISODate() {
  return new Date().toISOString().slice(0, 10)
}

const TABS = [
  { id: 'overview', label: 'Overview' },
  { id: 'cards', label: 'Cards' },
  { id: 'transactions', label: 'Transactions' },
  { id: 'bills', label: 'Bills & pay' },
]

const chartTitle = 'text-base font-bold text-sky-950 dark:text-[var(--pf-text)]'
const chartSub = 'mt-0.5 text-xs text-slate-500 dark:text-[var(--pf-text-muted)]'

const CATEGORY_PIE_COLORS = ['#0ea5e9', '#22c55e', '#a855f7', '#f97316', '#eab308', '#64748b', '#ef4444']
const BILLS_BAR_COLORS = ['#38bdf8', '#6366f1', '#22c55e', '#f59e0b', '#ef4444']

function utilizationBadgeClass(pct) {
  if (pct == null || Number.isNaN(pct)) return 'text-[var(--pf-text-muted)] border-[var(--pf-border)]'
  if (pct < 30) return 'text-emerald-600 dark:text-emerald-400 border-emerald-500/50 bg-emerald-500/10'
  if (pct < 50) return 'text-amber-700 dark:text-amber-300 border-amber-500/50 bg-amber-500/10'
  if (pct < 75) return 'text-orange-700 dark:text-orange-300 border-orange-500/50 bg-orange-500/10'
  return 'text-red-700 dark:text-red-300 border-red-500/50 bg-red-500/10'
}

function utilizationBarColorClass(pct) {
  const p = Number(pct) || 0
  if (p < 30) return 'bg-emerald-500'
  if (p < 50) return 'bg-yellow-400'
  if (p < 75) return 'bg-orange-500'
  return 'bg-red-500'
}

function creditHealthBadgeClass(health) {
  const h = String(health || '').toUpperCase()
  if (h === 'EXCELLENT') return 'border-emerald-500/60 bg-emerald-500/15 text-emerald-700 dark:text-emerald-300'
  if (h === 'GOOD') return 'border-sky-500/60 bg-sky-500/15 text-sky-800 dark:text-sky-200'
  if (h === 'WARNING') return 'border-amber-500/60 bg-amber-500/15 text-amber-800 dark:text-amber-200'
  if (h === 'DANGER') return 'border-red-500/60 bg-red-500/15 text-red-800 dark:text-red-200'
  return 'border-[var(--pf-border)] bg-[var(--pf-card-hover)] text-[var(--pf-text)]'
}

export default function PfCreditCardsPage() {
  const { onSessionInvalid } = useOutletContext() || {}
  const { tick, refresh } = usePfRefresh()
  const [tab, setTab] = useState('overview')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [cards, setCards] = useState([])
  const [accounts, setAccounts] = useState([])
  const [outstanding, setOutstanding] = useState(null)
  const [dash, setDash] = useState(null)
  const [tx, setTx] = useState([])
  const [bills, setBills] = useState([])

  const [cardName, setCardName] = useState('')
  const [bankName, setBankName] = useState('')
  const [cardLimit, setCardLimit] = useState('')
  const [billStart, setBillStart] = useState('')
  const [billEnd, setBillEnd] = useState('')
  const [genCardId, setGenCardId] = useState('')
  const [payBillId, setPayBillId] = useState('')
  const [payAmount, setPayAmount] = useState('')
  const [payFromAcc, setPayFromAcc] = useState('')
  const [payRef, setPayRef] = useState('')
  const [busy, setBusy] = useState(false)
  const [categories, setCategories] = useState([])
  const [txCardId, setTxCardId] = useState('')
  const [txAmount, setTxAmount] = useState('')
  const [txDate, setTxDate] = useState(() => todayISODate())
  const [txCategoryId, setTxCategoryId] = useState('')
  const [txDesc, setTxDesc] = useState('')
  const [closingDay, setClosingDay] = useState('')
  const [dueDay, setDueDay] = useState('')
  const [cardNetwork, setCardNetwork] = useState('')
  const [cardType, setCardType] = useState('')
  const [interestRate, setInterestRate] = useState('')
  const [annualFee, setAnnualFee] = useState('')
  const [currency, setCurrency] = useState('INR')
  const [isActiveAdd, setIsActiveAdd] = useState(true)
  const [cardsFilter, setCardsFilter] = useState('all')
  const [pendingTxCardId, setPendingTxCardId] = useState(null)
  const [editForm, setEditForm] = useState(null)
  const [yearlySpend, setYearlySpend] = useState([])
  const [selectedYear, setSelectedYear] = useState(() => new Date().getFullYear())
  const [selectedCardId, setSelectedCardId] = useState('')
  const [monthlySpend, setMonthlySpend] = useState([])
  const [yearlyChartYear, setYearlyChartYear] = useState(() => new Date().getFullYear())
  const [monthlyCategoryFilter, setMonthlyCategoryFilter] = useState('')
  const [cardUtilization, setCardUtilization] = useState([])
  const [spendByCategory, setSpendByCategory] = useState([])
  const [billedVsPaid, setBilledVsPaid] = useState([])

  const period = useMemo(() => {
    const d = new Date()
    return { y: d.getFullYear(), m: d.getMonth() + 1 }
  }, [tick])

  const usageTotals = useMemo(() => {
    if (!dash) return null
    const totalLimit = Number(dash.total_credit_limit) || 0
    const used = Number(dash.used_limit) || 0
    const available = Math.max(0, totalLimit - used)
    return { totalLimit, used, available }
  }, [dash])

  const usagePieData = useMemo(
    () =>
      usageTotals
        ? [
            { name: 'Used', value: usageTotals.used },
            { name: 'Available', value: usageTotals.available },
          ]
        : [],
    [usageTotals],
  )

  const billsBarData = useMemo(
    () =>
      !dash
        ? []
        : [
            { name: 'Unbilled', value: Number(dash.unbilled_charges) || 0 },
            { name: 'Billed', value: Number(dash.billed_outstanding) || 0 },
            { name: 'Paid', value: Number(dash.paid_this_month) || 0 },
            { name: 'Due this month', value: Number(dash.due_this_month) || 0 },
            { name: 'Overdue', value: Number(dash.overdue_amount) || 0 },
          ],
    [dash],
  )

  const yearlyYears = useMemo(() => {
    const ys = new Set()
    for (const row of yearlySpend) {
      if (row.year) ys.add(row.year)
    }
    return Array.from(ys).sort((a, b) => a - b)
  }, [yearlySpend])

  const yearlySpendForYear = useMemo(() => {
    const rows = yearlySpend.filter((r) => r.year === yearlyChartYear)
    return rows.map((r) => ({
      name: r.card_name,
      amount: Number(r.total_spent) || 0,
    }))
  }, [yearlySpend, yearlyChartYear])

  const yearlySpendYearTotal = useMemo(
    () => yearlySpendForYear.reduce((s, r) => s + r.amount, 0),
    [yearlySpendForYear],
  )

  const yearlySpendHighest = useMemo(() => {
    if (!yearlySpendForYear.length) return null
    return [...yearlySpendForYear].sort((a, b) => b.amount - a.amount)[0]
  }, [yearlySpendForYear])

  const yearlySpendLowest = useMemo(() => {
    if (!yearlySpendForYear.length) return null
    return [...yearlySpendForYear].sort((a, b) => a.amount - b.amount)[0]
  }, [yearlySpendForYear])

  const categoryPieData = useMemo(
    () =>
      (spendByCategory || []).map((row) => ({
        name: row.category || 'Other',
        value: Number(row.total_spent) || 0,
      })),
    [spendByCategory],
  )

  const billedVsPaidChart = useMemo(
    () =>
      (billedVsPaid || []).map((row) => {
        const d = new Date(row.month_start)
        return {
          label: d.toLocaleString(undefined, { month: 'short', year: '2-digit' }),
          billed: Number(row.billed) || 0,
          paid: Number(row.paid) || 0,
        }
      }),
    [billedVsPaid],
  )

  const insights = useMemo(() => {
    if (!dash) return []
    const out = []
    const pct = dash.utilization_pct ?? 0
    const health = (dash.credit_health || 'GOOD').replace(/_/g, ' ')
    out.push(`Utilization is ${pct}% — credit health: ${health}.`)
    if (dash.highest_spend_card_this_month) {
      out.push(
        `Top spend this month: ${dash.highest_spend_card_this_month} (${formatInr(dash.highest_spend_amount_this_month)}).`,
      )
    }
    if (dash.last_month_spend != null) {
      out.push(`Last month's card spend: ${formatInr(dash.last_month_spend)}.`)
    }
    if (dash.next_due_date) {
      out.push(`Next statement payment due: ${dash.next_due_date}.`)
    }
    if ((dash.interest_fees_due_month || 0) < 0.01) {
      out.push('No interest or late fees recorded on statements due this month.')
    } else {
      out.push(`Interest + late fees (due this month): ${formatInr(dash.interest_fees_due_month)}.`)
    }
    if ((dash.paid_this_month || 0) > 0) {
      out.push(`Paid toward statements this month: ${formatInr(dash.paid_this_month)}.`)
    }
    return out
  }, [dash])

  const enrichedCards = useMemo(() => {
    const byId = new Map((cardUtilization || []).map((r) => [r.card_id, r]))
    return (cards || []).map((c) => {
      const u = byId.get(c.id) || {}
      const lim = Number(c.card_limit) || 0
      const used = u.used_amount ?? 0
      return {
        ...c,
        used_amount: used,
        available_credit: u.available_credit ?? Math.max(0, lim - used),
        unbilled_charges: u.unbilled_charges ?? 0,
        billed_outstanding: u.billed_outstanding ?? 0,
        utilization_pct: u.utilization_pct ?? 0,
        utilization_status: u.utilization_status ?? 'Good',
        next_due_date: u.next_due_date ?? null,
        overdue_amount: u.overdue_amount ?? 0,
      }
    })
  }, [cards, cardUtilization])

  const filteredCards = useMemo(() => {
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const weekMs = 7 * 86400000
    return enrichedCards.filter((row) => {
      const active = row.is_active !== false
      const pct = Number(row.utilization_pct) || 0
      const overdue = Number(row.overdue_amount) > 0.01
      let dueSoon = false
      if (row.next_due_date && !overdue) {
        const d = new Date(row.next_due_date)
        d.setHours(0, 0, 0, 0)
        if (d >= today && d.getTime() - today.getTime() <= weekMs) dueSoon = true
      }
      if (cardsFilter === 'all') return true
      if (cardsFilter === 'active') return active
      if (cardsFilter === 'high_util') return pct >= 50
      if (cardsFilter === 'due_soon') return dueSoon
      if (cardsFilter === 'overdue') return overdue
      return true
    })
  }, [enrichedCards, cardsFilter])

  const cardsTabSummary = useMemo(() => {
    const rows = filteredCards
    const n = rows.length
    let totalLimit = 0
    let totalUsed = 0
    let totalDue = 0
    let utilSum = 0
    let utilN = 0
    for (const r of rows) {
      const lim = Number(r.card_limit) || 0
      const used = Number(r.used_amount) || 0
      totalLimit += lim
      totalUsed += used
      totalDue += Number(r.billed_outstanding) || 0
      if (lim > 0.01) {
        utilSum += (used / lim) * 100
        utilN += 1
      }
    }
    const avgUtil = utilN ? Math.round((utilSum / utilN) * 10) / 10 : 0
    return { n, totalLimit, totalUsed, avgUtil, totalDue }
  }, [filteredCards])

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const [
        c,
        a,
        o,
        txR,
        billR,
        dsum,
        cats,
        ySpend,
        utilRows,
        catSpend,
        billPay,
      ] = await Promise.all([
        listCreditCards(),
        listFinanceAccounts(),
        getCreditCardOutstanding(),
        listCreditCardTransactions({ limit: 100 }),
        listCreditCardBills({ limit: 100 }),
        getCreditCardDashboardSummary(period.y, period.m),
        listPfExpenseCategories(),
        getCreditCardYearlySpend(),
        getCreditCardCardUtilization(),
        getCreditCardSpendByCategory(yearlyChartYear),
        getCreditCardBilledVsPaid(period.y, period.m, 12),
      ])
      setCards(Array.isArray(c) ? c : [])
      setCategories(Array.isArray(cats) ? cats : [])
      setAccounts(Array.isArray(a) ? a : [])
      setOutstanding(o && typeof o === 'object' ? o : null)
      setTx(Array.isArray(txR) ? txR : [])
      setBills(Array.isArray(billR) ? billR : [])
      setDash(dsum && typeof dsum === 'object' ? dsum : null)
      setYearlySpend(Array.isArray(ySpend) ? ySpend : [])
      setCardUtilization(Array.isArray(utilRows) ? utilRows : [])
      setSpendByCategory(Array.isArray(catSpend) ? catSpend : [])
      setBilledVsPaid(Array.isArray(billPay) ? billPay : [])
    } catch (e) {
      if (e.status === 401) {
        setPfToken(null)
        onSessionInvalid?.()
      } else {
        setError(e.message || 'Could not load credit cards')
      }
    } finally {
      setLoading(false)
    }
  }, [onSessionInvalid, period.m, period.y, yearlyChartYear])

  useEffect(() => {
    if (!selectedCardId && cards.length) {
      setSelectedCardId(String(cards[0].id))
    }
    if (!selectedYear && yearlyYears.length) {
      setSelectedYear(yearlyYears[yearlyYears.length - 1])
    }
  }, [cards, yearlyYears, selectedCardId, selectedYear])

  useEffect(() => {
    async function loadMonthly() {
      if (!selectedCardId || !selectedYear) {
        setMonthlySpend([])
        return
      }
      try {
        const data = await getCreditCardMonthlySpend(
          Number(selectedCardId),
          Number(selectedYear),
          monthlyCategoryFilter || undefined,
        )
        setMonthlySpend(Array.isArray(data) ? data : [])
      } catch {
        setMonthlySpend([])
      }
    }
    loadMonthly()
  }, [selectedCardId, selectedYear, monthlyCategoryFilter])

  const monthlyLineData = useMemo(
    () =>
      (monthlySpend || []).map((row) => {
        const d = new Date(row.month)
        return {
          monthLabel: d.toLocaleString(undefined, { month: 'short' }),
          amount: Number(row.total_spent) || 0,
        }
      }),
    [monthlySpend],
  )

  const monthlyStats = useMemo(() => {
    if (!monthlyLineData.length) return { avg: 0, hi: null, lo: null }
    const amounts = monthlyLineData.map((r) => r.amount)
    const sum = amounts.reduce((a, b) => a + b, 0)
    const avg = sum / amounts.length
    let hi = monthlyLineData[0]
    let lo = monthlyLineData[0]
    for (const row of monthlyLineData) {
      if (row.amount > hi.amount) hi = row
      if (row.amount < lo.amount) lo = row
    }
    return { avg, hi, lo }
  }, [monthlyLineData])

  useEffect(() => {
    load()
  }, [load, tick])

  useEffect(() => {
    if (tab === 'transactions' && pendingTxCardId != null) {
      setTxCardId(String(pendingTxCardId))
      setPendingTxCardId(null)
    }
  }, [tab, pendingTxCardId])

  useEffect(() => {
    if (yearlyYears.length && !yearlyYears.includes(yearlyChartYear)) {
      setYearlyChartYear(yearlyYears[yearlyYears.length - 1])
    }
  }, [yearlyYears, yearlyChartYear])

  async function handleAddCard(e) {
    e.preventDefault()
    setBusy(true)
    setError('')
    try {
      await createCreditCard({
        card_name: cardName.trim(),
        bank_name: bankName.trim() || null,
        card_limit: Number(cardLimit) || 0,
        billing_cycle_start: 1,
        due_days: 15,
        closing_day: closingDay === '' ? null : Number(closingDay),
        due_day: dueDay === '' ? null : Number(dueDay),
        interest_rate: interestRate === '' ? 0 : Number(interestRate),
        annual_fee: annualFee === '' ? 0 : Number(annualFee),
        card_network: cardNetwork.trim() || null,
        card_type: cardType.trim() || null,
        currency: (currency || 'INR').trim().toUpperCase() || 'INR',
        is_active: isActiveAdd,
      })
      setCardName('')
      setBankName('')
      setCardLimit('')
      setClosingDay('')
      setDueDay('')
      setCardNetwork('')
      setCardType('')
      setInterestRate('')
      setAnnualFee('')
      setCurrency('INR')
      setIsActiveAdd(true)
      await load()
      refresh()
    } catch (err) {
      if (err.status === 401) {
        setPfToken(null)
        onSessionInvalid?.()
      } else {
        setError(err.message || 'Could not save card')
      }
    } finally {
      setBusy(false)
    }
  }

  async function handleGenerateBill(e) {
    e.preventDefault()
    if (!genCardId || !billStart || !billEnd) {
      setError('Select card and statement date range.')
      return
    }
    setBusy(true)
    setError('')
    try {
      await generateCreditCardBill({
        card_id: Number(genCardId),
        bill_start_date: billStart,
        bill_end_date: billEnd,
      })
      await load()
      refresh()
    } catch (err) {
      setError(err.message || 'Could not generate bill')
    } finally {
      setBusy(false)
    }
  }

  async function handlePayBill(e) {
    e.preventDefault()
    if (!payBillId || !payAmount || !payFromAcc) {
      setError('Bill, amount, and bank account required.')
      return
    }
    setBusy(true)
    setError('')
    try {
      await payCreditCardBill({
        bill_id: Number(payBillId),
        amount: Number(payAmount),
        payment_date: todayISODate(),
        from_account_id: Number(payFromAcc),
        reference_number: payRef.trim() || null,
      })
      setPayAmount('')
      setPayRef('')
      await load()
      refresh()
    } catch (err) {
      setError(err.message || 'Payment failed')
    } finally {
      setBusy(false)
    }
  }

  async function handleManualSwipe(e) {
    e.preventDefault()
    if (!txCardId || !txAmount) {
      setError('Select a card and enter an amount.')
      return
    }
    const cat = categories.find((x) => String(x.id) === txCategoryId)
    setBusy(true)
    setError('')
    try {
      await createCreditCardStandaloneTransaction({
        card_id: Number(txCardId),
        amount: Number(txAmount),
        transaction_date: txDate,
        expense_category_id: txCategoryId === '' ? null : Number(txCategoryId),
        category: cat?.name || 'general',
        description: txDesc.trim() || null,
        paid_by: null,
      })
      setTxAmount('')
      setTxDesc('')
      await load()
      refresh()
    } catch (err) {
      setError(err.message || 'Could not add swipe')
    } finally {
      setBusy(false)
    }
  }

  function openCardEditor(row) {
    setEditForm({
      id: row.id,
      card_name: row.card_name,
      bank_name: row.bank_name ?? '',
      card_limit: String(row.card_limit ?? ''),
      card_network: row.card_network ?? '',
      card_type: row.card_type ?? '',
      interest_rate: String(row.interest_rate ?? '0'),
      annual_fee: String(row.annual_fee ?? '0'),
      currency: row.currency || 'INR',
      is_active: row.is_active !== false,
      closing_day: row.closing_day != null ? String(row.closing_day) : '',
      due_day: row.due_day != null ? String(row.due_day) : '',
    })
  }

  async function handleSaveEdit(e) {
    e.preventDefault()
    if (!editForm?.id) return
    setBusy(true)
    setError('')
    try {
      await updateCreditCard(editForm.id, {
        card_name: editForm.card_name.trim(),
        bank_name: editForm.bank_name.trim() || null,
        card_limit: Number(editForm.card_limit) || 0,
        interest_rate: editForm.interest_rate === '' ? 0 : Number(editForm.interest_rate),
        annual_fee: editForm.annual_fee === '' ? 0 : Number(editForm.annual_fee),
        card_network: editForm.card_network.trim() || null,
        card_type: editForm.card_type.trim() || null,
        currency: (editForm.currency || 'INR').trim().toUpperCase() || 'INR',
        is_active: editForm.is_active,
        closing_day: editForm.closing_day === '' ? null : Number(editForm.closing_day),
        due_day: editForm.due_day === '' ? null : Number(editForm.due_day),
      })
      setEditForm(null)
      await load()
      refresh()
    } catch (err) {
      if (err.status === 401) {
        setPfToken(null)
        onSessionInvalid?.()
      } else {
        setError(err.message || 'Could not update card')
      }
    } finally {
      setBusy(false)
    }
  }

  async function handleDeleteCard(row) {
    if (
      !window.confirm(
        `Delete card "${row.card_name}"? Statements and swipes for this card will be removed.`,
      )
    ) {
      return
    }
    setBusy(true)
    setError('')
    try {
      await deleteCreditCard(row.id)
      if (editForm?.id === row.id) setEditForm(null)
      await load()
      refresh()
    } catch (err) {
      if (err.status === 401) {
        setPfToken(null)
        onSessionInvalid?.()
      } else {
        setError(err.message || 'Could not delete card')
      }
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0 space-y-2">
          <div className="flex flex-wrap items-center gap-2 sm:gap-3">
            <h1 className="text-xl font-bold text-slate-900 dark:text-slate-100 sm:text-2xl">Credit cards</h1>
            {dash && tab === 'overview' ? (
              <span
                className={`rounded-full border px-3 py-1 text-[11px] font-bold uppercase tracking-wide ${creditHealthBadgeClass(dash.credit_health)}`}
              >
                Credit health: {String(dash.credit_health || '—').replace(/_/g, ' ')}
              </span>
            ) : null}
          </div>
          <p className="max-w-2xl text-sm text-slate-600 dark:text-slate-400">
            Swipes post as expenses without debiting your bank until you pay the statement; statements create liabilities.
          </p>
        </div>
        <div className="flex flex-shrink-0 flex-wrap gap-2 sm:justify-end">
          <button type="button" className={btnSecondary} onClick={() => setTab('transactions')}>
            + Add expense
          </button>
          <button type="button" className={btnSecondary} onClick={() => setTab('bills')}>
            + Record payment
          </button>
          <button type="button" className={btnSecondary} onClick={() => setTab('cards')}>
            + Add card
          </button>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={`rounded-full px-3 py-1.5 text-xs font-semibold transition ${
              tab === t.id
                ? 'bg-[var(--pf-primary)] text-white'
                : 'border border-[var(--pf-border)] text-[var(--pf-text-muted)] hover:bg-[var(--pf-card-hover)]'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {error ? (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-100">
          {error}
        </div>
      ) : null}

      {loading && !cards.length ? (
        <div className="animate-pulse rounded-2xl bg-slate-200/60 p-8 dark:bg-slate-700/40">Loading…</div>
      ) : null}

      {tab === 'overview' && dash ? (
        <>
          <div className={`${cardCls} space-y-4 p-4 sm:p-5`}>
            <h2 className="text-base font-bold text-[var(--pf-text)]">
              Summary ({period.y}-{String(period.m).padStart(2, '0')})
            </h2>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {[
                ['Total limit', formatInr(dash.total_credit_limit), false],
                [
                  'Utilization',
                  `${(dash.utilization_pct ?? 0).toFixed(1)}%`,
                  true,
                ],
                ['Used', formatInr(dash.used_limit), false],
                ['Available', formatInr(dash.available_limit), false],
                ['Cards', String(dash.card_count ?? cards.length ?? '—'), false],
                ['Avg monthly spend (12m)', formatInr(dash.avg_monthly_spend), false],
                ['Last month spend', formatInr(dash.last_month_spend), false],
                ['Unbilled', formatInr(dash.unbilled_charges), false],
                ['Billed outstanding', formatInr(dash.billed_outstanding), false],
                ['Paid this month', formatInr(dash.paid_this_month), false],
                ['Due this month', formatInr(dash.due_this_month), false],
                ['Due this week', formatInr(dash.due_this_week), false],
                ['Overdue', formatInr(dash.overdue_amount), false],
                ['Next due date', dash.next_due_date ?? '—', false],
                ['Interest + fees (due this month)', formatInr(dash.interest_fees_due_month), false],
              ].map(([k, v, isUtil]) => (
                <div key={k} className="rounded-xl border border-[var(--pf-border)] bg-[var(--pf-surface)] px-3 py-2">
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-[var(--pf-text-muted)]">{k}</p>
                  <p
                    className={`mt-1 text-lg font-bold tabular-nums ${
                      isUtil ? utilizationBadgeClass(Number(dash.utilization_pct ?? 0)) : 'text-[var(--pf-text)]'
                    }`}
                  >
                    {v}
                  </p>
                </div>
              ))}
            </div>
            {outstanding ? (
              <p className="text-sm text-[var(--pf-text-muted)]">
                Outstanding (API): unbilled {formatInr(outstanding.unbilled_charges)} + billed{' '}
                {formatInr(outstanding.billed_outstanding)} = {formatInr(outstanding.total)}
              </p>
            ) : null}
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <section className={pfChartCard} aria-label="Credit limit usage">
              <h3 className={chartTitle}>Limit usage</h3>
              <p className={chartSub}>Used vs available across all cards</p>
              <div className="relative mt-3 h-[280px] w-full">
                {!usageTotals || usageTotals.totalLimit <= 0 || usagePieData.every((d) => d.value === 0) ? (
                  <p className="flex h-full items-center justify-center text-sm text-[var(--pf-text-muted)]">
                    No limit data yet.
                  </p>
                ) : (
                  <>
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Tooltip formatter={(v) => formatInr(v)} />
                        <Legend iconSize={10} verticalAlign="bottom" />
                        <Pie
                          data={usagePieData}
                          dataKey="value"
                          nameKey="name"
                          cx="50%"
                          cy="48%"
                          innerRadius={62}
                          outerRadius={92}
                          paddingAngle={2}
                        >
                          <Cell key="used" fill="#f87171" />
                          <Cell key="available" fill="#22c55e" />
                        </Pie>
                      </PieChart>
                    </ResponsiveContainer>
                    <div className="pointer-events-none absolute left-1/2 top-[44%] flex w-[200px] -translate-x-1/2 -translate-y-1/2 flex-col items-center gap-0.5 text-center">
                      <p className="text-[10px] font-semibold uppercase tracking-wide text-[var(--pf-text-muted)]">
                        Utilization
                      </p>
                      <p className={`text-2xl font-bold tabular-nums ${utilizationBadgeClass(Number(dash.utilization_pct ?? 0))}`}>
                        {(dash.utilization_pct ?? 0).toFixed(1)}%
                      </p>
                      <p className="text-[11px] text-[var(--pf-text-muted)]">
                        Used {formatInr(usageTotals.used)}
                      </p>
                      <p className="text-[11px] text-[var(--pf-text-muted)]">
                        Limit {formatInr(usageTotals.totalLimit)}
                      </p>
                    </div>
                  </>
                )}
              </div>
            </section>

            <section className={pfChartCard} aria-label="Bills and dues">
              <h3 className={chartTitle}>Bills & dues</h3>
              <p className={chartSub}>Unbilled, billed, paid this month, due, and overdue</p>
              <div className="mt-3 h-[260px] w-full">
                {billsBarData.length === 0 || billsBarData.every((d) => d.value === 0) ? (
                  <p className="flex h-full items-center justify-center text-sm text-[var(--pf-text-muted)]">
                    No statement amounts for this period.
                  </p>
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      data={billsBarData}
                      margin={{ top: 8, right: 16, left: 0, bottom: 24 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" opacity={0.2} />
                      <XAxis
                        dataKey="name"
                        tick={{ fontSize: 11 }}
                        tickMargin={8}
                        stroke="#64748b"
                      />
                      <YAxis
                        tick={{ fontSize: 11 }}
                        stroke="#64748b"
                        tickFormatter={(v) => `₹${(v / 1000).toFixed(0)}k`}
                      />
                      <Tooltip formatter={(v) => formatInr(v)} />
                      <Bar dataKey="value" name="Amount" radius={[4, 4, 0, 0]}>
                        {billsBarData.map((_, i) => (
                          <Cell key={billsBarData[i].name} fill={BILLS_BAR_COLORS[i % BILLS_BAR_COLORS.length]} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </div>
            </section>
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <section className={pfChartCard} aria-label="Yearly spend per card">
              <div className="flex flex-wrap items-end justify-between gap-2">
                <div>
                  <h3 className={chartTitle}>Yearly spend per card</h3>
                  <p className={chartSub}>Swipe totals by card for the selected year</p>
                </div>
                <select
                  className={`${inputCls} max-w-[8rem]`}
                  value={yearlyChartYear}
                  onChange={(e) => setYearlyChartYear(Number(e.target.value))}
                >
                  {(yearlyYears.length ? yearlyYears : [yearlyChartYear]).map((y) => (
                    <option key={y} value={y}>
                      {y}
                    </option>
                  ))}
                </select>
              </div>
              <div className="mt-3 flex flex-wrap gap-3 text-sm text-[var(--pf-text-muted)]">
                <span>
                  <span className="font-semibold text-[var(--pf-text)]">Total: </span>
                  {formatInr(yearlySpendYearTotal)}
                </span>
                {yearlySpendHighest ? (
                  <span>
                    <span className="font-semibold text-[var(--pf-text)]">Highest: </span>
                    {yearlySpendHighest.name} ({formatInr(yearlySpendHighest.amount)})
                  </span>
                ) : null}
                {yearlySpendLowest && yearlySpendForYear.length > 1 ? (
                  <span>
                    <span className="font-semibold text-[var(--pf-text)]">Lowest: </span>
                    {yearlySpendLowest.name} ({formatInr(yearlySpendLowest.amount)})
                  </span>
                ) : null}
              </div>
              <div className="mt-3 h-[280px] w-full">
                {!yearlySpendForYear.length ? (
                  <p className="flex h-full items-center justify-center text-sm text-[var(--pf-text-muted)]">
                    No spend recorded for this year.
                  </p>
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={yearlySpendForYear} margin={{ top: 8, right: 16, left: 0, bottom: 48 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" opacity={0.2} />
                      <XAxis
                        dataKey="name"
                        tick={{ fontSize: 10 }}
                        stroke="#64748b"
                        interval={0}
                        angle={-25}
                        textAnchor="end"
                        height={56}
                      />
                      <YAxis
                        tick={{ fontSize: 11 }}
                        stroke="#64748b"
                        tickFormatter={(v) => `₹${(v / 1000).toFixed(0)}k`}
                      />
                      <Tooltip formatter={(v) => formatInr(v)} />
                      <Bar dataKey="amount" name="Spend" radius={[4, 4, 0, 0]} fill="#0ea5e9" />
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </div>
            </section>

            <section className={pfChartCard} aria-label="Monthly spend trend">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <h3 className={chartTitle}>Monthly spend trend</h3>
                  <p className={chartSub}>By card, year, and category filter</p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <select
                    className={inputCls}
                    value={selectedCardId}
                    onChange={(e) => setSelectedCardId(e.target.value)}
                  >
                    {cards.map((c) => (
                      <option key={c.id} value={String(c.id)}>
                        {c.card_name}
                      </option>
                    ))}
                  </select>
                  <select
                    className={inputCls}
                    value={selectedYear}
                    onChange={(e) => setSelectedYear(Number(e.target.value))}
                  >
                    {yearlyYears.length ? (
                      yearlyYears.map((y) => (
                        <option key={y} value={y}>
                          {y}
                        </option>
                      ))
                    ) : (
                      <option value={selectedYear}>{selectedYear}</option>
                    )}
                  </select>
                  <select
                    className={inputCls}
                    value={monthlyCategoryFilter}
                    onChange={(e) => setMonthlyCategoryFilter(e.target.value)}
                  >
                    <option value="">All categories</option>
                    {categories.map((c) => (
                      <option key={c.id} value={String(c.id)}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              {monthlyLineData.length > 0 ? (
                <p className="mt-2 text-xs text-[var(--pf-text-muted)]">
                  Avg {formatInr(monthlyStats.avg)}
                  {monthlyStats.hi ? (
                    <>
                      {' '}
                      · High {monthlyStats.hi.monthLabel} ({formatInr(monthlyStats.hi.amount)})
                    </>
                  ) : null}
                  {monthlyStats.lo && monthlyStats.hi?.monthLabel !== monthlyStats.lo.monthLabel ? (
                    <>
                      {' '}
                      · Low {monthlyStats.lo.monthLabel} ({formatInr(monthlyStats.lo.amount)})
                    </>
                  ) : null}
                </p>
              ) : null}
              <div className="mt-3 h-[280px] w-full">
                {!monthlyLineData.length ? (
                  <p className="flex h-full items-center justify-center text-sm text-[var(--pf-text-muted)]">
                    No monthly data for this selection.
                  </p>
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={monthlyLineData} margin={{ top: 8, right: 16, left: 0, bottom: 24 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" opacity={0.2} />
                      <XAxis dataKey="monthLabel" tick={{ fontSize: 11 }} stroke="#64748b" />
                      <YAxis
                        tick={{ fontSize: 11 }}
                        stroke="#64748b"
                        tickFormatter={(v) => `₹${(v / 1000).toFixed(0)}k`}
                      />
                      <Tooltip formatter={(v) => formatInr(v)} />
                      <ReferenceLine
                        y={monthlyStats.avg}
                        stroke="#94a3b8"
                        strokeDasharray="4 4"
                        label={{
                          value: 'Avg',
                          fill: '#94a3b8',
                          fontSize: 10,
                          position: 'insideTopRight',
                        }}
                      />
                      <Bar dataKey="amount" name="Amount" radius={[4, 4, 0, 0]} fill="#22c55e" />
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </div>
            </section>
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <section className={pfChartCard} aria-label="Spend by category">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <h3 className={chartTitle}>Spend by category</h3>
                  <p className={chartSub}>All cards · year {yearlyChartYear}</p>
                </div>
              </div>
              <div className="mt-3 h-[280px] w-full">
                {!categoryPieData.length || categoryPieData.every((d) => d.value === 0) ? (
                  <p className="flex h-full items-center justify-center text-sm text-[var(--pf-text-muted)]">
                    No categorized spend for this year.
                  </p>
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Tooltip formatter={(v) => formatInr(v)} />
                      <Legend />
                      <Pie
                        data={categoryPieData}
                        dataKey="value"
                        nameKey="name"
                        cx="50%"
                        cy="50%"
                        innerRadius={48}
                        outerRadius={80}
                        paddingAngle={2}
                      >
                        {categoryPieData.map((_, i) => (
                          <Cell key={categoryPieData[i].name} fill={CATEGORY_PIE_COLORS[i % CATEGORY_PIE_COLORS.length]} />
                        ))}
                      </Pie>
                    </PieChart>
                  </ResponsiveContainer>
                )}
              </div>
            </section>

            <section className={pfChartCard} aria-label="Card utilization">
              <h3 className={chartTitle}>Card utilization</h3>
              <p className={chartSub}>Used vs limit per card</p>
              <div className="mt-4 space-y-4">
                {!cardUtilization.length ? (
                  <p className="text-sm text-[var(--pf-text-muted)]">No cards registered.</p>
                ) : (
                  cardUtilization.map((row) => (
                    <div key={row.card_id}>
                      <div className="flex items-center justify-between gap-2 text-sm">
                        <span className="truncate font-medium text-[var(--pf-text)]">{row.card_name}</span>
                        <span
                          className={`shrink-0 font-semibold tabular-nums ${utilizationBadgeClass(Number(row.utilization_pct ?? 0))}`}
                        >
                          {Number(row.utilization_pct ?? 0).toFixed(0)}%
                        </span>
                      </div>
                      <div className="mt-1 h-2.5 overflow-hidden rounded-full bg-slate-200/30 dark:bg-slate-700/50">
                        <div
                          className="h-full rounded-full bg-[var(--pf-primary)] transition-[width]"
                          style={{
                            width: `${Math.min(100, Number(row.utilization_pct ?? 0))}%`,
                            backgroundColor:
                              Number(row.utilization_pct ?? 0) >= 75
                                ? '#ef4444'
                                : Number(row.utilization_pct ?? 0) >= 50
                                  ? '#f97316'
                                  : '#0ea5e9',
                          }}
                        />
                      </div>
                      <p className="mt-1 text-[11px] text-[var(--pf-text-muted)]">
                        {formatInr(row.used_amount)} of {formatInr(row.card_limit)}
                      </p>
                    </div>
                  ))
                )}
              </div>
            </section>
          </div>

          <section className={pfChartCard} aria-label="Statement vs payments">
            <h3 className={chartTitle}>Statement totals vs payments</h3>
            <p className={chartSub}>Billed amount by statement close month vs cash paid (last 12 months)</p>
            <div className="mt-3 h-[300px] w-full">
              {!billedVsPaidChart.length ? (
                <p className="flex h-full items-center justify-center text-sm text-[var(--pf-text-muted)]">
                  No bill or payment history yet.
                </p>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={billedVsPaidChart} margin={{ top: 8, right: 16, left: 0, bottom: 24 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" opacity={0.2} />
                    <XAxis dataKey="label" tick={{ fontSize: 10 }} stroke="#64748b" />
                    <YAxis
                      tick={{ fontSize: 11 }}
                      stroke="#64748b"
                      tickFormatter={(v) => `₹${(v / 1000).toFixed(0)}k`}
                    />
                    <Tooltip formatter={(v) => formatInr(v)} />
                    <Legend />
                    <Line type="monotone" dataKey="billed" name="Statement total" stroke="#0ea5e9" strokeWidth={2} dot />
                    <Line type="monotone" dataKey="paid" name="Paid" stroke="#22c55e" strokeWidth={2} dot />
                  </LineChart>
                </ResponsiveContainer>
              )}
            </div>
          </section>

          <section
            className={`${cardCls} border-l-4 border-l-[var(--pf-primary)] p-4 sm:p-5`}
            aria-label="Insights"
          >
            <h3 className="text-sm font-bold uppercase tracking-wide text-[var(--pf-text)]">Insights</h3>
            <ul className="mt-2 list-inside list-disc space-y-1 text-sm text-[var(--pf-text-muted)]">
              {insights.map((line) => (
                <li key={line}>{line}</li>
              ))}
            </ul>
          </section>
        </>
      ) : null}

      {tab === 'cards' ? (
        <div className="space-y-6">
          <div className="grid gap-6 lg:grid-cols-2">
            <form onSubmit={handleAddCard} className={`${cardCls} space-y-3 p-4 sm:p-5`}>
              <h2 className="text-base font-bold text-[var(--pf-text)]">Add credit card</h2>
              <div>
                <label className={labelCls}>Card name</label>
                <input className={inputCls} value={cardName} onChange={(e) => setCardName(e.target.value)} required />
              </div>
              <div>
                <label className={labelCls}>Bank (optional)</label>
                <input className={inputCls} value={bankName} onChange={(e) => setBankName(e.target.value)} />
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <label className={labelCls}>Card network</label>
                  <select
                    className={inputCls}
                    value={cardNetwork}
                    onChange={(e) => setCardNetwork(e.target.value)}
                  >
                    <option value="">— Select —</option>
                    <option value="Visa">Visa</option>
                    <option value="Mastercard">Mastercard</option>
                    <option value="RuPay">RuPay</option>
                    <option value="Other">Other</option>
                  </select>
                </div>
                <div>
                  <label className={labelCls}>Card type</label>
                  <select className={inputCls} value={cardType} onChange={(e) => setCardType(e.target.value)}>
                    <option value="">— Select —</option>
                    <option value="Rewards">Rewards</option>
                    <option value="Cashback">Cashback</option>
                    <option value="Business">Business</option>
                    <option value="Other">Other</option>
                  </select>
                </div>
              </div>
              <div>
                <label className={labelCls}>Credit limit</label>
                <input
                  className={inputCls}
                  type="number"
                  min="0"
                  step="0.01"
                  value={cardLimit}
                  onChange={(e) => setCardLimit(e.target.value)}
                />
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <label className={labelCls}>Interest rate %</label>
                  <input
                    className={inputCls}
                    type="number"
                    min="0"
                    max="100"
                    step="0.01"
                    value={interestRate}
                    onChange={(e) => setInterestRate(e.target.value)}
                    placeholder="0"
                  />
                </div>
                <div>
                  <label className={labelCls}>Annual fee</label>
                  <input
                    className={inputCls}
                    type="number"
                    min="0"
                    step="0.01"
                    value={annualFee}
                    onChange={(e) => setAnnualFee(e.target.value)}
                    placeholder="0"
                  />
                </div>
              </div>
              <div>
                <label className={labelCls}>Currency</label>
                <input
                  className={inputCls}
                  value={currency}
                  onChange={(e) => setCurrency(e.target.value)}
                  placeholder="INR"
                  maxLength={8}
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={labelCls}>Statement closing day (1–31)</label>
                  <input
                    className={inputCls}
                    type="number"
                    min="1"
                    max="31"
                    value={closingDay}
                    onChange={(e) => setClosingDay(e.target.value)}
                    placeholder="optional"
                  />
                </div>
                <div>
                  <label className={labelCls}>Payment due day (1–31)</label>
                  <input
                    className={inputCls}
                    type="number"
                    min="1"
                    max="31"
                    value={dueDay}
                    onChange={(e) => setDueDay(e.target.value)}
                    placeholder="optional"
                  />
                </div>
              </div>
              <div>
                <label className={labelCls}>Is active</label>
                <select
                  className={inputCls}
                  value={isActiveAdd ? 'yes' : 'no'}
                  onChange={(e) => setIsActiveAdd(e.target.value === 'yes')}
                >
                  <option value="yes">Yes</option>
                  <option value="no">No</option>
                </select>
              </div>
              <button type="submit" disabled={busy} className={btnPrimary}>
                {busy ? 'Saving…' : 'Save card'}
              </button>
            </form>
            <div className={`${cardCls} space-y-3 p-4 sm:p-5`}>
              <h2 className="text-base font-bold text-[var(--pf-text)]">Cards summary</h2>
              <p className="text-xs text-[var(--pf-text-muted)]">Totals reflect filters below.</p>
              <div className="grid gap-2 sm:grid-cols-2">
                {[
                  ['Total cards', String(cardsTabSummary.n)],
                  ['Total limit', formatInr(cardsTabSummary.totalLimit)],
                  ['Total used', formatInr(cardsTabSummary.totalUsed)],
                  ['Avg utilization', `${cardsTabSummary.avgUtil}%`],
                  ['Total due (billed)', formatInr(cardsTabSummary.totalDue)],
                ].map(([k, v]) => (
                  <div
                    key={k}
                    className="rounded-xl border border-[var(--pf-border)] bg-[var(--pf-surface)] px-3 py-2"
                  >
                    <p className="text-[11px] font-semibold uppercase tracking-wide text-[var(--pf-text-muted)]">
                      {k}
                    </p>
                    <p className="mt-1 text-lg font-bold tabular-nums text-[var(--pf-text)]">{v}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            {[
              { id: 'all', label: 'All cards' },
              { id: 'active', label: 'Active' },
              { id: 'high_util', label: 'High utilization' },
              { id: 'due_soon', label: 'Due soon' },
              { id: 'overdue', label: 'Overdue' },
            ].map((f) => (
              <button
                key={f.id}
                type="button"
                onClick={() => setCardsFilter(f.id)}
                className={`rounded-full px-3 py-1.5 text-xs font-semibold transition ${
                  cardsFilter === f.id
                    ? 'bg-[var(--pf-primary)] text-white'
                    : 'border border-[var(--pf-border)] text-[var(--pf-text-muted)] hover:bg-[var(--pf-card-hover)]'
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>

          <div className="space-y-4">
            <h2 className="text-base font-bold text-[var(--pf-text)]">Your cards</h2>
            {!filteredCards.length ? (
              <p className="text-sm text-[var(--pf-text-muted)]">
                {cards.length ? 'No cards match this filter.' : 'No cards yet — add one above.'}
              </p>
            ) : (
              <ul className="space-y-4">
                {filteredCards.map((c) => {
                  const pct = Number(c.utilization_pct) || 0
                  const dueLabel = c.next_due_date
                    ? new Date(c.next_due_date).toLocaleDateString(undefined, {
                        day: 'numeric',
                        month: 'short',
                      })
                    : '—'
                  const overdue = Number(c.overdue_amount) > 0.01
                  return (
                    <li key={c.id} className={`${cardCls} space-y-3 p-4 sm:p-5`}>
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <div>
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="text-base font-bold text-[var(--pf-text)]">{c.card_name}</span>
                            {c.bank_name ? (
                              <span className="text-sm text-[var(--pf-text-muted)]">{c.bank_name}</span>
                            ) : null}
                            {c.is_active === false ? (
                              <span className="rounded-full border border-[var(--pf-border)] px-2 py-0.5 text-[10px] font-semibold uppercase text-[var(--pf-text-muted)]">
                                Inactive
                              </span>
                            ) : null}
                          </div>
                          {(c.card_network || c.card_type) && (
                            <p className="mt-0.5 text-xs text-[var(--pf-text-muted)]">
                              {[c.card_network, c.card_type].filter(Boolean).join(' · ')}
                            </p>
                          )}
                        </div>
                        <span
                          className={`rounded-full border px-2.5 py-1 text-[11px] font-semibold ${utilizationBadgeClass(pct)}`}
                        >
                          {c.utilization_status} ({pct.toFixed(0)}%)
                        </span>
                      </div>

                      <div className="text-sm text-[var(--pf-text)]">
                        <p>
                          <span className="text-[var(--pf-text-muted)]">Limit: </span>
                          {formatInr(c.card_limit)}
                        </p>
                        <p className="mt-1">
                          <span className="text-[var(--pf-text-muted)]">Used: </span>
                          {formatInr(c.used_amount)}
                          <span className="text-[var(--pf-text-muted)]"> · Available: </span>
                          {formatInr(c.available_credit)}
                        </p>
                        <p className="mt-1 text-xs text-[var(--pf-text-muted)]">
                          Unbilled {formatInr(c.unbilled_charges)} · Billed {formatInr(c.billed_outstanding)}
                          {overdue ? (
                            <span className="font-semibold text-red-600 dark:text-red-400">
                              {' '}
                              · Overdue {formatInr(c.overdue_amount)}
                            </span>
                          ) : null}
                        </p>
                        <p className="mt-1 text-xs">
                          <span className="text-[var(--pf-text-muted)]">Due date: </span>
                          <span className={overdue ? 'font-semibold text-red-600 dark:text-red-400' : ''}>
                            {dueLabel}
                          </span>
                        </p>
                      </div>

                      <div>
                        <p className="text-[11px] font-semibold uppercase tracking-wide text-[var(--pf-text-muted)]">
                          Usage
                        </p>
                        <div className="mt-1.5 flex h-2.5 w-full overflow-hidden rounded-full bg-slate-200/80 dark:bg-slate-700/80">
                          <div
                            className={`h-full min-w-0 transition-all ${utilizationBarColorClass(pct)}`}
                            style={{ width: `${Math.min(100, Math.max(0, pct))}%` }}
                          />
                        </div>
                        <p className="mt-1 text-xs tabular-nums text-[var(--pf-text-muted)]">{pct.toFixed(0)}%</p>
                      </div>

                      <div className="flex flex-wrap gap-2">
                        <button
                          type="button"
                          className={btnSecondary}
                          onClick={() => {
                            setPendingTxCardId(c.id)
                            setTab('transactions')
                          }}
                        >
                          Add expense
                        </button>
                        <button type="button" className={btnSecondary} onClick={() => setTab('bills')}>
                          Record payment
                        </button>
                        <button
                          type="button"
                          className={btnSecondary}
                          onClick={() => {
                            setPendingTxCardId(c.id)
                            setTab('transactions')
                          }}
                        >
                          View transactions
                        </button>
                        <button type="button" className={btnSecondary} onClick={() => openCardEditor(c)}>
                          Edit card
                        </button>
                        <button type="button" className={btnSecondary} onClick={() => handleDeleteCard(c)}>
                          Delete card
                        </button>
                      </div>
                    </li>
                  )
                })}
              </ul>
            )}
          </div>
        </div>
      ) : null}

      {tab === 'transactions' ? (
        <div className={`${cardCls} p-0`}>
          <div className="border-b border-[var(--pf-border)] px-4 py-3">
            <h2 className="text-base font-bold text-[var(--pf-text)]">Transactions</h2>
            <p className="mt-1 text-xs text-[var(--pf-text-muted)]">
              Add a swipe, UPI on credit, or any charge manually — creates an expense and unbilled line (no bank debit until you pay the statement).
            </p>
          </div>
          <form onSubmit={handleManualSwipe} className="space-y-3 border-b border-[var(--pf-border)] px-4 py-4 sm:px-5">
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <div>
                <label className={labelCls}>Card</label>
                <select
                  className={inputCls}
                  value={txCardId}
                  onChange={(e) => setTxCardId(e.target.value)}
                  required
                >
                  <option value="">— Select —</option>
                  {cards.map((c) => (
                    <option key={c.id} value={String(c.id)}>
                      {c.card_name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className={labelCls}>Amount (₹)</label>
                <input
                  className={inputCls}
                  type="number"
                  min="0"
                  step="0.01"
                  value={txAmount}
                  onChange={(e) => setTxAmount(e.target.value)}
                  required
                />
              </div>
              <div>
                <label className={labelCls}>Date</label>
                <input className={inputCls} type="date" value={txDate} onChange={(e) => setTxDate(e.target.value)} required />
              </div>
              <div>
                <label className={labelCls}>Category</label>
                <select className={inputCls} value={txCategoryId} onChange={(e) => setTxCategoryId(e.target.value)}>
                  <option value="">— General —</option>
                  {categories.map((c) => (
                    <option key={c.id} value={String(c.id)}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <div>
              <label className={labelCls}>Description (optional)</label>
              <input className={inputCls} value={txDesc} onChange={(e) => setTxDesc(e.target.value)} placeholder="e.g. Amazon, fuel" />
            </div>
            <button type="submit" disabled={busy || !cards.length} className={btnPrimary}>
              {busy ? 'Saving…' : 'Add transaction'}
            </button>
          </form>
          <div className="border-b border-[var(--pf-border)] px-4 py-2">
            <h3 className="text-sm font-semibold text-[var(--pf-text)]">Recent swipes</h3>
          </div>
          <div className={pfTableWrap}>
            <table className={pfTable}>
              <thead>
                <tr>
                  <th className={pfTh}>Date</th>
                  <th className={pfTh}>Card</th>
                  <th className={pfTh}>Expense #</th>
                  <th className={pfTh}>Bill</th>
                  <th className={`${pfTh} text-right`}>Amount</th>
                </tr>
              </thead>
              <tbody>
                {tx.map((r) => (
                  <tr key={r.id} className={pfTrHover}>
                    <td className={pfTd}>{r.transaction_date}</td>
                    <td className={pfTd}>{cards.find((c) => c.id === r.card_id)?.card_name ?? r.card_id}</td>
                    <td className={pfTd}>{r.expense_id ?? '—'}</td>
                    <td className={pfTd}>{r.bill_id ?? '—'}</td>
                    <td className={`${pfTd} text-right font-medium`}>{formatInr(r.amount)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {!tx.length ? <p className="p-4 text-sm text-[var(--pf-text-muted)]">No transactions yet.</p> : null}
          </div>
        </div>
      ) : null}

      {tab === 'bills' ? (
        <div className="grid gap-6 lg:grid-cols-2">
          <form onSubmit={handleGenerateBill} className={`${cardCls} space-y-3 p-4 sm:p-5`}>
            <h2 className="text-base font-bold text-[var(--pf-text)]">Generate statement</h2>
            <p className="text-xs text-[var(--pf-text-muted)]">
              Packs unbilled charges between dates into one bill and books a liability for the total.
            </p>
            <div>
              <label className={labelCls}>Card</label>
              <select className={inputCls} value={genCardId} onChange={(e) => setGenCardId(e.target.value)} required>
                <option value="">— Select —</option>
                {cards.map((c) => (
                  <option key={c.id} value={String(c.id)}>
                    {c.card_name}
                  </option>
                ))}
              </select>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <label className={labelCls}>Statement from</label>
                <input className={inputCls} type="date" value={billStart} onChange={(e) => setBillStart(e.target.value)} required />
              </div>
              <div>
                <label className={labelCls}>Statement to</label>
                <input className={inputCls} type="date" value={billEnd} onChange={(e) => setBillEnd(e.target.value)} required />
              </div>
            </div>
            <button type="submit" disabled={busy} className={btnPrimary}>
              Generate bill
            </button>
          </form>

          <form onSubmit={handlePayBill} className={`${cardCls} space-y-3 p-4 sm:p-5`}>
            <h2 className="text-base font-bold text-[var(--pf-text)]">Pay statement from bank</h2>
            <div>
              <label className={labelCls}>Bill</label>
              <select className={inputCls} value={payBillId} onChange={(e) => setPayBillId(e.target.value)} required>
                <option value="">— Select —</option>
                {bills
                  .filter((b) => b.status !== 'PAID')
                  .map((b) => (
                    <option key={b.id} value={String(b.id)}>
                      #{b.id} · due {b.due_date} · rem {formatInr(b.remaining ?? b.total_amount - b.amount_paid)}
                    </option>
                  ))}
              </select>
            </div>
            <div>
              <label className={labelCls}>Amount (₹)</label>
              <input
                className={inputCls}
                type="number"
                step="0.01"
                min="0"
                value={payAmount}
                onChange={(e) => setPayAmount(e.target.value)}
                required
              />
            </div>
            <div>
              <label className={labelCls}>From account</label>
              <select className={inputCls} value={payFromAcc} onChange={(e) => setPayFromAcc(e.target.value)} required>
                <option value="">— Select —</option>
                {accounts.map((a) => (
                  <option key={a.id} value={String(a.id)}>
                    {a.account_name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className={labelCls}>Reference (optional)</label>
              <input className={inputCls} value={payRef} onChange={(e) => setPayRef(e.target.value)} />
            </div>
            <button type="submit" disabled={busy} className={btnPrimary}>
              Record payment
            </button>
          </form>

          <div className={`${cardCls} lg:col-span-2 p-0`}>
            <div className="border-b border-[var(--pf-border)] px-4 py-3">
              <h2 className="text-base font-bold text-[var(--pf-text)]">All bills</h2>
            </div>
            <div className={pfTableWrap}>
              <table className={pfTable}>
                <thead>
                  <tr>
                    <th className={pfTh}>ID</th>
                    <th className={pfTh}>Card</th>
                    <th className={pfTh}>Period</th>
                    <th className={pfTh}>Due</th>
                    <th className={pfTh}>Status</th>
                    <th className={`${pfTh} text-right`}>Total</th>
                    <th className={`${pfTh} text-right`}>Remaining</th>
                  </tr>
                </thead>
                <tbody>
                  {bills.map((b) => (
                    <tr key={b.id} className={pfTrHover}>
                      <td className={pfTd}>{b.id}</td>
                      <td className={pfTd}>{cards.find((c) => c.id === b.card_id)?.card_name ?? b.card_id}</td>
                      <td className={pfTd}>
                        {b.bill_start_date} → {b.bill_end_date}
                      </td>
                      <td className={pfTd}>{b.due_date}</td>
                      <td className={pfTd}>{b.status}</td>
                      <td className={`${pfTd} text-right`}>{formatInr(b.total_amount)}</td>
                      <td className={`${pfTd} text-right font-medium`}>
                        {formatInr(b.remaining != null ? b.remaining : Number(b.total_amount) - Number(b.amount_paid))}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {!bills.length ? <p className="p-4 text-sm text-[var(--pf-text-muted)]">No bills yet.</p> : null}
            </div>
          </div>
        </div>
      ) : null}

      {editForm ? (
        <div className="fixed inset-0 z-[100] flex items-start justify-center overflow-y-auto bg-black/50 p-4 sm:p-8">
          <div
            className={`${cardCls} relative mt-8 w-full max-w-lg space-y-3 p-4 sm:p-5`}
            role="dialog"
            aria-modal="true"
            aria-labelledby="edit-card-title"
          >
            <div className="flex items-start justify-between gap-2">
              <h2 id="edit-card-title" className="text-base font-bold text-[var(--pf-text)]">
                Edit card
              </h2>
              <button
                type="button"
                className="text-sm text-[var(--pf-text-muted)] hover:text-[var(--pf-text)]"
                onClick={() => setEditForm(null)}
              >
                Close
              </button>
            </div>
            <form onSubmit={handleSaveEdit} className="space-y-3">
              <div>
                <label className={labelCls}>Card name</label>
                <input
                  className={inputCls}
                  value={editForm.card_name}
                  onChange={(e) => setEditForm({ ...editForm, card_name: e.target.value })}
                  required
                />
              </div>
              <div>
                <label className={labelCls}>Bank</label>
                <input
                  className={inputCls}
                  value={editForm.bank_name}
                  onChange={(e) => setEditForm({ ...editForm, bank_name: e.target.value })}
                />
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <label className={labelCls}>Card network</label>
                  <select
                    className={inputCls}
                    value={editForm.card_network || ''}
                    onChange={(e) => setEditForm({ ...editForm, card_network: e.target.value })}
                  >
                    <option value="">—</option>
                    <option value="Visa">Visa</option>
                    <option value="Mastercard">Mastercard</option>
                    <option value="RuPay">RuPay</option>
                    <option value="Other">Other</option>
                  </select>
                </div>
                <div>
                  <label className={labelCls}>Card type</label>
                  <select
                    className={inputCls}
                    value={editForm.card_type || ''}
                    onChange={(e) => setEditForm({ ...editForm, card_type: e.target.value })}
                  >
                    <option value="">—</option>
                    <option value="Rewards">Rewards</option>
                    <option value="Cashback">Cashback</option>
                    <option value="Business">Business</option>
                    <option value="Other">Other</option>
                  </select>
                </div>
              </div>
              <div>
                <label className={labelCls}>Credit limit</label>
                <input
                  className={inputCls}
                  type="number"
                  min="0"
                  step="0.01"
                  value={editForm.card_limit}
                  onChange={(e) => setEditForm({ ...editForm, card_limit: e.target.value })}
                />
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <label className={labelCls}>Interest rate %</label>
                  <input
                    className={inputCls}
                    type="number"
                    min="0"
                    max="100"
                    step="0.01"
                    value={editForm.interest_rate}
                    onChange={(e) => setEditForm({ ...editForm, interest_rate: e.target.value })}
                  />
                </div>
                <div>
                  <label className={labelCls}>Annual fee</label>
                  <input
                    className={inputCls}
                    type="number"
                    min="0"
                    step="0.01"
                    value={editForm.annual_fee}
                    onChange={(e) => setEditForm({ ...editForm, annual_fee: e.target.value })}
                  />
                </div>
              </div>
              <div>
                <label className={labelCls}>Currency</label>
                <input
                  className={inputCls}
                  value={editForm.currency}
                  onChange={(e) => setEditForm({ ...editForm, currency: e.target.value })}
                  maxLength={8}
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={labelCls}>Closing day</label>
                  <input
                    className={inputCls}
                    type="number"
                    min="1"
                    max="31"
                    value={editForm.closing_day}
                    onChange={(e) => setEditForm({ ...editForm, closing_day: e.target.value })}
                  />
                </div>
                <div>
                  <label className={labelCls}>Due day</label>
                  <input
                    className={inputCls}
                    type="number"
                    min="1"
                    max="31"
                    value={editForm.due_day}
                    onChange={(e) => setEditForm({ ...editForm, due_day: e.target.value })}
                  />
                </div>
              </div>
              <div>
                <label className={labelCls}>Is active</label>
                <select
                  className={inputCls}
                  value={editForm.is_active ? 'yes' : 'no'}
                  onChange={(e) => setEditForm({ ...editForm, is_active: e.target.value === 'yes' })}
                >
                  <option value="yes">Yes</option>
                  <option value="no">No</option>
                </select>
              </div>
              <div className="flex flex-wrap gap-2 pt-1">
                <button type="submit" disabled={busy} className={btnPrimary}>
                  {busy ? 'Saving…' : 'Save changes'}
                </button>
                <button
                  type="button"
                  className={btnSecondary}
                  onClick={() => setEditForm(null)}
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </div>
  )
}
