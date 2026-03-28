import { NavLink } from 'react-router-dom'
import {
  BellIcon,
  BuildingOffice2Icon,
  Cog6ToothIcon,
  MapIcon,
  TableCellsIcon,
  TagIcon,
  UsersIcon,
} from '@heroicons/react/24/outline'

const items = [
  { to: 'business', label: 'Business Info', icon: BuildingOffice2Icon },
  { to: 'milk-rates', label: 'Milk Rate Chart', icon: TableCellsIcon },
  { to: 'pricing', label: 'Product Pricing', icon: TagIcon },
  { to: 'routes', label: 'Routes & Zones', icon: MapIcon },
  { to: 'users', label: 'Users & Roles', icon: UsersIcon },
  { to: 'notifications', label: 'Notifications', icon: BellIcon },
  { to: 'system', label: 'System Configuration', icon: Cog6ToothIcon },
]

export default function SettingsMenu() {
  return (
    <nav
      className="flex shrink-0 flex-col gap-0.5 border-b border-slate-200/80 pb-4 lg:w-56 lg:border-b-0 lg:border-r lg:border-slate-200/80 lg:pb-0 lg:pr-4"
      aria-label="Settings sections"
    >
      <p className="mb-2 hidden px-1 text-[11px] font-bold uppercase tracking-wider text-slate-400 lg:block">
        Configuration
      </p>
      <div className="flex gap-1 overflow-x-auto pb-1 lg:flex-col lg:overflow-visible lg:pb-0">
        {items.map(({ to, label, icon: Icon }) => (
          <NavLink
            key={to}
            to={to}
            className={({ isActive }) =>
              `flex shrink-0 items-center gap-2.5 rounded-xl px-3 py-2.5 text-sm font-semibold transition lg:w-full ${
                isActive
                  ? 'bg-[#004080] text-white shadow-sm'
                  : 'text-slate-600 hover:bg-slate-100'
              }`
            }
          >
            <Icon className="h-5 w-5 shrink-0 opacity-90" aria-hidden />
            <span className="whitespace-nowrap">{label}</span>
          </NavLink>
        ))}
      </div>
    </nav>
  )
}
