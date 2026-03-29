import { PencilSquareIcon, TrashIcon } from '@heroicons/react/24/solid'
import { useCallback, useEffect, useState } from 'react'
import { useOutletContext } from 'react-router-dom'
import {
  createFinanceAccount,
  deleteFinanceAccount,
  listFinanceAccounts,
  patchFinanceAccountBalance,
  setPfToken,
} from '../api.js'
import {
  btnPrimary,
  cardCls,
  inputCls,
  labelCls,
  pfActionRow,
  pfTable,
  pfTableWrap,
  pfTd,
  pfTdActions,
  pfTdRight,
  pfTh,
  pfThActions,
  pfThRight,
  pfTrHover,
} from '../pfFormStyles.js'
import { formatInr } from '../pfFormat.js'
import { usePfRefresh } from '../pfRefreshContext.jsx'

export default function PfAccountsPage() {
  const { onSessionInvalid } = useOutletContext() || {}
  const { tick, refresh } = usePfRefresh()
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [accountName, setAccountName] = useState('')
  const [accountType, setAccountType] = useState('SAVINGS')
  const [balance, setBalance] = useState('0')
  const [editingId, setEditingId] = useState(null)
  const [editBalance, setEditBalance] = useState('')
  const [savingId, setSavingId] = useState(null)
  const [deletingId, setDeletingId] = useState(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const data = await listFinanceAccounts()
      setRows(Array.isArray(data) ? data : [])
    } catch (e) {
      if (e.status === 401) {
        setPfToken(null)
        onSessionInvalid?.()
      } else {
        setError(e.message || 'Failed to load accounts')
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
      await createFinanceAccount({
        account_name: accountName.trim(),
        account_type: accountType.trim() || 'OTHER',
        balance: Number(balance) || 0,
      })
      setAccountName('')
      setBalance('0')
      await load()
      refresh()
    } catch (err) {
      if (err.status === 401) {
        setPfToken(null)
        onSessionInvalid?.()
      } else {
        setError(err.message || 'Could not create account')
      }
    } finally {
      setSubmitting(false)
    }
  }

  function startEdit(a) {
    setEditingId(a.id)
    setEditBalance(String(a.balance ?? ''))
  }

  function cancelEdit() {
    setEditingId(null)
    setEditBalance('')
    setSavingId(null)
  }

  async function saveBalance(accountId) {
    setSavingId(accountId)
    setError('')
    try {
      await patchFinanceAccountBalance(accountId, { balance: Number(editBalance) || 0 })
      cancelEdit()
      await load()
      refresh()
    } catch (err) {
      if (err.status === 401) {
        setPfToken(null)
        onSessionInvalid?.()
      } else {
        setError(err.message || 'Could not update balance')
      }
    } finally {
      setSavingId(null)
    }
  }

  async function handleDelete(a) {
    const bal = formatInr(a.balance)
    const ok = window.confirm(
      `Delete “${a.account_name}”?\n\n` +
        `All income and expense entries linked to this account will be permanently removed from the database.\n` +
        `This cannot be undone. The account balance (${bal}) will no longer count toward total cash.`,
    )
    if (!ok) return
    setDeletingId(a.id)
    setError('')
    try {
      await deleteFinanceAccount(a.id)
      if (editingId === a.id) cancelEdit()
      await load()
      refresh()
    } catch (err) {
      if (err.status === 401) {
        setPfToken(null)
        onSessionInvalid?.()
      } else {
        setError(err.message || 'Could not delete account')
      }
    } finally {
      setDeletingId(null)
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-slate-900 sm:text-2xl">Accounts</h1>
        <p className="mt-1 text-sm text-slate-500">Cash and bank balances used for income and expenses.</p>
      </div>

      {error ? (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">{error}</div>
      ) : null}

      <div className={cardCls}>
        <h2 className="text-base font-bold text-slate-900">Add account</h2>
        <form onSubmit={handleSubmit} className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div className="sm:col-span-2">
            <label htmlFor="acc-name" className={labelCls}>
              Account name
            </label>
            <input
              id="acc-name"
              className={inputCls}
              value={accountName}
              onChange={(e) => setAccountName(e.target.value)}
              placeholder="HDFC Savings"
              required
              maxLength={200}
            />
          </div>
          <div>
            <label htmlFor="acc-type" className={labelCls}>
              Type
            </label>
            <input
              id="acc-type"
              className={inputCls}
              value={accountType}
              onChange={(e) => setAccountType(e.target.value)}
              placeholder="SAVINGS, CURRENT, CASH…"
              maxLength={40}
            />
          </div>
          <div>
            <label htmlFor="acc-bal" className={labelCls}>
              Opening balance (₹)
            </label>
            <input
              id="acc-bal"
              type="number"
              step="0.01"
              className={inputCls}
              value={balance}
              onChange={(e) => setBalance(e.target.value)}
            />
          </div>
          <div className="flex items-end sm:col-span-2 lg:col-span-4">
            <button type="submit" disabled={submitting} className={btnPrimary}>
              {submitting ? 'Saving…' : 'Create account'}
            </button>
          </div>
        </form>
      </div>

      <div className={cardCls}>
        <h2 className="text-base font-bold text-slate-900">Your accounts</h2>
        <div className={`mt-4 ${pfTableWrap}`}>
          <table className={`${pfTable} min-w-[480px]`}>
            <thead>
              <tr>
                <th className={pfTh}>Name</th>
                <th className={pfTh}>Type</th>
                <th className={pfThRight}>Balance</th>
                <th className={`${pfThRight} ${pfThActions}`}>Actions</th>
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
                    No accounts yet — add one above.
                  </td>
                </tr>
              ) : (
                rows.map((a) => (
                  <tr key={a.id} className={pfTrHover}>
                    <td className={`${pfTd} font-medium text-slate-900`}>{a.account_name}</td>
                    <td className={`${pfTd} text-slate-600`}>{a.account_type}</td>
                    <td className={`${pfTdRight} align-middle`}>
                      {editingId === a.id ? (
                        <input
                          type="number"
                          step="0.01"
                          className={`${inputCls} mt-0 inline-block w-36 text-right`}
                          value={editBalance}
                          onChange={(e) => setEditBalance(e.target.value)}
                          aria-label="Edit balance"
                          autoFocus
                        />
                      ) : (
                        formatInr(a.balance)
                      )}
                    </td>
                    <td className={pfTdActions}>
                      {editingId === a.id ? (
                        <div className={pfActionRow}>
                          <button
                            type="button"
                            onClick={() => saveBalance(a.id)}
                            disabled={savingId === a.id}
                            className="rounded-lg bg-[#004080] px-2.5 py-1 text-xs font-semibold text-white hover:bg-[#003366] disabled:opacity-60"
                          >
                            {savingId === a.id ? '…' : 'Save'}
                          </button>
                          <button
                            type="button"
                            onClick={cancelEdit}
                            disabled={savingId === a.id}
                            className="rounded-lg border border-sky-200 px-2.5 py-1 text-xs font-semibold text-slate-600 hover:bg-sky-50 disabled:opacity-60"
                          >
                            Cancel
                          </button>
                        </div>
                      ) : (
                        <div className={pfActionRow}>
                          <button
                            type="button"
                            onClick={() => startEdit(a)}
                            className="inline-flex items-center gap-1 rounded-lg border border-sky-200 px-2 py-1 text-xs font-semibold text-[#004080] hover:bg-sky-50"
                            title="Edit balance"
                          >
                            <PencilSquareIcon className="h-4 w-4" />
                            Edit
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDelete(a)}
                            disabled={deletingId === a.id}
                            className="inline-flex items-center gap-1 rounded-lg border border-red-200 px-2 py-1 text-xs font-semibold text-red-700 hover:bg-red-50 disabled:opacity-60"
                            title="Delete account"
                          >
                            <TrashIcon className="h-4 w-4" />
                            {deletingId === a.id ? '…' : 'Delete'}
                          </button>
                        </div>
                      )}
                    </td>
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
