import {
  BanknotesIcon,
  BuildingOffice2Icon,
  BuildingStorefrontIcon,
  DevicePhoneMobileIcon,
  HomeModernIcon,
  MapPinIcon,
  PlusIcon,
  SparklesIcon,
  TruckIcon,
  WrenchScrewdriverIcon,
  XMarkIcon,
} from '@heroicons/react/24/solid'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { useOutletContext } from 'react-router-dom'
import {
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
  createChitFund,
  createFinanceAsset,
  deleteChitFund,
  deleteFinanceAsset,
  getFinanceAsset,
  getAssetsSummary,
  listChitFunds,
  listFinanceAccounts,
  listFinanceAssets,
  listFinanceLiabilities,
  patchChitFund,
  patchFinanceAsset,
  pfFetchBlob,
  postChitFundContribution,
  postChitFundDividend,
  postChitFundForemanCommission,
  setPfToken,
  triggerDownloadBlob,
} from '../api.js'
import PfExportMenu from '../PfExportMenu.jsx'
import { AppButton, AppModal } from '../pfDesignSystem/index.js'
import {
  btnDanger,
  btnPrimary,
  btnSecondary,
  cardCls,
  inputCls,
  labelCls,
  pfActionRow,
  pfChartCard,
  pfModalCloseBtn,
  pfModalHeader,
  pfModalOverlay,
  pfModalSurface,
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
import { PremiumSelect } from '../../../components/ui/PremiumSelect.jsx'
import { usePfRefresh } from '../pfRefreshContext.jsx'
import { PageHeader } from '../../../components/ui/PageHeader.jsx'

const ASSET_TYPES = [
  { value: 'PROPERTY_LAND', label: 'Property / Land' },
  { value: 'HOUSE', label: 'House' },
  { value: 'APARTMENT', label: 'Apartment' },
  { value: 'VEHICLE', label: 'Vehicle' },
  { value: 'GOLD_JEWELRY', label: 'Gold / Jewelry' },
  { value: 'EQUIPMENT_MACHINERY', label: 'Equipment' },
  { value: 'FURNITURE', label: 'Furniture' },
  { value: 'ELECTRONICS', label: 'Electronics' },
  { value: 'BUSINESS_ASSET', label: 'Business asset' },
  { value: 'CHIT_FUND', label: 'Chit fund (book entry)' },
  { value: 'OTHER', label: 'Other' },
]

const PIE_COLORS = ['#3b82f6', '#8b5cf6', '#10b981', '#f59e0b', '#ec4899', '#06b6d4', '#64748b', '#84cc16', '#a855f7', '#f43f5e']

function formatShortDate(iso) {
  if (!iso) return '—'
  const d = new Date(`${String(iso).slice(0, 10)}T12:00:00`)
  if (Number.isNaN(d.getTime())) return iso
  return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
}

function typeLabel(v) {
  return ASSET_TYPES.find((t) => t.value === v)?.label || v || '—'
}

function num(v) {
  if (v == null || v === '') return 0
  const n = Number(v)
  return Number.isFinite(n) ? n : 0
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

function emptyForm() {
  return {
    asset_name: '',
    asset_type: 'HOUSE',
    purchase_value: '',
    current_value: '',
    purchase_date: '',
    depreciation_rate: '',
    location: '',
    linked_liability_id: '',
    notes: '',
  }
}

/** Match backend effective_current_value (straight-line % per year from purchase). */
function previewEffectiveValue(purchaseValue, currentValueStr, depreciationPctStr, purchaseDateStr) {
  const pv = num(purchaseValue)
  const rate = num(depreciationPctStr)
  if (rate > 0 && purchaseDateStr) {
    const pd = new Date(`${String(purchaseDateStr).slice(0, 10)}T12:00:00`)
    if (!Number.isNaN(pd.getTime())) {
      const today = new Date()
      today.setHours(12, 0, 0, 0)
      if (pd <= today) {
        const yrs = (today.getTime() - pd.getTime()) / (365.25 * 86400000)
        const dep = pv * (rate / 100) * yrs
        return Math.max(0, Math.round((pv - dep) * 100) / 100)
      }
    }
  }
  if (currentValueStr !== '' && currentValueStr != null) {
    const cv = num(currentValueStr)
    return Math.max(0, cv)
  }
  return Math.max(0, pv)
}

function assetTypeIcon(type) {
  const t = String(type || '').toUpperCase()
  const cls = 'h-6 w-6'
  if (t === 'HOUSE' || t === 'APARTMENT') return <HomeModernIcon className={cls} aria-hidden />
  if (t === 'PROPERTY_LAND') return <MapPinIcon className={cls} aria-hidden />
  if (t === 'VEHICLE') return <TruckIcon className={cls} aria-hidden />
  if (t === 'GOLD_JEWELRY') return <SparklesIcon className={cls} aria-hidden />
  if (t === 'EQUIPMENT_MACHINERY' || t === 'BUSINESS_ASSET') return <WrenchScrewdriverIcon className={cls} aria-hidden />
  if (t === 'ELECTRONICS') return <DevicePhoneMobileIcon className={cls} aria-hidden />
  if (t === 'FURNITURE') return <BuildingStorefrontIcon className={cls} aria-hidden />
  if (t === 'CHIT_FUND') return <BanknotesIcon className={cls} aria-hidden />
  return <BuildingOffice2Icon className={cls} aria-hidden />
}

function cumulativePurchaseByYear(rows) {
  if (!rows.length) return []
  const events = rows
    .map((r) => ({
      y: r.purchase_date ? parseInt(String(r.purchase_date).slice(0, 4), 10) : null,
      v: num(r.purchase_value),
    }))
    .filter((x) => x.y != null && !Number.isNaN(x.y))
  if (!events.length) return []
  const minY = Math.min(...events.map((e) => e.y))
  const maxY = new Date().getFullYear()
  const byYear = new Map()
  for (const e of events) {
    byYear.set(e.y, (byYear.get(e.y) || 0) + e.v)
  }
  const out = []
  let cum = 0
  for (let y = minY; y <= maxY; y++) {
    cum += byYear.get(y) || 0
    out.push({
      year: String(y),
      cumulative: Math.round(cum * 100) / 100,
      added: Math.round((byYear.get(y) || 0) * 100) / 100,
    })
  }
  return out
}

function allocationByType(rows) {
  const m = new Map()
  for (const r of rows) {
    const t = r.asset_type || 'OTHER'
    const v = num(r.effective_current_value)
    m.set(t, (m.get(t) || 0) + v)
  }
  return [...m.entries()]
    .filter(([, v]) => v > 0)
    .map(([name, value]) => ({ name: typeLabel(name), value: Math.round(value * 100) / 100 }))
}

function appreciationPct(r) {
  const pv = num(r.purchase_value)
  const ev = num(r.effective_current_value)
  if (pv <= 0) return null
  return ((ev - pv) / pv) * 100
}

export default function PfAssetsPage() {
  const { onSessionInvalid } = useOutletContext() || {}
  const { tick, refresh } = usePfRefresh()
  const [rows, setRows] = useState([])
  const [summary, setSummary] = useState(null)
  const [liabilities, setLiabilities] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [filterType, setFilterType] = useState('ALL')
  const [filterLocation, setFilterLocation] = useState('')
  const [search, setSearch] = useState('')
  const [showAddModal, setShowAddModal] = useState(false)
  const [editId, setEditId] = useState(null)
  const [viewId, setViewId] = useState(null)
  const [viewRow, setViewRow] = useState(null)
  const [form, setForm] = useState(emptyForm)
  const [submitting, setSubmitting] = useState(false)
  const [assetExportBusy, setAssetExportBusy] = useState(false)
  const [assetStmtBusy, setAssetStmtBusy] = useState(false)
  const [chitFunds, setChitFunds] = useState([])
  const [accounts, setAccounts] = useState([])
  const [showChitModal, setShowChitModal] = useState(false)
  const [chitEditId, setChitEditId] = useState(null)
  const [chitForm, setChitForm] = useState(emptyChitForm)
  const [chitSubmitting, setChitSubmitting] = useState(false)
  const [chitLedgerChitId, setChitLedgerChitId] = useState(null)
  const [chitLedgerKind, setChitLedgerKind] = useState(null)
  const [chitLedgerDate, setChitLedgerDate] = useState(() => new Date().toISOString().slice(0, 10))
  const [chitLedgerAmount, setChitLedgerAmount] = useState('')
  const [chitLedgerAccountId, setChitLedgerAccountId] = useState('')
  const [chitLedgerMode, setChitLedgerMode] = useState('BANK')
  const [chitLedgerBusy, setChitLedgerBusy] = useState(false)

  const editingChit = useMemo(
    () => (chitEditId ? chitFunds.find((c) => c.id === chitEditId) : null),
    [chitFunds, chitEditId],
  )

  const chitCalcPreview = useMemo(() => {
    const tv = num(chitForm.total_value)
    const dur = Math.max(0, parseInt(String(chitForm.duration_months || '0'), 10) || 0)
    const totalPaidSaved = editingChit != null ? num(editingChit.total_paid) : 0
    const monthsPaid = editingChit != null ? num(editingChit.months_paid ?? editingChit.contributions_count) : 0
    const arInput = chitForm.amount_received === '' ? null : Number(chitForm.amount_received)
    const arFromServer = editingChit?.amount_received != null ? num(editingChit.amount_received) : null
    const amountReceived = arInput != null && !Number.isNaN(arInput) ? arInput : arFromServer
    const discountAuto =
      chitForm.auction_taken && amountReceived != null && !Number.isNaN(amountReceived)
        ? Math.max(0, Math.round((tv - amountReceived) * 100) / 100)
        : 0
    const remainingPayable =
      chitForm.auction_taken && tv > 0 ? Math.max(0, Math.round((tv - totalPaidSaved) * 100) / 100) : 0
    const remainingMonths =
      editingChit != null ? num(editingChit.remaining_months) : dur
    const assetValue =
      chitForm.auction_taken && amountReceived != null && !Number.isNaN(amountReceived)
        ? Math.max(0, Math.round((totalPaidSaved - amountReceived) * 100) / 100)
        : totalPaidSaved
    const netProfit =
      num(chitForm.dividend_received) - num(chitForm.foreman_commission) - (chitForm.auction_taken ? discountAuto : 0)
    return {
      totalPaid: totalPaidSaved,
      monthsPaid,
      discountAuto,
      remainingPayable,
      remainingMonths,
      assetValue,
      netProfit: Math.round(netProfit * 100) / 100,
    }
  }, [chitForm, editingChit])

  const chitLedgerTarget = useMemo(
    () => (chitLedgerChitId != null ? chitFunds.find((c) => c.id === chitLedgerChitId) : null),
    [chitFunds, chitLedgerChitId],
  )

  const liabilityById = useMemo(() => {
    const m = new Map()
    for (const ln of liabilities) m.set(ln.id, ln)
    return m
  }, [liabilities])

  const queryParams = useMemo(
    () => ({
      asset_type: filterType,
      location: filterLocation,
      search,
      limit: 500,
    }),
    [filterType, filterLocation, search],
  )

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const [list, sum, chits, acc] = await Promise.all([
        listFinanceAssets(queryParams),
        getAssetsSummary(),
        listChitFunds().catch(() => []),
        listFinanceAccounts().catch(() => []),
      ])
      setRows(Array.isArray(list) ? list : [])
      setSummary(sum || null)
      setChitFunds(Array.isArray(chits) ? chits : [])
      setAccounts(Array.isArray(acc) ? acc : [])
    } catch (e) {
      if (e.status === 401) {
        setPfToken(null)
        onSessionInvalid?.()
      } else {
        setError(e.message || 'Failed to load assets')
      }
    } finally {
      setLoading(false)
    }
  }, [onSessionInvalid, queryParams])

  useEffect(() => {
    load()
  }, [load, tick])

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const li = await listFinanceLiabilities({ limit: 500, skip: 0 })
        if (!cancelled) setLiabilities(Array.isArray(li) ? li : [])
      } catch {
        if (!cancelled) setLiabilities([])
      }
    })()
    return () => {
      cancelled = true
    }
  }, [tick])

  const locationOptions = useMemo(() => {
    const fromSummary = Array.isArray(summary?.locations) ? summary.locations : []
    const set = new Set(fromSummary.map(String))
    for (const r of rows) {
      if (r.location && String(r.location).trim()) set.add(String(r.location).trim())
    }
    return Array.from(set).sort((a, b) => a.localeCompare(b))
  }, [summary?.locations, rows])

  const linkedLoanOutstandingTotal = useMemo(() => {
    const seen = new Set()
    let s = 0
    for (const r of rows) {
      const id = r.linked_liability_id
      if (id == null || seen.has(id)) continue
      seen.add(id)
      const ln = liabilityById.get(id)
      if (ln) s += num(ln.outstanding_amount)
    }
    return Math.round(s * 100) / 100
  }, [rows, liabilityById])

  const portfolioPurchase = num(summary?.total_purchase_value)
  const portfolioEffective = num(summary?.total_current_value)
  const gainVsCost = portfolioEffective - portfolioPurchase
  const chitFundsNetKpi = num(summary?.chit_funds_net_value)

  const allocationPie = useMemo(() => allocationByType(rows), [rows])
  const trendSeries = useMemo(() => cumulativePurchaseByYear(rows), [rows])

  const formPreviewEffective = useMemo(
    () =>
      previewEffectiveValue(
        form.purchase_value,
        form.current_value,
        form.depreciation_rate,
        form.purchase_date,
      ),
    [form.purchase_value, form.current_value, form.depreciation_rate, form.purchase_date],
  )

  const hasActiveFilters =
    filterType !== 'ALL' || Boolean(String(filterLocation).trim()) || Boolean(String(search).trim())

  function openAdd() {
    setForm(emptyForm())
    setEditId(null)
    setShowAddModal(true)
  }

  function openEdit(r) {
    setViewId(null)
    setViewRow(null)
    setForm({
      asset_name: r.asset_name || '',
      asset_type: r.asset_type || 'OTHER',
      purchase_value: String(r.purchase_value ?? ''),
      current_value: String(r.current_value ?? ''),
      purchase_date: r.purchase_date ? String(r.purchase_date).slice(0, 10) : '',
      depreciation_rate: r.depreciation_rate != null ? String(r.depreciation_rate) : '',
      location: r.location || '',
      linked_liability_id: r.linked_liability_id != null ? String(r.linked_liability_id) : '',
      notes: r.notes || '',
    })
    setEditId(r.id)
    setShowAddModal(true)
  }

  async function openView(id) {
    setViewId(id)
    setViewRow(null)
    try {
      const r = await getFinanceAsset(id)
      setViewRow(r)
    } catch (e) {
      if (e.status === 401) {
        setPfToken(null)
        onSessionInvalid?.()
      } else {
        window.alert(e.message || 'Could not load asset')
      }
      setViewId(null)
    }
  }

  function linkedOutstandingForAsset(r) {
    const id = r.linked_liability_id
    if (id == null) return 0
    return num(liabilityById.get(id)?.outstanding_amount)
  }

  function equityForAsset(r) {
    return Math.max(0, Math.round((num(r.effective_current_value) - linkedOutstandingForAsset(r)) * 100) / 100)
  }

  function buildPayloadFromForm() {
    const purchase_value = num(form.purchase_value)
    let current_value = form.current_value === '' ? null : num(form.current_value)
    if (current_value === null) current_value = purchase_value
    const depreciation_rate = form.depreciation_rate === '' ? null : num(form.depreciation_rate)
    const linked_raw = String(form.linked_liability_id || '').trim()
    const linked_liability_id = linked_raw === '' ? null : Number(linked_raw)
    return {
      asset_name: form.asset_name.trim(),
      asset_type: form.asset_type,
      purchase_value,
      current_value,
      purchase_date: form.purchase_date ? form.purchase_date : null,
      depreciation_rate: depreciation_rate > 0 ? depreciation_rate : null,
      location: form.location.trim() || null,
      linked_liability_id: Number.isFinite(linked_liability_id) ? linked_liability_id : null,
      notes: form.notes.trim() || null,
    }
  }

  async function handleSave(e) {
    e.preventDefault()
    setSubmitting(true)
    setError('')
    try {
      const body = buildPayloadFromForm()
      if (editId) {
        await patchFinanceAsset(editId, body)
      } else {
        await createFinanceAsset(body)
      }
      setShowAddModal(false)
      setEditId(null)
      await load()
      refresh()
    } catch (err) {
      if (err.status === 401) {
        setPfToken(null)
        onSessionInvalid?.()
      } else {
        setError(err.message || 'Could not save asset')
      }
    } finally {
      setSubmitting(false)
    }
  }

  async function handleDelete(r) {
    if (!window.confirm(`Delete asset “${r.asset_name}”?`)) return
    try {
      await deleteFinanceAsset(r.id)
      if (viewId === r.id) {
        setViewId(null)
        setViewRow(null)
      }
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

  async function handleAssetsExport() {
    setAssetExportBusy(true)
    try {
      const { blob, filename } = await pfFetchBlob('/pf/export/assets/excel')
      triggerDownloadBlob(blob, filename || 'Fixed_Assets.xlsx')
    } catch (e) {
      if (e.status === 401) {
        setPfToken(null)
        onSessionInvalid?.()
      } else {
        window.alert(e.message || 'Export failed')
      }
    } finally {
      setAssetExportBusy(false)
    }
  }

  async function downloadAssetStatement(kind) {
    if (!viewId) return
    setAssetStmtBusy(true)
    try {
      const path = kind === 'pdf' ? `/pf/export/assets/${viewId}/pdf` : `/pf/export/assets/${viewId}/excel`
      const { blob, filename: suggest } = await pfFetchBlob(path)
      const ext = kind === 'pdf' ? '.pdf' : '.xlsx'
      const name =
        suggest ||
        `Asset_${String(viewRow?.asset_name || 'export')
          .replace(/\s+/g, '_')
          .slice(0, 80)}${ext}`
      triggerDownloadBlob(blob, name)
    } catch (e) {
      if (e.status === 401) {
        setPfToken(null)
        onSessionInvalid?.()
      } else {
        window.alert(e.message || 'Export failed')
      }
    } finally {
      setAssetStmtBusy(false)
    }
  }

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
      const accRaw = chitForm.auction_receipt_finance_account_id
      const accId =
        accRaw === '' || accRaw == null ? null : Number(accRaw)
      const base = {
        chit_name: chitForm.chit_name.trim(),
        total_value: Number(chitForm.total_value) || 0,
        monthly_amount: Number(chitForm.monthly_amount) || 0,
        start_date: chitForm.start_date,
        duration_months: Math.max(0, parseInt(String(chitForm.duration_months || '0'), 10) || 0),
        auction_taken: chitForm.auction_taken,
        auction_month: chitForm.auction_month === '' ? null : Number(chitForm.auction_month),
        amount_received: chitForm.amount_received === '' ? null : Number(chitForm.amount_received),
        foreman_commission: Number(chitForm.foreman_commission) || 0,
        dividend_received: Number(chitForm.dividend_received) || 0,
        status: chitForm.status || 'RUNNING',
        notes: chitForm.notes?.trim() || null,
        ...(chitForm.auction_taken && accId != null && !Number.isNaN(accId)
          ? { auction_receipt_finance_account_id: accId }
          : {}),
        ...(chitForm.auction_taken && (chitForm.auction_booking_date || chitForm.start_date)
          ? { auction_booking_date: chitForm.auction_booking_date || chitForm.start_date }
          : {}),
      }
      if (chitEditId) {
        await patchChitFund(chitEditId, base)
      } else {
        await createChitFund(base)
      }
      setShowChitModal(false)
      await load()
      refresh()
    } catch (err) {
      if (err.status === 401) {
        setPfToken(null)
        onSessionInvalid?.()
      } else {
        setError(err.message || 'Could not save chit fund')
      }
    } finally {
      setChitSubmitting(false)
    }
  }

  async function handleChitDelete(c) {
    if (!window.confirm(`Delete chit “${c.chit_name}”? Contribution history will be removed.`)) return
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

  function openChitLedger(chitId, kind) {
    setChitLedgerChitId(chitId)
    setChitLedgerKind(kind)
    setChitLedgerDate(new Date().toISOString().slice(0, 10))
    setChitLedgerAmount('')
    setChitLedgerMode(kind === 'contribution' ? 'BANK' : 'BANK')
    setChitLedgerAccountId(accounts[0]?.id != null ? String(accounts[0].id) : '')
  }

  async function submitChitLedger(e) {
    e.preventDefault()
    if (!chitLedgerChitId || !chitLedgerKind) return
    const amt = Number(chitLedgerAmount)
    if (!amt || amt <= 0) {
      setError('Enter a valid amount')
      return
    }
    const acc = chitLedgerAccountId ? Number(chitLedgerAccountId) : null
    if (chitLedgerKind !== 'contribution' && chitLedgerKind !== 'commission' && !acc) {
      setError('Select bank account for this entry')
      return
    }
    if (chitLedgerKind === 'contribution' && chitLedgerMode === 'BANK' && (!acc || Number.isNaN(acc))) {
      setError('Select bank account for contribution')
      return
    }
    if (
      chitLedgerKind === 'contribution' &&
      chitLedgerMode === 'CASH' &&
      accounts.length > 1 &&
      (!acc || Number.isNaN(acc))
    ) {
      setError('Select which account to pay from (cash wallet or bank)')
      return
    }
    setChitLedgerBusy(true)
    setError('')
    try {
      if (chitLedgerKind === 'contribution') {
        await postChitFundContribution(chitLedgerChitId, {
          contribution_date: chitLedgerDate,
          amount: amt,
          payment_mode: chitLedgerMode,
          finance_account_id:
            chitLedgerMode === 'BANK'
              ? acc
              : acc && !Number.isNaN(acc)
                ? acc
                : accounts.length === 1 && accounts[0]?.id != null
                  ? Number(accounts[0].id)
                  : null,
        })
      } else if (chitLedgerKind === 'dividend') {
        await postChitFundDividend(chitLedgerChitId, {
          entry_date: chitLedgerDate,
          amount: amt,
          finance_account_id: acc,
        })
      } else if (chitLedgerKind === 'commission') {
        await postChitFundForemanCommission(chitLedgerChitId, {
          entry_date: chitLedgerDate,
          amount: amt,
          finance_account_id: acc,
        })
      }
      setChitLedgerChitId(null)
      setChitLedgerKind(null)
      await load()
      refresh()
    } catch (err) {
      if (err.status === 401) {
        setPfToken(null)
        onSessionInvalid?.()
      } else {
        setError(err.message || 'Could not record entry')
      }
    } finally {
      setChitLedgerBusy(false)
    }
  }

  const groupedRows = useMemo(() => {
    const order = ASSET_TYPES.map((t) => t.value)
    const m = new Map()
    for (const r of rows) {
      const t = r.asset_type || 'OTHER'
      if (!m.has(t)) m.set(t, [])
      m.get(t).push(r)
    }
    const keys = [...new Set([...order.filter((k) => m.has(k)), ...m.keys()].filter((k) => m.has(k)))]
    return keys.map((k) => ({ key: k, label: typeLabel(k), items: m.get(k) || [] }))
  }, [rows])

  const kpiGlass =
    'rounded-2xl border p-4 shadow-[var(--pf-shadow)] backdrop-blur-md transition dark:border-[var(--pf-border)] dark:bg-white/[0.04]'
  const chartTitle = 'text-sm font-bold text-slate-900 dark:text-[var(--pf-text)]'
  const chartSub = 'mt-0.5 text-xs text-slate-500 dark:text-[var(--pf-text-muted)]'

  function assetCardShell(r) {
    const ap = appreciationPct(r)
    if (ap != null && ap > 0.5) {
      return 'border-emerald-500/30 bg-gradient-to-br from-emerald-500/[0.06] to-transparent'
    }
    if (ap != null && ap < -0.5) {
      return 'border-slate-500/30 bg-gradient-to-br from-slate-500/[0.06] to-transparent'
    }
    return 'border-[var(--pf-border)] bg-white/[0.03] dark:bg-white/[0.03]'
  }

  return (
    <div className="space-y-10">
      <PageHeader
        title="Fixed assets"
        description="Property, gold, vehicles, equipment — portfolio value, allocation, and equity after linked loans."
        action={
          <div className="flex flex-wrap items-center gap-2">
            <PfExportMenu
              busy={assetExportBusy}
              items={[{ key: 'xlsx', label: 'Export Excel (all)', onClick: handleAssetsExport }]}
            />
            <button type="button" onClick={openAdd} className={`${btnPrimary} inline-flex items-center gap-2`}>
              <PlusIcon className="h-5 w-5" aria-hidden />
              Add asset
            </button>
          </div>
        }
      />

      {error ? (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-100">
          {error}
        </div>
      ) : null}

      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6" aria-label="Asset summary">
        <div className={kpiGlass}>
          <p className="text-[11px] font-bold uppercase tracking-wider text-[var(--pf-text-muted)]">Portfolio value</p>
          <p className="mt-2 font-mono text-lg font-bold tabular-nums text-[var(--pf-text)] sm:text-xl">
            {formatInr(summary?.total_current_value)}
          </p>
          <p className="mt-1 text-[10px] text-[var(--pf-text-muted)]">Effective book (depreciation rules)</p>
        </div>
        <div className={kpiGlass}>
          <p className="text-[11px] font-bold uppercase tracking-wider text-[var(--pf-text-muted)]">Purchase value</p>
          <p className="mt-2 font-mono text-lg font-bold tabular-nums text-[var(--pf-text)] sm:text-xl">
            {formatInr(summary?.total_purchase_value)}
          </p>
        </div>
        <div
          className={`${kpiGlass} ${
            gainVsCost >= 0 ? 'border-emerald-500/25 bg-emerald-500/[0.04]' : 'border-amber-500/25 bg-amber-500/[0.04]'
          }`}
        >
          <p className="text-[11px] font-bold uppercase tracking-wider text-[var(--pf-text-muted)]">vs cost basis</p>
          <p
            className={`mt-2 font-mono text-lg font-bold tabular-nums sm:text-xl ${
              gainVsCost >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-amber-700 dark:text-amber-300'
            }`}
          >
            {gainVsCost >= 0 ? '+' : ''}
            {formatInr(gainVsCost)}
          </p>
        </div>
        <div className={kpiGlass}>
          <p className="text-[11px] font-bold uppercase tracking-wider text-[var(--pf-text-muted)]">Depreciation</p>
          <p className="mt-2 font-mono text-lg font-bold tabular-nums text-[var(--pf-text)] sm:text-xl">
            {formatInr(summary?.total_depreciation)}
          </p>
        </div>
        <div className={`${kpiGlass} border-sky-500/25 bg-sky-500/[0.04]`}>
          <p className="text-[11px] font-bold uppercase tracking-wider text-[var(--pf-text-muted)]">Linked loan balance</p>
          <p className="mt-2 font-mono text-lg font-bold tabular-nums text-sky-700 dark:text-sky-300 sm:text-xl">
            {formatInr(linkedLoanOutstandingTotal)}
          </p>
          <p className="mt-1 text-[10px] text-[var(--pf-text-muted)]">{summary?.linked_loan_count ?? 0} asset link(s)</p>
        </div>
        <div className={`${kpiGlass} border-amber-500/25 bg-amber-500/[0.04]`}>
          <p className="text-[11px] font-bold uppercase tracking-wider text-[var(--pf-text-muted)]">Chit funds (asset side)</p>
          <p className="mt-2 font-mono text-lg font-bold tabular-nums text-amber-800 dark:text-amber-200 sm:text-xl">
            {formatInr(chitFundsNetKpi)}
          </p>
          <p className="mt-1 text-[10px] text-[var(--pf-text-muted)]">
            Book asset total · Payable sits in liabilities · Net worth = assets − liabilities
          </p>
          {summary?.chit_funds_metrics ? (
            <dl className="mt-3 grid grid-cols-2 gap-x-3 gap-y-1 border-t border-amber-500/20 pt-3 text-[10px] text-[var(--pf-text-muted)] sm:grid-cols-3">
              <div>
                <dt className="font-semibold text-[var(--pf-text)]">Pot value</dt>
                <dd className="font-mono tabular-nums">{formatInr(summary.chit_funds_metrics.total_chit_value)}</dd>
              </div>
              <div>
                <dt className="font-semibold text-[var(--pf-text)]">Total paid</dt>
                <dd className="font-mono tabular-nums">{formatInr(summary.chit_funds_metrics.total_paid)}</dd>
              </div>
              <div>
                <dt className="font-semibold text-[var(--pf-text)]">Received</dt>
                <dd className="font-mono tabular-nums">{formatInr(summary.chit_funds_metrics.total_amount_received)}</dd>
              </div>
              <div>
                <dt className="font-semibold text-[var(--pf-text)]">Dividend</dt>
                <dd className="font-mono tabular-nums">{formatInr(summary.chit_funds_metrics.total_dividend)}</dd>
              </div>
              <div>
                <dt className="font-semibold text-[var(--pf-text)]">Commission</dt>
                <dd className="font-mono tabular-nums">{formatInr(summary.chit_funds_metrics.total_commission)}</dd>
              </div>
              <div>
                <dt className="font-semibold text-[var(--pf-text)]">Discount (loss)</dt>
                <dd className="font-mono tabular-nums">{formatInr(summary.chit_funds_metrics.total_discount)}</dd>
              </div>
              <div>
                <dt className="font-semibold text-[var(--pf-text)]">Net P/L</dt>
                <dd className="font-mono tabular-nums">{formatInr(summary.chit_funds_metrics.net_profit_loss)}</dd>
              </div>
              <div>
                <dt className="font-semibold text-[var(--pf-text)]">Chit payable</dt>
                <dd className="font-mono tabular-nums">{formatInr(summary.chit_funds_metrics.total_liability_value)}</dd>
              </div>
              <div>
                <dt className="font-semibold text-[var(--pf-text)]">Asset − payable</dt>
                <dd className="font-mono tabular-nums">{formatInr(summary.chit_funds_metrics.net_balance_sheet)}</dd>
              </div>
            </dl>
          ) : null}
        </div>
      </section>

      <section
        className="space-y-4 rounded-2xl border border-[var(--pf-border)] bg-white/[0.02] p-5 dark:bg-white/[0.02]"
        aria-label="Chit funds"
      >
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="min-w-0">
            <h2 className="text-base font-bold text-[var(--pf-text)]">Chit funds</h2>
            <p className="mt-1 max-w-3xl text-xs text-[var(--pf-text-muted)]">
              <strong>Before auction:</strong> each payment is a bank outflow with type{' '}
              <code className="rounded bg-black/5 px-1 dark:bg-white/10">CHIT_CONTRIBUTION</code> (book asset = total paid).{' '}
              <strong>After auction:</strong> remaining payable = pot value − total paid; <strong>Pay month</strong> records a
              liability installment (reduces <strong>Chit Fund Payable</strong>). Saving auction data books{' '}
              <strong>Chit Fund Discount (Loss)</strong> and optional auction receipt to your bank. <strong>Dividend</strong> →
              income; <strong>Commission</strong> → expense.
            </p>
          </div>
          <button type="button" onClick={openChitAdd} className={`${btnSecondary} inline-flex items-center gap-2 text-xs`}>
            <PlusIcon className="h-4 w-4" aria-hidden />
            Add chit fund
          </button>
        </div>
        {chitFunds.length === 0 ? (
          <p className="text-sm text-[var(--pf-text-muted)]">No chit funds yet.</p>
        ) : (
          <div className={pfTableWrap}>
            <table className={`${pfTable} min-w-[64rem] text-xs sm:text-sm`}>
              <thead>
                <tr>
                  <th className={pfTh}>Chit</th>
                  <th className={pfTh}>Status</th>
                  <th className={pfThRight}>Total paid</th>
                  <th className={pfThRight}>Received</th>
                  <th className={pfThRight}>Net asset</th>
                  <th className={pfThRight}>Payable</th>
                  <th className={pfThRight}>Discount</th>
                  <th className={pfThRight}>Net P/L</th>
                  <th className={pfThRight}>Rem. mo</th>
                  <th className={pfTh}>Auction</th>
                  <th className={pfTdActions}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {chitFunds.map((c) => (
                  <tr key={c.id} className={pfTrHover}>
                    <td className={pfTd}>
                      <span className="font-medium text-[var(--pf-text)]">{c.chit_name}</span>
                      <p className="text-[10px] text-[var(--pf-text-muted)]">
                        {formatInr(c.monthly_amount)}/mo · {c.duration_months} mo · pot {formatInr(c.total_value)}
                      </p>
                    </td>
                    <td className={pfTd}>{String(c.status || '—')}</td>
                    <td className={pfTdRight}>{formatInr(c.total_paid)}</td>
                    <td className={pfTdRight}>{formatInr(c.total_received)}</td>
                    <td className={pfTdRight}>{formatInr(c.net_asset_value)}</td>
                    <td className={pfTdRight}>{c.auction_taken ? formatInr(c.liability_outstanding) : '—'}</td>
                    <td className={pfTdRight}>{c.auction_taken ? formatInr(c.discount_computed) : '—'}</td>
                    <td className={pfTdRight}>{formatInr(c.net_position ?? c.profit_loss)}</td>
                    <td className={pfTdRight}>{c.remaining_months ?? '—'}</td>
                    <td className={pfTd}>{c.auction_taken ? `Yes (mo ${c.auction_month ?? '—'})` : 'No'}</td>
                    <td className={pfTdActions}>
                      <div className="flex flex-wrap gap-1">
                        <button type="button" className={`${btnSecondary} !px-2 !py-1 text-[10px]`} onClick={() => openChitEdit(c)}>
                          Edit
                        </button>
                        <button
                          type="button"
                          className={`${btnSecondary} !px-2 !py-1 text-[10px]`}
                          onClick={() => openChitLedger(c.id, 'contribution')}
                        >
                          Pay month
                        </button>
                        <button
                          type="button"
                          className={`${btnSecondary} !px-2 !py-1 text-[10px]`}
                          onClick={() => openChitLedger(c.id, 'dividend')}
                        >
                          Dividend
                        </button>
                        <button
                          type="button"
                          className={`${btnSecondary} !px-2 !py-1 text-[10px]`}
                          onClick={() => openChitLedger(c.id, 'commission')}
                        >
                          Commission
                        </button>
                        <button type="button" className={`${btnDanger} !px-2 !py-1 text-[10px]`} onClick={() => handleChitDelete(c)}>
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {!loading && rows.length > 0 ? (
        <section className="grid gap-6 lg:grid-cols-2" aria-label="Charts">
          <div className={`${pfChartCard} min-h-[300px]`}>
            <p className={chartTitle}>Allocation by type</p>
            <p className={chartSub}>Share of portfolio by effective value</p>
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
            <p className={chartTitle}>Capital added (cumulative)</p>
            <p className={chartSub}>Purchase cost booked by year — depreciation in KPIs &amp; cards</p>
            <div className="mt-4 h-[240px] w-full">
              {trendSeries.length === 0 ? (
                <p className="flex h-full items-center justify-center text-sm text-[var(--pf-text-muted)]">
                  Add purchase dates to see trend
                </p>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={trendSeries} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-[var(--pf-border)] opacity-40" />
                    <XAxis dataKey="year" tick={{ fontSize: 10 }} />
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
                      dataKey="cumulative"
                      name="Cumulative purchase"
                      stroke="var(--pf-primary)"
                      strokeWidth={2.5}
                      dot
                    />
                  </LineChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>
        </section>
      ) : null}

      <div className={`flex flex-col gap-3 lg:flex-row lg:flex-wrap lg:items-end ${cardCls}`}>
        <div className="min-w-[10rem] flex-1">
          <PremiumSelect
            label="Type"
            labelClassName="text-[11px] font-bold uppercase tracking-wide text-[var(--pf-text-muted)]"
            className="w-full"
            value={filterType}
            onChange={setFilterType}
            options={[
              { value: 'ALL', label: 'All types' },
              ...ASSET_TYPES.map((t) => ({ value: t.value, label: t.label })),
            ]}
          />
        </div>
        <div className="min-w-[10rem] flex-1">
          <PremiumSelect
            label="Location"
            labelClassName="text-[11px] font-bold uppercase tracking-wide text-[var(--pf-text-muted)]"
            className="w-full"
            placeholder="All locations"
            value={filterLocation}
            onChange={setFilterLocation}
            options={[
              { value: '', label: 'All locations' },
              ...locationOptions.map((loc) => ({ value: loc, label: loc })),
            ]}
            searchable={locationOptions.length > 6}
          />
        </div>
        <div className="min-w-[12rem] flex-[2]">
          <label className="text-[11px] font-bold uppercase tracking-wide text-[var(--pf-text-muted)]">Search</label>
          <input
            className={`${inputCls} mt-1 w-full`}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Asset name…"
          />
        </div>
      </div>

      {loading ? (
        <div className={`${cardCls} py-16 text-center text-[var(--pf-text-muted)]`}>Loading…</div>
      ) : rows.length === 0 ? (
        <div
          className={`${cardCls} flex flex-col items-center justify-center px-6 py-16 text-center`}
          role="status"
        >
          <div className="flex h-20 w-20 items-center justify-center rounded-3xl bg-amber-500/15 text-amber-600 dark:text-amber-300">
            <BuildingOffice2Icon className="h-10 w-10" aria-hidden />
          </div>
          <h2 className="mt-6 text-lg font-bold text-[var(--pf-text)]">
            {hasActiveFilters ? 'No assets match your filters' : 'No assets yet'}
          </h2>
          <p className="mt-2 max-w-md text-sm text-[var(--pf-text-muted)]">
            {hasActiveFilters
              ? 'Try clearing type, location, or search.'
              : 'Track your house, gold, vehicles, land, and equipment to see allocation, depreciation, and equity vs linked loans in your net worth.'}
          </p>
          {!hasActiveFilters ? (
            <button type="button" onClick={openAdd} className={`${btnPrimary} mt-8 inline-flex items-center gap-2`}>
              <PlusIcon className="h-5 w-5" />
              Add your first asset
            </button>
          ) : null}
        </div>
      ) : (
        <>
          <section className="space-y-10" aria-label="Asset cards">
            {groupedRows.map((g) => (
              <div key={g.key}>
                <h2 className="text-xs font-bold uppercase tracking-[0.16em] text-[var(--pf-text-muted)]">{g.label}</h2>
                <div className="mt-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                  {g.items.map((r) => {
                    const ap = appreciationPct(r)
                    const loan = linkedOutstandingForAsset(r)
                    const eq = equityForAsset(r)
                    const apCls =
                      ap == null
                        ? 'text-[var(--pf-text-muted)]'
                        : ap >= 0
                          ? 'text-emerald-600 dark:text-emerald-400'
                          : 'text-red-600 dark:text-red-400'
                    return (
                      <div
                        key={r.id}
                        className={`rounded-2xl border p-5 backdrop-blur-md transition hover:-translate-y-0.5 hover:shadow-lg ${assetCardShell(r)}`}
                      >
                        <div className="flex items-start gap-3">
                          <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-white/80 text-amber-800 shadow-sm dark:bg-white/10 dark:text-amber-200">
                            {assetTypeIcon(r.asset_type)}
                          </span>
                          <div className="min-w-0 flex-1">
                            <h3 className="font-bold text-[var(--pf-text)]">{r.asset_name}</h3>
                            <p className="text-xs text-[var(--pf-text-muted)]">
                              {[typeLabel(r.asset_type), r.location].filter(Boolean).join(' · ') || '—'}
                            </p>
                            {r.linked_liability_id ? (
                              <span className="mt-2 inline-flex rounded-full border border-sky-400/40 bg-sky-500/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-sky-200">
                                Loan: {r.linked_liability_name || `#${r.linked_liability_id}`}
                              </span>
                            ) : null}
                          </div>
                        </div>
                        <dl className="mt-4 space-y-2 text-sm">
                          <div className="flex justify-between gap-2">
                            <dt className="text-[var(--pf-text-muted)]">Purchase</dt>
                            <dd className="font-mono font-semibold tabular-nums text-[var(--pf-text)]">
                              {formatInr(r.purchase_value)}
                            </dd>
                          </div>
                          <div className="flex justify-between gap-2">
                            <dt className="text-[var(--pf-text-muted)]">Current (book)</dt>
                            <dd className="font-mono font-bold tabular-nums text-emerald-600 dark:text-emerald-400">
                              {formatInr(r.effective_current_value)}
                            </dd>
                          </div>
                          {r.linked_liability_id ? (
                            <>
                              <div className="flex justify-between gap-2 text-xs">
                                <dt className="text-[var(--pf-text-muted)]">Loan outstanding</dt>
                                <dd className="font-mono tabular-nums text-sky-600 dark:text-sky-300">{formatInr(loan)}</dd>
                              </div>
                              <div className="flex justify-between gap-2 border-t border-[var(--pf-border)]/50 pt-2">
                                <dt className="font-medium text-[var(--pf-text)]">Your equity</dt>
                                <dd className="font-mono font-bold tabular-nums text-[var(--pf-text)]">{formatInr(eq)}</dd>
                              </div>
                            </>
                          ) : null}
                          <div className={`flex justify-between gap-2 pt-1 text-sm ${apCls}`}>
                            <dt className="font-medium">{ap != null && ap >= 0 ? 'Appreciation' : 'vs purchase'}</dt>
                            <dd className="font-mono font-semibold tabular-nums">
                              {ap == null
                                ? '—'
                                : `${ap >= 0 ? '+' : ''}${ap.toFixed(1)}%`}
                            </dd>
                          </div>
                        </dl>
                        <div className="mt-5 flex flex-wrap gap-2 border-t border-[var(--pf-border)]/60 pt-4">
                          <button type="button" className={`${btnSecondary} flex-1 justify-center px-3 py-2 text-xs`} onClick={() => openView(r.id)}>
                            View
                          </button>
                          <button type="button" className={`${btnSecondary} flex-1 justify-center px-3 py-2 text-xs`} onClick={() => openEdit(r)}>
                            Edit
                          </button>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            ))}
          </section>

          <div className={cardCls}>
            <h2 className="text-base font-bold text-[var(--pf-text)]">All assets</h2>
            <p className="mt-1 text-sm text-[var(--pf-text-muted)]">Register view — sortable scan of every holding.</p>
            <div className={`${pfTableWrap} mt-4`}>
              <table className={`${pfTable} min-w-[960px]`}>
                <thead>
                  <tr>
                    <th className={pfTh}>Name</th>
                    <th className={pfTh}>Type</th>
                    <th className={pfTh}>Location</th>
                    <th className={pfThRight}>Purchase</th>
                    <th className={pfThRight}>Effective</th>
                    <th className={pfThRight}>vs cost</th>
                    <th className={pfThRight}>Loan</th>
                    <th className={pfThRight}>Equity</th>
                    <th className={pfThRight}>Linked</th>
                    <th className={pfThRight}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => {
                    const ap = appreciationPct(r)
                    const loan = linkedOutstandingForAsset(r)
                    const eq = equityForAsset(r)
                    const diff = num(r.effective_current_value) - num(r.purchase_value)
                    const diffCls =
                      diff > 0.01
                        ? 'text-emerald-600 dark:text-emerald-400'
                        : diff < -0.01
                          ? 'text-red-600 dark:text-red-400'
                          : ''
                    return (
                      <tr key={r.id} className={pfTrHover}>
                        <td className={`${pfTd} font-bold text-[var(--pf-text)]`}>{r.asset_name}</td>
                        <td className={pfTd}>{typeLabel(r.asset_type)}</td>
                        <td className={`${pfTd} text-[var(--pf-text-muted)]`}>{r.location ?? '—'}</td>
                        <td className={`${pfTdRight} font-mono tabular-nums`}>{formatInr(r.purchase_value)}</td>
                        <td className={`${pfTdRight} font-mono font-semibold tabular-nums`}>
                          {formatInr(r.effective_current_value)}
                        </td>
                        <td className={`${pfTdRight} font-mono text-sm tabular-nums ${diffCls}`}>
                          {ap == null ? '—' : `${ap >= 0 ? '+' : ''}${ap.toFixed(1)}%`}
                        </td>
                        <td className={`${pfTdRight} font-mono tabular-nums text-sky-600 dark:text-sky-300`}>
                          {loan > 0 ? formatInr(loan) : '—'}
                        </td>
                        <td className={`${pfTdRight} font-mono font-medium tabular-nums`}>
                          {r.linked_liability_id ? formatInr(eq) : '—'}
                        </td>
                        <td className={`${pfTdRight} text-xs`}>{r.linked_liability_name ?? '—'}</td>
                        <td className={pfTdActions}>
                          <div className={pfActionRow}>
                            <button
                              type="button"
                              className={`${btnSecondary} px-2.5 py-1.5 text-xs`}
                              onClick={() => openView(r.id)}
                            >
                              View
                            </button>
                            <button type="button" className={`${btnSecondary} px-2.5 py-1.5 text-xs`} onClick={() => openEdit(r)}>
                              Edit
                            </button>
                            <button type="button" className={`${btnDanger} px-2.5 py-1.5 text-xs`} onClick={() => handleDelete(r)}>
                              Delete
                            </button>
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      <AppModal
        open={showAddModal}
        onClose={() => !submitting && setShowAddModal(false)}
        title={editId ? 'Edit asset' : 'Add asset'}
        subtitle="Grouped like a wealth manager — book value preview follows your depreciation rule."
        maxWidthClass="max-w-2xl"
        footer={
          <>
            <AppButton type="button" variant="ghost" disabled={submitting} onClick={() => setShowAddModal(false)}>
              Cancel
            </AppButton>
            <AppButton type="submit" variant="primary" disabled={submitting} form="pf-asset-form">
              {submitting ? 'Saving…' : editId ? 'Save changes' : 'Save asset'}
            </AppButton>
          </>
        }
      >
        <form id="pf-asset-form" onSubmit={handleSave} className="space-y-6">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-[var(--pf-text-muted)]">Asset info</p>
            <div className="mt-3 grid gap-4 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <label htmlFor="ast-na" className={labelCls}>
                  Asset name
                </label>
                <input
                  id="ast-na"
                  className={inputCls}
                  value={form.asset_name}
                  onChange={(e) => setForm((f) => ({ ...f, asset_name: e.target.value }))}
                  required
                />
              </div>
              <div>
                <PremiumSelect
                  id="ast-tp"
                  label="Type"
                  labelClassName={labelCls}
                  value={form.asset_type}
                  onChange={(v) => setForm((f) => ({ ...f, asset_type: v }))}
                  options={ASSET_TYPES.map((t) => ({ value: t.value, label: t.label }))}
                />
              </div>
              <div>
                <label htmlFor="ast-lo" className={labelCls}>
                  Location
                </label>
                <input
                  id="ast-lo"
                  className={inputCls}
                  value={form.location}
                  onChange={(e) => setForm((f) => ({ ...f, location: e.target.value }))}
                  placeholder="City / address"
                />
              </div>
            </div>
          </div>

          <div className="border-t border-[var(--pf-border)] pt-5">
            <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-[var(--pf-text-muted)]">Value</p>
            <div className="mt-3 grid gap-4 sm:grid-cols-2">
              <div>
                <label htmlFor="ast-pv" className={labelCls}>
                  Purchase value (₹)
                </label>
                <input
                  id="ast-pv"
                  type="number"
                  min="0"
                  step="0.01"
                  className={`${inputCls} font-mono tabular-nums`}
                  value={form.purchase_value}
                  onChange={(e) => setForm((f) => ({ ...f, purchase_value: e.target.value }))}
                  required
                />
              </div>
              <div>
                <label htmlFor="ast-cv" className={labelCls}>
                  Current value (₹)
                </label>
                <input
                  id="ast-cv"
                  type="number"
                  min="0"
                  step="0.01"
                  className={`${inputCls} font-mono tabular-nums`}
                  value={form.current_value}
                  onChange={(e) => setForm((f) => ({ ...f, current_value: e.target.value }))}
                  placeholder="Optional if using depreciation %"
                />
              </div>
              <div className="sm:col-span-2">
                <label htmlFor="ast-dr" className={labelCls}>
                  Depreciation % / year
                </label>
                <input
                  id="ast-dr"
                  type="number"
                  min="0"
                  max="100"
                  step="0.01"
                  className={inputCls}
                  value={form.depreciation_rate}
                  placeholder="Optional — straight-line from purchase date"
                  onChange={(e) => setForm((f) => ({ ...f, depreciation_rate: e.target.value }))}
                />
              </div>
            </div>
            <div className="mt-4 rounded-xl border border-[var(--pf-border)] bg-white/[0.04] px-4 py-3 dark:bg-white/[0.05]">
              <p className="text-[11px] font-bold uppercase tracking-wide text-[var(--pf-text-muted)]">Estimated book value</p>
              <p className="mt-1 font-mono text-lg font-bold tabular-nums text-emerald-600 dark:text-emerald-400">
                {formatInr(formPreviewEffective)}
              </p>
              <p className="mt-1 text-[10px] text-[var(--pf-text-muted)]">
                Matches server rule: with depreciation % and purchase date, value = purchase − (rate × years × purchase); otherwise
                uses current value or purchase.
              </p>
            </div>
          </div>

          <div className="border-t border-[var(--pf-border)] pt-5">
            <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-[var(--pf-text-muted)]">Dates</p>
            <div className="mt-3">
              <label htmlFor="ast-pd" className={labelCls}>
                Purchase date
              </label>
              <input
                id="ast-pd"
                type="date"
                className={inputCls}
                value={form.purchase_date}
                onChange={(e) => setForm((f) => ({ ...f, purchase_date: e.target.value }))}
              />
            </div>
          </div>

          <div className="border-t border-[var(--pf-border)] pt-5">
            <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-[var(--pf-text-muted)]">Loan</p>
            <div className="mt-3">
              <PremiumSelect
                id="ast-ll"
                label="Linked liability"
                labelClassName={labelCls}
                placeholder="None"
                value={form.linked_liability_id}
                onChange={(v) => setForm((f) => ({ ...f, linked_liability_id: v }))}
                options={[
                  { value: '', label: 'None' },
                  ...liabilities.map((ln) => ({
                    value: String(ln.id),
                    label: `${ln.liability_name} · ${formatInr(ln.outstanding_amount)} outst.`,
                  })),
                ]}
                searchable={liabilities.length > 6}
              />
            </div>
          </div>

          <div className="border-t border-[var(--pf-border)] pt-5">
            <label htmlFor="ast-no" className={labelCls}>
              Notes
            </label>
            <textarea
              id="ast-no"
              rows={3}
              className={`${inputCls} resize-y`}
              value={form.notes}
              onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
            />
          </div>
        </form>
      </AppModal>

      {viewId ? (
        <div className={pfModalOverlay} role="dialog" aria-modal="true">
          <div className={`${pfModalSurface} max-h-[92vh] max-w-lg p-5 md:p-6`}>
            <div className={pfModalHeader}>
              <h2 className="text-lg font-semibold text-[var(--pf-text)]">Asset details</h2>
              <button
                type="button"
                className={pfModalCloseBtn}
                onClick={() => {
                  setViewId(null)
                  setViewRow(null)
                }}
                aria-label="Close"
              >
                <XMarkIcon className="h-6 w-6" />
              </button>
            </div>
            {!viewRow ? (
              <p className="mt-4 text-[var(--pf-text-muted)]">Loading…</p>
            ) : (
              <>
                <p className="mt-1 text-xl font-bold text-[var(--pf-text)]">{viewRow.asset_name}</p>
                <p className="text-sm text-[var(--pf-text-muted)]">{typeLabel(viewRow.asset_type)}</p>
                {viewRow.linked_liability_id ? (
                  <div className="mt-4 rounded-xl border border-sky-500/30 bg-sky-500/[0.06] p-4 text-sm">
                    <p className="text-[11px] font-bold uppercase tracking-wide text-sky-800 dark:text-sky-200">
                      Equity snapshot
                    </p>
                    <dl className="mt-2 space-y-1">
                      <div className="flex justify-between gap-2">
                        <dt className="text-[var(--pf-text-muted)]">Asset (book)</dt>
                        <dd className="font-mono font-semibold">{formatInr(viewRow.effective_current_value)}</dd>
                      </div>
                      <div className="flex justify-between gap-2">
                        <dt className="text-[var(--pf-text-muted)]">Loan outstanding</dt>
                        <dd className="font-mono">{formatInr(linkedOutstandingForAsset(viewRow))}</dd>
                      </div>
                      <div className="flex justify-between gap-2 border-t border-[var(--pf-border)]/50 pt-2 font-bold">
                        <dt>Your equity</dt>
                        <dd className="font-mono">{formatInr(equityForAsset(viewRow))}</dd>
                      </div>
                    </dl>
                  </div>
                ) : null}
                <dl className="mt-4 space-y-2 text-sm">
                  <div className="flex justify-between gap-2 border-b border-[var(--pf-border)] pb-2">
                    <dt className="text-[var(--pf-text-muted)]">Purchase value</dt>
                    <dd className="font-medium tabular-nums">{formatInr(viewRow.purchase_value)}</dd>
                  </div>
                  <div className="flex justify-between gap-2 border-b border-[var(--pf-border)] pb-2">
                    <dt className="text-[var(--pf-text-muted)]">Stored current value</dt>
                    <dd className="font-medium tabular-nums">{formatInr(viewRow.current_value)}</dd>
                  </div>
                  <div className="flex justify-between gap-2 border-b border-[var(--pf-border)] pb-2">
                    <dt className="text-[var(--pf-text-muted)]">Effective current value</dt>
                    <dd className="font-bold tabular-nums text-emerald-600 dark:text-emerald-400">
                      {formatInr(viewRow.effective_current_value)}
                    </dd>
                  </div>
                  <div className="flex justify-between gap-2 border-b border-[var(--pf-border)] pb-2">
                    <dt className="text-[var(--pf-text-muted)]">Book depreciation</dt>
                    <dd className="tabular-nums">{formatInr(viewRow.book_depreciation)}</dd>
                  </div>
                  <div className="flex justify-between gap-2 border-b border-[var(--pf-border)] pb-2">
                    <dt className="text-[var(--pf-text-muted)]">Depreciation</dt>
                    <dd>
                      {viewRow.depreciation_rate != null && Number(viewRow.depreciation_rate) > 0
                        ? `${Number(viewRow.depreciation_rate)}%/yr · ${viewRow.depreciation_years} yrs`
                        : '—'}
                    </dd>
                  </div>
                  <div className="flex justify-between gap-2 border-b border-[var(--pf-border)] pb-2">
                    <dt className="text-[var(--pf-text-muted)]">Purchase date</dt>
                    <dd>{formatShortDate(viewRow.purchase_date)}</dd>
                  </div>
                  <div className="flex justify-between gap-2 border-b border-[var(--pf-border)] pb-2">
                    <dt className="text-[var(--pf-text-muted)]">Location</dt>
                    <dd className="text-right">{viewRow.location || '—'}</dd>
                  </div>
                  <div className="flex justify-between gap-2 border-b border-[var(--pf-border)] pb-2">
                    <dt className="text-[var(--pf-text-muted)]">Linked liability</dt>
                    <dd className="text-right">{viewRow.linked_liability_name || '—'}</dd>
                  </div>
                  <div className="pt-1">
                    <dt className="text-[var(--pf-text-muted)]">Notes</dt>
                    <dd className="mt-1 text-[var(--pf-text)]">{viewRow.notes || '—'}</dd>
                  </div>
                </dl>
                <div className="mt-4 flex flex-wrap gap-2">
                  <PfExportMenu
                    busy={assetStmtBusy}
                    items={[
                      { key: 'x', label: 'Export Excel', onClick: () => downloadAssetStatement('xlsx') },
                      { key: 'p', label: 'Export PDF', onClick: () => downloadAssetStatement('pdf') },
                    ]}
                  />
                  <button type="button" className={btnSecondary} onClick={() => openEdit(viewRow)}>
                    Edit
                  </button>
                  <button type="button" className={btnDanger} onClick={() => handleDelete(viewRow)}>
                    Delete
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      ) : null}

      {showChitModal ? (
        <AppModal
          open={showChitModal}
          onClose={() => !chitSubmitting && setShowChitModal(false)}
          maxWidthClass="max-w-2xl"
          title={chitEditId ? 'Edit chit fund' : 'Add chit fund'}
          footer={
            <>
              <button type="button" className={btnSecondary} disabled={chitSubmitting} onClick={() => setShowChitModal(false)}>
                Cancel
              </button>
              <AppButton type="submit" variant="primary" disabled={chitSubmitting} form="pf-chit-form">
                {chitSubmitting ? 'Saving…' : 'Save'}
              </AppButton>
            </>
          }
        >
          <form id="pf-chit-form" onSubmit={handleChitSave} className="grid max-h-[70vh] gap-4 overflow-y-auto sm:grid-cols-2">
            <div className="sm:col-span-2">
              <label className={labelCls} htmlFor="cf-name">
                Chit name
              </label>
              <input
                id="cf-name"
                className={inputCls}
                value={chitForm.chit_name}
                onChange={(e) => setChitForm((f) => ({ ...f, chit_name: e.target.value }))}
                required
              />
            </div>
            <div>
              <label className={labelCls} htmlFor="cf-tv">
                Total chit value (₹)
              </label>
              <input
                id="cf-tv"
                type="number"
                min="0"
                step="0.01"
                className={inputCls}
                value={chitForm.total_value}
                onChange={(e) => setChitForm((f) => ({ ...f, total_value: e.target.value }))}
              />
            </div>
            <div>
              <label className={labelCls} htmlFor="cf-mo">
                Monthly contribution (₹)
              </label>
              <input
                id="cf-mo"
                type="number"
                min="0"
                step="0.01"
                className={inputCls}
                value={chitForm.monthly_amount}
                onChange={(e) => setChitForm((f) => ({ ...f, monthly_amount: e.target.value }))}
              />
            </div>
            <div>
              <label className={labelCls} htmlFor="cf-sd">
                Start date
              </label>
              <input
                id="cf-sd"
                type="date"
                className={inputCls}
                value={chitForm.start_date}
                onChange={(e) => setChitForm((f) => ({ ...f, start_date: e.target.value }))}
                required
              />
            </div>
            <div>
              <label className={labelCls} htmlFor="cf-dur">
                Duration (months)
              </label>
              <input
                id="cf-dur"
                type="number"
                min="0"
                className={inputCls}
                value={chitForm.duration_months}
                onChange={(e) => setChitForm((f) => ({ ...f, duration_months: e.target.value }))}
              />
            </div>
            <div className="sm:col-span-2 rounded-xl border border-[var(--pf-border)] bg-black/[0.02] p-3 dark:bg-white/[0.02]">
              <p className="text-[11px] font-bold uppercase tracking-wider text-[var(--pf-text-muted)]">
                Calculated (read-only)
              </p>
              <dl className="mt-2 grid grid-cols-2 gap-2 text-xs sm:grid-cols-3">
                <div>
                  <dt className="text-[var(--pf-text-muted)]">Total paid</dt>
                  <dd className="font-mono font-semibold tabular-nums text-[var(--pf-text)]">
                    {formatInr(chitCalcPreview.totalPaid)}
                  </dd>
                </div>
                <div>
                  <dt className="text-[var(--pf-text-muted)]">Months paid</dt>
                  <dd className="font-mono font-semibold tabular-nums text-[var(--pf-text)]">{chitCalcPreview.monthsPaid}</dd>
                </div>
                <div>
                  <dt className="text-[var(--pf-text-muted)]">Remaining months</dt>
                  <dd className="font-mono font-semibold tabular-nums text-[var(--pf-text)]">
                    {chitCalcPreview.remainingMonths}
                  </dd>
                </div>
                <div>
                  <dt className="text-[var(--pf-text-muted)]">Book asset value</dt>
                  <dd className="font-mono font-semibold tabular-nums text-[var(--pf-text)]">
                    {formatInr(chitCalcPreview.assetValue)}
                  </dd>
                </div>
                {chitForm.auction_taken ? (
                  <>
                    <div>
                      <dt className="text-[var(--pf-text-muted)]">Discount (auto)</dt>
                      <dd className="font-mono font-semibold tabular-nums text-[var(--pf-text)]">
                        {formatInr(chitCalcPreview.discountAuto)}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-[var(--pf-text-muted)]">Remaining payable</dt>
                      <dd className="font-mono font-semibold tabular-nums text-[var(--pf-text)]">
                        {formatInr(chitCalcPreview.remainingPayable)}
                      </dd>
                    </div>
                    <div className="sm:col-span-2">
                      <dt className="text-[var(--pf-text-muted)]">Net P/L (div − comm − discount)</dt>
                      <dd className="font-mono font-semibold tabular-nums text-[var(--pf-text)]">
                        {formatInr(chitCalcPreview.netProfit)}
                      </dd>
                    </div>
                  </>
                ) : null}
              </dl>
            </div>
            <div className="sm:col-span-2 flex items-center gap-2">
              <input
                id="cf-auc"
                type="checkbox"
                checked={chitForm.auction_taken}
                onChange={(e) => setChitForm((f) => ({ ...f, auction_taken: e.target.checked }))}
              />
              <label htmlFor="cf-auc" className="text-sm text-[var(--pf-text)]">
                Auction taken?
              </label>
            </div>
            {chitForm.auction_taken ? (
              <>
                <div>
                  <label className={labelCls} htmlFor="cf-am">
                    Auction month (1…duration)
                  </label>
                  <input
                    id="cf-am"
                    type="number"
                    min="1"
                    className={inputCls}
                    value={chitForm.auction_month}
                    onChange={(e) => setChitForm((f) => ({ ...f, auction_month: e.target.value }))}
                  />
                </div>
                <div>
                  <label className={labelCls} htmlFor="cf-ar">
                    Amount received (₹)
                  </label>
                  <input
                    id="cf-ar"
                    type="number"
                    min="0"
                    step="0.01"
                    className={inputCls}
                    value={chitForm.amount_received}
                    onChange={(e) => setChitForm((f) => ({ ...f, amount_received: e.target.value }))}
                  />
                </div>
                <div>
                  <label className={labelCls} htmlFor="cf-abd">
                    Auction booking date
                  </label>
                  <input
                    id="cf-abd"
                    type="date"
                    className={inputCls}
                    value={chitForm.auction_booking_date || chitForm.start_date}
                    onChange={(e) => setChitForm((f) => ({ ...f, auction_booking_date: e.target.value }))}
                  />
                </div>
                <div className="sm:col-span-2">
                  <PremiumSelect
                    id="cf-auc-acc"
                    label="Bank account for auction receipt (optional)"
                    labelClassName={labelCls}
                    value={chitForm.auction_receipt_finance_account_id}
                    onChange={(v) => setChitForm((f) => ({ ...f, auction_receipt_finance_account_id: v }))}
                    options={accounts.map((a) => ({
                      value: String(a.id),
                      label: `${a.account_name ?? 'Account'}${a.account_type ? ` · ${a.account_type}` : ''}`,
                    }))}
                  />
                  <p className="mt-1 text-[10px] text-[var(--pf-text-muted)]">
                    If set when you first save auction details, we credit this account for the amount received and book the
                    discount loss. You can leave blank and record cash manually.
                  </p>
                </div>
              </>
            ) : null}
            <div>
              <label className={labelCls} htmlFor="cf-fc">
                Foreman commission recorded (₹ total)
              </label>
              <input
                id="cf-fc"
                type="number"
                min="0"
                step="0.01"
                className={inputCls}
                value={chitForm.foreman_commission}
                onChange={(e) => setChitForm((f) => ({ ...f, foreman_commission: e.target.value }))}
              />
            </div>
            <div>
              <label className={labelCls} htmlFor="cf-div">
                Dividend received (₹ total)
              </label>
              <input
                id="cf-div"
                type="number"
                min="0"
                step="0.01"
                className={inputCls}
                value={chitForm.dividend_received}
                onChange={(e) => setChitForm((f) => ({ ...f, dividend_received: e.target.value }))}
              />
            </div>
            <div className="sm:col-span-2">
              <PremiumSelect
                id="cf-st"
                label="Status"
                labelClassName={labelCls}
                value={chitForm.status}
                onChange={(v) => setChitForm((f) => ({ ...f, status: v }))}
                options={[
                  { value: 'RUNNING', label: 'Running' },
                  { value: 'COMPLETED', label: 'Completed' },
                ]}
              />
            </div>
            <div className="sm:col-span-2">
              <label className={labelCls} htmlFor="cf-no">
                Notes
              </label>
              <textarea
                id="cf-no"
                rows={2}
                className={`${inputCls} resize-y`}
                value={chitForm.notes}
                onChange={(e) => setChitForm((f) => ({ ...f, notes: e.target.value }))}
              />
            </div>
          </form>
        </AppModal>
      ) : null}

      {chitLedgerKind ? (
        <AppModal
          open={Boolean(chitLedgerKind)}
          onClose={() => {
            if (!chitLedgerBusy) {
              setChitLedgerKind(null)
              setChitLedgerChitId(null)
            }
          }}
          maxWidthClass="max-w-md"
          title={
            chitLedgerKind === 'contribution'
              ? chitLedgerTarget?.auction_taken
                ? 'Pay chit installment (liability)'
                : 'Record chit contribution (asset)'
              : chitLedgerKind === 'dividend'
                ? 'Record chit dividend'
                : 'Record foreman commission'
          }
          footer={
            <>
              <button
                type="button"
                className={btnSecondary}
                disabled={chitLedgerBusy}
                onClick={() => {
                  setChitLedgerKind(null)
                  setChitLedgerChitId(null)
                }}
              >
                Cancel
              </button>
              <AppButton type="submit" variant="primary" disabled={chitLedgerBusy} form="pf-chit-ledger-form">
                {chitLedgerBusy ? 'Saving…' : 'Save'}
              </AppButton>
            </>
          }
        >
          <form id="pf-chit-ledger-form" onSubmit={submitChitLedger} className="space-y-4">
            <div>
              <label className={labelCls} htmlFor="cl-d">
                Date
              </label>
              <input
                id="cl-d"
                type="date"
                className={inputCls}
                value={chitLedgerDate}
                onChange={(e) => setChitLedgerDate(e.target.value)}
                required
              />
            </div>
            <div>
              <label className={labelCls} htmlFor="cl-a">
                Amount (₹)
              </label>
              <input
                id="cl-a"
                type="number"
                min="0"
                step="0.01"
                className={inputCls}
                value={chitLedgerAmount}
                onChange={(e) => setChitLedgerAmount(e.target.value)}
                required
              />
            </div>
            {chitLedgerKind === 'contribution' ? (
              <div>
                <PremiumSelect
                  id="cl-m"
                  label="Payment mode"
                  labelClassName={labelCls}
                  value={chitLedgerMode}
                  onChange={(v) => setChitLedgerMode(v)}
                  options={[
                    { value: 'BANK', label: 'Bank' },
                    { value: 'CASH', label: 'Cash' },
                  ]}
                />
              </div>
            ) : null}
            {(chitLedgerKind !== 'contribution' || chitLedgerMode === 'BANK' || chitLedgerMode === 'CASH') && (
              <div>
                <PremiumSelect
                  id="cl-acc"
                  label={
                    chitLedgerKind === 'contribution' && chitLedgerMode === 'CASH'
                      ? 'Pay from account'
                      : 'Bank account'
                  }
                  labelClassName={labelCls}
                  value={chitLedgerAccountId}
                  onChange={(v) => setChitLedgerAccountId(v)}
                  options={accounts.map((a) => ({ value: String(a.id), label: a.account_name }))}
                />
                {chitLedgerKind === 'contribution' && chitLedgerMode === 'CASH' && accounts.length > 1 ? (
                  <p className="mt-1 text-[10px] text-[var(--pf-text-muted)]">
                    Required when you have multiple accounts — picks the wallet or bank this cash payment hits.
                  </p>
                ) : null}
              </div>
            )}
          </form>
        </AppModal>
      ) : null}
    </div>
  )
}
