import {
  ArrowTrendingDownIcon,
  ArrowTrendingUpIcon,
  ArrowsRightLeftIcon,
  BanknotesIcon,
  BuildingLibraryIcon,
  CalendarDaysIcon,
  ChartBarIcon,
  CreditCardIcon,
  CubeIcon,
  UserGroupIcon,
  WalletIcon,
} from '@heroicons/react/24/solid'
import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  listCreditCardBills,
  listCreditCards,
  listFinanceAccounts,
  listFinanceLiabilities,
  listFinanceLoans,
  listPfExpenseCategories,
  listPfIncomeCategories,
  listPfPaymentInstruments,
} from '../api.js'
import { AppButton, AppModal } from '../pfDesignSystem/index.js'
import { usePfToast } from '../notifications/pfToastContext.jsx'
import { usePfRefresh } from '../pfRefreshContext.jsx'
import { loadPfAppPrefs } from '../pfSettingsPrefs.js'
import AccountForm from './forms/AccountForm.jsx'
import AssetForm from './forms/AssetForm.jsx'
import CreditCardPaymentForm from './forms/CreditCardPaymentForm.jsx'
import CreditCardSwipeForm from './forms/CreditCardSwipeForm.jsx'
import EmiPaymentForm from './forms/EmiPaymentForm.jsx'
import ExpenseForm from './forms/ExpenseForm.jsx'
import IncomeForm from './forms/IncomeForm.jsx'
import InvestmentForm from './forms/InvestmentForm.jsx'
import LoanGivenForm from './forms/LoanGivenForm.jsx'
import LoanTakenForm from './forms/LoanTakenForm.jsx'
import TransferForm from './forms/TransferForm.jsx'

const ENTRY_GRID = [
  {
    id: 'expense',
    label: 'Expense',
    sub: 'Debit spend',
    icon: ArrowTrendingDownIcon,
    ring: 'ring-rose-500/30',
    bg: 'bg-rose-500/10',
    iconCls: 'text-rose-600 dark:text-rose-400',
  },
  {
    id: 'income',
    label: 'Income',
    sub: 'Credit inflow',
    icon: ArrowTrendingUpIcon,
    ring: 'ring-emerald-500/30',
    bg: 'bg-emerald-500/10',
    iconCls: 'text-emerald-600 dark:text-emerald-400',
  },
  {
    id: 'transfer',
    label: 'Transfer',
    sub: 'Between accounts',
    icon: ArrowsRightLeftIcon,
    ring: 'ring-sky-500/30',
    bg: 'bg-sky-500/10',
    iconCls: 'text-sky-600 dark:text-sky-400',
  },
  {
    id: 'cc_swipe',
    label: 'Card swipe',
    sub: 'Credit card',
    icon: CreditCardIcon,
    ring: 'ring-violet-500/30',
    bg: 'bg-violet-500/10',
    iconCls: 'text-violet-600 dark:text-violet-400',
  },
  {
    id: 'cc_pay',
    label: 'Card payment',
    sub: 'Pay statement',
    icon: BanknotesIcon,
    ring: 'ring-indigo-500/30',
    bg: 'bg-indigo-500/10',
    iconCls: 'text-indigo-600 dark:text-indigo-400',
  },
  {
    id: 'loan_given',
    label: 'Loan given',
    sub: 'You lent',
    icon: UserGroupIcon,
    ring: 'ring-amber-500/30',
    bg: 'bg-amber-500/10',
    iconCls: 'text-amber-600 dark:text-amber-400',
  },
  {
    id: 'loan_taken',
    label: 'Loan taken',
    sub: 'Borrowed',
    icon: BuildingLibraryIcon,
    ring: 'ring-orange-500/30',
    bg: 'bg-orange-500/10',
    iconCls: 'text-orange-600 dark:text-orange-400',
  },
  {
    id: 'emi',
    label: 'EMI payment',
    sub: 'Loans / liabilities',
    icon: CalendarDaysIcon,
    ring: 'ring-cyan-500/30',
    bg: 'bg-cyan-500/10',
    iconCls: 'text-cyan-600 dark:text-cyan-400',
  },
  {
    id: 'investment',
    label: 'Investment',
    sub: 'Portfolio',
    icon: ChartBarIcon,
    ring: 'ring-blue-500/30',
    bg: 'bg-blue-500/10',
    iconCls: 'text-blue-600 dark:text-blue-400',
  },
  {
    id: 'asset',
    label: 'Asset',
    sub: 'Fixed asset',
    icon: CubeIcon,
    ring: 'ring-teal-500/30',
    bg: 'bg-teal-500/10',
    iconCls: 'text-teal-600 dark:text-teal-400',
  },
  {
    id: 'account',
    label: 'Account',
    sub: 'Bank / cash',
    icon: WalletIcon,
    ring: 'ring-slate-500/30',
    bg: 'bg-slate-500/10',
    iconCls: 'text-slate-600 dark:text-slate-300',
  },
]

