import { BanknotesIcon, PlusIcon, XMarkIcon } from '@heroicons/react/24/solid'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { useOutletContext } from 'react-router-dom'
import {
  closeFinanceLiability,
  createFinanceLiability,
  createLiabilityPayment,
  deleteFinanceLiability,
  getFinanceLiability,
  getLiabilitiesSummary,
  listFinanceAccounts,
  listFinanceLiabilities,
  listLiabilityPayments,
  patchFinanceLiability,
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
  pfModalSurfaceFit,
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

const LIABILITY_TYPES = [
  { value: 'CREDIT_CARD', label: 'Credit card' },
  { value: 'PERSONAL_LOAN_BORROWED', label: 'Personal loan (borrowed)' },
  { value: 'HOME_LOAN', label: 'Home loan' },
  { value: 'VEHICLE_LOAN', label: 'Vehicle loan' },
  { value: 'EMI_PURCHASE', label: 'EMI purchase' },
  { value: 'BNPL', label: 'BNPL (buy now pay later)' },
  { value: 'BORROWED_PERSON', label: 'Borrowed from person' },
  { value: 'BILLS_PAYABLE', label: 'Bills payable' },
  { value: 'OTHER', label: 'Other' },
]

function todayISODate() {
  return new Date().toISOString().slice(0, 10)
}

function formatShortDate(iso) {
  if (!iso) return '—'
  const d = new Date(`${String(iso).slice(0, 10)}T12:00:00`)
  if (Number.isNaN(d.getTime())) return iso
  return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })
}

function typeLabel(v) {
  return LIABILITY_TYPES.find((t) => t.value === v)?.label || v || '—'
}

function statusBadge(displayStatus) {
  const base =
    'inline-flex rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wide'
  if (displayStatus === 'OVERDUE') {
    return (
      <span className={`${base} border border-red-300 bg-red-100 text-red-900 dark:border-red-700 dark:bg-red-950/50 dark:text-red-200`}>
        Overdue
      </span>
    )
  }
  if (displayStatus === 'PAID' || displayStatus === 'CLOSED') {
    return (
      <span
        className={`${base} border border-slate-200 bg-slate-100 text-slate-700 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-300`}
      >
        {displayStatus === 'PAID' ? 'Paid' : 'Closed'}
      </span>
    )
  }
  return (
    <span className={`${base} border border-sky-200 bg-sky-50 text-sky-900 dark:border-sky-800 dark:bg-sky-950/40 dark:text-sky-200`}>
      Active
    </span>
  )
}

function emptyForm() {
  return {
    liability_name: '',
    liability_type: 'CREDIT_CARD',
    total_amount: '',
    outstanding_amount: '',
    interest_rate: '',
    minimum_due: '',
    installment_amount: '',
    due_date: '',
    billing_cycle_day: '',
    lender_name: '',
    notes: '',
    status: 'ACTIVE',
  }
}

