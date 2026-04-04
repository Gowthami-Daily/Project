import { useState } from 'react'
import { postAccountMovement, setPfToken } from '../../api.js'
import { usePfToast } from '../../notifications/pfToastContext.jsx'
import { PremiumSelect } from '../../../../components/ui/PremiumSelect.jsx'
import { AppInput, AppTextarea } from '../../pfDesignSystem/index.js'
import { inputCls, labelCls } from '../../pfFormStyles.js'
import { formatInr } from '../../pfFormat.js'
import { todayISODate } from '../pfToday.js'

export default function TransferForm({ formId, accounts, defaultFromId, defaultToId, onSuccess, onSessionInvalid }) {
  const [fromId, setFromId] = useState(defaultFromId != null ? String(defaultFromId) : '')
  const [toId, setToId] = useState(defaultToId != null ? String(defaultToId) : '')
  const [amount, setAmount] = useState('')
  const [movementDate, setMovementDate] = useState(todayISODate)
  const [reference, setReference] = useState('')
  const [notes, setNotes] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const toast = usePfToast()

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    const fa = Number(fromId)
    const ta = Number(toId)
    const amt = Number(amount)
    if (!fa || !ta || fa === ta) {
      setError('Choose two different accounts.')
      return
    }
    if (!amt || amt <= 0) {
      setError('Enter a positive amount.')
      return
    }
    setSubmitting(true)
    try {
      await postAccountMovement({
        movement_type: 'internal_transfer',
        amount: amt,
        movement_date: movementDate,
        from_account_id: fa,
        to_account_id: ta,
        reference_number: reference.trim() || null,
        notes: notes.trim() || null,
      })
      onSuccess?.()
    } catch (err) {
      if (err.status === 401) {
        setPfToken(null)
        onSessionInvalid?.()
      } else {
        const msg = err.message || 'Could not transfer'
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
          id="pf-ge-tr-amt"
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
          <label className={labelCls} htmlFor="pf-ge-tr-date">
            Date
          </label>
          <input
            id="pf-ge-tr-date"
            type="date"
            className={inputCls}
            required
            value={movementDate}
            onChange={(e) => setMovementDate(e.target.value)}
          />
        </div>
        <div className="sm:col-span-2">
          <PremiumSelect
            id="pf-ge-tr-from"
            label="From account"
            labelClassName={labelCls}
            required
            options={accounts.map((a) => ({
              value: String(a.id),
              label: `${a.account_name} (${a.account_type}) · ${formatInr(a.balance)}`,
              disabled: String(a.id) === toId,
            }))}
            value={fromId}
            onChange={setFromId}
            placeholder="Select…"
            searchable={accounts.length > 5}
          />
        </div>
        <div className="sm:col-span-2">
          <PremiumSelect
            id="pf-ge-tr-to"
            label="To account"
            labelClassName={labelCls}
            required
            options={accounts.map((a) => ({
              value: String(a.id),
              label: `${a.account_name} (${a.account_type}) · ${formatInr(a.balance)}`,
              disabled: String(a.id) === fromId,
            }))}
            value={toId}
            onChange={setToId}
            placeholder="Select…"
            searchable={accounts.length > 5}
          />
        </div>
        <AppInput id="pf-ge-tr-ref" label="Reference (optional)" value={reference} onChange={(e) => setReference(e.target.value)} />
        <div className="sm:col-span-2">
          <AppTextarea id="pf-ge-tr-notes" label="Notes" rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
        </div>
      </div>
      {submitting ? <p className="text-sm text-[var(--pf-text-muted)]">Saving…</p> : null}
    </form>
  )
}
