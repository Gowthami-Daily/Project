import {
  ArrowRightOnRectangleIcon,
  ArrowsRightLeftIcon,
  BanknotesIcon,
  BuildingLibraryIcon,
  CalculatorIcon,
  ChartBarIcon,
  ChartPieIcon,
  CreditCardIcon,
  Cog6ToothIcon,
  HeartIcon,
  HomeIcon,
  PresentationChartLineIcon,
  ReceiptPercentIcon,
  RectangleStackIcon,
  ScaleIcon,
  ShieldCheckIcon,
  TableCellsIcon,
  WalletIcon,
} from '@heroicons/react/24/solid'
import { motion } from 'framer-motion'
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
    return <div className="mx-2 mt-3 hidden h-px bg-[var(--pf-border)] lg:block" aria-hidden />
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
          'sidebar-item relative z-0 flex items-center gap-3 overflow-hidden rounded-lg py-2.5 pl-4 pr-3 text-sm font-semibold lg:pr-4',
          'mx-2 my-1 transition-colors duration-[var(--pf-motion-normal,180ms)] [transition-timing-function:var(--pf-ease-standard,cubic-bezier(0.4,0,0.2,1))]',
          collapsed ? 'lg:mx-1 lg:justify-center lg:gap-0 lg:px-0 lg:pl-0 lg:pr-0' : '',
          isActive
            ? 'text-white'
            : 'text-[var(--pf-text-muted)] hover:bg-[var(--pf-card-hover)] hover:text-[var(--pf-text)]',
        ].join(' ')
      }
    >
      {({ isActive }) => (
        <>
          {isActive ? (
            <motion.span
              layoutId={collapsed ? undefined : 'pf-sidebar-active-pill'}
              className={[
                'absolute -z-10 rounded-lg bg-[var(--pf-primary)] shadow-sm',
                collapsed ? 'inset-y-1 left-1 right-1' : 'inset-y-1 left-2 right-2',
              ].join(' ')}
              initial={false}
              transition={{ type: 'spring', stiffness: 440, damping: 34 }}
            />
          ) : null}
          <Icon className="relative z-10 h-5 w-5 shrink-0 opacity-90" aria-hidden />
          <span className={`relative z-10 min-w-0 flex-1 truncate text-left transition-opacity duration-300 ${collapsed ? 'lg:hidden' : ''}`}>
            {label}
          </span>
        </>
      )}
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
        'sidebar-item flex w-full items-center gap-3 rounded-lg py-2.5 pl-4 pr-3 text-left text-sm font-semibold transition-colors duration-200 lg:pr-4',
        'mx-2 my-1 text-[var(--pf-text-muted)] hover:bg-[var(--pf-card-hover)] hover:text-[var(--pf-text)]',
        collapsed ? 'lg:mx-1 lg:justify-center lg:gap-0 lg:px-0 lg:pl-0 lg:pr-0' : 'lg:justify-between',
      ].join(' ')}
    >
      <span className={`min-w-0 truncate ${collapsed ? 'lg:hidden' : ''}`}>{label}</span>
      <span
        className={[
          'relative inline-flex h-6 w-11 shrink-0 items-center rounded-full border border-[var(--pf-border)] transition-colors duration-200',
          isDark ? 'bg-[var(--pf-primary)]' : 'bg-[var(--pf-card-hover)]',
          collapsed ? '' : 'lg:ml-auto',
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
        className={`fixed inset-0 z-[54] bg-slate-900/45 backdrop-blur-[2px] transition-opacity duration-300 lg:hidden ${
          mobileOpen ? 'opacity-100' : 'pointer-events-none opacity-0'
        }`}
        onClick={onCloseMobile}
      />

      <aside
        className={[
          'fixed inset-y-0 left-0 z-[55] flex w-[min(88vw,17.5rem)] max-w-[min(88vw,17.5rem)] flex-col border-r border-[var(--pf-border)] bg-[var(--pf-sidebar)] shadow-[var(--pf-shadow)] transition-[width,transform] duration-[var(--pf-motion-slow,260ms)] [transition-timing-function:var(--pf-ease-standard,cubic-bezier(0.4,0,0.2,1))] lg:max-w-none lg:translate-x-0 lg:shadow-none',
          'pf-sidebar-rail lg:relative lg:z-0 lg:h-full lg:min-h-0 lg:max-h-full lg:shrink-0',
          mobileOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0',
          collapsed ? 'lg:w-[4.5rem] lg:min-w-[4.5rem]' : 'lg:w-[15rem] lg:min-w-[15rem]',
        ].join(' ')}
        aria-label="Personal finance navigation"
      >
        <div className="flex items-center justify-between gap-2 border-b border-[var(--pf-border)] px-3 py-3 lg:px-4">
          <div className={`flex min-w-0 flex-1 items-center gap-2 ${collapsed ? 'lg:justify-center lg:overflow-hidden' : ''}`}>
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[var(--pf-primary)] text-white shadow-inner">
              <RiverLogo className="h-5 w-5 text-white" />
            </div>
            <span
              className={`truncate text-sm font-bold text-[var(--pf-text)] transition-opacity duration-300 ${collapsed ? 'lg:hidden' : ''}`}
            >
              Personal finance
            </span>
          </div>
          <button
            type="button"
            onClick={onCloseMobile}
            className="rounded-lg px-3 py-1.5 text-sm font-semibold text-[var(--pf-text-muted)] hover:bg-[var(--pf-card-hover)] lg:hidden"
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
              to="/personal-finance/analytics"
              icon={PresentationChartLineIcon}
              label="Analytics"
              collapsed={collapsed}
              onNavigate={closeIfMobile}
            />
            <NavItem
              to="/personal-finance/monthly-statements"
              icon={TableCellsIcon}
              label="Financial statement"
              collapsed={collapsed}
              onNavigate={closeIfMobile}
            />
            <NavItem to="/personal-finance/reports" icon={ChartBarIcon} label="Reports" collapsed={collapsed} onNavigate={closeIfMobile} />
            <NavItem
              to="/personal-finance/cash-flow"
              icon={ArrowsRightLeftIcon}
              label="Cash flow"
              collapsed={collapsed}
              onNavigate={closeIfMobile}
            />
          </div>

          <SectionLabel collapsed={collapsed} showDividerBefore>
            Planning
          </SectionLabel>
          <div className="flex flex-col">
            <NavItem to="/personal-finance/tax" icon={CalculatorIcon} label="Tax" collapsed={collapsed} onNavigate={closeIfMobile} />
            <NavItem
              to="/personal-finance/budget"
              icon={RectangleStackIcon}
              label="Budget"
              collapsed={collapsed}
              onNavigate={closeIfMobile}
            />
            <NavItem
              to="/personal-finance/financial-health"
              icon={HeartIcon}
              label="Financial health"
              collapsed={collapsed}
              onNavigate={closeIfMobile}
            />
          </div>

          <SectionLabel collapsed={collapsed} showDividerBefore>
            Transactions
          </SectionLabel>
          <div className="flex flex-col">
            <NavItem to="/personal-finance/accounts" icon={WalletIcon} label="Accounts" collapsed={collapsed} onNavigate={closeIfMobile} />
            <NavItem
              to="/personal-finance/transfer"
              icon={ArrowsRightLeftIcon}
              label="Money movement"
              collapsed={collapsed}
              onNavigate={closeIfMobile}
            />
            <NavItem to="/personal-finance/income" icon={BanknotesIcon} label="Income" collapsed={collapsed} onNavigate={closeIfMobile} />
            <NavItem
              to="/personal-finance/expenses"
              icon={CreditCardIcon}
              label="Expenses"
              collapsed={collapsed}
              onNavigate={closeIfMobile}
            />
            <NavItem
              to="/personal-finance/credit-cards"
              icon={CreditCardIcon}
              label="Credit cards"
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
              to="/personal-finance/chit-funds"
              icon={BanknotesIcon}
              label="Chit funds"
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
              label="Loans & liabilities"
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
            <NavItem
              to="/personal-finance/settings"
              icon={Cog6ToothIcon}
              label="Settings"
              collapsed={collapsed}
              onNavigate={closeIfMobile}
            />

            <DarkModeSwitch collapsed={collapsed} isDark={isDark} onToggle={toggleTheme} />

            {showAdmin ? (
              <NavItem
                to="/super-admin"
                icon={ShieldCheckIcon}
                label="Admin panel"
                collapsed={collapsed}
                onNavigate={closeIfMobile}
              />
            ) : null}

            <button
              type="button"
              title={collapsed ? 'Logout' : undefined}
              onClick={() => {
                closeIfMobile()
                onLogout?.()
              }}
              className={[
                'sidebar-item logout flex w-full items-center gap-3 rounded-lg py-2.5 pl-4 pr-3 text-left text-sm font-semibold transition-colors duration-200 lg:pr-4',
                'mx-2 my-1 text-[#EF4444] hover:bg-red-500/10 dark:hover:bg-red-500/15',
                collapsed ? 'lg:mx-1 lg:justify-center lg:gap-0 lg:px-0 lg:pl-0 lg:pr-0' : '',
              ].join(' ')}
            >
              <ArrowRightOnRectangleIcon className="h-5 w-5 shrink-0" aria-hidden />
              <span className={`min-w-0 flex-1 truncate text-left ${collapsed ? 'lg:hidden' : ''}`}>Logout</span>
            </button>
          </div>
        </div>
      </aside>
    </>
  )
}
