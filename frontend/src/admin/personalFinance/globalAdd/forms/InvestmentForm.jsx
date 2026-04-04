import { useState } from 'react'
import { createFinanceInvestment, setPfToken } from '../../api.js'
import { usePfToast } from '../../notifications/pfToastContext.jsx'
import { PremiumSelect } from '../../../../components/ui/PremiumSelect.jsx'
import { AppInput, AppTextarea } from '../../pfDesignSystem/index.js'
import { inputCls, labelCls } from '../../pfFormStyles.js'
import { todayISODate } from '../pfToday.js'

const INVESTMENT_TYPE_OPTIONS = [
  { value: 'MUTUAL_FUND', label: 'Mutual funds' },
  { value: 'STOCK', label: 'Stocks' },
  { value: 'GOLD', label: 'Gold' },
  { value: 'FD', label: 'Fixed deposits' },
  { value: 'PPF', label: 'PPF' },
  { value: 'EPF', label: 'EPF' },
  { value: 'NPS', label: 'NPS' },
  { value: 'REAL_ESTATE', label: 'Real estate' },
  { value: 'BOND', label: 'Bonds / debt' },
  { value: 'CRYPTO', label: 'Crypto' },
  { value: 'OTHER', label: 'Other' },
]

export default function InvestmentForm({ formId, defaultType, defaultPlatform, onSuccess, onSessionInvalid }) {
  const [investmentType, setInvestmentType] = useState(defaultType || 'MUTUAL_FUND')
  const [name, setName] = useState('')
  const [investedAmount, setInvestedAmount] = useState('')
  const [currentValue, setCurrentValue] = useState('')
  const [sipMonthlyAmount, setSipMonthlyAmount] = useState('')
  const [investmentDate, setInvestmentDate] = useState(todayISODate)
  const [platform, setPlatform] = useState(defaultPlatform || '')
  const [notes, setNotes] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const toast = usePfToast()

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    if (!name.trim()) {
      setError('Name is required.')
      return
    }
    const inv = Number(investedAmount)
    if (!inv || inv <= 0) {
      setError('Enter invested amount.')
      return
    }
    const cv =
      currentValue === '' || currentValue == null ? null : Math.max(0, Number(currentValue))
    const sip =
      sipMonthlyAmount === '' || sipMonthlyAmount == null ? null : Math.max(0, Number(sipMonthlyAmount))
    setSubmitting(true)
    try {
      await createFinanceInvestment({
        type: investmentType.trim(),
        name: name.trim(),
        invested_amount: inv,
        current_value: cv != null && !Number.isNaN(cv) ? cv : null,
        sip_monthly_amount: sip != null && !Number.isNaN(sip) ? sip : null,
        investment_date: investmentDate,
        platform: platform.trim() || null,
        notes: notes.trim() || null,
      })
      onSuccess?.()
    } catch (err) {
      if (err.status === 401) {
        setPfToken(null)
        onSessionInvalid?.()
      } else {
        const msg = err.message || 'Could not save investment'
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
          id="pf-ge-inv-amt"
          label="Amount invested (₹)"
          type="number"
          inputMode="decimal"
          step="0.01"
          min="0"
          amount
          required
          value={investedAmount}
          onChange={(e) => setInvestedAmount(e.target.value)}
        />
        <AppInput
          id="pf-ge-inv-cv"
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
          <label className={labelCls} htmlFor="pf-ge-inv-date">
            Date
          </label>
          <input
            id="pf-ge-inv-date"
            type="date"
            className={inputCls}
            required
            value={investmentDate}
            onChange={(e) => setInvestmentDate(e.target.value)}
          />
        </div>
        <PremiumSelect
          id="pf-ge-inv-type"
          label="Type"
          labelClassName={labelCls}
          options={INVESTMENT_TYPE_OPTIONS}
          value={investmentType}
          onChange={setInvestmentType}
          searchable
        />
        <div className="sm:col-span-2">
          <AppInput id="pf-ge-inv-name" label="Name" required value={name} onChange={(e) => setName(e.target.value)} />
        </div>
        <div className="sm:col-span-2">
          <AppInput id="pf-ge-inv-plat" label="Platform (optional)" value={platform} onChange={(e) => setPlatform(e.target.value)} />
        </div>
        <AppInput
          id="pf-ge-inv-sip"
          label="SIP / month (₹, optional)"
          type="number"
          inputMode="decimal"
          step="0.01"
          min="0"
          amount
          value={sipMonthlyAmount}
          onChange={(e) => setSipMonthlyAmount(e.target.value)}
        />
        <div className="sm:col-span-2">
          <AppTextarea id="pf-ge-inv-notes" label="Notes" rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
        </div>
      </div>
      {submitting ? <p className="text-sm text-[var(--pf-text-muted)]">Saving…</p> : null}
    </form>
  )
}
