import { useCallback, useEffect, useMemo, useState } from 'react'
import { useOutletContext } from 'react-router-dom'
import {
  createFinanceInvestment,
  deleteFinanceInvestment,
  listFinanceInvestments,
  pfFetchBlob,
  setPfToken,
  triggerDownloadBlob,
  updateFinanceInvestment,
} from '../api.js'
import PfExportMenu from '../PfExportMenu.jsx'
import {
  btnDanger,
  btnPrimary,
  btnSecondary,
  cardCls,
  inputCls,
  labelCls,
  pfActionRow,
  pfChartCard,
  pfTable,
  pfTableWrap,
  pfTd,
  pfTdActions,
  pfTdRight,
  pfTh,
  pfThActions,
  pfThRight,
  pfTrHover,
} from '../pfFormStyles.js'
import { formatInr } from '../pfFormat.js'
import { usePfRefresh } from '../pfRefreshContext.jsx'

const INVESTMENT_TYPE_OPTIONS = [
  { value: 'MUTUAL_FUND', label: 'Mutual fund' },
  { value: 'STOCK', label: 'Stock' },
  { value: 'GOLD', label: 'Gold' },
  { value: 'FD', label: 'Fixed deposit' },
  { value: 'PPF', label: 'PPF' },
  { value: 'EPF', label: 'EPF' },
  { value: 'NPS', label: 'NPS' },
  { value: 'REAL_ESTATE', label: 'Real estate' },
  { value: 'BOND', label: 'Bond / debt' },
  { value: 'CRYPTO', label: 'Crypto' },
  { value: 'OTHER', label: 'Other' },
]

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
    investmentDate: todayISODate(),
    platform: '',
    notes: '',
  }
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
  const [investmentDate, setInvestmentDate] = useState(todayISODate)
  const [platform, setPlatform] = useState('')
  const [notes, setNotes] = useState('')
  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState(null)
  const [invExportBusy, setInvExportBusy] = useState(false)

  const totalInvested = useMemo(
    () => rows.reduce((s, r) => s + Number(r.invested_amount ?? 0), 0),
    [rows],
  )

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const data = await listFinanceInvestments()
      setRows(Array.isArray(data) ? data : [])
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
    setInvestmentDate(
      r.investment_date ? String(r.investment_date).slice(0, 10) : todayISODate(),
    )
    setPlatform(r.platform ?? '')
    setNotes(r.notes ?? '')
    setShowForm(true)
  }

  function closeForm() {
    setShowForm(false)
    resetFormToEmpty()
  }

  function buildPayload() {
    return {
      type: investmentType.trim(),
      name: name.trim(),
      invested_amount: Number(investedAmount),
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
    const ok = window.confirm('Are you sure you want to delete this investment?')
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

  const typeLabel = (v) => INVESTMENT_TYPE_OPTIONS.find((o) => o.value === v)?.label || v

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-slate-900 dark:text-slate-100 sm:text-2xl">Investments</h1>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            Track what you invested, where it is held, and when.
          </p>
        </div>
        <PfExportMenu
          busy={invExportBusy}
          items={[{ key: 'xlsx', label: 'Export Excel', onClick: handleInvestmentsExport }]}
        />
      </div>

      <div className={pfChartCard}>
        <p className="text-sm font-medium text-slate-500 dark:text-slate-400">Total invested</p>
        <p className="mt-1 text-2xl font-bold tabular-nums text-slate-900 dark:text-slate-100">
          {formatInr(totalInvested)}
        </p>
      </div>

      {error ? (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">{error}</div>
      ) : null}

      <button
        type="button"
        onClick={openAddForm}
        className="w-full rounded-[12px] border border-slate-200 bg-white py-3 text-sm font-bold text-[#1E3A8A] shadow-sm transition hover:bg-slate-50 active:scale-[0.98] sm:w-auto sm:px-6"
      >
        + Add investment
      </button>

      {showForm ? (
        <div className={cardCls}>
          <h2 className="text-base font-bold text-slate-900 dark:text-slate-100">
            {editingId != null ? 'Edit investment' : 'Add investment'}
          </h2>
          <form onSubmit={handleSubmit} className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <div>
              <label htmlFor="inv-type" className={labelCls}>
                Type
              </label>
              <select
                id="inv-type"
                className={inputCls}
                value={investmentType}
                onChange={(e) => setInvestmentType(e.target.value)}
                required
              >
                {!INVESTMENT_TYPE_OPTIONS.some((o) => o.value === investmentType) && investmentType ? (
                  <option value={investmentType}>{investmentType}</option>
                ) : null}
                {INVESTMENT_TYPE_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="sm:col-span-2">
              <label htmlFor="inv-name" className={labelCls}>
                Name
              </label>
              <input
                id="inv-name"
                className={inputCls}
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. HDFC Nifty 50 Index Fund"
                required
              />
            </div>
            <div>
              <label htmlFor="inv-invested" className={labelCls}>
                Invested amount (₹)
              </label>
              <input
                id="inv-invested"
                type="number"
                step="0.01"
                min="0"
                className={inputCls}
                value={investedAmount}
                onChange={(e) => setInvestedAmount(e.target.value)}
                required
              />
            </div>
            <div>
              <label htmlFor="inv-date" className={labelCls}>
                Date
              </label>
              <input
                id="inv-date"
                type="date"
                className={inputCls}
                value={investmentDate}
                onChange={(e) => setInvestmentDate(e.target.value)}
                required
              />
            </div>
            <div>
              <label htmlFor="inv-plat" className={labelCls}>
                Platform / broker
              </label>
              <input
                id="inv-plat"
                className={inputCls}
                value={platform}
                onChange={(e) => setPlatform(e.target.value)}
                placeholder="Optional"
              />
            </div>
            <div className="sm:col-span-2 lg:col-span-3">
              <label htmlFor="inv-notes" className={labelCls}>
                Notes <span className="font-normal text-slate-400">(optional)</span>
              </label>
              <textarea
                id="inv-notes"
                rows={3}
                className={`${inputCls} resize-y`}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Optional"
              />
            </div>
            <div className="flex flex-wrap items-end justify-end gap-2 sm:col-span-2 lg:col-span-3">
              <button type="button" onClick={closeForm} className={btnSecondary}>
                Cancel
              </button>
              <button type="submit" disabled={submitting} className={btnPrimary}>
                {submitting ? 'Saving…' : 'Save investment'}
              </button>
            </div>
          </form>
        </div>
      ) : null}

      <div className={cardCls}>
        <h2 className="text-base font-bold text-slate-900 dark:text-slate-100">Holdings</h2>
        <div className={`mt-4 ${pfTableWrap}`}>
          <table className={`${pfTable} min-w-[720px]`}>
            <thead>
              <tr>
                <th className={pfTh}>Type</th>
                <th className={pfTh}>Name</th>
                <th className={pfTh}>Platform</th>
                <th className={pfThRight}>Invested</th>
                <th className={pfThRight}>Date</th>
                <th className={`${pfThRight} ${pfThActions}`}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={6} className="border-b border-sky-100/90 px-3 py-6 text-center text-slate-500 first:pl-4">
                    Loading…
                  </td>
                </tr>
              ) : rows.length === 0 ? (
                <tr>
                  <td colSpan={6} className="border-b border-sky-100/90 px-3 py-8 text-center text-slate-500 first:pl-4">
                    No investments yet.
                  </td>
                </tr>
              ) : (
                rows.map((r) => (
                  <tr key={r.id} className={pfTrHover}>
                    <td className={`${pfTd} font-medium`}>{typeLabel(r.investment_type)}</td>
                    <td className={`${pfTd} text-slate-800`}>{r.name || '—'}</td>
                    <td className={`${pfTd} text-slate-600`}>{r.platform ?? '—'}</td>
                    <td className={pfTdRight}>{formatInr(r.invested_amount)}</td>
                    <td className={pfTdRight}>{formatDisplayDate(r.investment_date)}</td>
                    <td className={pfTdActions}>
                      <div className={pfActionRow}>
                        <button
                          type="button"
                          onClick={() => openEditForm(r)}
                          className={`${btnSecondary} px-2.5 py-1.5 text-xs`}
                        >
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
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
