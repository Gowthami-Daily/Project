import { useCallback, useEffect, useState } from 'react'
import { useOutletContext } from 'react-router-dom'
import { createFinanceInvestment, listFinanceInvestments, setPfToken } from '../api.js'
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

function todayISODate() {
  const d = new Date()
  return d.toISOString().slice(0, 10)
}

export default function PfInvestmentsPage() {
  const { onSessionInvalid } = useOutletContext() || {}
  const { tick, refresh } = usePfRefresh()
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [investmentType, setInvestmentType] = useState('MUTUAL_FUND')
  const [investedAmount, setInvestedAmount] = useState('')
  const [currentValue, setCurrentValue] = useState('0')
  const [platform, setPlatform] = useState('')
  const [asOfDate, setAsOfDate] = useState(todayISODate)

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

  async function handleSubmit(e) {
    e.preventDefault()
    setSubmitting(true)
    setError('')
    try {
      await createFinanceInvestment({
        investment_type: investmentType.trim(),
        invested_amount: Number(investedAmount),
        current_value: Number(currentValue) || 0,
        platform: platform.trim() || null,
        as_of_date: asOfDate,
      })
      setInvestedAmount('')
      setCurrentValue('0')
      setPlatform('')
      await load()
      refresh()
    } catch (err) {
      if (err.status === 401) {
        setPfToken(null)
        onSessionInvalid?.()
      } else {
        setError(err.message || 'Could not add investment')
      }
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-slate-900 sm:text-2xl">Investments</h1>
        <p className="mt-1 text-sm text-slate-500">Track invested amount and current market value.</p>
      </div>

      {error ? (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">{error}</div>
      ) : null}

      <div className={cardCls}>
        <h2 className="text-base font-bold text-slate-900">Add investment</h2>
        <form onSubmit={handleSubmit} className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <div>
            <label htmlFor="inv-type" className={labelCls}>
              Type
            </label>
            <input
              id="inv-type"
              className={inputCls}
              value={investmentType}
              onChange={(e) => setInvestmentType(e.target.value)}
              placeholder="MUTUAL_FUND, STOCK, FD…"
              required
            />
          </div>
          <div>
            <label htmlFor="inv-invested" className={labelCls}>
              Invested (₹)
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
            <label htmlFor="inv-curr" className={labelCls}>
              Current value (₹)
            </label>
            <input
              id="inv-curr"
              type="number"
              step="0.01"
              min="0"
              className={inputCls}
              value={currentValue}
              onChange={(e) => setCurrentValue(e.target.value)}
            />
          </div>
          <div>
            <label htmlFor="inv-plat" className={labelCls}>
              Platform / broker
            </label>
            <input id="inv-plat" className={inputCls} value={platform} onChange={(e) => setPlatform(e.target.value)} />
          </div>
          <div>
            <label htmlFor="inv-date" className={labelCls}>
              As of date
            </label>
            <input
              id="inv-date"
              type="date"
              className={inputCls}
              value={asOfDate}
              onChange={(e) => setAsOfDate(e.target.value)}
              required
            />
          </div>
          <div className="flex items-end">
            <button type="submit" disabled={submitting} className={btnPrimary}>
              {submitting ? 'Saving…' : 'Add investment'}
            </button>
          </div>
        </form>
      </div>

      <div className={cardCls}>
        <h2 className="text-base font-bold text-slate-900">Holdings</h2>
        <div className={`mt-4 ${pfTableWrap}`}>
          <table className={`${pfTable} min-w-[560px]`}>
            <thead>
              <tr>
                <th className={pfTh}>Type</th>
                <th className={pfTh}>Platform</th>
                <th className={pfThRight}>Invested</th>
                <th className={pfThRight}>Current</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={4} className="border-b border-sky-100/90 px-3 py-6 text-center text-slate-500 first:pl-4">
                    Loading…
                  </td>
                </tr>
              ) : rows.length === 0 ? (
                <tr>
                  <td colSpan={4} className="border-b border-sky-100/90 px-3 py-8 text-center text-slate-500 first:pl-4">
                    No investments yet.
                  </td>
                </tr>
              ) : (
                rows.map((r) => (
                  <tr key={r.id} className={pfTrHover}>
                    <td className={`${pfTd} font-medium`}>{r.investment_type}</td>
                    <td className={`${pfTd} text-slate-600`}>{r.platform ?? '—'}</td>
                    <td className={pfTdRight}>{formatInr(r.invested_amount)}</td>
                    <td className={pfTdRight}>{formatInr(r.current_value)}</td>
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
