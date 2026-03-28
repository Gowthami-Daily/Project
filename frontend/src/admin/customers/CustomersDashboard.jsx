import {
  ArrowPathIcon,
  BanknotesIcon,
  ChatBubbleLeftRightIcon,
  TruckIcon,
  UserGroupIcon,
  UserMinusIcon,
  UserPlusIcon,
} from '@heroicons/react/24/solid'
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import KpiCard from '../dashboard/KpiCard.jsx'

const kpis = [
  { title: 'Total customers', value: '1,284', subtitle: 'All-time registered', icon: UserGroupIcon, gradientClass: 'bg-gradient-to-br from-blue-600 to-cyan-500' },
  { title: 'Active subscriptions', value: '1,098', subtitle: 'Receiving daily / alt-day milk', icon: ArrowPathIcon, gradientClass: 'bg-gradient-to-br from-emerald-500 to-teal-400' },
  { title: 'Paused customers', value: '86', subtitle: 'Vacation or manual pause', icon: UserMinusIcon, gradientClass: 'bg-gradient-to-br from-amber-500 to-orange-500' },
  { title: 'New this month', value: '+47', subtitle: 'vs +38 prior month', icon: UserPlusIcon, gradientClass: 'bg-gradient-to-br from-violet-600 to-indigo-500' },
  { title: 'Wallet balance total', value: '₹3.2L', subtitle: 'Liability · ledger sum', icon: BanknotesIcon, gradientClass: 'bg-gradient-to-br from-sky-500 to-blue-600' },
  { title: 'Pending deliveries', value: '312', subtitle: 'Today’s open stops', icon: TruckIcon, gradientClass: 'bg-gradient-to-br from-rose-500 to-pink-500' },
  { title: 'Complaints open', value: '23', subtitle: 'SLA within 24h', icon: ChatBubbleLeftRightIcon, gradientClass: 'bg-gradient-to-br from-fuchsia-600 to-purple-500' },
  { title: 'Churn (30d)', value: '12', subtitle: 'Stopped subscriptions', icon: UserMinusIcon, gradientClass: 'bg-gradient-to-br from-slate-600 to-slate-800' },
]

const growth = [
  { m: 'Oct', n: 1180 },
  { m: 'Nov', n: 1205 },
  { m: 'Dec', n: 1220 },
  { m: 'Jan', n: 1240 },
  { m: 'Feb', n: 1255 },
  { m: 'Mar', n: 1284 },
]

const subMix = [
  { name: 'Daily buffalo', value: 52, fill: '#004080' },
  { name: 'Daily cow', value: 28, fill: '#0ea5e9' },
  { name: 'Alternate', value: 12, fill: '#22c55e' },
  { name: 'Custom / weekend', value: 8, fill: '#94a3b8' },
]

const revPerCust = [
  { area: 'Zone A', avg: 1850 },
  { area: 'Zone B', avg: 1620 },
  { area: 'Zone C', avg: 2100 },
  { area: 'Zone D', avg: 1390 },
]

const areas = [
  { zone: 'North', pct: 32, color: 'bg-sky-500' },
  { zone: 'East', pct: 24, color: 'bg-emerald-500' },
  { zone: 'Central', pct: 28, color: 'bg-violet-500' },
  { zone: 'West', pct: 16, color: 'bg-amber-500' },
]

export default function CustomersDashboard() {
  return (
    <div className="space-y-8">
      <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4" aria-label="CRM KPIs">
        {kpis.map((k) => (
          <KpiCard key={k.title} {...k} />
        ))}
      </section>

      <section className="grid gap-4 lg:grid-cols-2" aria-label="CRM charts">
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
          <h3 className="text-sm font-bold text-slate-900">Customer growth</h3>
          <p className="text-xs text-slate-500">Active accounts · 6 months</p>
          <div className="mt-3 h-[240px]">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={growth} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="m" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip />
                <Line type="monotone" dataKey="n" name="Customers" stroke="#004080" strokeWidth={2.5} dot />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
          <h3 className="text-sm font-bold text-slate-900">Subscription mix</h3>
          <p className="text-xs text-slate-500">By plan type (demo)</p>
          <div className="mt-2 h-[240px]">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={subMix} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={48} outerRadius={82} paddingAngle={2}>
                  {subMix.map((e) => (
                    <Cell key={e.name} fill={e.fill} />
                  ))}
                </Pie>
                <Tooltip formatter={(v) => `${v}%`} />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
          <h3 className="text-sm font-bold text-slate-900">Revenue per customer</h3>
          <p className="text-xs text-slate-500">₹ / month · by zone (avg)</p>
          <div className="mt-3 h-[240px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={revPerCust} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="area" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip formatter={(v) => [`₹${v}`, 'Avg']} />
                <Bar dataKey="avg" fill="#004080" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
          <h3 className="text-sm font-bold text-slate-900">Area-wise customers</h3>
          <p className="text-xs text-slate-500">Share by zone — replace with map SDK (Mapbox / Google)</p>
          <div className="mt-4 space-y-3">
            {areas.map((a) => (
              <div key={a.zone}>
                <div className="mb-1 flex justify-between text-xs font-medium text-slate-600">
                  <span>{a.zone}</span>
                  <span>{a.pct}%</span>
                </div>
                <div className="h-2.5 overflow-hidden rounded-full bg-slate-100">
                  <div className={`h-full rounded-full ${a.color}`} style={{ width: `${a.pct}%` }} />
                </div>
              </div>
            ))}
          </div>
          <div className="mt-4 rounded-xl border border-dashed border-slate-200 bg-slate-50 py-8 text-center text-xs text-slate-500">
            Heatmap / pin map placeholder
          </div>
        </div>
      </section>
    </div>
  )
}
