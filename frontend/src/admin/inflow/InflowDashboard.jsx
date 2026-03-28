import {
  BeakerIcon,
  BuildingStorefrontIcon,
  ChartBarIcon,
  ClipboardDocumentListIcon,
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
import { theadRow, tableScroll, tableWrap } from './inflowTableStyles.js'

const kpis = [
  {
    title: 'Milk collected today',
    value: '18,640 L',
    subtitle: 'All centers · gross',
    icon: BeakerIcon,
    gradientClass: 'bg-gradient-to-br from-teal-500 to-cyan-700',
  },
  {
    title: 'Farmers visited',
    value: '312',
    subtitle: 'Unique check-ins',
    icon: UserGroupIcon,
    gradientClass: 'bg-gradient-to-br from-sky-500 to-blue-700',
  },
  {
    title: 'Avg fat %',
    value: '5.42',
    subtitle: 'Accepted milk · MTD',
    icon: ChartBarIcon,
    gradientClass: 'bg-gradient-to-br from-amber-500 to-orange-600',
  },
  {
    title: 'Avg SNF %',
    value: '8.31',
    subtitle: 'Accepted milk · MTD',
    icon: ChartBarIcon,
    gradientClass: 'bg-gradient-to-br from-violet-500 to-purple-700',
  },
  {
    title: 'Rejected milk',
    value: '420 L',
    subtitle: 'Not sent to tank',
    icon: XCircleIcon,
    gradientClass: 'bg-gradient-to-br from-rose-500 to-red-700',
  },
  {
    title: 'Milk sent to tank',
    value: '17,980 L',
    subtitle: 'After QC accept',
    icon: BeakerIcon,
    gradientClass: 'bg-gradient-to-br from-emerald-600 to-teal-800',
  },
  {
    title: 'Pending entries',
    value: '14',
    subtitle: 'Draft / unsynced',
    icon: ClipboardDocumentListIcon,
    gradientClass: 'bg-gradient-to-br from-slate-600 to-slate-900',
  },
  {
    title: 'Centers active',
    value: '6',
    subtitle: 'Receiving this shift',
    icon: BuildingStorefrontIcon,
    gradientClass: 'bg-gradient-to-br from-indigo-500 to-blue-800',
  },
]

const collectionTrend = [
  { d: 'Mon', L: 17200 },
  { d: 'Tue', L: 18100 },
  { d: 'Wed', L: 17800 },
  { d: 'Thu', L: 18640 },
  { d: 'Fri', L: 19200 },
  { d: 'Sat', L: 16500 },
]

const fatSnfTrend = [
  { d: 'Mon', fat: 5.38, snf: 8.28 },
  { d: 'Tue', fat: 5.41, snf: 8.30 },
  { d: 'Wed', fat: 5.39, snf: 8.29 },
  { d: 'Thu', fat: 5.42, snf: 8.31 },
]

const farmerSupply = [
  { name: 'V. Raju', L: 1240 },
  { name: 'K. Lakshmi', L: 980 },
  { name: 'P. Krishna', L: 860 },
  { name: 'M. Fatima', L: 720 },
  { name: 'S. Ravi', L: 640 },
]

const centerCollection = [
  { center: 'Kukatpally', L: 5200 },
  { center: 'Uppal', L: 4100 },
  { center: 'Miyapur', L: 3800 },
  { center: 'Attapur', L: 2900 },
  { center: 'Bachupally', L: 2640 },
]

const centerSummary = [
  { center: 'Kukatpally', farmers: 58, liters: 5200, avgFat: 5.44, rejected: 80 },
  { center: 'Uppal', farmers: 44, liters: 4100, avgFat: 5.38, rejected: 55 },
  { center: 'Miyapur', farmers: 51, liters: 3800, avgFat: 5.41, rejected: 120 },
  { center: 'Attapur', farmers: 39, liters: 2900, avgFat: 5.35, rejected: 45 },
  { center: 'Bachupally', farmers: 36, liters: 2640, avgFat: 5.50, rejected: 30 },
]

export default function InflowDashboard() {
  return (
    <div className="space-y-8">
      <section className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4" aria-label="Inflow KPIs">
        {kpis.map((k) => (
          <KpiCard key={k.title} {...k} />
        ))}
      </section>

      <div className="rounded-2xl border border-slate-200 bg-slate-50/80 p-4 text-sm text-slate-600 shadow-inner sm:p-5">
        <p className="font-semibold text-slate-800">Operational flow</p>
        <p className="mt-1 text-xs sm:text-sm">
          Farmer → milk collection → quality test → <strong className="font-semibold text-emerald-800">accepted → tank</strong> →
          production. Rejected milk does not enter bulk storage.
        </p>
      </div>

      <section className="grid gap-4 lg:grid-cols-2" aria-label="Inflow charts">
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
          <h3 className="text-sm font-bold text-slate-900">Milk collection trend</h3>
          <p className="text-xs text-slate-500">Liters · recent days</p>
          <div className="mt-3 h-[240px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={collectionTrend} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="d" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip />
                <Bar dataKey="L" name="Liters" fill="#0d9488" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
          <h3 className="text-sm font-bold text-slate-900">Fat &amp; SNF trend</h3>
          <p className="text-xs text-slate-500">Accepted milk averages</p>
          <div className="mt-3 h-[240px]">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={fatSnfTrend} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="d" tick={{ fontSize: 11 }} />
                <YAxis domain={[5, 9]} tick={{ fontSize: 11 }} />
                <Tooltip />
                <Legend />
                <Line type="monotone" dataKey="fat" name="Fat %" stroke="#ca8a04" strokeWidth={2} dot />
                <Line type="monotone" dataKey="snf" name="SNF %" stroke="#004080" strokeWidth={2} dot />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
          <h3 className="text-sm font-bold text-slate-900">Farmer-wise supply</h3>
          <p className="text-xs text-slate-500">Top suppliers today (L)</p>
          <div className="mt-3 h-[240px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={farmerSupply} layout="vertical" margin={{ top: 8, right: 16, left: 8, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" horizontal={false} />
                <XAxis type="number" tick={{ fontSize: 11 }} />
                <YAxis type="category" dataKey="name" width={88} tick={{ fontSize: 11 }} />
                <Tooltip />
                <Bar dataKey="L" fill="#0369a1" radius={[0, 6, 6, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
          <h3 className="text-sm font-bold text-slate-900">Center-wise collection</h3>
          <p className="text-xs text-slate-500">Liters today</p>
          <div className="mt-3 h-[240px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={centerCollection} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="center" tick={{ fontSize: 10 }} angle={-20} textAnchor="end" height={56} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip />
                <Bar dataKey="L" name="Liters" fill="#004080" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </section>

      <section aria-label="Collection center summary">
        <h3 className="mb-3 text-sm font-bold text-slate-900">Collection center summary</h3>
        <div className={tableWrap}>
          <div className={tableScroll}>
            <table className="min-w-full text-left text-sm">
              <thead className={theadRow}>
                <tr>
                  <th className="px-4 py-3">Center</th>
                  <th className="px-4 py-3 text-right">Farmers</th>
                  <th className="px-4 py-3 text-right">Liters</th>
                  <th className="px-4 py-3 text-right">Avg fat %</th>
                  <th className="px-4 py-3 text-right">Rejected (L)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {centerSummary.map((c) => (
                  <tr key={c.center} className="bg-white hover:bg-slate-50/80">
                    <td className="px-4 py-3 font-semibold text-slate-900">{c.center}</td>
                    <td className="px-4 py-3 text-right tabular-nums text-slate-700">{c.farmers}</td>
                    <td className="px-4 py-3 text-right tabular-nums font-medium text-slate-900">
                      {c.liters.toLocaleString()}
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums text-slate-700">{c.avgFat}</td>
                    <td className="px-4 py-3 text-right tabular-nums text-rose-700">{c.rejected}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>
    </div>
  )
}
