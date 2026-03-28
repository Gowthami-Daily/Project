import { NavLink, useLocation } from 'react-router-dom'
import {
  BanknotesIcon,
  ChartBarSquareIcon,
  CubeIcon,
  HomeIcon,
  HomeModernIcon,
  MapIcon,
  TruckIcon,
  UserGroupIcon,
  UsersIcon,
  WrenchScrewdriverIcon,
  Cog6ToothIcon,
  BeakerIcon,
} from '@heroicons/react/24/outline'
import RiverLogo from '../RiverLogo.jsx'
import { ADMIN_DISPLAY_NAME } from '../config.js'

const navItems = [
  { to: '/admin', end: true, label: 'Dashboard', icon: HomeIcon },
  { to: '/admin/cattle/dashboard', label: 'Cattle', icon: HomeModernIcon, activePrefix: '/admin/cattle' },
  { to: '/admin/inflow/dashboard', label: 'Inflow', icon: TruckIcon, activePrefix: '/admin/inflow' },
  { to: '/admin/production/dashboard', label: 'Production', icon: BeakerIcon, activePrefix: '/admin/production' },
  { to: '/admin/inventory/dashboard', label: 'Inventory', icon: CubeIcon, activePrefix: '/admin/inventory' },
  { to: '/admin/outflow/dashboard', label: 'Dispatch', icon: MapIcon, activePrefix: '/admin/outflow' },
  { to: '/admin/customers', label: 'Customers', icon: UserGroupIcon },
  { to: '/admin/ledger', label: 'Finance', icon: BanknotesIcon },
  { to: '/admin/hr', label: 'HR & Staff', icon: UsersIcon },
  { to: '/admin/assets', label: 'Assets', icon: WrenchScrewdriverIcon },
  { to: '/admin/reports', label: 'Reports', icon: ChartBarSquareIcon },
  { to: '/admin/settings', label: 'Settings', icon: Cog6ToothIcon },
]

export default function Sidebar({ mobileOpen, onClose }) {
  const { pathname } = useLocation()

  const nav = (
    <>
      <div className="flex items-center gap-3 border-b border-white/10 px-5 py-5">
        <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-white/10 text-white shadow-inner">
          <RiverLogo className="h-8 w-8 text-white" />
        </div>
        <div>
          <p className="text-sm font-bold leading-tight text-white">Gowthami Daily</p>
          <p className="text-[11px] font-medium text-slate-400">Dairy ERP</p>
        </div>
      </div>

      <div className="border-b border-white/10 px-4 py-4">
        <div className="flex items-center gap-3 rounded-xl bg-white/5 px-3 py-2.5 ring-1 ring-white/10">
          <div
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-sky-400 to-[#004080] text-sm font-bold text-white"
            aria-hidden
          >
            {ADMIN_DISPLAY_NAME.slice(0, 1).toUpperCase()}
          </div>
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-white">{ADMIN_DISPLAY_NAME}</p>
            <p className="truncate text-xs text-slate-400">Operations Manager</p>
          </div>
        </div>
      </div>

      <nav className="flex flex-1 flex-col gap-0.5 overflow-y-auto p-3" aria-label="Main navigation">
        {navItems.map(({ to, end, label, icon: Icon, activePrefix }) => (
          <NavLink
            key={to}
            to={to}
            end={end}
            onClick={() => onClose?.()}
            className={({ isActive }) => {
              const on =
                activePrefix != null ? pathname.startsWith(activePrefix) : isActive
              return `flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition ${
                on
                  ? 'bg-white/15 text-white shadow-inner ring-1 ring-white/10'
                  : 'text-slate-300 hover:bg-white/10 hover:text-white'
              }`
            }}
          >
            <Icon className="h-5 w-5 shrink-0 opacity-90" aria-hidden />
            {label}
          </NavLink>
        ))}
      </nav>

      <div className="border-t border-white/10 p-4">
        <a
          href="/"
          className="block rounded-xl px-3 py-2.5 text-center text-xs font-semibold text-slate-400 transition hover:bg-white/10 hover:text-white"
        >
          ← Public site
        </a>
      </div>
    </>
  )

  return (
    <>
      <div
        className={`fixed inset-0 z-40 bg-slate-900/60 backdrop-blur-sm transition lg:hidden ${
          mobileOpen ? 'opacity-100' : 'pointer-events-none opacity-0'
        }`}
        aria-hidden={!mobileOpen}
        onClick={onClose}
      />

      <aside
        className={`fixed left-0 top-0 z-50 flex h-screen w-[260px] flex-col bg-[#2D3748] shadow-2xl transition-transform duration-200 ease-out lg:translate-x-0 ${
          mobileOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
        }`}
      >
        {nav}
      </aside>
    </>
  )
}
