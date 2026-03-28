import {
  BanknotesIcon,
  BeakerIcon,
  CurrencyRupeeIcon,
  HeartIcon,
  UserGroupIcon,
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
    title: 'Total animals',
    value: '48',
    subtitle: 'On farm register',
    icon: UserGroupIcon,
    gradientClass: 'bg-gradient-to-br from-emerald-600 to-teal-800',
  },
  {
    title: 'Milking',
    value: '32',
    subtitle: 'Lactating now',
    icon: BeakerIcon,
    gradientClass: 'bg-gradient-to-br from-sky-500 to-blue-700',
  },
  {
    title: 'Dry animals',
    value: '14',
    subtitle: 'Non-lactating',
    icon: UserGroupIcon,
    gradientClass: 'bg-gradient-to-br from-slate-500 to-slate-800',
  },
  {
    title: 'Milk today (herd)',
    value: '412 L',
    subtitle: 'Recorded yield',
    icon: BeakerIcon,
    gradientClass: 'bg-gradient-to-br from-cyan-500 to-emerald-700',
  },
  {
    title: 'Feed cost today',
    value: '₹ 6,480',
    subtitle: 'Allocated usage',
    icon: CurrencyRupeeIcon,
    gradientClass: 'bg-gradient-to-br from-amber-500 to-orange-600',
  },
  {
    title: 'Doctor cost (MTD)',
    value: '₹ 12,400',
    subtitle: 'Visits + medicine',
    icon: HeartIcon,
    gradientClass: 'bg-gradient-to-br from-rose-500 to-pink-700',
  },
  {
    title: 'Profit today (herd)',
    value: '₹ 8,920',
    subtitle: 'Milk − feed − alloc. health',
    icon: BanknotesIcon,
    gradientClass: 'bg-gradient-to-br from-green-600 to-emerald-900',
  },
]

const yieldByAnimal = [
  { id: 'C-014', L: 14.2 },
  { id: 'C-021', L: 13.8 },
  { id: 'B-003', L: 12.1 },
  { id: 'C-008', L: 11.4 },
  { id: 'B-011', L: 10.9 },
]

const feedCostByAnimal = [
  { id: 'B-003', cost: 148 },
  { id: 'C-014', cost: 135 },
  { id: 'C-021', cost: 132 },
  { id: 'C-008', cost: 128 },
  { id: 'B-011', cost: 125 },
]

const profitByAnimal = [
  { id: 'C-014', p: 186 },
  { id: 'C-021', p: 172 },
  { id: 'B-003', p: 98 },
  { id: 'C-008', p: 64 },
  { id: 'B-011', p: 22 },
]

const healthIssues = [
  { w: 'W1', n: 2 },
  { w: 'W2', n: 5 },
  { w: 'W3', n: 3 },
  { w: 'W4', n: 4 },
  { w: 'W5', n: 1 },
]

export default function CattleDashboard() {
  return (
    <div className="space-y-8">
      <section className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-4" aria-label="Herd KPIs">
        {kpis.map((k) => (
          <KpiCard key={k.title} {...k} />
        ))}
      </section>

      <div className="rounded-2xl border border-slate-200 bg-emerald-50/40 p-4 text-sm text-slate-600 shadow-inner sm:p-5">
        <p className="font-semibold text-emerald-950">Economics</p>
        <p className="mt-1 text-xs sm:text-sm">
          Track <strong className="font-semibold text-emerald-900">profit per animal</strong> and feed cost per liter to cull or breed
          decisions — same discipline as large dairy operations.
        </p>
      </div>

      <section className="grid gap-4 lg:grid-cols-2" aria-label="Herd charts">
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
          <h3 className="text-sm font-bold text-slate-900">Milk yield per animal</h3>
          <p className="text-xs text-slate-500">Yesterday total L · top animals</p>
          <div className="mt-3 h-[240px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={yieldByAnimal} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="id" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip />
                <Bar dataKey="L" name="Liters" fill="#059669" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
          <h3 className="text-sm font-bold text-slate-900">Feed cost per animal</h3>
          <p className="text-xs text-slate-500">Daily allocated ₹ · demo</p>
          <div className="mt-3 h-[240px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={feedCostByAnimal} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="id" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip formatter={(v) => [`₹${v}`, 'Cost']} />
                <Bar dataKey="cost" name="₹/day" fill="#d97706" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
          <h3 className="text-sm font-bold text-slate-900">Profit per animal</h3>
          <p className="text-xs text-slate-500">Monthly est. contribution (demo)</p>
          <div className="mt-3 h-[240px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={profitByAnimal} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="id" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip formatter={(v) => [`₹${v}`, 'Profit']} />
                <Bar dataKey="p" name="₹" fill="#047857" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
          <h3 className="text-sm font-bold text-slate-900">Health issues</h3>
          <p className="text-xs text-slate-500">Cases opened per week</p>
          <div className="mt-3 h-[240px]">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={healthIssues} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="w" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
                <Tooltip />
                <Legend />
                <Line type="monotone" dataKey="n" name="Cases" stroke="#e11d48" strokeWidth={2.5} dot />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      </section>
    </div>
  )
}
