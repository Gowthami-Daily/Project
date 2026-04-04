import { useEffect, useMemo, useState } from 'react'
import { payCreditCardBill, setPfToken } from '../../api.js'
import { usePfToast } from '../../notifications/pfToastContext.jsx'
import { PremiumSelect } from '../../../../components/ui/PremiumSelect.jsx'
import { AppInput } from '../../pfDesignSystem/index.js'
import { inputCls, labelCls } from '../../pfFormStyles.js'
import { formatInr } from '../../pfFormat.js'
import { todayISODate } from '../pfToday.js'

export default function CreditCardPaymentForm({ formId, accounts, creditCards, bills, defaultAccountId, onSuccess, onSessionInvalid }) {
  const openBills = useMemo(
    () => (Array.isArray(bills) ? bills : []).filter((b) => String(b.status || '').toUpperCase() !== 'PAID'),
    [bills],
  )

  const cardName = (cardId) => creditCards?.find((c) => c.id === cardId)?.card_name ?? cardId

  const [payBillId, setPayBillId] = useState('')

  useEffect(() => {
    if (payBillId) return
    const first = openBills[0]
    if (first?.id != null) setPayBillId(String(first.id))
  }, [openBills, payBillId])
  const [payAmount, setPayAmount] = useState('')
  const [payPaymentDate, setPayPaymentDate] = useState(todayISODate)
  const [payFromAcc, setPayFromAcc] = useState(defaultAccountId != null ? String(defaultAccountId) : '')
  const [payRef, setPayRef] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const toast = usePfToast()

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    if (!payBillId || !payAmount || !payFromAcc) {
      setError('Bill, amount, and bank account are required.')
      return
    }
    setSubmitting(true)
    try {
      await payCreditCardBill({
        bill_id: Number(payBillId),
        amount: Number(payAmount),
        payment_date: payPaymentDate || todayISODate(),
        from_account_id: Number(payFromAcc),
        reference_number: payRef.trim() || null,
      })
      onSuccess?.()
    } catch (err) {
      if (err.status === 401) {
        setPfToken(null)
        onSessionInvalid?.()
      } else {
        const msg = err.message || 'Payment failed'
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
      {openBills.length === 0 ? (
        <p className="text-sm text-[var(--pf-text-muted)]">No open card bills. Generate a statement on Credit cards first.</p>
      ) : null}
      <div className="grid gap-4 sm:grid-cols-2">
        <AppInput
          id="pf-ge-ccpay-amt"
          label="Amount (₹)"
          type="number"
          inputMode="decimal"
          step="0.01"
          min="0"
          amount
          required
          value={payAmount}
          onChange={(e) => setPayAmount(e.target.value)}
        />
        <div>
          <label className={labelCls} htmlFor="pf-ge-ccpay-date">
            Payment date
          </label>
          <input
            id="pf-ge-ccpay-date"
            type="date"
            className={inputCls}
            required
            value={payPaymentDate}
            onChange={(e) => setPayPaymentDate(e.target.value)}
          />
        </div>
        <div className="sm:col-span-2">
          <PremiumSelect
            id="pf-ge-ccpay-bill"
            label="Bill"
            labelClassName={labelCls}
            required
            options={openBills.map((b) => {
              const rem = b.remaining != null ? b.remaining : Number(b.total_amount) - Number(b.amount_paid || 0)
              return {
                value: String(b.id),
                label: `#${b.id} · ${cardName(b.card_id)} · due ${b.due_date} · rem ${formatInr(rem)}`,
              }
            })}
            value={payBillId}
            onChange={setPayBillId}
            placeholder="Select…"
            searchable={openBills.length > 6}
          />
        </div>
        <div className="sm:col-span-2">
          <PremiumSelect
            id="pf-ge-ccpay-acc"
            label="From account"
            labelClassName={labelCls}
            required
            options={accounts.map((a) => ({ value: String(a.id), label: a.account_name }))}
            value={payFromAcc}
            onChange={setPayFromAcc}
            placeholder="Select…"
            searchable={accounts.length > 6}
          />
        </div>
        <div className="sm:col-span-2">
          <AppInput id="pf-ge-ccpay-ref" label="Reference (optional)" value={payRef} onChange={(e) => setPayRef(e.target.value)} />
        </div>
      </div>
      {submitting ? <p className="text-sm text-[var(--pf-text-muted)]">Saving…</p> : null}
    </form>
  )
}
