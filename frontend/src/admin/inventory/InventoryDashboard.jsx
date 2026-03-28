import { BeakerIcon, CubeIcon, ExclamationTriangleIcon, FireIcon } from '@heroicons/react/24/solid'
import { CurrencyRupeeIcon } from '@heroicons/react/24/outline'
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
    title: 'Raw milk stock',
    value: '12,400 L',
    subtitle: 'Bulk storage · all tanks',
    icon: BeakerIcon,
    gradientClass: 'bg-gradient-to-br from-sky-500 to-blue-700',
  },
  {
    title: 'Processed milk',
    value: '8,920 L',
    subtitle: 'Pasteurized · ready to pack',
    icon: BeakerIcon,
    gradientClass: 'bg-gradient-to-br from-cyan-500 to-teal-600',
  },
  {
    title: 'Curd stock',
    value: '3,240',
    subtitle: 'Units (cups / packs)',
    icon: CubeIcon,
    gradientClass: 'bg-gradient-to-br from-amber-500 to-orange-600',
  },
  {
    title: 'Paneer stock',
    value: '186 kg',
    subtitle: 'Cold storage A',
    icon: CubeIcon,
    gradientClass: 'bg-gradient-to-br from-rose-500 to-pink-600',
  },
  {
    title: 'Ghee stock',
    value: '412 L',
    subtitle: 'Finished goods',
    icon: FireIcon,
    gradientClass: 'bg-gradient-to-br from-violet-600 to-indigo-700',
  },
  {
    title: 'Spoilage today',
    value: '84 L',
    subtitle: 'Logged + in QA hold',
    icon: ExclamationTriangleIcon,
    gradientClass: 'bg-gradient-to-br from-red-500 to-rose-700',
  },
  {
    title: 'Stock value',
    value: '₹ 42.8L',
    subtitle: 'FIFO valuation (demo)',
    icon: CurrencyRupeeIcon,
    gradientClass: 'bg-gradient-to-br from-emerald-600 to-green-800',
  },
  {
    title: 'Low stock alerts',
    value: '7',
    subtitle: 'SKUs below reorder',
    icon: ExclamationTriangleIcon,
    gradientClass: 'bg-gradient-to-br from-slate-600 to-slate-900',
  },
]

/** Demo: mixed units; tooltip clarifies */
const stockLevels = [
  { name: 'Raw milk', qty: 12400, unit: 'L' },
  { name: 'Processed', qty: 8920, unit: 'L' },
  { name: 'Curd', qty: 3240, unit: 'units' },
  { name: 'Paneer', qty: 186, unit: 'kg' },
  { name: 'Ghee', qty: 412, unit: 'L' },
]

const prodVsDispatch = [
  { day: 'Mon', production: 8200, dispatch: 7800 },
  { day: 'Tue', production: 8500, dispatch: 8100 },
  { day: 'Wed', production: 7900, dispatch: 8000 },
  { day: 'Thu', production: 8800, dispatch: 8300 },
  { day: 'Fri', production: 9000, dispatch: 8600 },
  { day: 'Sat', production: 7200, dispatch: 7400 },
]

const spoilagePie = [
  { name: 'Temperature', value: 38, fill: '#f43f5e' },
  { name: 'Expired', value: 22, fill: '#f97316' },
  { name: 'Damaged', value: 18, fill: '#eab308' },
  { name: 'Transport', value: 12, fill: '#64748b' },
  { name: 'Other', value: 10, fill: '#94a3b8' },
]

const stockValueLine = [
  { w: 'W1', lakhs: 38.2 },
  { w: 'W2', lakhs: 39.5 },
  { w: 'W3', lakhs: 40.1 },
  { w: 'W4', lakhs: 41.8 },
  { w: 'W5', lakhs: 42.8 },
]

export default function InventoryDashboard() {
  return (
    <div className="space-y-8">
      <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4" aria-label="Inventory KPIs">
        {kpis.map((k) => (
          <KpiCard key={k.title} {...k} />
        ))}
      </section>

      <div className="rounded-2xl border border-slate-200 bg-slate-50/80 p-4 text-sm text-slate-600 shadow-inner sm:p-5">
        <p className="font-semibold text-slate-800">Inventory lifecycle (demo)</p>
        <p className="mt-1 text-xs sm:text-sm">
          Farmer milk → tank → processing → product → dispatch → delivery → return → spoilage. Wrong stock here breaks
          production planning and customer promise.
        </p>
      </div>

      <section className="grid gap-4 lg:grid-cols-2" aria-label="Inventory charts">
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
          <h3 className="text-sm font-bold text-slate-900">Stock levels</h3>
          <p className="text-xs text-slate-500">Normalized view · demo units</p>
          <div className="mt-3 h-[260px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={stockLevels} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip
                  formatter={(value, _n, item) => [`${Number(value).toLocaleString()} ${item.payload.unit}`, 'Qty']}
                />
                <Bar dataKey="qty" name="Quantity" fill="#004080" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
          <h3 className="text-sm font-bold text-slate-900">Production vs dispatch</h3>
          <p className="text-xs text-slate-500">Liters equivalent · daily</p>
          <div className="mt-3 h-[260px]">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={prodVsDispatch} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="day" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip />
                <Legend />
                <Line type="monotone" dataKey="production" name="Production" stroke="#004080" strokeWidth={2} dot />
                <Line type="monotone" dataKey="dispatch" name="Dispatch" stroke="#0ea5e9" strokeWidth={2} dot />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
          <h3 className="text-sm font-bold text-slate-900">Spoilage mix</h3>
          <p className="text-xs text-slate-500">Last 30 days · % of logged loss</p>
          <div className="mt-3 h-[260px]">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={spoilagePie}
                  dataKey="value"
                  nameKey="name"
                  cx="50%"
                  cy="50%"
                  innerRadius={52}
                  outerRadius={88}
                  paddingAngle={2}
                >
                  {spoilagePie.map((entry) => (
                    <Cell key={entry.name} fill={entry.fill} />
                  ))}
                </Pie>
                <Tooltip formatter={(v) => [`${v}%`, 'Share']} />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
          <h3 className="text-sm font-bold text-slate-900">Stock value</h3>
          <p className="text-xs text-slate-500">₹ lakhs · rolling</p>
          <div className="mt-3 h-[260px]">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={stockValueLine} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="w" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip formatter={(v) => [`₹ ${v}L`, 'Value']} />
                <Line type="monotone" dataKey="lakhs" name="Value (₹L)" stroke="#16a34a" strokeWidth={2.5} dot />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      </section>
    </div>
  )
}
