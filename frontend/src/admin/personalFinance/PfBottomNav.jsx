import { ChartBarIcon, Cog6ToothIcon, HomeIcon, PlusIcon, WalletIcon } from '@heroicons/react/24/solid'
import { NavLink } from 'react-router-dom'
import { usePfUniversalAdd } from './globalAdd/PfUniversalAddContext.jsx'

const navH = 'min-h-[64px]'
const navItem =
  `flex min-w-0 flex-1 flex-col items-center justify-center gap-0.5 rounded-[12px] py-1 text-[10px] font-semibold transition-all duration-200 active:scale-95 sm:text-xs`
const navInactive = 'text-[var(--pf-text-muted)]'
const navActive = 'text-[var(--pf-primary)]'

/**
 * Mobile bottom bar (md+ hidden). Safe-area aware. Center (+) opens UniversalEntryModal.
 */
export default function PfBottomNav() {
  const { openPicker } = usePfUniversalAdd()

  return (
    <nav
      className={`fixed bottom-0 left-0 right-0 z-50 border-t border-[var(--pf-border)] bg-[var(--pf-header)]/85 pb-[max(0.25rem,env(safe-area-inset-bottom))] pt-1 shadow-[0_-12px_40px_-12px_rgba(0,0,0,0.18)] backdrop-blur-2xl backdrop-saturate-150 dark:border-white/[0.06] dark:bg-[var(--pf-header)]/75 dark:shadow-[0_-12px_48px_-8px_rgba(0,0,0,0.55)] md:hidden ${navH}`}
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
            Dashboard
          </NavLink>
          <NavLink
            to="/personal-finance/accounts"
            className={({ isActive }) => `${navItem} flex-1 ${isActive ? navActive : navInactive}`}
          >
            <WalletIcon className="h-[22px] w-[22px] shrink-0" />
            Accounts
          </NavLink>
          <div className="w-14 shrink-0" aria-hidden />
          <NavLink
            to="/personal-finance/reports"
            className={({ isActive }) => `${navItem} flex-1 ${isActive ? navActive : navInactive}`}
          >
            <ChartBarIcon className="h-[22px] w-[22px] shrink-0" />
            Reports
          </NavLink>
          <NavLink
            to="/personal-finance/settings"
            className={({ isActive }) => `${navItem} flex-1 ${isActive ? navActive : navInactive}`}
          >
            <Cog6ToothIcon className="h-[22px] w-[22px] shrink-0" />
            Settings
          </NavLink>
        </div>
        <button
          type="button"
          onClick={openPicker}
          className="pf-fab-tap absolute left-1/2 top-0 z-10 flex h-14 w-14 -translate-x-1/2 -translate-y-[52%] items-center justify-center rounded-full bg-[var(--pf-primary)] text-white shadow-[0_8px_28px_rgba(0,0,0,0.35)] ring-4 ring-[var(--pf-bg)] transition duration-200 hover:bg-[var(--pf-primary-hover)]"
          aria-label="Add expense, income, transfer, or more"
        >
          <PlusIcon className="h-8 w-8" />
        </button>
      </div>
    </nav>
  )
}
