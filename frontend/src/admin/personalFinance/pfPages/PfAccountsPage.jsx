import {
  ArrowTrendingUpIcon,
  BanknotesIcon,
  BuildingLibraryIcon,
  CreditCardIcon,
  DevicePhoneMobileIcon,
  EllipsisVerticalIcon,
  PencilSquareIcon,
  ScaleIcon,
  TrashIcon,
} from '@heroicons/react/24/solid'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { AppButton, AppDropdown, AppInput, AppModal } from '../pfDesignSystem/index.js'
import { Link, useOutletContext } from 'react-router-dom'
import {
  createFinanceAccount,
  deleteFinanceAccount,
  listAccountTransferHistory,
  listFinanceAccounts,
  patchFinanceAccount,
  setPfToken,
} from '../api.js'
import {
  PF_FINANCE_ACCOUNT_TYPES,
  pfAccountTypeLabel,
  pfDefaultIncludeLiquid,
} from '../pfAccountTypes.js'
import {
  btnPrimary,
  btnSecondary,
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
import { PageHeader } from '../../../components/ui/PageHeader.jsx'

const MOVEMENT_LABELS = {
  internal_transfer: 'Internal transfer',
  external_deposit: 'External deposit',
  external_withdrawal: 'External withdrawal',
  credit_card_payment: 'Credit card payment',
  loan_disbursement: 'Loan disbursement',
  loan_emi_payment: 'Loan EMI payment',
}

function humanizeMovementType(t) {
  const k = String(t || '')
  return MOVEMENT_LABELS[k] ?? k.replace(/_/g, ' ')
}

const glassSummary =
  'relative overflow-hidden rounded-2xl border p-4 shadow-[var(--pf-shadow)] backdrop-blur-md transition-all duration-200 sm:p-5 ' +
  'border-white/10 bg-white/[0.05] hover:-translate-y-0.5 hover:border-white/15 hover:bg-white/[0.07] hover:shadow-lg ' +
  'dark:border-[var(--pf-border)] dark:bg-white/[0.04] dark:hover:bg-white/[0.07]'

const tintRing = {
  BANK: 'ring-1 ring-blue-500/25',
  CASH: 'ring-1 ring-emerald-500/25',
  WALLET: 'ring-1 ring-violet-500/25',
  CREDIT_CARD: 'ring-1 ring-orange-500/25',
  INVESTMENT: 'ring-1 ring-indigo-500/25',
  ASSET: 'ring-1 ring-indigo-500/20',
  DEFAULT: 'ring-1 ring-slate-400/15',
}

function accountTint(type) {
  const t = String(type || '').toUpperCase()
  return tintRing[t] || tintRing.DEFAULT
}

function TypeIcon({ type, className = 'h-6 w-6' }) {
  const t = String(type || '').toUpperCase()
  if (t === 'BANK') return <BuildingLibraryIcon className={className} />
  if (t === 'CASH') return <BanknotesIcon className={className} />
  if (t === 'WALLET') return <DevicePhoneMobileIcon className={className} />
  if (t === 'CREDIT_CARD') return <CreditCardIcon className={className} />
  if (t === 'INVESTMENT' || t === 'ASSET') return <ArrowTrendingUpIcon className={className} />
  if (t === 'LOAN_GIVEN' || t === 'LOAN_TAKEN') return <ScaleIcon className={className} />
  return <BanknotesIcon className={className} />
}

/** Top KPI strip */
function AccountSummaryCard({ icon: Icon, label, value, sub, accentClass }) {
  return (
    <div className={`${glassSummary} ${accentClass}`}>
      <div className="flex items-start justify-between gap-2">
        <div className="rounded-xl bg-[var(--pf-card-hover)]/80 p-2 text-[var(--pf-primary)] dark:text-sky-400">
          <Icon className="h-5 w-5" />
        </div>
      </div>
      <p className="mt-3 font-mono text-xl font-bold tabular-nums tracking-tight text-[var(--pf-text)] sm:text-2xl">
        {value}
      </p>
      <p className="mt-1 text-[11px] font-semibold uppercase tracking-wider text-[var(--pf-text-muted)]">{label}</p>
      {sub ? <p className="mt-0.5 text-xs text-[var(--pf-text-muted)]">{sub}</p> : null}
    </div>
  )
}

const quickBtn =
  'inline-flex min-w-0 flex-1 items-center justify-center rounded-lg border px-2 py-1.5 text-[11px] font-semibold transition ' +
  'border-[var(--pf-border)] bg-[var(--pf-input-bg)] text-[var(--pf-text)] hover:bg-[var(--pf-card-hover)]'

function AccountCard({
  account: a,
  editingId,
  editBalance,
  setEditBalance,
  savingId,
  togglingId,
  startEdit,
  cancelEdit,
  saveBalance,
  toggleFlag,
  handleDelete,
  deletingId,
}) {
  const [moreOpen, setMoreOpen] = useState(false)
  const tUpper = String(a.account_type || '').toUpperCase()
  const isEditing = editingId === a.id

  return (
    <div
      className={`rounded-2xl border p-5 shadow-[var(--pf-shadow)] backdrop-blur-md transition-all duration-200 ${accountTint(
        a.account_type,
      )} border-white/10 bg-white/[0.04] hover:-translate-y-0.5 hover:bg-white/[0.06] dark:border-[var(--pf-border)] dark:bg-white/[0.04] dark:hover:bg-white/[0.07]`}
    >
      <div className="flex gap-3">
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[var(--pf-card-hover)] text-[var(--pf-primary)] dark:text-sky-400">
          <TypeIcon type={a.account_type} className="h-6 w-6" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <h3 className="truncate font-semibold text-[var(--pf-text)]">{a.account_name}</h3>
              <p className="truncate text-xs text-[var(--pf-text-muted)]">{pfAccountTypeLabel(a.account_type)}</p>
            </div>
            <button
              type="button"
              className="rounded-lg p-1 text-[var(--pf-text-muted)] hover:bg-[var(--pf-card-hover)]"
              aria-expanded={moreOpen}
              aria-label="More actions"
              onClick={() => setMoreOpen((v) => !v)}
            >
              <EllipsisVerticalIcon className="h-5 w-5" />
            </button>
          </div>
          <div className="mt-3">
            {isEditing ? (
              <input
                type="number"
                step="0.01"
                className={`${inputCls} mt-0 font-mono text-lg`}
                value={editBalance}
                onChange={(e) => setEditBalance(e.target.value)}
                aria-label="Edit balance"
                autoFocus
              />
            ) : (
              <p className="font-mono text-xl font-bold tabular-nums text-[var(--pf-text)]">{formatInr(a.balance)}</p>
            )}
          </div>
        </div>
      </div>

      {moreOpen ? (
        <div className="mt-4 space-y-2 border-t border-[var(--pf-border)] pt-3 text-xs">
          <div className="flex flex-wrap gap-2">
            <span className="text-[var(--pf-text-muted)]">Net worth:</span>
            <button
              type="button"
              disabled={togglingId === a.id}
              onClick={() => toggleFlag(a.id, 'include_in_networth', !a.include_in_networth)}
              className="rounded-md border border-[var(--pf-border)] px-2 py-0.5 font-semibold text-[var(--pf-primary)] hover:bg-[var(--pf-card-hover)] disabled:opacity-50"
            >
              {a.include_in_networth !== false ? 'Included' : 'Excluded'}
            </button>
            <span className="text-[var(--pf-text-muted)]">Liquid:</span>
            <button
              type="button"
              disabled={togglingId === a.id}
              title="Bank / cash / wallet liquid filter"
              onClick={() => toggleFlag(a.id, 'include_in_liquid', !a.include_in_liquid)}
              className="rounded-md border border-[var(--pf-border)] px-2 py-0.5 font-semibold text-[var(--pf-primary)] hover:bg-[var(--pf-card-hover)] disabled:opacity-50"
            >
              {a.include_in_liquid !== false ? 'Included' : 'Excluded'}
            </button>
          </div>
          <div className="flex flex-wrap gap-2">
            {isEditing ? (
              <>
                <button
                  type="button"
                  onClick={() => saveBalance(a.id)}
                  disabled={savingId === a.id}
                  className={btnPrimary + ' h-9 min-h-0 px-3 text-xs'}
                >
                  {savingId === a.id ? '…' : 'Save balance'}
                </button>
                <button
                  type="button"
                  onClick={cancelEdit}
                  disabled={savingId === a.id}
                  className={btnSecondary + ' h-9 min-h-0 px-3 text-xs'}
                >
                  Cancel
                </button>
              </>
            ) : (
              <>
                <button
                  type="button"
                  onClick={() => startEdit(a)}
                  className="inline-flex items-center gap-1 rounded-lg border border-[var(--pf-border)] px-2.5 py-1 font-semibold text-[var(--pf-text)] hover:bg-[var(--pf-card-hover)]"
                >
                  <PencilSquareIcon className="h-4 w-4" />
                  Adjust balance
                </button>
                <button
                  type="button"
                  onClick={() => handleDelete(a)}
                  disabled={deletingId === a.id}
                  className="inline-flex items-center gap-1 rounded-lg border border-red-500/40 px-2.5 py-1 font-semibold text-red-400 hover:bg-red-500/10 disabled:opacity-50"
                >
                  <TrashIcon className="h-4 w-4" />
                  {deletingId === a.id ? '…' : 'Delete'}
                </button>
              </>
            )}
          </div>
        </div>
      ) : null}

      <div className="mt-4 flex flex-wrap gap-2">
        <Link
          to={`/personal-finance/transfer?from_account_id=${a.id}`}
          className={quickBtn}
          title="Move money from this account"
        >
          Transfer
        </Link>
        <Link to={`/personal-finance/income?account_id=${a.id}`} className={quickBtn}>
          Add income
        </Link>
        <Link to={`/personal-finance/expenses?account_id=${a.id}`} className={quickBtn}>
          Add expense
        </Link>
        <Link to={`/personal-finance/monthly-statements?tab=ledger&account_id=${a.id}`} className={quickBtn}>
          Ledger
        </Link>
      </div>
      {tUpper === 'CREDIT_CARD' ? (
        <p className="mt-2 text-[10px] leading-snug text-[var(--pf-text-muted)]">
          Credit balances follow your book convention; use expenses to build utilization.
        </p>
      ) : null}
    </div>
  )
}

function AccountGroup({ title, accounts, ...cardProps }) {
  if (!accounts.length) return null
  return (
    <section className="space-y-3">
      <h2 className="text-xs font-bold uppercase tracking-[0.14em] text-[var(--pf-text-muted)]">{title}</h2>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {accounts.map((a) => (
          <AccountCard key={a.id} account={a} {...cardProps} />
        ))}
      </div>
    </section>
  )
}

function AddAccountModal({
  open,
  onClose,
  onSubmit,
  submitting,
  accountName,
  setAccountName,
  accountType,
  setAccountType,
  balance,
  setBalance,
  includeNwCreate,
  setIncludeNwCreate,
  includeLiqCreate,
  setIncludeLiqCreate,
}) {
  const typeOptions = useMemo(
    () => PF_FINANCE_ACCOUNT_TYPES.map((t) => ({ value: t.value, label: t.label })),
    [],
  )
  return (
    <AppModal
      open={open}
      onClose={() => !submitting && onClose()}
      title="Add account"
      subtitle="Create a bank, cash, wallet, or other book account."
      maxWidthClass="max-w-[480px]"
      footer={
        <>
          <AppButton type="button" variant="secondary" disabled={submitting} onClick={onClose}>
            Cancel
          </AppButton>
          <AppButton type="submit" variant="primary" disabled={submitting} form="pf-account-add-form">
            {submitting ? 'Saving…' : 'Create account'}
          </AppButton>
        </>
      }
    >
      <form id="pf-account-add-form" onSubmit={onSubmit} className="space-y-4">
        <AppInput
          id="modal-acc-name"
          label="Account name"
          variant="boxed"
          value={accountName}
          onChange={(e) => setAccountName(e.target.value)}
          placeholder="HDFC Savings"
          required
          maxLength={200}
        />
        <div>
          <label htmlFor="modal-acc-type-dd" className={labelCls}>
            Account type
          </label>
          <AppDropdown
            id="modal-acc-type-dd"
            value={accountType}
            onChange={setAccountType}
            options={typeOptions}
            aria-label="Account type"
          />
        </div>
        <AppInput
          id="modal-acc-bal"
          label="Opening balance (₹)"
          type="number"
          step="0.01"
          amount
          value={balance}
          onChange={(e) => setBalance(e.target.value)}
          variant="boxed"
        />
        <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap">
          <label className="flex cursor-pointer items-center gap-2 text-sm text-[var(--pf-text)]">
            <input
              type="checkbox"
              checked={includeNwCreate}
              onChange={(e) => setIncludeNwCreate(e.target.checked)}
              className="rounded border-[var(--pf-border)] text-[var(--pf-primary)] focus:ring-[var(--pf-primary)]"
            />
            Include in net worth
          </label>
          <label className="flex cursor-pointer items-center gap-2 text-sm text-[var(--pf-text)]">
            <input
              type="checkbox"
              checked={includeLiqCreate}
              onChange={(e) => setIncludeLiqCreate(e.target.checked)}
              className="rounded border-[var(--pf-border)] text-[var(--pf-primary)] focus:ring-[var(--pf-primary)]"
            />
            Include in liquid cash
          </label>
        </div>
      </form>
    </AppModal>
  )
}

function sectionForAccountType(accountType) {
  const t = String(accountType || '').toUpperCase()
  if (t === 'BANK') return 'bank'
  if (t === 'CASH') return 'cash'
  if (t === 'WALLET') return 'wallet'
  if (t === 'CREDIT_CARD') return 'credit'
  if (t === 'INVESTMENT' || t === 'ASSET') return 'investment'
  return 'other'
}

export default function PfAccountsPage() {
  const { onSessionInvalid } = useOutletContext() || {}
  const { tick, refresh } = usePfRefresh()
  const [rows, setRows] = useState([])
  const [movements, setMovements] = useState([])
  const [loading, setLoading] = useState(true)
  const [movLoading, setMovLoading] = useState(false)
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [addOpen, setAddOpen] = useState(false)
  const [showTable, setShowTable] = useState(false)
  const [accountName, setAccountName] = useState('')
  const [accountType, setAccountType] = useState('BANK')
  const [balance, setBalance] = useState('0')
  const [includeNwCreate, setIncludeNwCreate] = useState(true)
  const [includeLiqCreate, setIncludeLiqCreate] = useState(true)
  const [editingId, setEditingId] = useState(null)
  const [editBalance, setEditBalance] = useState('')
  const [savingId, setSavingId] = useState(null)
  const [deletingId, setDeletingId] = useState(null)
  const [togglingId, setTogglingId] = useState(null)

  const load = useCallback(async () => {
    setLoading(true)
    setMovLoading(true)
    setError('')
    try {
      const [data, hist] = await Promise.all([
        listFinanceAccounts(),
        listAccountTransferHistory({ limit: 8, skip: 0 }).catch(() => ({ items: [], total: 0 })),
      ])
      setRows(Array.isArray(data) ? data : [])
      setMovements(Array.isArray(hist?.items) ? hist.items : [])
    } catch (e) {
      if (e.status === 401) {
        setPfToken(null)
        onSessionInvalid?.()
      } else {
        setError(e.message || 'Failed to load accounts')
      }
      setRows([])
      setMovements([])
    } finally {
      setLoading(false)
      setMovLoading(false)
    }
  }, [onSessionInvalid])

  useEffect(() => {
    load()
  }, [load, tick])

  useEffect(() => {
    setIncludeLiqCreate(pfDefaultIncludeLiquid(accountType))
  }, [accountType])

  function resetAddForm() {
    setAccountName('')
    setAccountType('BANK')
    setBalance('0')
    setIncludeNwCreate(true)
    setIncludeLiqCreate(true)
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setSubmitting(true)
    setError('')
    try {
      await createFinanceAccount({
        account_name: accountName.trim(),
        account_type: accountType,
        balance: Number(balance) || 0,
        include_in_networth: includeNwCreate,
        include_in_liquid: includeLiqCreate,
      })
      resetAddForm()
      setAddOpen(false)
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
      await patchFinanceAccount(accountId, { balance: Number(editBalance) || 0 })
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

  async function toggleFlag(accountId, field, next) {
    setTogglingId(accountId)
    setError('')
    try {
      await patchFinanceAccount(accountId, { [field]: next })
      await load()
      refresh()
    } catch (err) {
      if (err.status === 401) {
        setPfToken(null)
        onSessionInvalid?.()
      } else {
        setError(err.message || 'Could not update account')
      }
    } finally {
      setTogglingId(null)
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

  const accountNameById = useMemo(() => {
    const m = new Map()
    for (const x of rows) m.set(x.id, x.account_name)
    return m
  }, [rows])

  const movementLabel = useCallback(
    (id) => {
      if (!id) return 'Outside'
      return accountNameById.get(id) ?? `#${id}`
    },
    [accountNameById],
  )

  const sumByTypes = useCallback((types) => {
    const set = new Set(types.map((t) => String(t).toUpperCase()))
    let s = 0
    for (const a of rows) {
      if (set.has(String(a.account_type || '').toUpperCase())) s += Number(a.balance) || 0
    }
    return s
  }, [rows])

  const summary = useMemo(() => {
    const bank = sumByTypes(['BANK'])
    const cash = sumByTypes(['CASH'])
    const wallet = sumByTypes(['WALLET'])
    const creditRaw = sumByTypes(['CREDIT_CARD'])
    const creditUsed = Math.abs(creditRaw)
    const investments = sumByTypes(['INVESTMENT', 'ASSET'])
    return { bank, cash, wallet, creditUsed, investments }
  }, [rows, sumByTypes])

  const grouped = useMemo(() => {
    const g = { bank: [], cash: [], wallet: [], credit: [], investment: [], other: [] }
    for (const a of rows) {
      g[sectionForAccountType(a.account_type)].push(a)
    }
    const nameSort = (u, v) => String(u.account_name || '').localeCompare(String(v.account_name || ''))
    Object.keys(g).forEach((k) => g[k].sort(nameSort))
    return g
  }, [rows])

  const colCount = 6

  const cardProps = {
    editingId,
    editBalance,
    setEditBalance,
    savingId,
    togglingId,
    startEdit,
    cancelEdit,
    saveBalance,
    toggleFlag,
    handleDelete,
    deletingId,
  }

  return (
    <div className="space-y-8">
      <PageHeader
        title="Accounts"
        description="Balances by bank, cash, wallet, and credit — with fast actions for moving and recording money."
        action={
          <button type="button" className={btnPrimary} onClick={() => setAddOpen(true)}>
            Add account
          </button>
        }
      />

      {error ? (
        <div className="rounded-xl border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm text-amber-100">{error}</div>
      ) : null}

      <section aria-label="Account summary">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
          <AccountSummaryCard
            icon={BuildingLibraryIcon}
            label="Total bank"
            value={formatInr(summary.bank)}
            sub="All bank-type accounts"
            accentClass="ring-1 ring-blue-500/20"
          />
          <AccountSummaryCard
            icon={BanknotesIcon}
            label="Cash"
            value={formatInr(summary.cash)}
            sub="Physical cash"
            accentClass="ring-1 ring-emerald-500/20"
          />
          <AccountSummaryCard
            icon={DevicePhoneMobileIcon}
            label="Wallets"
            value={formatInr(summary.wallet)}
            sub="UPI / apps"
            accentClass="ring-1 ring-violet-500/20"
          />
          <AccountSummaryCard
            icon={CreditCardIcon}
            label="Credit (book)"
            value={formatInr(summary.creditUsed)}
            sub="Sum of |credit card balances|"
            accentClass="ring-1 ring-orange-500/20"
          />
          <AccountSummaryCard
            icon={ArrowTrendingUpIcon}
            label="Investments & assets"
            value={formatInr(summary.investments)}
            sub="Investment + asset accounts"
            accentClass="ring-1 ring-indigo-500/20"
          />
        </div>
      </section>

      {loading ? (
        <p className="text-sm text-[var(--pf-text-muted)]">Loading accounts…</p>
      ) : rows.length === 0 ? (
        <div className={cardCls}>
          <p className="text-[var(--pf-text-muted)]">No accounts yet — add one to start tracking balances.</p>
          <button type="button" className={`${btnPrimary} mt-4`} onClick={() => setAddOpen(true)}>
            Add your first account
          </button>
        </div>
      ) : (
        <div className="space-y-10">
          <AccountGroup title="Bank accounts" accounts={grouped.bank} {...cardProps} />
          <AccountGroup title="Cash" accounts={grouped.cash} {...cardProps} />
          <AccountGroup title="Digital wallets" accounts={grouped.wallet} {...cardProps} />
          <AccountGroup title="Credit cards" accounts={grouped.credit} {...cardProps} />
          <AccountGroup title="Investments & assets" accounts={grouped.investment} {...cardProps} />
          <AccountGroup title="Loans & other" accounts={grouped.other} {...cardProps} />
        </div>
      )}

      <section className={cardCls} aria-label="Recent movements">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="text-base font-bold text-[var(--pf-text)]">Recent account movements</h2>
            <p className="mt-0.5 text-xs text-[var(--pf-text-muted)]">Latest diary entries across all accounts.</p>
          </div>
          <Link to="/personal-finance/transfer" className={btnSecondary + ' h-9 min-h-0 whitespace-nowrap px-3 text-xs'}>
            Money movement
          </Link>
        </div>
        {movLoading ? (
          <p className="text-sm text-[var(--pf-text-muted)]">Loading…</p>
        ) : movements.length === 0 ? (
          <p className="text-sm text-[var(--pf-text-muted)]">No movements yet — record internal transfers or cash in/out on Money movement.</p>
        ) : (
          <div className={pfTableWrap}>
            <table className={`${pfTable} min-w-[640px]`}>
              <thead>
                <tr>
                  <th className={pfTh}>Date</th>
                  <th className={pfTh}>Type</th>
                  <th className={pfTh}>From</th>
                  <th className={pfTh}>To</th>
                  <th className={pfThRight}>Amount</th>
                </tr>
              </thead>
              <tbody>
                {movements.map((r) => (
                  <tr key={r.id} className={pfTrHover}>
                    <td className={pfTd}>{r.movement_date}</td>
                    <td className={pfTd}>{humanizeMovementType(r.movement_type)}</td>
                    <td className={pfTd}>{movementLabel(r.from_account_id)}</td>
                    <td className={pfTd}>{movementLabel(r.to_account_id)}</td>
                    <td className={pfTdRight}>{formatInr(r.amount)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[var(--pf-border)] pt-6">
        <p className="text-sm text-[var(--pf-text-muted)]">Need to bulk-edit flags or copy balances? Expand the detail table.</p>
        <button type="button" className={btnSecondary + ' h-9 min-h-0 px-3 text-xs'} onClick={() => setShowTable((v) => !v)}>
          {showTable ? 'Hide detail table' : 'Show detail table'}
        </button>
      </div>

      {showTable ? (
        <div className={cardCls}>
          <h2 className="text-base font-bold text-[var(--pf-text)]">All accounts (table)</h2>
          <div className={`mt-4 ${pfTableWrap}`}>
            <table className={`${pfTable} min-w-[720px]`}>
              <thead>
                <tr>
                  <th className={pfTh}>Name</th>
                  <th className={pfTh}>Type</th>
                  <th className={pfThRight}>Balance</th>
                  <th className={pfTh}>NW</th>
                  <th className={pfTh}>Liquid</th>
                  <th className={`${pfThRight} ${pfThActions}`}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={colCount} className="px-3 py-6 text-center text-[var(--pf-text-muted)] first:pl-4">
                      Loading…
                    </td>
                  </tr>
                ) : rows.length === 0 ? (
                  <tr>
                    <td colSpan={colCount} className="px-3 py-8 text-center text-[var(--pf-text-muted)] first:pl-4">
                      No accounts.
                    </td>
                  </tr>
                ) : (
                  rows.map((a) => (
                    <tr key={a.id} className={pfTrHover}>
                      <td className={`${pfTd} font-medium`}>{a.account_name}</td>
                      <td className={pfTd}>{pfAccountTypeLabel(a.account_type)}</td>
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
                      <td className={pfTd}>
                        <button
                          type="button"
                          disabled={togglingId === a.id}
                          onClick={() => toggleFlag(a.id, 'include_in_networth', !a.include_in_networth)}
                          className="rounded-lg border border-[var(--pf-border)] px-2 py-0.5 text-xs font-semibold text-[var(--pf-primary)] hover:bg-[var(--pf-card-hover)] disabled:opacity-50"
                        >
                          {a.include_in_networth !== false ? 'Yes' : 'No'}
                        </button>
                      </td>
                      <td className={pfTd}>
                        <button
                          type="button"
                          disabled={togglingId === a.id}
                          onClick={() => toggleFlag(a.id, 'include_in_liquid', !a.include_in_liquid)}
                          className="rounded-lg border border-[var(--pf-border)] px-2 py-0.5 text-xs font-semibold text-[var(--pf-primary)] hover:bg-[var(--pf-card-hover)] disabled:opacity-50"
                          title="Counts toward liquid (Bank/Cash/Wallet)"
                        >
                          {a.include_in_liquid !== false ? 'Yes' : 'No'}
                        </button>
                      </td>
                      <td className={pfTdActions}>
                        {editingId === a.id ? (
                          <div className={pfActionRow}>
                            <button
                              type="button"
                              onClick={() => saveBalance(a.id)}
                              disabled={savingId === a.id}
                              className={btnPrimary + ' h-8 min-h-0 px-2.5 text-xs'}
                            >
                              {savingId === a.id ? '…' : 'Save'}
                            </button>
                            <button
                              type="button"
                              onClick={cancelEdit}
                              disabled={savingId === a.id}
                              className={btnSecondary + ' h-8 min-h-0 px-2.5 text-xs'}
                            >
                              Cancel
                            </button>
                          </div>
                        ) : (
                          <div className={pfActionRow}>
                            <button
                              type="button"
                              onClick={() => startEdit(a)}
                              className="inline-flex items-center gap-1 rounded-lg border border-[var(--pf-border)] px-2 py-1 text-xs font-semibold text-[var(--pf-primary)] hover:bg-[var(--pf-card-hover)]"
                              title="Edit balance"
                            >
                              <PencilSquareIcon className="h-4 w-4" />
                              Edit
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDelete(a)}
                              disabled={deletingId === a.id}
                              className="inline-flex items-center gap-1 rounded-lg border border-red-500/40 px-2 py-1 text-xs font-semibold text-red-400 hover:bg-red-500/10 disabled:opacity-60"
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
      ) : null}

      <AddAccountModal
        open={addOpen}
        onClose={() => {
          if (!submitting) {
            setAddOpen(false)
            resetAddForm()
          }
        }}
        onSubmit={handleSubmit}
        submitting={submitting}
        accountName={accountName}
        setAccountName={setAccountName}
        accountType={accountType}
        setAccountType={setAccountType}
        balance={balance}
        setBalance={setBalance}
        includeNwCreate={includeNwCreate}
        setIncludeNwCreate={setIncludeNwCreate}
        includeLiqCreate={includeLiqCreate}
        setIncludeLiqCreate={setIncludeLiqCreate}
      />
    </div>
  )
}
