import {
  ArrowTrendingUpIcon,
  BanknotesIcon,
  BuildingLibraryIcon,
  ReceiptPercentIcon,
  ScaleIcon,
  TruckIcon,
  WalletIcon,
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
  {
    title: 'Revenue today',
    value: '₹2,84,000',
    subtitle: 'Wallet debits + COD + retail',
    icon: ArrowTrendingUpIcon,
    gradientClass: 'bg-gradient-to-br from-emerald-500 to-teal-400',
  },
  {
    title: 'Expense today',
    value: '₹1,12,400',
    subtitle: 'OpEx + procurement cash outs',
    icon: ScaleIcon,
    gradientClass: 'bg-gradient-to-br from-rose-500 to-orange-500',
  },
  {
    title: 'Profit today',
    value: '₹1,71,600',
    subtitle: 'Revenue − expense (gross)',
    icon: BanknotesIcon,
    gradientClass: 'bg-gradient-to-br from-lime-500 to-green-600',
  },
  {
    title: 'Customer wallet balance',
    value: '₹3.2L',
    subtitle: 'Liability · ledger sum',
    icon: WalletIcon,
    gradientClass: 'bg-gradient-to-br from-sky-500 to-blue-600',
  },
  {
    title: 'Farmer payable',
    value: '₹4.5L',
    subtitle: 'Accrued milk purchase',
    icon: TruckIcon,
    gradientClass: 'bg-gradient-to-br from-violet-600 to-indigo-500',
  },
  {
    title: 'Advances given',
    value: '₹1.1L',
    subtitle: 'Farmer + staff outstanding',
    icon: ReceiptPercentIcon,
    gradientClass: 'bg-gradient-to-br from-fuchsia-600 to-purple-500',
  },
  {
    title: 'Cash in hand',
    value: '₹48,200',
    subtitle: 'Hub + route floats',
    icon: BanknotesIcon,
    gradientClass: 'bg-gradient-to-br from-amber-500 to-yellow-500',
  },
  {
    title: 'Bank balance',
    value: '₹12.4L',
    subtitle: 'Operating accounts',
    icon: BuildingLibraryIcon,
    gradientClass: 'bg-gradient-to-br from-cyan-600 to-blue-700',
  },
]

const revExp = [
  { m: 'Oct', revenue: 42, expense: 28 },
  { m: 'Nov', revenue: 45, expense: 30 },
  { m: 'Dec', revenue: 48, expense: 31 },
  { m: 'Jan', revenue: 52, expense: 33 },
  { m: 'Feb', revenue: 50, expense: 32 },
  { m: 'Mar', revenue: 55, expense: 34 },
]

const profitLine = [
  { m: 'Oct', p: 14 },
  { m: 'Nov', p: 15 },
  { m: 'Dec', p: 17 },
  { m: 'Jan', p: 19 },
  { m: 'Feb', p: 18 },
  { m: 'Mar', p: 21 },
]

const expensePie = [
  { name: 'Fuel', value: 28, fill: '#004080' },
  { name: 'Salary', value: 35, fill: '#0ea5e9' },
  { name: 'Maintenance', value: 12, fill: '#22c55e' },
  { name: 'Rent & utilities', value: 15, fill: '#f59e0b' },
  { name: 'Other', value: 10, fill: '#94a3b8' },
]

const monthlyProfit = [
  { m: 'Oct', net: 14 },
  { m: 'Nov', net: 15 },
  { m: 'Dec', net: 17 },
  { m: 'Jan', net: 19 },
  { m: 'Feb', net: 18 },
  { m: 'Mar', net: 21 },
]

export default function FinanceDashboard() {
  return (
    <div className="space-y-8">
      <section aria-label="Finance KPIs" className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {kpis.map((k) => (
          <KpiCard key={k.title} {...k} />
        ))}
      </section>

      <section aria-label="Finance charts" className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
          <h3 className="text-sm font-bold text-slate-900">Revenue vs expense</h3>
          <p className="text-xs text-slate-500">₹ Lakhs · monthly (demo)</p>
          <div className="mt-3 h-[260px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={revExp} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="m" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip />
                <Legend />
                <Bar dataKey="revenue" name="Revenue" fill="#004080" radius={[6, 6, 0, 0]} />
                <Bar dataKey="expense" name="Expense" fill="#f97316" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
          <h3 className="text-sm font-bold text-slate-900">Profit trend</h3>
          <p className="text-xs text-slate-500">Net before tax · lakhs</p>
          <div className="mt-3 h-[260px]">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={profitLine} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="m" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip />
                <Line type="monotone" dataKey="p" name="Profit" stroke="#16a34a" strokeWidth={2.5} dot />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
          <h3 className="text-sm font-bold text-slate-900">Expense breakdown</h3>
          <p className="text-xs text-slate-500">Share of OpEx (demo)</p>
          <div className="mt-2 h-[260px]">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={expensePie}
                  dataKey="value"
                  nameKey="name"
                  cx="50%"
                  cy="50%"
                  innerRadius={50}
                  outerRadius={85}
                  paddingAngle={2}
                >
                  {expensePie.map((e) => (
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
          <h3 className="text-sm font-bold text-slate-900">Monthly profit</h3>
          <p className="text-xs text-slate-500">Closing net · lakhs</p>
          <div className="mt-3 h-[260px]">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={monthlyProfit} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="m" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip />
                <Line type="monotone" dataKey="net" name="Net profit" stroke="#004080" strokeWidth={2.5} dot={{ r: 4 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      </section>

      <p className="text-xs text-slate-500">
        Wire KPIs to FastAPI ledger endpoints; customer wallet must remain a <strong>ledger</strong> (not a single balance column)
        for audit-grade ERP.
      </p>
    </div>
  )
}