export default function PfLiabilitiesPage() {
  const { onSessionInvalid } = useOutletContext() || {}
  const { tick, refresh } = usePfRefresh()
  const [rows, setRows] = useState([])
  const [summary, setSummary] = useState(null)
  const [accounts, setAccounts] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [filterType, setFilterType] = useState('ALL')
  const [filterStatus, setFilterStatus] = useState('ACTIVE')
  const [filterDueMonth, setFilterDueMonth] = useState(false)
  const [search, setSearch] = useState('')
  const [searchDebounced, setSearchDebounced] = useState('')

  const [showAddModal, setShowAddModal] = useState(false)
  const [editId, setEditId] = useState(null)
  const [form, setForm] = useState(emptyForm)
  const [submitting, setSubmitting] = useState(false)

  const [viewId, setViewId] = useState(null)
  const [viewRow, setViewRow] = useState(null)
  const [payments, setPayments] = useState([])
  const [detailLoading, setDetailLoading] = useState(false)
  const [exportBusy, setExportBusy] = useState(false)

  const [payId, setPayId] = useState(null)
  const [payDate, setPayDate] = useState(todayISODate)
  const [payAmount, setPayAmount] = useState('')
  const [payInterest, setPayInterest] = useState('')
  const [payMode, setPayMode] = useState('CASH')
  const [payAccountId, setPayAccountId] = useState('')
  const [payNotes, setPayNotes] = useState('')
  const [paySubmitting, setPaySubmitting] = useState(false)
  const [closingId, setClosingId] = useState(null)

  const queryParams = useMemo(
    () => ({
      liability_type: filterType === 'ALL' ? undefined : filterType,
      status: filterStatus === 'ALL' ? undefined : filterStatus,
      due_this_month: filterDueMonth || undefined,
      search: searchDebounced.trim() || undefined,
    }),
    [filterType, filterStatus, filterDueMonth, searchDebounced],
  )

  useEffect(() => {
    const t = window.setTimeout(() => setSearchDebounced(search), 350)
    return () => window.clearTimeout(t)
  }, [search])

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const [data, sum, acc] = await Promise.all([
        listFinanceLiabilities(queryParams),
        getLiabilitiesSummary().catch(() => null),
        listFinanceAccounts(),
      ])
      setRows(Array.isArray(data) ? data : [])
      setSummary(sum && typeof sum === 'object' ? sum : null)
      setAccounts(Array.isArray(acc) ? acc : [])
    } catch (e) {
      if (e.status === 401) {
        setPfToken(null)
        onSessionInvalid?.()
      } else {
        setError(e.message || 'Failed to load liabilities')
      }
    } finally {
      setLoading(false)
    }
  }, [onSessionInvalid, queryParams])

  useEffect(() => {
    load()
  }, [load, tick])

  useEffect(() => {
    if (!viewId) {
      setViewRow(null)
      setPayments([])
      return
    }
    let cancelled = false
    ;(async () => {
      setDetailLoading(true)
      try {
        const [ln, pay] = await Promise.all([getFinanceLiability(viewId), listLiabilityPayments(viewId)])
        if (!cancelled) {
          setViewRow(ln)
          setPayments(Array.isArray(pay) ? pay : [])
        }
      } catch (e) {
        if (!cancelled && e.status !== 401) setError(e.message || 'Failed to load liability')
      } finally {
        if (!cancelled) setDetailLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [viewId, tick])

  function openAdd() {
    setEditId(null)
    setForm(emptyForm())
    setShowAddModal(true)
  }

  function openEdit(r) {
    setEditId(r.id)
    setForm({
      liability_name: r.liability_name ?? '',
      liability_type: r.liability_type ?? 'OTHER',
      total_amount: String(r.total_amount ?? ''),
      outstanding_amount: String(r.outstanding_amount ?? ''),
      interest_rate: r.interest_rate != null ? String(r.interest_rate) : '',
      minimum_due: r.minimum_due != null ? String(r.minimum_due) : '',
      installment_amount: r.installment_amount != null ? String(r.installment_amount) : '',
      due_date: r.due_date ? String(r.due_date).slice(0, 10) : '',
      billing_cycle_day: r.billing_cycle_day != null ? String(r.billing_cycle_day) : '',
      lender_name: r.lender_name ?? '',
      notes: r.notes ?? '',
      status: r.status ?? 'ACTIVE',
    })
    setShowAddModal(true)
  }

  async function handleSaveForm(e) {
    e.preventDefault()
    setSubmitting(true)
    setError('')
    const body = {
      liability_name: form.liability_name.trim(),
      liability_type: form.liability_type,
      total_amount: Number(form.total_amount),
      outstanding_amount:
        form.outstanding_amount === '' ? undefined : Math.max(0, Number(form.outstanding_amount)),
      interest_rate: form.interest_rate === '' ? null : Number(form.interest_rate),
      minimum_due: form.minimum_due === '' ? null : Number(form.minimum_due),
      installment_amount: form.installment_amount === '' ? null : Number(form.installment_amount),
      due_date: form.due_date || null,
      billing_cycle_day:
        form.billing_cycle_day === '' || form.billing_cycle_day == null
          ? null
          : Math.min(31, Math.max(1, Number(form.billing_cycle_day))),
      lender_name: form.lender_name.trim() || null,
      notes: form.notes.trim() || null,
      status: form.status || 'ACTIVE',
    }
    try {
      if (editId) {
        await patchFinanceLiability(editId, body)
      } else {
        await createFinanceLiability(body)
      }
      setShowAddModal(false)
      setEditId(null)
      await load()
      refresh()
      if (viewId && editId === viewId) {
        const ln = await getFinanceLiability(viewId)
        setViewRow(ln)
      }
    } catch (err) {
      if (err.status === 401) {
        setPfToken(null)
        onSessionInvalid?.()
      } else {
        setError(err.message || 'Could not save')
      }
    } finally {
      setSubmitting(false)
    }
  }

  async function handleDelete(r) {
    if (!window.confirm(`Delete liability “${r.liability_name}” and all its payments?`)) return
    try {
      await deleteFinanceLiability(r.id)
      if (viewId === r.id) setViewId(null)
      await load()
      refresh()
    } catch (err) {
      if (err.status === 401) {
        setPfToken(null)
        onSessionInvalid?.()
      } else {
        setError(err.message || 'Delete failed')
      }
    }
  }

  function openPay(r) {
    setPayId(r.id)
    setPayDate(todayISODate())
    setPayAmount('')
    setPayInterest('')
    setPayMode('CASH')
    setPayAccountId(accounts[0]?.id != null ? String(accounts[0].id) : '')
    setPayNotes('')
  }

  async function handlePaySubmit(e) {
    e.preventDefault()
    if (!payId) return
    const amt = Number(payAmount)
    const intr = payInterest === '' ? 0 : Number(payInterest)
    if (!amt || amt <= 0) {
      setError('Enter amount paid')
      return
    }
    if (intr < 0 || intr > amt) {
      setError('Interest paid must be between 0 and amount paid')
      return
    }
    const mode = payMode === 'BANK' ? 'BANK' : 'CASH'
    const acc = mode === 'BANK' ? Number(payAccountId) : null
    if (mode === 'BANK' && (!acc || Number.isNaN(acc))) {
      setError('Select bank account')
      return
    }
    setPaySubmitting(true)
    setError('')
    const savedPayId = payId
    const savedViewId = viewId
    try {
      await createLiabilityPayment(savedPayId, {
        payment_date: payDate,
        amount_paid: amt,
        interest_paid: intr,
        payment_mode: mode,
        finance_account_id: mode === 'BANK' ? acc : null,
        notes: payNotes.trim() || null,
      })
      setPayId(null)
      await load()
      refresh()
      if (savedViewId === savedPayId) {
        setPayments(await listLiabilityPayments(savedViewId))
        setViewRow(await getFinanceLiability(savedViewId))
      }
    } catch (err) {
      if (err.status === 401) {
        setPfToken(null)
        onSessionInvalid?.()
      } else {
        setError(err.message || 'Payment failed')
      }
    } finally {
      setPaySubmitting(false)
    }
  }

  async function handleCloseLiability(id) {
    if (!window.confirm('Close this liability? Outstanding must be zero.')) return
    setClosingId(id)
    setError('')
    try {
      await closeFinanceLiability(id)
      setViewId(null)
      await load()
      refresh()
    } catch (err) {
      if (err.status === 401) {
        setPfToken(null)
        onSessionInvalid?.()
      } else {
        setError(err.message || 'Could not close')
      }
    } finally {
      setClosingId(null)
    }
  }

  async function handleStatementExport(liaId, kind) {
    setExportBusy(true)
    try {
      const path = kind === 'pdf' ? `/pf/export/liabilities/${liaId}/pdf` : `/pf/export/liabilities/${liaId}/excel`
      const { blob, filename } = await pfFetchBlob(path)
      triggerDownloadBlob(blob, filename || `Liability.${kind === 'pdf' ? 'pdf' : 'xlsx'}`)
    } catch (e) {
      if (e.status === 401) {
        setPfToken(null)
        onSessionInvalid?.()
      } else {
        window.alert(e.message || 'Export failed')
      }
    } finally {
      setExportBusy(false)
    }
  }

  async function handlePortfolioExport() {
    setExportBusy(true)
    try {
      const { blob, filename } = await pfFetchBlob('/pf/export/liabilities/excel')
      triggerDownloadBlob(blob, filename || 'Liabilities.xlsx')
    } catch (e) {
      if (e.status === 401) {
        setPfToken(null)
        onSessionInvalid?.()
      } else {
        window.alert(e.message || 'Export failed')
      }
    } finally {
      setExportBusy(false)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-slate-900 dark:text-slate-100 sm:text-2xl">Liabilities</h1>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            Money you owe — cards, loans you borrowed, bills, BNPL, EMIs.
          </p>
        </div>
        <PfExportMenu
          busy={exportBusy}
          items={[{ key: 'xlsx', label: 'Export all (Excel)', onClick: handlePortfolioExport }]}
        />
      </div>

      {error ? (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:border-amber-900/40 dark:bg-amber-950/30 dark:text-amber-100">
          {error}
        </div>
      ) : null}

      {summary ? (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div className={pfChartCard}>
            <p className="text-xs font-medium text-slate-500 dark:text-slate-400">Total liabilities (book)</p>
            <p className="mt-1 text-lg font-bold tabular-nums text-slate-900 dark:text-slate-100">
              {formatInr(summary.total_liabilities_book)}
            </p>
          </div>
          <div className={pfChartCard}>
            <p className="text-xs font-medium text-slate-500 dark:text-slate-400">Total outstanding</p>
            <p className="mt-1 text-lg font-bold tabular-nums text-slate-900 dark:text-slate-100">
              {formatInr(summary.total_outstanding)}
            </p>
          </div>
          <div className={pfChartCard}>
            <p className="text-xs font-medium text-slate-500 dark:text-slate-400">Due this month</p>
            <p className="mt-1 text-lg font-bold tabular-nums text-slate-900 dark:text-slate-100">
              {formatInr(summary.due_this_month_amount)}
            </p>
          </div>
          <div className={pfChartCard}>
            <p className="text-xs font-medium text-slate-500 dark:text-slate-400">Overdue</p>
            <p className="mt-1 text-lg font-bold tabular-nums text-red-700 dark:text-red-400">
              {formatInr(summary.overdue_amount)}
            </p>
          </div>
        </div>
      ) : null}

      <div className={`${cardCls} flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end`}>
        <div>
          <label className={labelCls} htmlFor="lia-f-type">
            Type
          </label>
          <select
            id="lia-f-type"
            className={`${pfSelectCompact} mt-1 w-full sm:w-auto`}
            value={filterType}
            onChange={(e) => setFilterType(e.target.value)}
          >
            <option value="ALL">All types</option>
            {LIABILITY_TYPES.map((t) => (
              <option key={t.value} value={t.value}>
                {t.label}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className={labelCls} htmlFor="lia-f-st">
            Status
          </label>
          <select
            id="lia-f-st"
            className={`${pfSelectCompact} mt-1 w-full sm:w-auto`}
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
          >
            <option value="ALL">All</option>
            <option value="ACTIVE">Active</option>
            <option value="OVERDUE">Overdue</option>
            <option value="CLOSED">Closed</option>
            <option value="PAID">Paid</option>
          </select>
        </div>
        <div className="flex items-center gap-2 pt-6 sm:pt-0">
          <input
            id="lia-f-due"
            type="checkbox"
            className="h-4 w-4 rounded border-sky-300 text-[#1E3A8A]"
            checked={filterDueMonth}
            onChange={(e) => setFilterDueMonth(e.target.checked)}
          />
          <label htmlFor="lia-f-due" className="text-sm text-slate-700 dark:text-slate-300">
            Due this month
          </label>
        </div>
        <div className="min-w-[12rem] flex-1">
          <label className={labelCls} htmlFor="lia-f-search">
            Search
          </label>
          <input
            id="lia-f-search"
            type="search"
            className={inputCls}
            placeholder="Name…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </div>

      <div className="flex flex-wrap gap-3">
        <button type="button" onClick={openAdd} className={`${btnPrimary} inline-flex items-center gap-2`}>
          <PlusIcon className="h-5 w-5" />
          Add liability
        </button>
      </div>

      {loading ? (
        <p className="text-sm text-slate-500">Loading…</p>
      ) : rows.length === 0 ? (
        <p className="text-sm text-slate-500">No liabilities match your filters.</p>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {rows.map((r) => (
            <div
              key={r.id}
              className={`${cardCls} flex flex-col border-sky-200/80 dark:border-slate-600 ${
                r.display_status === 'OVERDUE' ? 'ring-2 ring-red-300 dark:ring-red-800' : ''
              }`}
            >
              <div className="flex items-start justify-between gap-2">
                <div>
                  <h3 className="font-bold text-slate-900 dark:text-slate-100">{r.liability_name}</h3>
                  <p className="mt-1 text-xs text-slate-500">{typeLabel(r.liability_type)}</p>
                </div>
                {statusBadge(r.display_status)}
              </div>
              <div className="mt-3 space-y-1 text-sm text-slate-700 dark:text-slate-200">
                <p>
                  Outstanding:{' '}
                  <span className="font-mono font-semibold tabular-nums">{formatInr(r.outstanding_amount)}</span>
                </p>
                {r.minimum_due != null && Number(r.minimum_due) > 0 ? (
                  <p>
                    Min due: <span className="font-mono tabular-nums">{formatInr(r.minimum_due)}</span>
                  </p>
                ) : null}
                {r.installment_amount != null && Number(r.installment_amount) > 0 ? (
                  <p>
                    EMI / installment:{' '}
                    <span className="font-mono tabular-nums">{formatInr(r.installment_amount)}</span>
                  </p>
                ) : null}
                <p>
                  Due: <span className="font-medium">{formatShortDate(r.due_date)}</span>
                </p>
                {r.interest_rate != null ? <p>Interest: {r.interest_rate}%</p> : null}
              </div>
              <div className="mt-4 flex flex-wrap gap-2 border-t border-sky-100/80 pt-4 dark:border-slate-600">
                <button
                  type="button"
                  disabled={Number(r.outstanding_amount) <= 0 || String(r.status).toUpperCase() === 'CLOSED'}
                  className={`${btnSecondary} flex-1 justify-center text-xs`}
                  onClick={() => openPay(r)}
                >
                  Pay
                </button>
                <button type="button" className={`${btnSecondary} flex-1 justify-center text-xs`} onClick={() => setViewId(r.id)}>
                  View
                </button>
                <button type="button" className={`${btnSecondary} flex-1 justify-center text-xs`} onClick={() => openEdit(r)}>
                  Edit
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {showAddModal ? (
        <div
          className={pfModalOverlay}
          role="dialog"
          aria-modal="true"
          onMouseDown={(e) => e.target === e.currentTarget && setShowAddModal(false)}
        >
          <div
            className={`${pfModalSurface} max-w-xl p-5 md:p-6`}
            onMouseDown={(ev) => ev.stopPropagation()}
          >
            <div className={pfModalHeader}>
              <h2 className="text-lg font-semibold text-[var(--pf-text)]">{editId ? 'Edit liability' : 'Add liability'}</h2>
              <button
                type="button"
                className={pfModalCloseBtn}
                onClick={() => setShowAddModal(false)}
                aria-label="Close"
              >
                <XMarkIcon className="h-6 w-6" />
              </button>
            </div>
            <form onSubmit={handleSaveForm} className="grid gap-3 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <label className={labelCls} htmlFor="fm-name">
                  Name
                </label>
                <input id="fm-name" className={inputCls} value={form.liability_name} onChange={(e) => setForm((f) => ({ ...f, liability_name: e.target.value }))} required />
              </div>
              <div className="sm:col-span-2">
                <label className={labelCls} htmlFor="fm-type">
                  Type
                </label>
                <select
                  id="fm-type"
                  className={inputCls}
                  value={form.liability_type}
                  onChange={(e) => setForm((f) => ({ ...f, liability_type: e.target.value }))}
                >
                  {LIABILITY_TYPES.map((t) => (
                    <option key={t.value} value={t.value}>
                      {t.label}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className={labelCls} htmlFor="fm-tot">
                  Total amount (₹)
                </label>
                <input id="fm-tot" type="number" min="0" step="0.01" className={inputCls} value={form.total_amount} onChange={(e) => setForm((f) => ({ ...f, total_amount: e.target.value }))} required />
              </div>
              <div>
                <label className={labelCls} htmlFor="fm-out">
                  Outstanding (₹)
                </label>
                <input id="fm-out" type="number" min="0" step="0.01" className={inputCls} value={form.outstanding_amount} onChange={(e) => setForm((f) => ({ ...f, outstanding_amount: e.target.value }))} placeholder="Defaults to total" />
              </div>
              <div>
                <label className={labelCls} htmlFor="fm-rate">
                  Interest % (optional)
                </label>
                <input id="fm-rate" type="number" step="0.01" className={inputCls} value={form.interest_rate} onChange={(e) => setForm((f) => ({ ...f, interest_rate: e.target.value }))} />
              </div>
              <div>
                <label className={labelCls} htmlFor="fm-min">
                  Minimum due (₹)
                </label>
                <input id="fm-min" type="number" min="0" step="0.01" className={inputCls} value={form.minimum_due} onChange={(e) => setForm((f) => ({ ...f, minimum_due: e.target.value }))} />
              </div>
              <div>
                <label className={labelCls} htmlFor="fm-ins">
                  EMI / installment (₹)
                </label>
                <input id="fm-ins" type="number" min="0" step="0.01" className={inputCls} value={form.installment_amount} onChange={(e) => setForm((f) => ({ ...f, installment_amount: e.target.value }))} />
              </div>
              <div>
                <label className={labelCls} htmlFor="fm-due">
                  Due date
                </label>
                <input id="fm-due" type="date" className={inputCls} value={form.due_date} onChange={(e) => setForm((f) => ({ ...f, due_date: e.target.value }))} />
              </div>
              <div>
                <label className={labelCls} htmlFor="fm-cycle">
                  Billing cycle day (1–31)
                </label>
                <input id="fm-cycle" type="number" min="1" max="31" className={inputCls} value={form.billing_cycle_day} onChange={(e) => setForm((f) => ({ ...f, billing_cycle_day: e.target.value }))} />
              </div>
              <div className="sm:col-span-2">
                <label className={labelCls} htmlFor="fm-lender">
                  Lender name
                </label>
                <input id="fm-lender" className={inputCls} value={form.lender_name} onChange={(e) => setForm((f) => ({ ...f, lender_name: e.target.value }))} />
              </div>
              <div className="sm:col-span-2">
                <label className={labelCls} htmlFor="fm-notes">
                  Notes
                </label>
                <textarea id="fm-notes" rows={2} className={`${inputCls} resize-y`} value={form.notes} onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))} />
              </div>
              {editId ? (
                <div className="sm:col-span-2">
                  <label className={labelCls} htmlFor="fm-st">
                    Status
                  </label>
                  <select id="fm-st" className={inputCls} value={form.status} onChange={(e) => setForm((f) => ({ ...f, status: e.target.value }))}>
                    <option value="ACTIVE">Active</option>
                    <option value="CLOSED">Closed</option>
                  </select>
                </div>
              ) : null}
              <div className="flex flex-wrap gap-2 sm:col-span-2">
                <button type="submit" disabled={submitting} className={btnPrimary}>
                  {submitting ? 'Saving…' : 'Save liability'}
                </button>
                <button type="button" className={btnSecondary} onClick={() => setShowAddModal(false)}>
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}

      {payId ? (
        <div
          className={pfModalOverlay}
          role="dialog"
          aria-modal="true"
          onMouseDown={(e) => e.target === e.currentTarget && setPayId(null)}
        >
          <div
            className={`${pfModalSurfaceFit} max-w-md p-5 md:p-6`}
            onMouseDown={(ev) => ev.stopPropagation()}
          >
            <div className={pfModalHeader}>
              <h2 className="text-lg font-semibold text-[var(--pf-text)]">Record payment</h2>
            </div>
            <form onSubmit={handlePaySubmit} className="grid gap-3">
              <div>
                <label className={labelCls}>Date</label>
                <input type="date" className={inputCls} value={payDate} onChange={(e) => setPayDate(e.target.value)} required />
              </div>
              <div>
                <label className={labelCls}>Amount paid (₹)</label>
                <input type="number" min="0" step="0.01" className={inputCls} value={payAmount} onChange={(e) => setPayAmount(e.target.value)} required />
              </div>
              <div>
                <label className={labelCls}>Interest portion (₹)</label>
                <input type="number" min="0" step="0.01" className={inputCls} value={payInterest} onChange={(e) => setPayInterest(e.target.value)} />
              </div>
              <div>
                <label className={labelCls}>Mode</label>
                <select className={inputCls} value={payMode} onChange={(e) => setPayMode(e.target.value)}>
                  <option value="CASH">Cash</option>
                  <option value="BANK">Bank</option>
                </select>
              </div>
              {payMode === 'BANK' ? (
                <div>
                  <label className={labelCls}>Account</label>
                  <select className={inputCls} value={payAccountId} onChange={(e) => setPayAccountId(e.target.value)} required>
                    {accounts.map((a) => (
                      <option key={a.id} value={a.id}>
                        {a.account_name}
                      </option>
                    ))}
                  </select>
                </div>
              ) : null}
              <div>
                <label className={labelCls}>Notes</label>
                <input className={inputCls} value={payNotes} onChange={(e) => setPayNotes(e.target.value)} />
              </div>
              <div className="flex gap-2">
                <button type="submit" disabled={paySubmitting} className={btnPrimary}>
                  {paySubmitting ? 'Saving…' : 'Save payment'}
                </button>
                <button type="button" className={btnSecondary} onClick={() => setPayId(null)}>
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}

      {viewId && viewRow ? (
        <div
          className={pfModalOverlay}
          role="dialog"
          aria-modal="true"
          onMouseDown={(e) => e.target === e.currentTarget && setViewId(null)}
        >
          <div
            className={`${pfModalSurface} max-w-3xl p-5 md:p-6`}
            onMouseDown={(ev) => ev.stopPropagation()}
          >
            <div className={`${pfModalHeader} flex-wrap`}>
              <div>
                <h2 className="text-lg font-semibold text-[var(--pf-text)]">{viewRow.liability_name}</h2>
                <p className="text-xs text-[var(--pf-text-muted)]">{typeLabel(viewRow.liability_type)}</p>
                <div className="mt-2">{statusBadge(viewRow.display_status)}</div>
              </div>
              <div className="flex items-center gap-2">
                <PfExportMenu
                  busy={exportBusy}
                  items={[
                    { key: 'pdf', label: 'Export PDF', onClick: () => handleStatementExport(viewId, 'pdf') },
                    { key: 'xlsx', label: 'Export Excel', onClick: () => handleStatementExport(viewId, 'excel') },
                  ]}
                />
                <button type="button" className={pfModalCloseBtn} onClick={() => setViewId(null)} aria-label="Close">
                  <XMarkIcon className="h-6 w-6" />
                </button>
              </div>
            </div>

            {detailLoading ? (
              <p className="mt-4 text-sm text-[var(--pf-text-muted)]">Loading…</p>
            ) : (
              <>
                <div className="mt-4 grid gap-2 text-sm sm:grid-cols-2">
                  <p>
                    Total: <span className="font-semibold tabular-nums">{formatInr(viewRow.total_amount)}</span>
                  </p>
                  <p>
                    Outstanding: <span className="font-semibold tabular-nums">{formatInr(viewRow.outstanding_amount)}</span>
                  </p>
                  <p>Interest paid (history): {formatInr(viewRow.interest_paid_lifetime)}</p>
                  <p>Due date: {formatShortDate(viewRow.due_date)}</p>
                  {viewRow.lender_name ? <p>Lender: {viewRow.lender_name}</p> : null}
                  {viewRow.notes ? <p className="sm:col-span-2 text-slate-600 dark:text-slate-400">{viewRow.notes}</p> : null}
                </div>
                <div className="mt-4 flex flex-wrap gap-2">
                  <button type="button" className={`${btnSecondary} inline-flex items-center gap-1 text-xs`} onClick={() => openPay(viewRow)}>
                    <BanknotesIcon className="h-4 w-4" />
                    Record payment
                  </button>
                  <button
                    type="button"
                    disabled={closingId === viewId || Number(viewRow.outstanding_amount) > 0.01}
                    className={`${btnDanger} text-xs`}
                    onClick={() => handleCloseLiability(viewId)}
                  >
                    {closingId === viewId ? '…' : 'Close liability'}
                  </button>
                  <button type="button" className={`${btnDanger} text-xs`} onClick={() => handleDelete(viewRow)}>
                    Delete
                  </button>
                </div>
                <h3 className="mt-6 text-sm font-bold text-slate-900 dark:text-slate-100">Payment history</h3>
                <div className={`${pfTableWrap} mt-2`}>
                  <table className={`${pfTable} min-w-[420px] text-xs`}>
                    <thead>
                      <tr>
                        <th className={pfTh}>Date</th>
                        <th className={pfThRight}>Amount</th>
                        <th className={pfThRight}>Interest</th>
                        <th className={pfTh}>Mode</th>
                      </tr>
                    </thead>
                    <tbody>
                      {payments.length === 0 ? (
                        <tr>
                          <td colSpan={4} className="px-3 py-6 text-center text-slate-500">
                            No payments yet.
                          </td>
                        </tr>
                      ) : (
                        payments.map((p) => (
                          <tr key={p.id} className={pfTrHover}>
                            <td className={pfTd}>{p.payment_date}</td>
                            <td className={pfTdRight}>{formatInr(p.amount_paid)}</td>
                            <td className={pfTdRight}>{formatInr(p.interest_paid)}</td>
                            <td className={pfTd}>{p.payment_mode}</td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </>
            )}
          </div>
        </div>
      ) : null}
    </div>
  )
}
