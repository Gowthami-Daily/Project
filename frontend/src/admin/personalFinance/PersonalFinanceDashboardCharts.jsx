import { memo, useMemo } from 'react'
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
import { formatInr } from './pfFormat.js'

const CHART_COLORS_LIGHT = ['#1E3A8A', '#0ea5e9', '#22c55e', '#a855f7', '#f59e0b', '#ec4899', '#64748b']
const CHART_COLORS_DARK = ['#3B82F6', '#38bdf8', '#4ade80', '#c084fc', '#fbbf24', '#f472b6', '#94a3b8']

/** @typedef {'full' | 'overview' | 'cashflow'} ChartMode */

function PersonalFinanceDashboardCharts({
  isDark,
  chartMode = 'full',
  barIeData,
  pieData,
  networthData,
  invBarData,
  /** Income / expense / EMI / savings — same month keys as barIeData */
  cashflowTrendData,
  dashYear,
  dashMonthLabel,
  filterBankName,
  bankFilter,
  pfChartCard,
  chartTitleCls,
  chartSubCls,
}) {
  const colors = isDark ? CHART_COLORS_DARK : CHART_COLORS_LIGHT
  const gridStroke = isDark ? '#334155' : '#e2e8f0'
  const axisStroke = isDark ? '#94a3b8' : '#64748b'
  const tooltipBox = useMemo(
    () => ({
      borderRadius: 12,
      border: isDark ? '1px solid #475569' : '1px solid #bae6fd',
      background: isDark ? '#1e293b' : '#ffffff',
      color: isDark ? '#e2e8f0' : '#0f172a',
      boxShadow: isDark ? '0 4px 12px rgba(0,0,0,0.35)' : '0 4px 12px rgba(0,0,0,0.08)',
    }),
    [isDark],
  )

  const pieStroke = isDark ? '#1e293b' : '#fff'
  const emiLineColor = isDark ? '#f472b6' : '#db2777'

  const incomeExpenseBlock = (
    <div className={`min-w-0 ${pfChartCard}`}>
      <h2 className={chartTitleCls}>Income vs expense</h2>
      <p className={chartSubCls}>
        Monthly · {dashYear}
        {bankFilter ? ` · ${filterBankName || 'filtered account'}` : ''}
      </p>
      <div className="mt-3 h-[280px] min-h-[280px] min-w-0 w-full">
        <ResponsiveContainer width="100%" height="100%" minWidth={48} minHeight={220}>
          <BarChart data={barIeData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
            <defs>
              <linearGradient id="pfBarIncome" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#34d399" stopOpacity={1} />
                <stop offset="100%" stopColor="#059669" stopOpacity={0.92} />
              </linearGradient>
              <linearGradient id="pfBarExpense" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#fb923c" stopOpacity={1} />
                <stop offset="100%" stopColor="#ea580c" stopOpacity={0.92} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke={gridStroke} opacity={0.85} />
            <XAxis dataKey="month" tick={{ fontSize: 10, fill: axisStroke }} stroke={axisStroke} angle={-35} textAnchor="end" height={56} />
            <YAxis tick={{ fontSize: 11, fill: axisStroke }} stroke={axisStroke} tickFormatter={(v) => `₹${(v / 1000).toFixed(0)}k`} />
            <Tooltip formatter={(v) => formatInr(v)} contentStyle={tooltipBox} animationDuration={200} />
            <Legend verticalAlign="bottom" height={28} />
            <Bar dataKey="income" name="Income" fill="url(#pfBarIncome)" radius={[6, 6, 0, 0]} animationDuration={800} animationEasing="ease-out" />
            <Bar dataKey="expense" name="Expense" fill="url(#pfBarExpense)" radius={[6, 6, 0, 0]} animationDuration={800} animationEasing="ease-out" />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  )

  const expensePieBlock = (
    <div className={`min-w-0 ${pfChartCard}`}>
      <h2 className={chartTitleCls}>Expense by category</h2>
      <p className={chartSubCls}>
        {bankFilter ? `${dashMonthLabel} · ${filterBankName || 'filtered'}` : `${dashMonthLabel} · expenses in this month`}
      </p>
      <div className="mt-3 h-[280px] min-h-[280px] min-w-0 w-full">
        {pieData.length === 0 ? (
          <p className="flex h-full items-center justify-center text-sm text-slate-500 dark:text-slate-400">No expense data yet</p>
        ) : (
          <ResponsiveContainer width="100%" height="100%" minWidth={48} minHeight={220}>
            <PieChart>
              <Pie
                data={pieData}
                dataKey="value"
                nameKey="name"
                cx="50%"
                cy="50%"
                innerRadius={52}
                outerRadius={88}
                paddingAngle={2}
                stroke={pieStroke}
                strokeWidth={2}
                label={(props) => {
                  const name = props?.name != null ? String(props.name) : ''
                  const pct = typeof props?.percent === 'number' ? props.percent : 0
                  return `${name} ${(pct * 100).toFixed(0)}%`
                }}
                animationDuration={800}
                animationEasing="ease-out"
              >
                {pieData.map((_, i) => (
                  <Cell key={i} fill={colors[i % colors.length]} />
                ))}
              </Pie>
              <Tooltip formatter={(v) => formatInr(v)} contentStyle={tooltipBox} animationDuration={200} />
              <Legend verticalAlign="bottom" height={28} />
            </PieChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  )

  const networthBlock = (
    <div className={`min-w-0 ${pfChartCard}`}>
      <h2 className={chartTitleCls}>{bankFilter ? 'Account cashflow (cumulative)' : 'Net worth trend'}</h2>
      <p className={chartSubCls}>
        {bankFilter
          ? `Running income − expense by month · ${filterBankName || 'this account'} · ${dashYear}`
          : `Base includes assets, investments, loan receivable, liabilities; plus cumulative savings · ${dashYear}`}
      </p>
      <div className="mt-3 h-[280px] min-h-[280px] min-w-0 w-full">
        <ResponsiveContainer width="100%" height="100%" minWidth={48} minHeight={220}>
          <LineChart data={networthData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
            <defs>
              <linearGradient id="pfLineNwDash" x1="0" y1="0" x2="1" y2="0">
                <stop offset="0%" stopColor={isDark ? '#60a5fa' : '#1E3A8A'} />
                <stop offset="100%" stopColor={isDark ? '#93c5fd' : '#3b82f6'} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke={gridStroke} opacity={0.85} />
            <XAxis dataKey="month" tick={{ fontSize: 10, fill: axisStroke }} stroke={axisStroke} angle={-35} textAnchor="end" height={56} />
            <YAxis tick={{ fontSize: 11, fill: axisStroke }} stroke={axisStroke} tickFormatter={(v) => `₹${(v / 1000).toFixed(0)}k`} />
            <Tooltip formatter={(v) => formatInr(v)} contentStyle={tooltipBox} animationDuration={200} />
            <Legend verticalAlign="bottom" height={28} />
            <Line
              type="monotone"
              dataKey="netWorth"
              name="Net worth"
              stroke="url(#pfLineNwDash)"
              strokeWidth={2.75}
              dot={{ r: 3, strokeWidth: 2, fill: isDark ? '#1e293b' : '#fff' }}
              activeDot={{ r: 5 }}
              animationDuration={800}
              animationEasing="ease-out"
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  )

  const invBlock = (
    <div className={`min-w-0 ${pfChartCard}`}>
      <h2 className={chartTitleCls}>Investment allocation</h2>
      <p className={chartSubCls}>
        {bankFilter ? 'Profile-wide by instrument type (bank filter does not apply)' : 'By instrument type'}
      </p>
      <div className="mt-3 h-[280px] min-h-[280px] min-w-0 w-full">
        {invBarData.length === 0 ? (
          <p className="flex h-full items-center justify-center text-sm text-slate-500 dark:text-slate-400">No investments yet</p>
        ) : (
          <ResponsiveContainer width="100%" height="100%" minWidth={48} minHeight={220}>
            <BarChart data={invBarData} layout="vertical" margin={{ top: 8, right: 8, left: 8, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={gridStroke} />
              <XAxis type="number" tick={{ fontSize: 11, fill: axisStroke }} stroke={axisStroke} tickFormatter={(v) => `₹${(v / 1000).toFixed(0)}k`} />
              <YAxis type="category" dataKey="type" width={100} tick={{ fontSize: 11, fill: axisStroke }} stroke={axisStroke} />
              <defs>
                <linearGradient id="pfInvBarDash" x1="0" y1="0" x2="1" y2="0">
                  <stop offset="0%" stopColor="#38bdf8" />
                  <stop offset="100%" stopColor={isDark ? '#3b82f6' : '#1E3A8A'} />
                </linearGradient>
              </defs>
              <Tooltip formatter={(v) => formatInr(v)} contentStyle={tooltipBox} animationDuration={200} />
              <Legend verticalAlign="bottom" height={28} />
              <Bar dataKey="value" name="Value" fill="url(#pfInvBarDash)" radius={[0, 6, 6, 0]} animationDuration={800} animationEasing="ease-out" />
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  )

  const cashflowTrendBlock =
    Array.isArray(cashflowTrendData) && cashflowTrendData.length > 0 ? (
      <div className={`min-w-0 lg:col-span-2 ${pfChartCard}`}>
        <h2 className={chartTitleCls}>Cashflow trend</h2>
        <p className={chartSubCls}>
          Income, expense, EMI (selected month only), savings — {dashYear}
          {bankFilter ? ` · ${filterBankName || 'filtered'}` : ''}
        </p>
        <div className="mt-3 h-[300px] min-h-[300px] min-w-0 w-full">
          <ResponsiveContainer width="100%" height="100%" minWidth={48} minHeight={240}>
            <LineChart data={cashflowTrendData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={gridStroke} opacity={0.85} />
              <XAxis dataKey="month" tick={{ fontSize: 10, fill: axisStroke }} stroke={axisStroke} angle={-35} textAnchor="end" height={56} />
              <YAxis tick={{ fontSize: 11, fill: axisStroke }} stroke={axisStroke} tickFormatter={(v) => `₹${(v / 1000).toFixed(0)}k`} />
              <Tooltip formatter={(v) => formatInr(v)} contentStyle={tooltipBox} animationDuration={200} />
              <Legend verticalAlign="bottom" height={28} />
              <Line type="monotone" dataKey="income" name="Income" stroke="#22c55e" strokeWidth={2} dot={{ r: 2 }} />
              <Line type="monotone" dataKey="expense" name="Expense" stroke="#ea580c" strokeWidth={2} dot={{ r: 2 }} />
              <Line type="monotone" dataKey="emi" name="EMI" stroke={emiLineColor} strokeWidth={2} strokeDasharray="4 3" dot={{ r: 2 }} />
              <Line type="monotone" dataKey="savings" name="Savings" stroke="#2563eb" strokeWidth={2} dot={{ r: 2 }} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>
    ) : null

  if (chartMode === 'overview') {
    return (
      <section aria-label="Overview charts" className="grid min-w-0 gap-4 lg:grid-cols-2">
        {networthBlock}
        {invBlock}
      </section>
    )
  }

  if (chartMode === 'cashflow') {
    return (
      <section aria-label="Cashflow charts" className="grid min-w-0 gap-4 lg:grid-cols-2">
        {incomeExpenseBlock}
        {expensePieBlock}
        {cashflowTrendBlock}
      </section>
    )
  }

  return (
    <section aria-label="Charts" className="grid min-w-0 gap-4 lg:grid-cols-2">
      {incomeExpenseBlock}
      {expensePieBlock}
      {networthBlock}
      {invBlock}
    </section>
  )
}

export default memo(PersonalFinanceDashboardCharts)
