import { useState } from 'react'
import { createFinanceAccount, setPfToken } from '../../api.js'
import { usePfToast } from '../../notifications/pfToastContext.jsx'
import { AppInput } from '../../pfDesignSystem/index.js'
import { inputCls, labelCls } from '../../pfFormStyles.js'
import { PF_FINANCE_ACCOUNT_TYPES, pfDefaultIncludeLiquid } from '../../pfAccountTypes.js'

export default function AccountForm({ formId, onSuccess, onSessionInvalid }) {
  const [accountName, setAccountName] = useState('')
  const [accountType, setAccountType] = useState('BANK')
  const [balance, setBalance] = useState('')
  const [includeNw, setIncludeNw] = useState(true)
  const [includeLiq, setIncludeLiq] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const toast = usePfToast()

  function onTypeChange(next) {
    setAccountType(next)
    setIncludeLiq(pfDefaultIncludeLiquid(next))
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    if (!accountName.trim()) {
      setError('Account name is required.')
      return
    }
    setSubmitting(true)
    try {
      await createFinanceAccount({
        account_name: accountName.trim(),
        account_type: accountType,
        balance: Number(balance) || 0,
        include_in_networth: includeNw,
        include_in_liquid: includeLiq,
      })
      onSuccess?.()
    } catch (err) {
      if (err.status === 401) {
        setPfToken(null)
        onSessionInvalid?.()
      } else {
        const msg = err.message || 'Could not create account'
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
          id="pf-ge-ac-bal"
          label="Opening balance (₹)"
          type="number"
          inputMode="decimal"
          step="0.01"
          amount
          value={balance}
          onChange={(e) => setBalance(e.target.value)}
        />
        <div>
          <label className={labelCls} htmlFor="pf-ge-ac-type">
            Account type
          </label>
          <select id="pf-ge-ac-type" className={inputCls} value={accountType} onChange={(e) => onTypeChange(e.target.value)}>
            {PF_FINANCE_ACCOUNT_TYPES.map((t) => (
              <option key={t.value} value={t.value}>
                {t.label}
              </option>
            ))}
          </select>
        </div>
        <div className="sm:col-span-2">
          <AppInput id="pf-ge-ac-name" label="Account name" required value={accountName} onChange={(e) => setAccountName(e.target.value)} />
        </div>
        <label className="flex cursor-pointer items-center gap-2 text-sm text-[var(--pf-text)] sm:col-span-2">
          <input type="checkbox" checked={includeNw} onChange={(e) => setIncludeNw(e.target.checked)} />
          Include in net worth
        </label>
        <label className="flex cursor-pointer items-center gap-2 text-sm text-[var(--pf-text)] sm:col-span-2">
          <input type="checkbox" checked={includeLiq} onChange={(e) => setIncludeLiq(e.target.checked)} />
          Include in liquid assets
        </label>
      </div>
      {submitting ? <p className="text-sm text-[var(--pf-text-muted)]">Saving…</p> : null}
    </form>
  )
}
