import {
  ArrowTrendingDownIcon,
  BeakerIcon,
  BoltIcon,
  CubeIcon,
  TruckIcon,
} from '@heroicons/react/24/solid'
import {
  Bar,
  BarChart,
  CartesianGrid,
  ComposedChart,
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
    title: 'Raw milk used today',
    value: '8,420 L',
    subtitle: 'From balance tanks → pasteurizer',
    icon: BeakerIcon,
    gradientClass: 'bg-gradient-to-br from-teal-500 to-cyan-700',
  },
  {
    title: 'Milk packed today',
    value: '7,960 L',
    subtitle: '500ml + 1L equivalent',
    icon: CubeIcon,
    gradientClass: 'bg-gradient-to-br from-amber-400 to-yellow-600',
  },
  {
    title: 'Production loss',
    value: '118 L',
    subtitle: 'Pasteurization + packing',
    icon: ArrowTrendingDownIcon,
    gradientClass: 'bg-gradient-to-br from-rose-500 to-red-700',
  },
  {
    title: 'Packing efficiency',
    value: '94.5%',
    subtitle: 'Output vs pasteurized input',
    icon: BoltIcon,
    gradientClass: 'bg-gradient-to-br from-slate-600 to-slate-900',
  },
  {
    title: 'Pending packing',
    value: '640 L',
    subtitle: 'In buffer · next shift',
    icon: CubeIcon,
    gradientClass: 'bg-gradient-to-br from-indigo-500 to-violet-700',
  },
  {
    title: 'Dispatched',
    value: '6,100 L',
    subtitle: 'Loaded to vehicles today',
    icon: TruckIcon,
    gradientClass: 'bg-gradient-to-br from-sky-600 to-blue-800',
  },
]

const processedVsPacked = [
  { day: 'Mon', processed: 7800, packed: 7450 },
  { day: 'Tue', processed: 8200, packed: 7980 },
  { day: 'Wed', processed: 7900, packed: 7650 },
  { day: 'Thu', processed: 8500, packed: 8200 },
  { day: 'Fri', processed: 8800, packed: 8600 },
  { day: 'Sat', processed: 7200, packed: 7100 },
]

const lossSeries = [
  { day: 'Mon', loss: 95 },
  { day: 'Tue', loss: 88 },
  { day: 'Wed', loss: 102 },
  { day: 'Thu', loss: 76 },
  { day: 'Fri', loss: 118 },
  { day: 'Sat', loss: 64 },
]

const packingBySize = [
  { size: '500ml', liters: 4200 },
  { size: '1L', liters: 3760 },
]

export default function ProductionDashboard() {
  return (
    <div className="space-y-8">
      <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3" aria-label="Production KPIs">
        {kpis.map((k) => (
          <KpiCard key={k.title} {...k} />
        ))}
      </section>

      <div className="rounded-2xl border border-slate-200 bg-slate-50/80 p-4 text-sm text-slate-600 shadow-inner sm:p-5">
        <p className="font-semibold text-slate-800">Plant flow (demo)</p>
        <p className="mt-1 text-xs sm:text-sm">
          Raw milk (tank) → pasteurization → standardization (fat adjust) → packing (500ml / 1L) → cold storage →
          dispatch → delivery.
        </p>
      </div>

      <section className="grid gap-4 lg:grid-cols-2" aria-label="Production charts">
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5 lg:col-span-2">
          <h3 className="text-sm font-bold text-slate-900">Milk processed vs packed</h3>
          <p className="text-xs text-slate-500">Daily liters · bars = processed, line = packed</p>
          <div className="mt-3 h-[280px]">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={processedVsPacked} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="day" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip />
                <Legend />
                <Bar dataKey="processed" name="Processed (L)" fill="#0d9488" radius={[4, 4, 0, 0]} />
                <Line type="monotone" dataKey="packed" name="Packed (L)" stroke="#ca8a04" strokeWidth={2.5} dot />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
          <h3 className="text-sm font-bold text-slate-900">Production loss</h3>
          <p className="text-xs text-slate-500">Liters · rolling days</p>
          <div className="mt-3 h-[260px]">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={lossSeries} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="day" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip />
                <Line type="monotone" dataKey="loss" name="Loss (L)" stroke="#e11d48" strokeWidth={2.5} dot />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
          <h3 className="text-sm font-bold text-slate-900">Packing by size</h3>
          <p className="text-xs text-slate-500">Today · total liters packed</p>
          <div className="mt-3 h-[260px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={packingBySize} layout="vertical" margin={{ top: 8, right: 16, left: 8, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" horizontal={false} />
                <XAxis type="number" tick={{ fontSize: 11 }} />
                <YAxis type="category" dataKey="size" width={56} tick={{ fontSize: 11 }} />
                <Tooltip />
                <Bar dataKey="liters" name="Liters" fill="#004080" radius={[0, 6, 6, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </section>
    </div>
  )
}
