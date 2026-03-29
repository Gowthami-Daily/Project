import { useCallback, useEffect, useState } from 'react'
import { useOutletContext } from 'react-router-dom'
import { createFinanceAsset, listFinanceAssets, setPfToken } from '../api.js'
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

export default function PfAssetsPage() {
  const { onSessionInvalid } = useOutletContext() || {}
  const { tick, refresh } = usePfRefresh()
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [assetName, setAssetName] = useState('')
  const [assetType, setAssetType] = useState('PROPERTY')
  const [value, setValue] = useState('0')

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const data = await listFinanceAssets()
      setRows(Array.isArray(data) ? data : [])
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
  }, [onSessionInvalid])

  useEffect(() => {
    load()
  }, [load, tick])

  async function handleSubmit(e) {
    e.preventDefault()
    setSubmitting(true)
    setError('')
    try {
      await createFinanceAsset({
        asset_name: assetName.trim(),
        asset_type: assetType.trim(),
        value: Number(value) || 0,
      })
      setAssetName('')
      setValue('0')
      await load()
      refresh()
    } catch (err) {
      if (err.status === 401) {
        setPfToken(null)
        onSessionInvalid?.()
      } else {
        setError(err.message || 'Could not add asset')
      }
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-slate-900 sm:text-2xl">Fixed assets</h1>
        <p className="mt-1 text-sm text-slate-500">Property, vehicles, equipment, and other long-term assets.</p>
      </div>

      {error ? (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">{error}</div>
      ) : null}

      <div className={cardCls}>
        <h2 className="text-base font-bold text-slate-900">Add asset</h2>
        <form onSubmit={handleSubmit} className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div className="sm:col-span-2">
            <label htmlFor="ast-name" className={labelCls}>
              Name
            </label>
            <input
              id="ast-name"
              className={inputCls}
              value={assetName}
              onChange={(e) => setAssetName(e.target.value)}
              required
            />
          </div>
          <div>
            <label htmlFor="ast-type" className={labelCls}>
              Type
            </label>
            <input
              id="ast-type"
              className={inputCls}
              value={assetType}
              onChange={(e) => setAssetType(e.target.value)}
              placeholder="PROPERTY, VEHICLE…"
            />
          </div>
          <div>
            <label htmlFor="ast-val" className={labelCls}>
              Value (₹)
            </label>
            <input
              id="ast-val"
              type="number"
              step="0.01"
              min="0"
              className={inputCls}
              value={value}
              onChange={(e) => setValue(e.target.value)}
            />
          </div>
          <div>
            <button type="submit" disabled={submitting} className={btnPrimary}>
              {submitting ? 'Saving…' : 'Add asset'}
            </button>
          </div>
        </form>
      </div>

      <div className={cardCls}>
        <h2 className="text-base font-bold text-slate-900">Recorded assets</h2>
        <div className={`mt-4 ${pfTableWrap}`}>
          <table className={`${pfTable} min-w-[400px]`}>
            <thead>
              <tr>
                <th className={pfTh}>Name</th>
                <th className={pfTh}>Type</th>
                <th className={pfThRight}>Value</th>
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
                    No assets yet.
                  </td>
                </tr>
              ) : (
                rows.map((r) => (
                  <tr key={r.id} className={pfTrHover}>
                    <td className={`${pfTd} font-medium`}>{r.asset_name}</td>
                    <td className={`${pfTd} text-slate-600`}>{r.asset_type}</td>
                    <td className={pfTdRight}>{formatInr(r.value)}</td>
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
