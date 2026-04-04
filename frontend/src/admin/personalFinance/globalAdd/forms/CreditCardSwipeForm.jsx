import { useMemo, useState } from 'react'
import { createCreditCardStandaloneTransaction, setPfToken } from '../../api.js'
import { usePfToast } from '../../notifications/pfToastContext.jsx'
import { PremiumSelect } from '../../../../components/ui/PremiumSelect.jsx'
import { AppDropdown, AppInput, AppTextarea } from '../../pfDesignSystem/index.js'
import { inputCls, labelCls } from '../../pfFormStyles.js'
import { todayISODate } from '../pfToday.js'

const TX_TYPE_OPTIONS = [
  { value: 'swipe', label: 'Swipe / purchase' },
  { value: 'refund', label: 'Refund' },
  { value: 'fee', label: 'Fee' },
]

export default function CreditCardSwipeForm({
  formId,
  creditCards,
  categories,
  defaultCardId,
  onSuccess,
  onSessionInvalid,
}) {
  const [txCardId, setTxCardId] = useState(defaultCardId != null ? String(defaultCardId) : '')
  const [txType, setTxType] = useState('swipe')
  const [amount, setAmount] = useState('')
  const [txDate, setTxDate] = useState(todayISODate)
  const [txCategoryId, setTxCategoryId] = useState('')
  const [txDesc, setTxDesc] = useState('')
  const [txMerchant, setTxMerchant] = useState('')
  const [txNotes, setTxNotes] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const toast = usePfToast()

  const catOptions = useMemo(
    () => categories.map((c) => ({ value: String(c.id), label: c.name })),
    [categories],
  )

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    if (!txCardId || !amount) {
      setError('Select a card and enter an amount.')
      return
    }
    const cat = categories.find((x) => String(x.id) === txCategoryId)
    setSubmitting(true)
    try {
      await createCreditCardStandaloneTransaction({
        card_id: Number(txCardId),
        transaction_type: txType,
        amount: Number(amount),
        transaction_date: txDate,
        expense_category_id: txCategoryId === '' ? null : Number(txCategoryId),
        category: cat?.name || 'general',
        description: txDesc.trim() || txMerchant.trim() || null,
        merchant: txMerchant.trim() || null,
        notes: txNotes.trim() || null,
        attachment_url: null,
        is_emi: false,
        paid_by: null,
      })
      onSuccess?.()
    } catch (err) {
      if (err.status === 401) {
        setPfToken(null)
        onSessionInvalid?.()
      } else {
        const msg = err.message || 'Could not add transaction'
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
          id="pf-ge-ccsw-amt"
          label="Amount (₹)"
          type="number"
          inputMode="decimal"
          step="0.01"
          min="0"
          amount
          required
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
        />
        <div>
          <label className={labelCls} htmlFor="pf-ge-ccsw-date">
            Date
          </label>
          <input
            id="pf-ge-ccsw-date"
            type="date"
            className={inputCls}
            required
            value={txDate}
            onChange={(e) => setTxDate(e.target.value)}
          />
        </div>
        <div className="sm:col-span-2">
          <PremiumSelect
            id="pf-ge-ccsw-card"
            label="Card"
            labelClassName={labelCls}
            required
            options={creditCards.map((c) => ({ value: String(c.id), label: c.card_name }))}
            value={txCardId}
            onChange={setTxCardId}
            placeholder="Select…"
            searchable={creditCards.length > 6}
          />
        </div>
        <PremiumSelect
          id="pf-ge-ccsw-type"
          label="Type"
          labelClassName={labelCls}
          options={TX_TYPE_OPTIONS}
          value={txType}
          onChange={setTxType}
        />
        <div className="sm:col-span-2">
          <span className={labelCls}>Category</span>
          <div className="mt-2">
            <AppDropdown
              id="pf-ge-ccsw-cat"
              value={txCategoryId}
              onChange={setTxCategoryId}
              options={catOptions}
              placeholder="Optional category…"
              aria-label="Expense category"
            />
          </div>
        </div>
        <AppInput id="pf-ge-ccsw-merch" label="Merchant (optional)" value={txMerchant} onChange={(e) => setTxMerchant(e.target.value)} />
        <AppInput id="pf-ge-ccsw-desc" label="Description (optional)" value={txDesc} onChange={(e) => setTxDesc(e.target.value)} />
        <div className="sm:col-span-2">
          <AppTextarea id="pf-ge-ccsw-notes" label="Notes" rows={2} value={txNotes} onChange={(e) => setTxNotes(e.target.value)} />
        </div>
      </div>
      {submitting ? <p className="text-sm text-[var(--pf-text-muted)]">Saving…</p> : null}
    </form>
  )
}
