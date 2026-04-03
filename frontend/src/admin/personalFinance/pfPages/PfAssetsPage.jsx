import {
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
  createFinanceAsset,
  deleteFinanceAsset,
  getFinanceAsset,
  getAssetsSummary,
  listFinanceAssets,
  listFinanceLiabilities,
  patchFinanceAsset,
  pfFetchBlob,
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
  pfSelectCompact,
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
      const [list, sum] = await Promise.all([listFinanceAssets(queryParams), getAssetsSummary()])
      setRows(Array.isArray(list) ? list : [])
      setSummary(sum || null)
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

      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5" aria-label="Asset summary">
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
          <label className="text-[11px] font-bold uppercase tracking-wide text-[var(--pf-text-muted)]">Type</label>
          <select
            className={`${pfSelectCompact} mt-1 w-full`}
            value={filterType}
            onChange={(e) => setFilterType(e.target.value)}
          >
            <option value="ALL">All types</option>
            {ASSET_TYPES.map((t) => (
              <option key={t.value} value={t.value}>
                {t.label}
              </option>
            ))}
          </select>
        </div>
        <div className="min-w-[10rem] flex-1">
          <label className="text-[11px] font-bold uppercase tracking-wide text-[var(--pf-text-muted)]">Location</label>
          <select
            className={`${pfSelectCompact} mt-1 w-full`}
            value={filterLocation}
            onChange={(e) => setFilterLocation(e.target.value)}
          >
            <option value="">All locations</option>
            {locationOptions.map((loc) => (
              <option key={loc} value={loc}>
                {loc}
              </option>
            ))}
          </select>
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
                <label htmlFor="ast-tp" className={labelCls}>
                  Type
                </label>
                <select
                  id="ast-tp"
                  className={inputCls}
                  value={form.asset_type}
                  onChange={(e) => setForm((f) => ({ ...f, asset_type: e.target.value }))}
                >
                  {ASSET_TYPES.map((t) => (
                    <option key={t.value} value={t.value}>
                      {t.label}
                    </option>
                  ))}
                </select>
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
              <label htmlFor="ast-ll" className={labelCls}>
                Linked liability
              </label>
              <select
                id="ast-ll"
                className={inputCls}
                value={form.linked_liability_id}
                onChange={(e) => setForm((f) => ({ ...f, linked_liability_id: e.target.value }))}
              >
                <option value="">None</option>
                {liabilities.map((ln) => (
                  <option key={ln.id} value={String(ln.id)}>
                    {ln.liability_name} · {formatInr(ln.outstanding_amount)} outst.
                  </option>
                ))}
              </select>
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
    </div>
  )
}
