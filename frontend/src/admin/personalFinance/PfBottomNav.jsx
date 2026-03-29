import {
  BanknotesIcon,
  CreditCardIcon,
  EllipsisHorizontalIcon,
  HomeIcon,
  PlusIcon,
  ScaleIcon,
  WalletIcon,
} from '@heroicons/react/24/solid'
import { useState } from 'react'
import { NavLink, useNavigate } from 'react-router-dom'

const navH = 'min-h-[64px]'
const navItem =
  `flex min-w-0 flex-1 flex-col items-center justify-center gap-0.5 rounded-[12px] py-1 text-[10px] font-semibold transition-all duration-200 active:scale-95 sm:text-xs`
const navInactive = 'text-[var(--pf-text-muted)]'
const navActive = 'text-[var(--pf-primary)]'

function PfQuickAddSheet({ open, onClose }) {
  const navigate = useNavigate()
  if (!open) return null
  const go = (path) => {
    onClose()
    navigate(path)
  }
  return (
    <div
      className="fixed inset-0 z-[60] flex flex-col justify-end bg-slate-900/45 backdrop-blur-sm md:hidden"
      role="dialog"
      aria-modal="true"
      aria-label="Quick add"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <div
        className="pf-sheet-panel rounded-t-2xl border border-[var(--pf-border)] bg-[var(--pf-card)] p-4 pb-[max(1rem,env(safe-area-inset-bottom))] shadow-[var(--pf-shadow)]"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-[var(--pf-border)]" />
        <p className="mb-3 text-center text-sm font-bold text-[var(--pf-text)]">Add new</p>
        <div className="grid gap-2">
          <button
            type="button"
            onClick={() => go('/personal-finance/income')}
            className="flex items-center gap-3 rounded-[12px] border border-[var(--pf-border)] bg-[var(--pf-card-hover)]/50 px-4 py-3 text-left text-sm font-semibold text-[var(--pf-text)] transition hover:bg-[var(--pf-card-hover)] active:scale-[0.99]"
          >
            <BanknotesIcon className="h-6 w-6 text-emerald-600" />
            Add income
          </button>
          <button
            type="button"
            onClick={() => go('/personal-finance/expenses')}
            className="flex items-center gap-3 rounded-[12px] border border-[var(--pf-border)] bg-[var(--pf-card-hover)]/50 px-4 py-3 text-left text-sm font-semibold text-[var(--pf-text)] transition hover:bg-[var(--pf-card-hover)] active:scale-[0.99]"
          >
            <CreditCardIcon className="h-6 w-6 text-[#EF4444]" />
            Add expense
          </button>
          <button
            type="button"
            onClick={() => go('/personal-finance/loans')}
            className="flex items-center gap-3 rounded-[12px] border border-[var(--pf-border)] bg-[var(--pf-card-hover)]/50 px-4 py-3 text-left text-sm font-semibold text-[var(--pf-text)] transition hover:bg-[var(--pf-card-hover)] active:scale-[0.99]"
          >
            <ScaleIcon className="h-6 w-6 text-[var(--pf-primary)]" />
            Add loan
          </button>
          <button
            type="button"
            onClick={() => go('/personal-finance/accounts')}
            className="flex items-center gap-3 rounded-[12px] border border-[var(--pf-border)] bg-[var(--pf-card-hover)]/50 px-4 py-3 text-left text-sm font-semibold text-[var(--pf-text)] transition hover:bg-[var(--pf-card-hover)] active:scale-[0.99]"
          >
            <WalletIcon className="h-6 w-6 text-sky-600" />
            Add account
          </button>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="mt-3 w-full rounded-[12px] border border-[var(--pf-border)] py-2.5 text-sm font-semibold text-[var(--pf-text-muted)] transition hover:bg-[var(--pf-card-hover)] active:scale-[0.99]"
        >
          Cancel
        </button>
      </div>
    </div>
  )
}

/**
 * Mobile bottom bar (md+ hidden). Safe-area aware.
 */
export default function PfBottomNav() {
  const [quickOpen, setQuickOpen] = useState(false)

  return (
    <>
      <nav
        className={`fixed bottom-0 left-0 right-0 z-50 border-t border-[var(--pf-border)] bg-[var(--pf-header)]/95 pb-[max(0.25rem,env(safe-area-inset-bottom))] pt-1 shadow-[0_-4px_24px_-4px_rgba(0,0,0,0.12)] backdrop-blur-md dark:shadow-[0_-4px_24px_-4px_rgba(0,0,0,0.35)] md:hidden ${navH}`}
        aria-label="Primary"
      >
        <div className="relative mx-auto max-w-lg px-1">
          <div className={`flex items-end justify-between ${navH}`}>
            <NavLink
              to="/personal-finance"
              end
              className={({ isActive }) => `${navItem} flex-1 ${isActive ? navActive : navInactive}`}
            >
              <HomeIcon className="h-[22px] w-[22px] shrink-0" />
              Home
            </NavLink>
            <NavLink
              to="/personal-finance/income"
              className={({ isActive }) => `${navItem} flex-1 ${isActive ? navActive : navInactive}`}
            >
              <BanknotesIcon className="h-[22px] w-[22px] shrink-0" />
              Income
            </NavLink>
            <div className="w-14 shrink-0" aria-hidden />
            <NavLink
              to="/personal-finance/expenses"
              className={({ isActive }) => `${navItem} flex-1 ${isActive ? navActive : navInactive}`}
            >
              <CreditCardIcon className="h-[22px] w-[22px] shrink-0" />
              Expense
            </NavLink>
            <NavLink
              to="/personal-finance/loans"
              className={({ isActive }) => `${navItem} flex-1 ${isActive ? navActive : navInactive}`}
            >
              <ScaleIcon className="h-[22px] w-[22px] shrink-0" />
              Loans
            </NavLink>
            <NavLink
              to="/personal-finance/more"
              className={({ isActive }) => `${navItem} flex-1 ${isActive ? navActive : navInactive}`}
            >
              <EllipsisHorizontalIcon className="h-[22px] w-[22px] shrink-0" />
              More
            </NavLink>
          </div>
          <button
            type="button"
            onClick={() => setQuickOpen(true)}
            className="pf-fab-tap absolute left-1/2 top-0 z-10 flex h-14 w-14 -translate-x-1/2 -translate-y-[52%] items-center justify-center rounded-full bg-[var(--pf-primary)] text-white shadow-[0_8px_28px_rgba(0,0,0,0.35)] ring-4 ring-[var(--pf-bg)] transition duration-200 hover:bg-[var(--pf-primary-hover)]"
            aria-label="Add income, expense, loan, or account"
          >
            <PlusIcon className="h-8 w-8" />
          </button>
        </div>
      </nav>
      <PfQuickAddSheet open={quickOpen} onClose={() => setQuickOpen(false)} />
    </>
  )
}