const TITLES = {
  expense: 'Add expense',
  income: 'Add income',
  transfer: 'Transfer money',
  cc_swipe: 'Credit card swipe',
  cc_pay: 'Pay credit card bill',
  loan_given: 'Loan given',
  loan_taken: 'Borrowed liability',
  emi: 'EMI payment',
  investment: 'Add investment',
  asset: 'Add asset',
  account: 'Add account',
}

const TOAST_SUCCESS = {
  expense: { title: 'Expense added' },
  income: { title: 'Income recorded' },
  transfer: { title: 'Money transferred' },
  cc_swipe: { title: 'Card transaction added' },
  cc_pay: { title: 'Card payment recorded' },
  loan_given: { title: 'Loan recorded' },
  loan_taken: { title: 'Liability saved' },
  emi: { title: 'EMI payment recorded' },
  investment: { title: 'Investment saved' },
  asset: { title: 'Asset saved' },
  account: { title: 'Account added' },
}

const SAVE_LABELS = {
  expense: 'Save expense',
  income: 'Save income',
  transfer: 'Transfer',
  cc_swipe: 'Save swipe',
  cc_pay: 'Pay bill',
  loan_given: 'Save loan',
  loan_taken: 'Save liability',
  emi: 'Record EMI',
  investment: 'Save',
  asset: 'Save asset',
  account: 'Save account',
}

function mapPrefsInvestmentType(v) {
  const m = {
    mutual_fund: 'MUTUAL_FUND',
    stock: 'STOCK',
    fd: 'FD',
    other: 'OTHER',
  }
  return m[v] || 'MUTUAL_FUND'
}

