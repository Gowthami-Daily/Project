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

const inflowOutflow = [
  { day: 'Mon', inflow: 4200, outflow: 3800 },
  { day: 'Tue', inflow: 4500, outflow: 4100 },
  { day: 'Wed', inflow: 4800, outflow: 4400 },
  { day: 'Thu', inflow: 4600, outflow: 4500 },
  { day: 'Fri', inflow: 5100, outflow: 4900 },
  { day: 'Sat', inflow: 5300, outflow: 5100 },
  { day: 'Sun', inflow: 4950, outflow: 4700 },
]

const revenueExpense = [
  { period: 'W1', revenue: 185, expense: 112 },
  { period: 'W2', revenue: 198, expense: 118 },
  { period: 'W3', revenue: 210, expense: 125 },
  { period: 'W4', revenue: 225, expense: 132 },
]

const milkByType = [
  { name: 'Buffalo', value: 58, fill: '#004080' },
  { name: 'Cow', value: 32, fill: '#0ea5e9' },
  { name: 'Mixed', value: 10, fill: '#94a3b8' },
]

const deliveryPerf = [
  { route: 'R-01', onTime: 96, delayed: 4 },
  { route: 'R-02', onTime: 99, delayed: 1 },
  { route: 'R-03', onTime: 88, delayed: 12 },
  { route: 'R-04', onTime: 94, delayed: 6 },
]

const chartCard = 'rounded-2xl border border-slate-200/90 bg-white p-4 shadow-sm sm:p-5'
const chartTitle = 'text-base font-bold text-slate-900'
const chartSub = 'mt-0.5 text-xs text-slate-500'

export default function ChartsSection() {
  return (
    <div className="grid gap-4 md:grid-cols-2">
      <div className={chartCard}>
        <h4 className={chartTitle}>Inflow vs outflow</h4>
        <p className={chartSub}>Thousands of liters · last 7 days</p>
        <div className="mt-3 h-[260px] w-full sm:h-[280px]">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={inflowOutflow} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis dataKey="day" tick={{ fontSize: 11 }} stroke="#64748b" />
              <YAxis tick={{ fontSize: 11 }} stroke="#64748b" />
              <Tooltip
                contentStyle={{ borderRadius: 12, border: '1px solid #e2e8f0' }}
                formatter={(v) => [`${v}k L`, '']}
              />
              <Legend />
              <Line type="monotone" dataKey="inflow" name="Inflow" stroke="#004080" strokeWidth={2.5} dot={false} />
              <Line type="monotone" dataKey="outflow" name="Outflow" stroke="#22c55e" strokeWidth={2.5} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className={chartCard}>
        <h4 className={chartTitle}>Revenue vs expense</h4>
        <p className={chartSub}>₹ Lakhs · weekly (demo)</p>
        <div className="mt-3 h-[260px] w-full sm:h-[280px]">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={revenueExpense} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis dataKey="period" tick={{ fontSize: 11 }} stroke="#64748b" />
              <YAxis tick={{ fontSize: 11 }} stroke="#64748b" />
              <Tooltip
                contentStyle={{ borderRadius: 12, border: '1px solid #e2e8f0' }}
                formatter={(v) => [`₹${v}L`, '']}
              />
              <Legend />
              <Bar dataKey="revenue" name="Revenue" fill="#004080" radius={[6, 6, 0, 0]} />
              <Bar dataKey="expense" name="Expense" fill="#f97316" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className={chartCard}>
        <h4 className={chartTitle}>Milk by type</h4>
        <p className={chartSub}>Share of procurement mix</p>
        <div className="mt-2 h-[240px] w-full sm:h-[260px]">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={milkByType}
                dataKey="value"
                nameKey="name"
                cx="50%"
                cy="50%"
                innerRadius={52}
                outerRadius={88}
                paddingAngle={3}
              >
                {milkByType.map((entry) => (
                  <Cell key={entry.name} fill={entry.fill} />
                ))}
              </Pie>
              <Tooltip formatter={(v) => `${v}%`} />
              <Legend />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className={chartCard}>
        <h4 className={chartTitle}>Delivery performance</h4>
        <p className={chartSub}>On-time % vs delayed % by route</p>
        <div className="mt-3 h-[260px] w-full sm:h-[280px]">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={deliveryPerf} layout="vertical" margin={{ top: 8, right: 8, left: 8, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis type="number" domain={[0, 100]} tick={{ fontSize: 11 }} stroke="#64748b" unit="%" />
              <YAxis type="category" dataKey="route" width={44} tick={{ fontSize: 11 }} stroke="#64748b" />
              <Tooltip
                contentStyle={{ borderRadius: 12, border: '1px solid #e2e8f0' }}
                formatter={(v) => [`${v}%`, '']}
              />
              <Legend />
              <Bar dataKey="onTime" name="On time" stackId="a" fill="#22c55e" radius={[0, 4, 4, 0]} />
              <Bar dataKey="delayed" name="Delayed" stackId="a" fill="#f59e0b" radius={[4, 0, 0, 4]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  )
}
