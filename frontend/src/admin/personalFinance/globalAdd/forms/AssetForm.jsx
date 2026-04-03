import { useState } from 'react'
import { createFinanceAsset, setPfToken } from '../../api.js'
import { usePfToast } from '../../notifications/pfToastContext.jsx'
import { AppInput, AppTextarea } from '../../pfDesignSystem/index.js'
import { inputCls, labelCls } from '../../pfFormStyles.js'
import { todayISODate } from '../pfToday.js'

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

export default function AssetForm({ formId, onSuccess, onSessionInvalid }) {
  const [assetName, setAssetName] = useState('')
  const [assetType, setAssetType] = useState('HOUSE')
  const [purchaseValue, setPurchaseValue] = useState('')
  const [currentValue, setCurrentValue] = useState('')
  const [purchaseDate, setPurchaseDate] = useState(todayISODate)
  const [depreciationRate, setDepreciationRate] = useState('')
  const [location, setLocation] = useState('')
  const [notes, setNotes] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const toast = usePfToast()

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    if (!assetName.trim()) {
      setError('Asset name is required.')
      return
    }
    const pv = Number(purchaseValue)
    if (!pv || pv <= 0) {
      setError('Enter purchase value.')
      return
    }
    const cv = currentValue === '' ? null : Math.max(0, Number(currentValue))
    const dr = depreciationRate === '' ? null : Number(depreciationRate)
    setSubmitting(true)
    try {
      await createFinanceAsset({
        asset_name: assetName.trim(),
        asset_type: assetType,
        purchase_value: pv,
        current_value: cv != null && !Number.isNaN(cv) ? cv : null,
        purchase_date: purchaseDate || null,
        depreciation_rate: dr != null && !Number.isNaN(dr) && dr > 0 ? dr : null,
        location: location.trim() || null,
        linked_liability_id: null,
        notes: notes.trim() ? notes.trim() : null,
      })
      onSuccess?.()
    } catch (err) {
      if (err.status === 401) {
        setPfToken(null)
        onSessionInvalid?.()
      } else {
        const msg = err.message || 'Could not save asset'
        setError(msg)
        toast.error('Something went wrong', msg)
      }
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <form id={formId} onSubmit={handleSubmit} className="space-y-4">
      {error ? (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-100">
          {error}
        </div>
      ) : null}
      <div className="grid gap-4 sm:grid-cols-2">
        <AppInput
          id="pf-ge-as-amt"
          label="Purchase value (₹)"
          type="number"
          inputMode="decimal"
          step="0.01"
          min="0"
          amount
          required
          value={purchaseValue}
          onChange={(e) => setPurchaseValue(e.target.value)}
        />
        <AppInput
          id="pf-ge-as-cv"
          label="Current value (₹, optional)"
          type="number"
          inputMode="decimal"
          step="0.01"
          min="0"
          amount
          value={currentValue}
          onChange={(e) => setCurrentValue(e.target.value)}
        />
        <div>
          <label className={labelCls} htmlFor="pf-ge-as-date">
            Purchase date
          </label>
          <input
            id="pf-ge-as-date"
            type="date"
            className={inputCls}
            value={purchaseDate}
            onChange={(e) => setPurchaseDate(e.target.value)}
          />
        </div>
        <div>
          <label className={labelCls} htmlFor="pf-ge-as-type">
            Type
          </label>
          <select id="pf-ge-as-type" className={inputCls} value={assetType} onChange={(e) => setAssetType(e.target.value)}>
            {ASSET_TYPES.map((t) => (
              <option key={t.value} value={t.value}>
                {t.label}
              </option>
            ))}
          </select>
        </div>
        <div className="sm:col-span-2">
          <AppInput id="pf-ge-as-name" label="Name" required value={assetName} onChange={(e) => setAssetName(e.target.value)} />
        </div>
        <AppInput
          id="pf-ge-as-dep"
          label="Depreciation % / yr (optional)"
          type="number"
          step="0.1"
          min="0"
          value={depreciationRate}
          onChange={(e) => setDepreciationRate(e.target.value)}
        />
        <AppInput id="pf-ge-as-loc" label="Location (optional)" value={location} onChange={(e) => setLocation(e.target.value)} />
        <div className="sm:col-span-2">
          <AppTextarea id="pf-ge-as-notes" label="Notes" rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
        </div>
      </div>
      {submitting ? <p className="text-sm text-[var(--pf-text-muted)]">Saving…</p> : null}
    </form>
  )
}