export default function UniversalEntryModal({ open, onClose, onSessionInvalid }) {
  const { refresh } = usePfRefresh()
  const toast = usePfToast()
  const [step, setStep] = useState('pick')
  const [entryId, setEntryId] = useState(null)
  const [loading, setLoading] = useState(false)
  const [loadError, setLoadError] = useState('')
  const [accounts, setAccounts] = useState([])
  const [expenseCategories, setExpenseCategories] = useState([])
  const [incomeCategories, setIncomeCategories] = useState([])
  const [instruments, setInstruments] = useState([])
  const [creditCards, setCreditCards] = useState([])
  const [bills, setBills] = useState([])
  const [loans, setLoans] = useState([])
  const [liabilities, setLiabilities] = useState([])

  const prefs = useMemo(() => loadPfAppPrefs(), [open])

  const categoryById = useMemo(() => {
    const m = new Map()
    for (const c of expenseCategories) m.set(c.id, c)
    return m
  }, [expenseCategories])

  const incomeCategoryById = useMemo(() => {
    const m = new Map()
    for (const c of incomeCategories) m.set(c.id, c)
    return m
  }, [incomeCategories])

  const defaultAccountNum = useMemo(() => {
    const raw = prefs?.preferences?.defaultAccountId
    if (raw == null || raw === '') return null
    const n = Number(raw)
    return Number.isFinite(n) ? n : null
  }, [prefs])

  const defaultCreditNum = useMemo(() => {
    const raw = prefs?.preferences?.defaultCreditCardId
    if (raw == null || raw === '') return null
    const n = Number(raw)
    return Number.isFinite(n) ? n : null
  }, [prefs])

  const defaultPayWith = useMemo(() => {
    if (defaultAccountNum != null && accounts.some((a) => a.id === defaultAccountNum)) {
      return `acc:${defaultAccountNum}`
    }
    if (defaultCreditNum != null && creditCards.some((c) => c.id === defaultCreditNum)) {
      return `cc:${defaultCreditNum}`
    }
    return ''
  }, [accounts, creditCards, defaultAccountNum, defaultCreditNum])

  const transferDefaults = useMemo(() => {
    let from = defaultAccountNum
    let to = null
    for (const a of accounts) {
      if (from != null && a.id !== from) {
        to = a.id
        break
      }
    }
    if (from == null && accounts[0]) {
      from = accounts[0].id
      to = accounts[1]?.id ?? null
    }
    return { from, to }
  }, [accounts, defaultAccountNum])

  const loadBootstrap = useCallback(async () => {
    setLoadError('')
    setLoading(true)
    try {
      const [a, ec, ic, pi, cc, bl, ln, liab] = await Promise.all([
        listFinanceAccounts(),
        listPfExpenseCategories(),
        listPfIncomeCategories(),
        listPfPaymentInstruments(),
        listCreditCards(),
        listCreditCardBills({ limit: 200 }),
        listFinanceLoans({ limit: 200 }),
        listFinanceLiabilities({ limit: 300 }),
      ])
      setAccounts(Array.isArray(a) ? a : [])
      setExpenseCategories(Array.isArray(ec) ? ec : [])
      setIncomeCategories(Array.isArray(ic) ? ic : [])
      setInstruments(Array.isArray(pi) ? pi : [])
      setCreditCards(Array.isArray(cc) ? cc : [])
      setBills(Array.isArray(bl) ? bl : [])
      setLoans(Array.isArray(ln) ? ln : [])
      setLiabilities(Array.isArray(liab) ? liab : [])
    } catch (e) {
      if (e.status === 401) {
        onSessionInvalid?.()
      } else {
        setLoadError(e.message || 'Could not load data')
      }
    } finally {
      setLoading(false)
    }
  }, [onSessionInvalid])

  useEffect(() => {
    if (!open) return
    setStep('pick')
    setEntryId(null)
    loadBootstrap()
  }, [open, loadBootstrap])

  const formId = entryId ? `pf-global-${entryId}` : 'pf-global-none'

  function handleSaved() {
    const kind = entryId
    const t = kind ? TOAST_SUCCESS[kind] : null
    if (t) toast.success(t.title, t.description)
    else toast.success('Saved')
    refresh()
    onClose()
    setStep('pick')
    setEntryId(null)
  }

  function pickEntry(id) {
    setEntryId(id)
    setStep('form')
  }

  function goBack() {
    setStep('pick')
    setEntryId(null)
  }

  const title =
    step === 'pick'
      ? 'Add new entry'
      : TITLES[entryId] || 'Add new entry'

  const subtitle =
    step === 'pick'
      ? 'Choose what you want to add — same shortcuts as the full pages, faster.'
      : 'Amount and date first where it matters; Esc closes, Enter saves.'

  const showForm = step === 'form' && entryId

  const body = loading ? (
    <div className="flex min-h-[12rem] flex-col items-center justify-center gap-3">
      <div
        className="h-9 w-9 animate-spin rounded-full border-2 border-[var(--pf-border)] border-t-[var(--pf-primary)]"
        aria-hidden
      />
      <p className="text-sm text-[var(--pf-text-muted)]">Loading accounts & categories…</p>
    </div>
  ) : loadError ? (
    <p className="text-sm text-amber-800 dark:text-amber-200">{loadError}</p>
  ) : step === 'pick' ? (
    <div>
      <p className="mb-4 text-sm font-medium text-[var(--pf-text)]">What do you want to add?</p>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {ENTRY_GRID.map((item) => {
          const Icon = item.icon
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => pickEntry(item.id)}
              className={`flex flex-col items-start gap-2 rounded-xl border border-[var(--pf-border)] p-4 text-left shadow-sm ring-2 ring-transparent transition hover:bg-[var(--pf-card-hover)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--pf-primary)] ${item.bg}`}
            >
              <span className={`flex h-10 w-10 items-center justify-center rounded-lg ${item.ring} ring-1 ${item.bg}`}>
                <Icon className={`h-5 w-5 ${item.iconCls}`} aria-hidden />
              </span>
              <span className="text-sm font-semibold text-[var(--pf-text)]">{item.label}</span>
              <span className="text-xs text-[var(--pf-text-muted)]">{item.sub}</span>
            </button>
          )
        })}
      </div>
    </div>
  ) : entryId === 'expense' ? (
    <ExpenseForm
      formId={formId}
      accounts={accounts}
      instruments={instruments}
      creditCards={creditCards}
      categories={expenseCategories}
      categoryById={categoryById}
      defaultPayWith={defaultPayWith}
      onSuccess={handleSaved}
      onSessionInvalid={onSessionInvalid}
    />
  ) : entryId === 'income' ? (
    <IncomeForm
      formId={formId}
      accounts={accounts}
      categories={incomeCategories}
      categoryById={incomeCategoryById}
      defaultAccountId={defaultAccountNum}
      onSuccess={handleSaved}
      onSessionInvalid={onSessionInvalid}
    />
  ) : entryId === 'transfer' ? (
    <TransferForm
      formId={formId}
      accounts={accounts}
      defaultFromId={transferDefaults.from}
      defaultToId={transferDefaults.to}
      onSuccess={handleSaved}
      onSessionInvalid={onSessionInvalid}
    />
  ) : entryId === 'cc_swipe' ? (
    <CreditCardSwipeForm
      formId={formId}
      creditCards={creditCards}
      categories={expenseCategories}
      defaultCardId={defaultCreditNum}
      onSuccess={handleSaved}
      onSessionInvalid={onSessionInvalid}
    />
  ) : entryId === 'cc_pay' ? (
    <CreditCardPaymentForm
      formId={formId}
      accounts={accounts}
      creditCards={creditCards}
      bills={bills}
      defaultAccountId={defaultAccountNum}
      onSuccess={handleSaved}
      onSessionInvalid={onSessionInvalid}
    />
  ) : entryId === 'loan_given' ? (
    <LoanGivenForm formId={formId} onSuccess={handleSaved} onSessionInvalid={onSessionInvalid} />
  ) : entryId === 'loan_taken' ? (
    <LoanTakenForm formId={formId} onSuccess={handleSaved} onSessionInvalid={onSessionInvalid} />
  ) : entryId === 'emi' ? (
    <EmiPaymentForm
      formId={formId}
      loans={loans}
      liabilities={liabilities}
      accounts={accounts}
      defaultAccountId={defaultAccountNum}
      onSuccess={handleSaved}
      onSessionInvalid={onSessionInvalid}
    />
  ) : entryId === 'investment' ? (
    <InvestmentForm
      formId={formId}
      defaultType={mapPrefsInvestmentType(prefs?.preferences?.defaultInvestmentType)}
      defaultPlatform={prefs?.investments?.defaultPlatform || ''}
      onSuccess={handleSaved}
      onSessionInvalid={onSessionInvalid}
    />
  ) : entryId === 'asset' ? (
    <AssetForm formId={formId} onSuccess={handleSaved} onSessionInvalid={onSessionInvalid} />
  ) : entryId === 'account' ? (
    <AccountForm formId={formId} onSuccess={handleSaved} onSessionInvalid={onSessionInvalid} />
  ) : null

  return (
    <AppModal
      open={open}
      onClose={onClose}
      title={title}
      subtitle={subtitle}
      maxWidthClass="max-w-2xl"
      footer={
        showForm ? (
          <>
            <AppButton type="button" variant="secondary" onClick={goBack}>
              Back
            </AppButton>
            <AppButton type="button" variant="secondary" onClick={onClose}>
              Cancel
            </AppButton>
            <AppButton type="submit" variant="primary" form={formId}>
              {SAVE_LABELS[entryId] || 'Save'}
            </AppButton>
          </>
        ) : (
          <AppButton type="button" variant="secondary" onClick={onClose}>
            Close
          </AppButton>
        )
      }
    >
      {body}
    </AppModal>
  )
}
