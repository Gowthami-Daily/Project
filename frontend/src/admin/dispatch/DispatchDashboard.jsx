import {
  CheckCircleIcon,
  ClockIcon,
  ExclamationTriangleIcon,
  MapIcon,
  TruckIcon,
  UserGroupIcon,
  XCircleIcon,
} from '@heroicons/react/24/solid'
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import KpiCard from '../dashboard/KpiCard.jsx'

const kpis = [
  {
    title: 'Routes today',
    value: '18',
    subtitle: 'Active shift · all zones',
    icon: MapIcon,
    gradientClass: 'bg-gradient-to-br from-blue-600 to-cyan-500',
  },
  {
    title: 'Total deliveries',
    value: '1,842',
    subtitle: 'Stops scheduled today',
    icon: TruckIcon,
    gradientClass: 'bg-gradient-to-br from-sky-500 to-indigo-600',
  },
  {
    title: 'Completed',
    value: '1,204',
    subtitle: '65% of today’s plan',
    icon: CheckCircleIcon,
    gradientClass: 'bg-gradient-to-br from-emerald-500 to-teal-500',
  },
  {
    title: 'Pending',
    value: '598',
    subtitle: 'Out for delivery + scheduled',
    icon: ClockIcon,
    gradientClass: 'bg-gradient-to-br from-amber-500 to-orange-500',
  },
  {
    title: 'Missed',
    value: '40',
    subtitle: 'Requires follow-up',
    icon: XCircleIcon,
    gradientClass: 'bg-gradient-to-br from-rose-500 to-red-600',
  },
  {
    title: 'Spoiled (L)',
    value: '127',
    subtitle: 'Returns logged today',
    icon: ExclamationTriangleIcon,
    gradientClass: 'bg-gradient-to-br from-violet-600 to-fuchsia-600',
  },
  {
    title: 'Vehicles active',
    value: '14',
    subtitle: 'On road / loading',
    icon: TruckIcon,
    gradientClass: 'bg-gradient-to-br from-slate-600 to-slate-800',
  },
  {
    title: 'Drivers active',
    value: '16',
    subtitle: 'Including 2 backups',
    icon: UserGroupIcon,
    gradientClass: 'bg-gradient-to-br from-cyan-600 to-blue-700',
  },
]

const byRoute = [
  { route: 'R1', deliveries: 210 },
  { route: 'R2', deliveries: 185 },
  { route: 'R3', deliveries: 198 },
  { route: 'R4', deliveries: 164 },
  { route: 'R5', deliveries: 142 },
]

const deliveryTime = [
  { h: '6am', min: 42 },
  { h: '8am', min: 38 },
  { h: '10am', min: 35 },
  { h: '12pm', min: 41 },
  { h: '2pm', min: 44 },
  { h: '4pm', min: 39 },
]

const missedByRoute = [
  { route: 'R1', n: 6 },
  { route: 'R2', n: 4 },
  { route: 'R3', n: 11 },
  { route: 'R4', n: 8 },
  { route: 'R5', n: 11 },
]

const efficiency = [
  { route: 'R1', pct: 94 },
  { route: 'R2', pct: 91 },
  { route: 'R3', pct: 88 },
  { route: 'R4', pct: 96 },
  { route: 'R5', pct: 87 },
]

export default function DispatchDashboard() {
  return (
    <div className="space-y-8">
      <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4" aria-label="Dispatch KPIs">
        {kpis.map((k) => (
          <KpiCard key={k.title} {...k} />
        ))}
      </section>

      <div className="rounded-2xl border border-slate-200 bg-slate-50/80 p-4 text-sm text-slate-600 shadow-inner sm:p-5">
        <p className="font-semibold text-slate-800">Operational flow (demo)</p>
        <p className="mt-1 text-xs sm:text-sm">
          Customer subscription → delivery schedule → route planning → dispatch entry (load) → out for delivery →
          delivered / missed → wallet deduction → finance entry.
        </p>
      </div>

      <section className="grid gap-4 lg:grid-cols-2" aria-label="Dispatch charts">
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
          <h3 className="text-sm font-bold text-slate-900">Deliveries by route</h3>
          <p className="text-xs text-slate-500">Today · stop count</p>
          <div className="mt-3 h-[240px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={byRoute} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="route" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip />
                <Bar dataKey="deliveries" fill="#004080" name="Stops" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
          <h3 className="text-sm font-bold text-slate-900">Delivery time</h3>
          <p className="text-xs text-slate-500">Avg minutes stop-to-stop (rolling)</p>
          <div className="mt-3 h-[240px]">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={deliveryTime} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="h" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip />
                <Line type="monotone" dataKey="min" name="Minutes" stroke="#0ea5e9" strokeWidth={2.5} dot />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
          <h3 className="text-sm font-bold text-slate-900">Missed deliveries</h3>
          <p className="text-xs text-slate-500">Last 7 days · by route</p>
          <div className="mt-3 h-[240px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={missedByRoute} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="route" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip />
                <Bar dataKey="n" fill="#f43f5e" name="Missed" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
          <h3 className="text-sm font-bold text-slate-900">Route efficiency</h3>
          <p className="text-xs text-slate-500">On-time % (demo)</p>
          <div className="mt-3 h-[240px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={efficiency} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="route" tick={{ fontSize: 11 }} />
                <YAxis domain={[0, 100]} tick={{ fontSize: 11 }} />
                <Tooltip formatter={(v) => [`${v}%`, 'Efficiency']} />
                <Legend />
                <Bar dataKey="pct" fill="#22c55e" name="On-time %" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </section>
    </div>
  )
}
