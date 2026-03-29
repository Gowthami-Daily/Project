import { useCallback, useEffect, useState } from 'react'
import { useOutletContext } from 'react-router-dom'
import {
  createFinanceLiability,
  listFinanceLiabilities,
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
  pfTrHover,
} from '../pfFormStyles.js'
import { formatInr } from '../pfFormat.js'
import { usePfRefresh } from '../pfRefreshContext.jsx'

export default function PfLiabilitiesPage() {
  const { onSessionInvalid } = useOutletContext() || {}
  const { tick, refresh } = usePfRefresh()
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [liabilityName, setLiabilityName] = useState('')
  const [liabilityType, setLiabilityType] = useState('CREDIT_CARD')
  const [amount, setAmount] = useState('')
  const [interestRate, setInterestRate] = useState('')
  const [dueDate, setDueDate] = useState('')
  const [showAddForm, setShowAddForm] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const data = await listFinanceLiabilities()
      setRows(Array.isArray(data) ? data : [])
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
  }, [onSessionInvalid])

  useEffect(() => {
    load()
  }, [load, tick])

  async function handleSubmit(e) {
    e.preventDefault()
    setSubmitting(true)
    setError('')
    try {
      await createFinanceLiability({
        liability_name: liabilityName.trim(),
        liability_type: liabilityType.trim(),
        amount: Number(amount),
        interest_rate: interestRate === '' ? null : Number(interestRate),
        due_date: dueDate || null,
      })
      setLiabilityName('')
      setAmount('')
      setInterestRate('')
      setDueDate('')
      await load()
      refresh()
      setShowAddForm(false)
    } catch (err) {
      if (err.status === 401) {
        setPfToken(null)
        onSessionInvalid?.()
      } else {
        setError(err.message || 'Could not add liability')
      }
    } finally {
      setSubmitting(false)
    }
  }

  async function handleLiabilitiesExport() {
    setLiaExportBusy(true)
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
      setLiaExportBusy(false)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-slate-900 dark:text-slate-100 sm:text-2xl">Liabilities</h1>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            Non-loan obligations (cards, payables, etc.).
          </p>
        </div>
        <PfExportMenu
          busy={liaExportBusy}
          items={[{ key: 'xlsx', label: 'Export Excel', onClick: handleLiabilitiesExport }]}
        />
      </div>

      {error ? (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">{error}</div>
      ) : null}

      <button
        type="button"
        onClick={() => setShowAddForm((v) => !v)}
        className="w-full rounded-[12px] border border-slate-200 bg-white py-3 text-sm font-bold text-[#1E3A8A] shadow-sm transition hover:bg-slate-50 active:scale-[0.98] sm:w-auto sm:px-6"
      >
        {showAddForm ? 'Close form' : '+ Add liability'}
      </button>

      {showAddForm ? (
      <div className={cardCls}>
        <h2 className="text-base font-bold text-slate-900">Add liability</h2>
        <form onSubmit={handleSubmit} className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <div className="sm:col-span-2">
            <label htmlFor="lia-name" className={labelCls}>
              Name
            </label>
            <input
              id="lia-name"
              className={inputCls}
              value={liabilityName}
              onChange={(e) => setLiabilityName(e.target.value)}
              required
            />
          </div>
          <div>
            <label htmlFor="lia-type" className={labelCls}>
              Type
            </label>
            <input
              id="lia-type"
              className={inputCls}
              value={liabilityType}
              onChange={(e) => setLiabilityType(e.target.value)}
            />
          </div>
          <div>
            <label htmlFor="lia-amt" className={labelCls}>
              Amount (₹)
            </label>
            <input
              id="lia-amt"
              type="number"
              step="0.01"
              min="0"
              className={inputCls}
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              required
            />
          </div>
          <div>
            <label htmlFor="lia-rate" className={labelCls}>
              Interest % (optional)
            </label>
            <input
              id="lia-rate"
              type="number"
              step="0.01"
              className={inputCls}
              value={interestRate}
              onChange={(e) => setInterestRate(e.target.value)}
            />
          </div>
          <div>
            <label htmlFor="lia-due" className={labelCls}>
              Due date (optional)
            </label>
            <input id="lia-due" type="date" className={inputCls} value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
          </div>
          <div>
            <button type="submit" disabled={submitting} className={btnPrimary}>
              {submitting ? 'Saving…' : 'Add liability'}
            </button>
          </div>
        </form>
      </div>
      ) : null}

      <div className={cardCls}>
        <h2 className="text-base font-bold text-slate-900">Recorded liabilities</h2>
        <div className={`mt-4 ${pfTableWrap}`}>
          <table className={`${pfTable} min-w-[480px]`}>
            <thead>
              <tr>
                <th className={pfTh}>Name</th>
                <th className={pfTh}>Type</th>
                <th className={pfThRight}>Amount</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={3} className="border-b border-sky-100/90 px-3 py-6 text-center text-slate-500 first:pl-4">
                    Loading…
                  </td>
                </tr>
              ) : rows.length === 0 ? (
                <tr>
                  <td colSpan={3} className="border-b border-sky-100/90 px-3 py-8 text-center text-slate-500 first:pl-4">
                    No liabilities yet.
                  </td>
                </tr>
              ) : (
                rows.map((r) => (
                  <tr key={r.id} className={pfTrHover}>
                    <td className={`${pfTd} font-medium`}>{r.liability_name}</td>
                    <td className={`${pfTd} text-slate-600`}>{r.liability_type}</td>
                    <td className={pfTdRight}>{formatInr(r.amount)}</td>
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
