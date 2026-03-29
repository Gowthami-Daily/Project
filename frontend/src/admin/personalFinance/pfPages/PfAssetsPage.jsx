import { BuildingOffice2Icon, PlusIcon, XMarkIcon } from '@heroicons/react/24/solid'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { useOutletContext } from 'react-router-dom'
import {
  createFinanceAsset,
  deleteFinanceAsset,
  getAssetsSummary,
  getFinanceAsset,
  listFinanceAssets,
  listFinanceLiabilities,
  patchFinanceAsset,
  pfFetchBlob,
  setPfToken,
  triggerDownloadBlob,
} from '../api.js'
import PfExportMenu from '../PfExportMenu.jsx'
import {
  btnDanger,
  btnPrimary,
  btnSecondary,
  cardCls,
  inputCls,
  labelCls,
  pfChartCard,
  pfModalCloseBtn,
  pfModalHeader,
  pfModalOverlay,
  pfModalSurface,
  pfSelectCompact,
} from '../pfFormStyles.js'
import { formatInr } from '../pfFormat.js'
import { usePfRefresh } from '../pfRefreshContext.jsx'

const ASSET_TYPES = [
  { value: 'PROPERTY_LAND', label: 'Property / Land' },
  { value: 'HOUSE', label: 'House' },
  { value: 'APARTMENT', label: 'Apartment' },
  { value: 'VEHICLE', label: 'Vehicle (car / bike)' },
  { value: 'GOLD_JEWELRY', label: 'Gold / Jewelry' },
  { value: 'EQUIPMENT_MACHINERY', label: 'Equipment / Machinery' },
  { value: 'FURNITURE', label: 'Furniture' },
  { value: 'ELECTRONICS', label: 'Electronics (laptop, mobile, etc.)' },
  { value: 'BUSINESS_ASSET', label: 'Business asset' },
  { value: 'OTHER', label: 'Other asset' },
]

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

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-slate-900 dark:text-slate-100 sm:text-2xl">Fixed assets</h1>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            Property, vehicles, gold, equipment — purchase cost, depreciation, and loans tied to the asset.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <PfExportMenu
            busy={assetExportBusy}
            items={[{ key: 'xlsx', label: 'Export Excel (all)', onClick: handleAssetsExport }]}
          />
          <button
            type="button"
            onClick={openAdd}
            className="inline-flex items-center gap-2 rounded-[12px] bg-[#1E3A8A] px-4 py-2.5 text-sm font-bold text-white shadow-sm transition hover:bg-[#172554] active:scale-[0.98]"
          >
            <PlusIcon className="h-5 w-5" aria-hidden />
            Add asset
          </button>
        </div>
      </div>

      {error ? (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-100">
          {error}
        </div>
      ) : null}

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4" aria-label="Asset summary">
        <div className={pfChartCard}>
          <p className="text-xs font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400">Total assets value</p>
          <p className="mt-1 text-xl font-bold tabular-nums text-slate-900 dark:text-slate-50">
            {formatInr(summary?.total_current_value)}
          </p>
          <p className="mt-0.5 text-[11px] text-slate-500 dark:text-slate-400">Effective (after depreciation rules)</p>
        </div>
        <div className={pfChartCard}>
          <p className="text-xs font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400">Total purchase value</p>
          <p className="mt-1 text-xl font-bold tabular-nums text-slate-900 dark:text-slate-50">
            {formatInr(summary?.total_purchase_value)}
          </p>
        </div>
        <div className={pfChartCard}>
          <p className="text-xs font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400">Total depreciation</p>
          <p className="mt-1 text-xl font-bold tabular-nums text-slate-900 dark:text-slate-50">
            {formatInr(summary?.total_depreciation)}
          </p>
        </div>
        <div className={pfChartCard}>
          <p className="text-xs font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400">Linked to loans</p>
          <p className="mt-1 text-xl font-bold tabular-nums text-slate-900 dark:text-slate-50">{summary?.linked_loan_count ?? '—'}</p>
          <p className="mt-0.5 text-[11px] text-slate-500 dark:text-slate-400">Assets with a liability link</p>
        </div>
      </section>

      <div className={`flex flex-col gap-3 lg:flex-row lg:flex-wrap lg:items-end ${cardCls}`}>
        <div className="min-w-[10rem] flex-1">
          <label className="text-[11px] font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400">Type</label>
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
          <label className="text-[11px] font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400">Location</label>
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
          <label className="text-[11px] font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400">Search</label>
          <input
            className={`${inputCls} mt-1 w-full`}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Asset name…"
          />
        </div>
      </div>

      {loading ? (
        <div className={`${cardCls} py-12 text-center text-slate-500`}>Loading…</div>
      ) : rows.length === 0 ? (
        <div className={`${cardCls} py-12 text-center text-slate-500`}>No assets match your filters.</div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {rows.map((r) => (
            <div
              key={r.id}
              className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-900/60"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-2">
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-amber-100 text-amber-800 dark:bg-amber-950/50 dark:text-amber-200">
                    <BuildingOffice2Icon className="h-5 w-5" />
                  </span>
                  <div>
                    <h3 className="font-bold text-slate-900 dark:text-slate-50">{r.asset_name}</h3>
                    <p className="text-xs text-slate-500 dark:text-slate-400">{typeLabel(r.asset_type)}</p>
                  </div>
                </div>
              </div>
              <dl className="mt-3 space-y-1.5 text-sm">
                <div className="flex justify-between gap-2">
                  <dt className="text-slate-500 dark:text-slate-400">Purchase</dt>
                  <dd className="font-medium tabular-nums text-slate-900 dark:text-slate-100">{formatInr(r.purchase_value)}</dd>
                </div>
                <div className="flex justify-between gap-2">
                  <dt className="text-slate-500 dark:text-slate-400">Current (effective)</dt>
                  <dd className="font-bold tabular-nums text-emerald-700 dark:text-emerald-400">{formatInr(r.effective_current_value)}</dd>
                </div>
                <div className="flex justify-between gap-2">
                  <dt className="text-slate-500 dark:text-slate-400">Purchase date</dt>
                  <dd className="text-slate-800 dark:text-slate-200">{formatShortDate(r.purchase_date)}</dd>
                </div>
                {r.depreciation_rate != null && Number(r.depreciation_rate) > 0 ? (
                  <div className="flex justify-between gap-2">
                    <dt className="text-slate-500 dark:text-slate-400">Depreciation</dt>
                    <dd className="text-slate-800 dark:text-slate-200">{Number(r.depreciation_rate)}%/year</dd>
                  </div>
                ) : null}
                <div className="flex justify-between gap-2">
                  <dt className="text-slate-500 dark:text-slate-400">Loan linked</dt>
                  <dd className="text-slate-800 dark:text-slate-200">{r.linked_liability_id ? 'Yes' : 'No'}</dd>
                </div>
              </dl>
              <div className="mt-4 flex flex-wrap gap-2">
                <button type="button" className={btnSecondary} onClick={() => openView(r.id)}>
                  View
                </button>
                <button type="button" className={btnSecondary} onClick={() => openEdit(r)}>
                  Edit
                </button>
                <button type="button" className={btnDanger} onClick={() => handleDelete(r)}>
                  Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {showAddModal ? (
        <div className={pfModalOverlay} role="dialog" aria-modal="true" aria-labelledby="ast-modal-title">
          <div className={`${pfModalSurface} max-h-[92vh] max-w-lg p-5 md:p-6`}>
            <div className={pfModalHeader}>
              <h2 id="ast-modal-title" className="text-lg font-semibold text-[var(--pf-text)]">
                {editId ? 'Edit asset' : 'Add asset'}
              </h2>
              <button
                type="button"
                className={pfModalCloseBtn}
                onClick={() => setShowAddModal(false)}
                aria-label="Close"
              >
                <XMarkIcon className="h-6 w-6" />
              </button>
            </div>
            <form onSubmit={handleSave} className="grid gap-4">
              <div>
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
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label htmlFor="ast-pv" className={labelCls}>
                    Purchase value (₹)
                  </label>
                  <input
                    id="ast-pv"
                    type="number"
                    min="0"
                    step="0.01"
                    className={inputCls}
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
                    className={inputCls}
                    value={form.current_value}
                    onChange={(e) => setForm((f) => ({ ...f, current_value: e.target.value }))}
                    placeholder="Defaults to purchase"
                  />
                </div>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
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
                <div>
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
                    placeholder="Optional"
                    onChange={(e) => setForm((f) => ({ ...f, depreciation_rate: e.target.value }))}
                  />
                </div>
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
              <div>
                <label htmlFor="ast-ll" className={labelCls}>
                  Linked loan (liability)
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
              <div>
                <label htmlFor="ast-no" className={labelCls}>
                  Notes
                </label>
                <textarea
                  id="ast-no"
                  rows={2}
                  className={`${inputCls} resize-y`}
                  value={form.notes}
                  onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
                />
              </div>
              <div className="flex flex-wrap gap-2 pt-2">
                <button type="submit" disabled={submitting} className={btnPrimary}>
                  {submitting ? 'Saving…' : editId ? 'Save changes' : 'Save asset'}
                </button>
                <button type="button" className={btnSecondary} onClick={() => setShowAddModal(false)}>
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}

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
                <dl className="mt-4 space-y-2 text-sm">
                  <div className="flex justify-between gap-2 border-b border-slate-100 pb-2 dark:border-slate-800">
                    <dt className="text-slate-500">Purchase value</dt>
                    <dd className="font-medium tabular-nums">{formatInr(viewRow.purchase_value)}</dd>
                  </div>
                  <div className="flex justify-between gap-2 border-b border-slate-100 pb-2 dark:border-slate-800">
                    <dt className="text-slate-500">Stored current value</dt>
                    <dd className="font-medium tabular-nums">{formatInr(viewRow.current_value)}</dd>
                  </div>
                  <div className="flex justify-between gap-2 border-b border-slate-100 pb-2 dark:border-slate-800">
                    <dt className="text-slate-500">Effective current value</dt>
                    <dd className="font-bold tabular-nums text-emerald-700 dark:text-emerald-400">
                      {formatInr(viewRow.effective_current_value)}
                    </dd>
                  </div>
                  <div className="flex justify-between gap-2 border-b border-slate-100 pb-2 dark:border-slate-800">
                    <dt className="text-slate-500">Book depreciation</dt>
                    <dd className="tabular-nums">{formatInr(viewRow.book_depreciation)}</dd>
                  </div>
                  <div className="flex justify-between gap-2 border-b border-slate-100 pb-2 dark:border-slate-800">
                    <dt className="text-slate-500">Depreciation</dt>
                    <dd>
                      {viewRow.depreciation_rate != null && Number(viewRow.depreciation_rate) > 0
                        ? `${Number(viewRow.depreciation_rate)}%/yr · ${viewRow.depreciation_years} yrs`
                        : '—'}
                    </dd>
                  </div>
                  <div className="flex justify-between gap-2 border-b border-slate-100 pb-2 dark:border-slate-800">
                    <dt className="text-slate-500">Purchase date</dt>
                    <dd>{formatShortDate(viewRow.purchase_date)}</dd>
                  </div>
                  <div className="flex justify-between gap-2 border-b border-slate-100 pb-2 dark:border-slate-800">
                    <dt className="text-slate-500">Location</dt>
                    <dd className="text-right">{viewRow.location || '—'}</dd>
                  </div>
                  <div className="flex justify-between gap-2 border-b border-slate-100 pb-2 dark:border-slate-800">
                    <dt className="text-slate-500">Linked liability</dt>
                    <dd className="text-right">{viewRow.linked_liability_name || '—'}</dd>
                  </div>
                  <div className="pt-1">
                    <dt className="text-slate-500">Notes</dt>
                    <dd className="mt-1 text-slate-800 dark:text-slate-200">{viewRow.notes || '—'}</dd>
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
