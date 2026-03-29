import {
  ArrowRightOnRectangleIcon,
  BanknotesIcon,
  BuildingLibraryIcon,
  ChartBarIcon,
  ChartPieIcon,
  CreditCardIcon,
  Cog6ToothIcon,
  ReceiptPercentIcon,
  HomeIcon,
  ScaleIcon,
  ShieldCheckIcon,
  TableCellsIcon,
  WalletIcon,
} from '@heroicons/react/24/solid'
import { NavLink } from 'react-router-dom'
import { usePfTheme } from './PfThemeContext.jsx'
import RiverLogo from '../RiverLogo.jsx'

function isAdminPanelVisible(user) {
  if (!user?.role) return false
  const r = String(user.role).toUpperCase()
  return r === 'SUPER_ADMIN' || r === 'ADMIN' || r === 'ADMINISTRATOR'
}

function SectionLabel({ children, collapsed, showDividerBefore }) {
  if (collapsed) {
    if (!showDividerBefore) return null
    return <div className="mx-2 mt-3 hidden h-px bg-[var(--pf-border)] md:block" aria-hidden />
  }
  return (
    <p className="sidebar-section-title mx-4 mt-5 mb-2 text-[11px] font-semibold uppercase tracking-[0.08em] text-[var(--pf-text-muted)] first:mt-3">
      {children}
    </p>
  )
}

function NavItem({ to, end, icon: Icon, label, collapsed, onNavigate }) {
  return (
    <NavLink
      to={to}
      end={end}
      title={collapsed ? label : undefined}
      onClick={onNavigate}
      className={({ isActive }) =>
        [
          'sidebar-item flex items-center gap-3 rounded-lg py-2.5 pl-4 pr-3 text-sm font-semibold transition-colors duration-200 md:pr-4',
          'mx-2 my-1',
          collapsed ? 'md:mx-1 md:justify-center md:gap-0 md:px-0 md:pl-0 md:pr-0' : '',
          isActive
            ? 'bg-[var(--pf-primary)] text-white shadow-sm'
            : 'text-[var(--pf-text-muted)] hover:bg-[var(--pf-card-hover)] hover:text-[var(--pf-text)]',
        ].join(' ')
      }
    >
      <Icon className="h-5 w-5 shrink-0 opacity-90" aria-hidden />
      <span className={`min-w-0 flex-1 truncate text-left transition-opacity duration-300 ${collapsed ? 'md:hidden' : ''}`}>
        {label}
      </span>
    </NavLink>
  )
}

function DarkModeSwitch({ collapsed, isDark, onToggle }) {
  const label = 'Dark mode'
  return (
    <button
      type="button"
      role="switch"
      aria-checked={isDark}
      title={collapsed ? label : undefined}
      onClick={onToggle}
      className={[
        'sidebar-item flex w-full items-center gap-3 rounded-lg py-2.5 pl-4 pr-3 text-left text-sm font-semibold transition-colors duration-200 md:pr-4',
        'mx-2 my-1 text-[var(--pf-text-muted)] hover:bg-[var(--pf-card-hover)] hover:text-[var(--pf-text)]',
        collapsed ? 'md:mx-1 md:justify-center md:gap-0 md:px-0 md:pl-0 md:pr-0' : 'md:justify-between',
      ].join(' ')}
    >
      <span className={`min-w-0 truncate ${collapsed ? 'md:hidden' : ''}`}>{label}</span>
      <span
        className={[
          'relative inline-flex h-6 w-11 shrink-0 items-center rounded-full border border-[var(--pf-border)] transition-colors duration-200',
          isDark ? 'bg-[var(--pf-primary)]' : 'bg-[var(--pf-card-hover)]',
          collapsed ? '' : 'md:ml-auto',
        ].join(' ')}
        aria-hidden
      >
        <span
          className={[
            'pointer-events-none block h-4 w-4 rounded-full bg-white shadow transition-transform duration-200',
            isDark ? 'translate-x-6' : 'translate-x-1',
          ].join(' ')}
        />
      </span>
    </button>
  )
}

