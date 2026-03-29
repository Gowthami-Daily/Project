import { useCallback, useEffect, useState } from 'react'
import { useOutletContext } from 'react-router-dom'
import { createFinanceAsset, listFinanceAssets, pfFetchBlob, setPfToken, triggerDownloadBlob } from '../api.js'
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
  const [showAddForm, setShowAddForm] = useState(false)
  const [assetExportBusy, setAssetExportBusy] = useState(false)

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
      setShowAddForm(false)
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

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-slate-900 dark:text-slate-100 sm:text-2xl">Fixed assets</h1>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            Property, vehicles, equipment, and other long-term assets.
          </p>
        </div>
        <PfExportMenu
          busy={assetExportBusy}
          items={[{ key: 'xlsx', label: 'Export Excel', onClick: handleAssetsExport }]}
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
        {showAddForm ? 'Close form' : '+ Add asset'}
      </button>

      {showAddForm ? (
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
      ) : null}

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
