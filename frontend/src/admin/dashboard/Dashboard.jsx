import {
  BanknotesIcon,
  BeakerIcon,
  CheckBadgeIcon,
  CircleStackIcon,
  ClockIcon,
  Cog6ToothIcon,
  ExclamationTriangleIcon,
  TruckIcon,
} from '@heroicons/react/24/solid'
import AlertsPanel from './AlertsPanel.jsx'
import ChartsSection from './ChartsSection.jsx'
import DispatchTable from './DispatchTable.jsx'
import KpiCard from './KpiCard.jsx'

const kpis = [
  {
    title: 'Milk procured today',
    value: '4,850 L',
    subtitle: 'Cow 1,920 L · Buffalo 2,930 L',
    icon: CircleStackIcon,
    gradientClass: 'bg-gradient-to-br from-emerald-500 via-teal-500 to-cyan-400',
  },
  {
    title: 'Milk dispatched today',
    value: '4,420 L',
    subtitle: '91.3% of procured volume loaded',
    icon: TruckIcon,
    gradientClass: 'bg-gradient-to-br from-blue-600 via-blue-500 to-cyan-400',
  },
  {
    title: 'Milk delivered today',
    value: '3,890 L',
    subtitle: 'Across 42 active routes · MTD',
    icon: CheckBadgeIcon,
    gradientClass: 'bg-gradient-to-br from-teal-500 to-emerald-400',
  },
  {
    title: 'Spoilage / wastage',
    value: '42 L',
    subtitle: '0.87% of intake · within threshold',
    icon: ExclamationTriangleIcon,
    gradientClass: 'bg-gradient-to-br from-rose-500 to-pink-500',
  },
  {
    title: 'Pending dispatch',
    value: '430 L',
    subtitle: 'Evening shift + 2 routes not departed',
    icon: ClockIcon,
    gradientClass: 'bg-gradient-to-br from-amber-500 to-orange-500',
  },
  {
    title: 'Milk in processing',
    value: '610 L',
    subtitle: 'Pasteurization & curd batch in progress',
    icon: Cog6ToothIcon,
    gradientClass: 'bg-gradient-to-br from-violet-600 to-indigo-500',
  },
  {
    title: 'Tank stock',
    value: '8,400 L',
    subtitle: 'Combined chilling capacity 72% utilized',
    icon: BeakerIcon,
    gradientClass: 'bg-gradient-to-br from-sky-500 to-blue-600',
  },
  {
    title: 'Revenue today',
    value: '₹2,84,000',
    subtitle: 'Wallet debits + COD · gross',
    icon: BanknotesIcon,
    gradientClass: 'bg-gradient-to-br from-lime-500 to-green-600',
  },
]

export default function Dashboard() {
  return (
    <div className="mx-auto max-w-[1600px] space-y-6 lg:space-y-8">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">Command center</h1>
        <p className="mt-1 text-sm text-slate-500 sm:text-base">
          Real-time dairy logistics — procurement, dispatch, cold chain, and cash at a glance.
        </p>
      </div>

      <section aria-label="Key performance indicators">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {kpis.map((k) => (
            <KpiCard key={k.title} {...k} />
          ))}
        </div>
      </section>

      <section aria-label="Dispatch operations">
        <DispatchTable />
      </section>

      <section aria-label="Analytics and alerts" className="grid grid-cols-1 gap-6 lg:grid-cols-12 lg:gap-6">
        <div className="lg:col-span-8">
          <h2 className="mb-4 text-lg font-bold text-slate-900">Analytics</h2>
          <ChartsSection />
        </div>
        <div className="lg:col-span-4">
          <h2 className="mb-4 text-lg font-bold text-slate-900 lg:sr-only">Alerts</h2>
          <AlertsPanel />
        </div>
      </section>
    </div>
  )
}
