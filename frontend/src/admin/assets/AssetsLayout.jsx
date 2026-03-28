import { NavLink, Outlet } from 'react-router-dom'
import {
  BanknotesIcon,
  CalendarDaysIcon,
  CheckBadgeIcon,
  ReceiptPercentIcon,
  TruckIcon,
  WrenchScrewdriverIcon,
} from '@heroicons/react/24/solid'
import KpiCard from '../dashboard/KpiCard.jsx'

const tabs = [
  { to: 'vehicles', label: 'Vehicles' },
  { to: 'maintenance', label: 'Maintenance' },
  { to: 'fuel', label: 'Fuel logs' },
  { to: 'machinery', label: 'Machinery' },
  { to: 'tanks', label: 'Tanks' },
  { to: 'schedule', label: 'Service schedule' },
]

const kpis = [
  {
    title: 'Total vehicles',
    value: '18',
    subtitle: 'Fleet registered · all hubs',
    icon: TruckIcon,
    gradientClass: 'bg-gradient-to-br from-blue-600 via-blue-500 to-cyan-400',
  },
  {
    title: 'Active vehicles',
    value: '14',
    subtitle: 'On routes or available today',
    icon: CheckBadgeIcon,
    gradientClass: 'bg-gradient-to-br from-emerald-500 to-teal-400',
  },
  {
    title: 'In maintenance',
    value: '3',
    subtitle: 'Workshop / inspection',
    icon: WrenchScrewdriverIcon,
    gradientClass: 'bg-gradient-to-br from-amber-500 to-orange-500',
  },
  {
    title: 'Fuel cost (MTD)',
    value: '₹1,24,800',
    subtitle: 'Diesel & petrol · March 2026',
    icon: BanknotesIcon,
    gradientClass: 'bg-gradient-to-br from-violet-600 to-indigo-500',
  },
  {
    title: 'Maintenance cost',
    value: '₹42,150',
    subtitle: 'Parts + labor · MTD',
    icon: ReceiptPercentIcon,
    gradientClass: 'bg-gradient-to-br from-rose-500 to-pink-500',
  },
  {
    title: 'Upcoming services',
    value: '6',
    subtitle: 'Due within 14 days',
    icon: CalendarDaysIcon,
    gradientClass: 'bg-gradient-to-br from-sky-500 to-blue-600',
  },
]

export default function AssetsLayout() {
  return (
    <div className="mx-auto max-w-[1600px] space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-slate-900">Assets &amp; fleet</h2>
          <p className="mt-1 text-sm text-slate-500">
            Vehicles, fuel, maintenance, cold-chain tanks, and machinery — operations reference UI.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 shadow-sm hover:bg-slate-50"
          >
            List of assets
          </button>
          <button
            type="button"
            className="rounded-xl border-2 border-[#004080] bg-white px-4 py-2 text-sm font-semibold text-[#004080] shadow-sm hover:bg-sky-50"
          >
            Add an asset
          </button>
        </div>
      </div>

      <section aria-label="Fleet summary" className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-6">
        {kpis.map((k) => (
          <KpiCard key={k.title} {...k} />
        ))}
      </section>

      <div className="border-b border-slate-200 pb-4">
        <nav className="flex flex-wrap gap-1" aria-label="Assets sections">
          {tabs.map((t) => (
            <NavLink
              key={t.to}
              to={t.to}
              className={({ isActive }) =>
                `rounded-lg px-4 py-2 text-sm font-semibold transition ${
                  isActive ? 'bg-[#004080] text-white shadow-sm' : 'text-slate-600 hover:bg-slate-100'
                }`
              }
            >
              {t.label}
            </NavLink>
          ))}
        </nav>
      </div>

      <Outlet />
    </div>
  )
}
