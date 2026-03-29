import { useCallback, useEffect, useState } from 'react'
import { useOutletContext } from 'react-router-dom'
import { getExpenseAnalytics, setPfToken } from '../api.js'
import {
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

function firstOfMonth() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`
}

function todayISODate() {
  const d = new Date()
  return d.toISOString().slice(0, 10)
}

export default function PfReportsHubPage() {
  const { onSessionInvalid } = useOutletContext() || {}
  const { tick } = usePfRefresh()
  const [start, setStart] = useState(firstOfMonth)
  const [end, setEnd] = useState(todayISODate)
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const d = await getExpenseAnalytics(start, end)
      setData(d && typeof d === 'object' ? d : null)
    } catch (e) {
      if (e.status === 401) {
        setPfToken(null)
        onSessionInvalid?.()
      } else {
        setError(e.message || 'Failed to load report')
      }
    } finally {
      setLoading(false)
    }
  }, [start, end, onSessionInvalid])

  useEffect(() => {
    load()
  }, [load, tick])

  const byCat = Array.isArray(data?.by_category) ? data.by_category : []
  const byPerson = Array.isArray(data?.by_person) ? data.by_person : []
  const byAcc = Array.isArray(data?.by_account) ? data.by_account : []

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-slate-900 sm:text-2xl">Reports</h1>
        <p className="mt-1 text-sm text-slate-500">
          Expense analytics: category, person (paid by), account, plus EMI and dairy totals for the window.
        </p>
      </div>

      <div className={cardCls}>
        <h2 className="text-base font-bold text-slate-900">Expense analytics</h2>
        <div className="mt-4 flex flex-wrap items-end gap-4">
          <div>
            <label htmlFor="rep-start" className={labelCls}>
              From
            </label>
            <input
              id="rep-start"
              type="date"
              className={inputCls}
              value={start}
              onChange={(e) => setStart(e.target.value)}
            />
          </div>
          <div>
            <label htmlFor="rep-end" className={labelCls}>
              To
            </label>
            <input
              id="rep-end"
              type="date"
              className={inputCls}
              value={end}
              onChange={(e) => setEnd(e.target.value)}
            />
          </div>
          <button
            type="button"
            onClick={() => load()}
            disabled={loading}
            className="rounded-xl bg-[#004080] px-4 py-2 text-sm font-semibold text-white hover:bg-[#003366] disabled:opacity-60"
          >
            {loading ? 'Loading…' : 'Refresh'}
          </button>
        </div>
        {error ? (
          <p className="mt-3 text-sm text-amber-800">{error}</p>
        ) : null}
        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-xl border border-sky-200/70 bg-sky-50/60 px-4 py-3 shadow-sm shadow-sky-950/[0.02]">
            <p className="text-xs font-semibold uppercase tracking-wide text-sky-900/70">EMI (expense)</p>
            <p className="mt-1 text-lg font-bold text-sky-950">{formatInr(data?.emi_expenses_total)}</p>
          </div>
          <div className="rounded-xl border border-sky-200/70 bg-sky-50/60 px-4 py-3 shadow-sm shadow-sky-950/[0.02]">
            <p className="text-xs font-semibold uppercase tracking-wide text-sky-900/70">Dairy (farm + feed)</p>
            <p className="mt-1 text-lg font-bold text-sky-950">{formatInr(data?.dairy_expenses_total)}</p>
          </div>
        </div>
      </div>

      <div className={cardCls}>
        <h3 className="text-sm font-bold text-slate-900">By category</h3>
        <div className={`mt-2 ${pfTableWrap}`}>
          <table className={`${pfTable} min-w-[20rem]`}>
            <thead>
              <tr>
                <th className={pfTh}>Category</th>
                <th className={pfThRight}>Amount</th>
              </tr>
            </thead>
            <tbody>
              {byCat.length === 0 ? (
                <tr>
                  <td colSpan={2} className="border-b border-sky-100/90 px-3 py-6 text-center text-slate-500 first:pl-4">
                    No rows
                  </td>
                </tr>
              ) : (
                byCat.map((row) => (
                  <tr key={row.category} className={pfTrHover}>
                    <td className={pfTd}>{row.category}</td>
                    <td className={pfTdRight}>{formatInr(row.amount)}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className={cardCls}>
        <h3 className="text-sm font-bold text-slate-900">By person (paid by)</h3>
        <div className={`mt-2 ${pfTableWrap}`}>
          <table className={`${pfTable} min-w-[20rem]`}>
            <thead>
              <tr>
                <th className={pfTh}>Person</th>
                <th className={pfThRight}>Amount</th>
              </tr>
            </thead>
            <tbody>
              {byPerson.length === 0 ? (
                <tr>
                  <td colSpan={2} className="border-b border-sky-100/90 px-3 py-6 text-center text-slate-500 first:pl-4">
                    No rows
                  </td>
                </tr>
              ) : (
                byPerson.map((row) => (
                  <tr key={row.person} className={pfTrHover}>
                    <td className={pfTd}>{row.person}</td>
                    <td className={pfTdRight}>{formatInr(row.amount)}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className={cardCls}>
        <h3 className="text-sm font-bold text-slate-900">By account</h3>
        <div className={`mt-2 ${pfTableWrap}`}>
          <table className={`${pfTable} min-w-[20rem]`}>
            <thead>
              <tr>
                <th className={pfTh}>Account</th>
                <th className={pfThRight}>Amount</th>
              </tr>
            </thead>
            <tbody>
              {byAcc.length === 0 ? (
                <tr>
                  <td colSpan={2} className="border-b border-sky-100/90 px-3 py-6 text-center text-slate-500 first:pl-4">
                    No rows
                  </td>
                </tr>
              ) : (
                byAcc.map((row) => (
                  <tr key={`${row.account_id}-${row.account_name}`} className={pfTrHover}>
                    <td className={pfTd}>{row.account_name}</td>
                    <td className={pfTdRight}>{formatInr(row.amount)}</td>
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