/**
 * @param {{
 *   user?: { role?: string } | null
 *   collapsed: boolean
 *   mobileOpen: boolean
 *   onCloseMobile: () => void
 *   onLogout: () => void
 * }} props
 */
export default function PfSidebar({ user = null, collapsed, mobileOpen, onCloseMobile, onLogout }) {
  const { isDark, setPreference } = usePfTheme()
  const showAdmin = isAdminPanelVisible(user)

  const closeIfMobile = () => {
    onCloseMobile()
  }

  const toggleTheme = () => {
    setPreference(isDark ? 'light' : 'dark')
  }

  return (
    <>
      <button
        type="button"
        aria-label="Close menu"
        className={`fixed inset-0 z-[54] bg-slate-900/45 backdrop-blur-[2px] transition-opacity duration-300 md:hidden ${
          mobileOpen ? 'opacity-100' : 'pointer-events-none opacity-0'
        }`}
        onClick={onCloseMobile}
      />

      <aside
        className={[
          'fixed inset-y-0 left-0 z-[55] flex w-[min(280px,88vw)] max-w-[280px] flex-col border-r border-[var(--pf-border)] bg-[var(--pf-sidebar)] shadow-[var(--pf-shadow)] transition-[width,transform] duration-300 ease-out md:max-w-none md:translate-x-0 md:shadow-none',
          'pf-sidebar-rail md:relative md:z-0',
          mobileOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0',
          collapsed ? 'md:w-[72px] md:min-w-[72px]' : 'md:w-[240px] md:min-w-[240px]',
        ].join(' ')}
        aria-label="Personal finance navigation"
      >
        <div className="flex items-center justify-between gap-2 border-b border-[var(--pf-border)] px-3 py-3 md:px-4">
          <div className={`flex min-w-0 flex-1 items-center gap-2 ${collapsed ? 'md:justify-center md:overflow-hidden' : ''}`}>
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[var(--pf-primary)] text-white shadow-inner">
              <RiverLogo className="h-5 w-5 text-white" />
            </div>
            <span
              className={`truncate text-sm font-bold text-[var(--pf-text)] transition-opacity duration-300 ${collapsed ? 'md:hidden' : ''}`}
            >
              Personal finance
            </span>
          </div>
          <button
            type="button"
            onClick={onCloseMobile}
            className="rounded-lg px-3 py-1.5 text-sm font-semibold text-[var(--pf-text-muted)] hover:bg-[var(--pf-card-hover)] md:hidden"
          >
            Close
          </button>
        </div>

        <nav className="flex min-h-0 flex-1 flex-col overflow-y-auto overflow-x-hidden pb-2" aria-label="Main">
          <SectionLabel collapsed={collapsed} showDividerBefore={false}>
            Main
          </SectionLabel>
          <div className="flex flex-col">
            <NavItem to="/personal-finance" end icon={HomeIcon} label="Dashboard" collapsed={collapsed} onNavigate={closeIfMobile} />
            <NavItem
              to="/personal-finance/monthly-statements"
              icon={TableCellsIcon}
              label="Financial statement"
              collapsed={collapsed}
              onNavigate={closeIfMobile}
            />
            <NavItem to="/personal-finance/reports" icon={ChartBarIcon} label="Reports" collapsed={collapsed} onNavigate={closeIfMobile} />
          </div>

          <SectionLabel collapsed={collapsed} showDividerBefore>
            Transactions
          </SectionLabel>
          <div className="flex flex-col">
            <NavItem to="/personal-finance/accounts" icon={WalletIcon} label="Accounts" collapsed={collapsed} onNavigate={closeIfMobile} />
            <NavItem to="/personal-finance/income" icon={BanknotesIcon} label="Income" collapsed={collapsed} onNavigate={closeIfMobile} />
            <NavItem
              to="/personal-finance/expenses"
              icon={CreditCardIcon}
              label="Expenses"
              collapsed={collapsed}
              onNavigate={closeIfMobile}
            />
            <NavItem to="/personal-finance/loans" icon={ScaleIcon} label="Loans" collapsed={collapsed} onNavigate={closeIfMobile} />
          </div>

          <SectionLabel collapsed={collapsed} showDividerBefore>
            Assets & liabilities
          </SectionLabel>
          <div className="flex flex-col">
            <NavItem
              to="/personal-finance/investments"
              icon={ChartPieIcon}
              label="Investments"
              collapsed={collapsed}
              onNavigate={closeIfMobile}
            />
            <NavItem
              to="/personal-finance/assets"
              icon={BuildingLibraryIcon}
              label="Fixed assets"
              collapsed={collapsed}
              onNavigate={closeIfMobile}
            />
            <NavItem
              to="/personal-finance/liabilities"
              icon={ReceiptPercentIcon}
              label="Liabilities"
              collapsed={collapsed}
              onNavigate={closeIfMobile}
            />
          </div>
        </nav>

        <div className="shrink-0 border-t border-[var(--pf-border)] pb-2 pt-1">
          <SectionLabel collapsed={collapsed} showDividerBefore={false}>
            System
          </SectionLabel>
          <div className="flex flex-col">
            <NavLink
              to="/personal-finance/settings"
              title={collapsed ? 'Settings' : undefined}
              onClick={closeIfMobile}
              className={({ isActive }) =>
                [
                  'sidebar-item flex items-center gap-3 rounded-lg py-2.5 pl-4 pr-3 text-sm font-semibold transition-colors duration-200 md:pr-4',
                  'mx-2 my-1',
                  collapsed ? 'md:mx-1 md:justify-center md:gap-0 md:px-0 md:pl-0 md:pr-0' : '',
                  isActive
                    ? 'bg-[var(--pf-primary)] text-white shadow-sm'
                    : 'text-[var(--pf-text-muted)] hover:bg-[var(--pf-card-hover)] hover:text-[var(--pf-text)]',
                ].join(' ')
              }
            >
              <Cog6ToothIcon className="h-5 w-5 shrink-0 opacity-90" aria-hidden />
              <span className={`min-w-0 flex-1 truncate text-left ${collapsed ? 'md:hidden' : ''}`}>Settings</span>
            </NavLink>

            <DarkModeSwitch collapsed={collapsed} isDark={isDark} onToggle={toggleTheme} />

            {showAdmin ? (
              <NavLink
                to="/super-admin"
                title={collapsed ? 'Admin panel' : undefined}
                onClick={closeIfMobile}
                className={({ isActive }) =>
                  [
                    'sidebar-item flex items-center gap-3 rounded-lg py-2.5 pl-4 pr-3 text-sm font-semibold transition-colors duration-200 md:pr-4',
                    'mx-2 my-1',
                    collapsed ? 'md:mx-1 md:justify-center md:gap-0 md:px-0 md:pl-0 md:pr-0' : '',
                    isActive
                      ? 'bg-[var(--pf-primary)] text-white shadow-sm'
                      : 'text-[var(--pf-text-muted)] hover:bg-[var(--pf-card-hover)] hover:text-[var(--pf-text)]',
                  ].join(' ')
                }
              >
                <ShieldCheckIcon className="h-5 w-5 shrink-0 opacity-90" aria-hidden />
                <span className={`min-w-0 flex-1 truncate text-left ${collapsed ? 'md:hidden' : ''}`}>Admin panel</span>
              </NavLink>
            ) : null}

            <button
              type="button"
              title={collapsed ? 'Logout' : undefined}
              onClick={() => {
                closeIfMobile()
                onLogout?.()
              }}
              className={[
                'sidebar-item logout flex w-full items-center gap-3 rounded-lg py-2.5 pl-4 pr-3 text-left text-sm font-semibold transition-colors duration-200 md:pr-4',
                'mx-2 my-1 text-[#EF4444] hover:bg-red-500/10 dark:hover:bg-red-500/15',
                collapsed ? 'md:mx-1 md:justify-center md:gap-0 md:px-0 md:pl-0 md:pr-0' : '',
              ].join(' ')}
            >
              <ArrowRightOnRectangleIcon className="h-5 w-5 shrink-0" aria-hidden />
              <span className={`min-w-0 flex-1 truncate text-left ${collapsed ? 'md:hidden' : ''}`}>Logout</span>
            </button>
          </div>
        </div>
      </aside>
    </>
  )
}
