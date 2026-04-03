import { memo, useMemo } from 'react'
import {
  Area,
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
import { chartGridStroke, chartTooltipBox } from '../../components/dashboard/chartTheme.js'
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
  /** Overview-only insight series (derived on dashboard page). */
  overviewNwThreeLineData = [],
  expenseCategoryHBarData = [],
  cashflowHealthData = [],
  debtTrendData = [],
  savingsRateTrendData = [],
  accountDistributionData = [],
  investmentAllocationBarSorted = [],
  dashYear,
  dashMonthLabel,
  filterBankName,
  bankFilter,
  pfChartCard,
  pfInsightCard,
  chartTitleCls,
  chartSubCls,
}) {
  const colors = isDark ? CHART_COLORS_DARK : CHART_COLORS_LIGHT
  const gridStroke = useMemo(() => chartGridStroke(isDark), [isDark])
  const axisStroke = isDark ? '#94a3b8' : '#64748b'
  const tooltipBox = useMemo(() => chartTooltipBox(isDark), [isDark])

  const pieStroke = isDark ? '#1e293b' : '#fff'
  const emiLineColor = isDark ? '#f472b6' : '#db2777'

  const incomeExpenseBlock = (
    <div className={`min-w-0 ${pfChartCard}`}>
      <h2 className={chartTitleCls}>Income vs expense</h2>
      <p className={chartSubCls}>
        Monthly · {dashYear}
        {bankFilter ? ` · ${filterBankName || 'filtered account'}` : ''}
      </p>
      <div className="mt-4 h-[280px] min-h-[280px] min-w-0 w-full">
        <ResponsiveContainer width="100%" height="100%" minWidth={48} minHeight={220}>
          <BarChart data={barIeData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
            <defs>
              <linearGradient id="pfBarIncome" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#34d399" stopOpacity={1} />
                <stop offset="100%" stopColor="#059669" stopOpacity={0.92} />
              </linearGradient>
              <linearGradient id="pfBarExpense" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#f87171" stopOpacity={1} />
                <stop offset="100%" stopColor="#dc2626" stopOpacity={0.92} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke={gridStroke} strokeOpacity={0.35} />
            <XAxis dataKey="month" tick={{ fontSize: 10, fill: axisStroke }} stroke={axisStroke} angle={-35} textAnchor="end" height={56} />
            <YAxis tick={{ fontSize: 11, fill: axisStroke }} stroke={axisStroke} tickFormatter={(v) => `₹${(v / 1000).toFixed(0)}k`} />
            <Tooltip formatter={(v) => formatInr(v)} contentStyle={tooltipBox} animationDuration={200} />
            <Legend verticalAlign="bottom" height={28} />
            <Bar dataKey="income" name="Income" fill="url(#pfBarIncome)" radius={[8, 8, 0, 0]} animationDuration={800} animationEasing="ease-out" />
            <Bar dataKey="expense" name="Expense" fill="url(#pfBarExpense)" radius={[8, 8, 0, 0]} animationDuration={800} animationEasing="ease-out" />
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
              <linearGradient id="pfNwAreaFillDash" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={isDark ? '#60a5fa' : '#3b82f6'} stopOpacity={0.28} />
                <stop offset="100%" stopColor={isDark ? '#60a5fa' : '#3b82f6'} stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke={gridStroke} strokeOpacity={0.35} />
            <XAxis dataKey="month" tick={{ fontSize: 10, fill: axisStroke }} stroke={axisStroke} angle={-35} textAnchor="end" height={56} />
            <YAxis tick={{ fontSize: 11, fill: axisStroke }} stroke={axisStroke} tickFormatter={(v) => `₹${(v / 1000).toFixed(0)}k`} />
            <Tooltip formatter={(v) => formatInr(v)} contentStyle={tooltipBox} animationDuration={200} />
            <Legend verticalAlign="bottom" height={28} />
            <Area
              type="monotone"
              dataKey="netWorth"
              stroke="none"
              fill="url(#pfNwAreaFillDash)"
              animationDuration={800}
              animationEasing="ease-out"
            />
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
              <CartesianGrid strokeDasharray="3 3" stroke={gridStroke} strokeOpacity={0.35} />
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
              <CartesianGrid strokeDasharray="3 3" stroke={gridStroke} strokeOpacity={0.35} />
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
    const card = pfInsightCard || pfChartCard
    const hasNwAssetSplit =
      Array.isArray(overviewNwThreeLineData) &&
      overviewNwThreeLineData.length > 0 &&
      typeof overviewNwThreeLineData[0]?.assets === 'number'

    const assetPiePalette = isDark
      ? ['#2dd4bf', '#38bdf8', '#818cf8', '#c084fc', '#fb923c', '#f472b6', '#94a3b8']
      : ['#14b8a6', '#0ea5e9', '#6366f1', '#a855f7', '#f97316', '#ec4899', '#64748b']

    const empty = (msg) => (
      <p className="flex h-[280px] items-center justify-center text-sm text-slate-500 dark:text-slate-400">{msg}</p>
    )

    const assetAllocationPie = (
      <div className={`min-w-0 ${card}`}>
        <h2 className={chartTitleCls}>Asset allocation</h2>
        <p className={chartSubCls}>
          Bank, cash, wallet, investments, fixed assets, loans given (book) · {dashMonthLabel}
        </p>
        <div className="mt-4 min-h-[280px] w-full">
          {accountDistributionData.length === 0 ? (
            empty('No balances to show yet')
          ) : (
            <ResponsiveContainer width="100%" height={280} minWidth={48} minHeight={220}>
              <PieChart>
                <Pie
                  data={accountDistributionData}
                  dataKey="value"
                  nameKey="name"
                  cx="50%"
                  cy="50%"
                  innerRadius={56}
                  outerRadius={92}
                  paddingAngle={2}
                  stroke={pieStroke}
                  strokeWidth={2}
                  label={(props) => {
                    const name = props?.name != null ? String(props.name) : ''
                    const pct = typeof props?.percent === 'number' ? props.percent : 0
                    return `${name} ${(pct * 100).toFixed(0)}%`
                  }}
                  animationDuration={750}
                  animationEasing="ease-out"
                >
                  {accountDistributionData.map((_, i) => (
                    <Cell key={i} fill={assetPiePalette[i % assetPiePalette.length]} />
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

    return (
      <section aria-label="Overview charts" className="grid min-w-0 gap-4 lg:grid-cols-2 lg:gap-4">
        <div className={`min-w-0 ${card}`}>
          <h2 className={chartTitleCls}>Net worth trend</h2>
          <p className={chartSubCls}>
            {bankFilter
              ? `Cumulative path · ${filterBankName || 'this account'} · ${dashYear}`
              : `Net worth with assets and liabilities (flat = latest book) · ${dashYear}`}
          </p>
          <div className="mt-4 min-h-[280px] w-full">
            {overviewNwThreeLineData.length === 0 ? (
              empty('No net worth trend yet')
            ) : (
              <ResponsiveContainer width="100%" height={280} minWidth={48} minHeight={220}>
                <LineChart data={overviewNwThreeLineData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id="insOvNwArea" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#a78bfa" stopOpacity={0.22} />
                      <stop offset="100%" stopColor="#a78bfa" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="pfLineNwDashOv" x1="0" y1="0" x2="1" y2="0">
                      <stop offset="0%" stopColor={isDark ? '#a78bfa' : '#7c3aed'} />
                      <stop offset="100%" stopColor={isDark ? '#c4b5fd' : '#8b5cf6'} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke={gridStroke} strokeOpacity={0.32} />
                  <XAxis dataKey="month" tick={{ fontSize: 10, fill: axisStroke }} stroke={axisStroke} angle={-32} textAnchor="end" height={54} />
                  <YAxis tick={{ fontSize: 10, fill: axisStroke }} stroke={axisStroke} tickFormatter={(v) => `₹${(v / 1000).toFixed(0)}k`} />
                  <Tooltip formatter={(v) => formatInr(v)} contentStyle={tooltipBox} animationDuration={180} />
                  <Legend verticalAlign="bottom" height={28} wrapperStyle={{ fontSize: 11 }} />
                  {hasNwAssetSplit ? (
                    <Line
                      type="monotone"
                      dataKey="assets"
                      name="Assets (book)"
                      stroke="#14b8a6"
                      strokeWidth={2}
                      dot={{ r: 2 }}
                      strokeOpacity={0.9}
                      animationDuration={720}
                    />
                  ) : null}
                  {hasNwAssetSplit ? (
                    <Line
                      type="monotone"
                      dataKey="liabilities"
                      name="Liabilities"
                      stroke="#a855f7"
                      strokeWidth={2}
                      strokeDasharray="5 4"
                      dot={{ r: 2 }}
                      strokeOpacity={0.9}
                      animationDuration={720}
                    />
                  ) : null}
                  <Area type="monotone" dataKey="netWorth" stroke="none" fill="url(#insOvNwArea)" animationDuration={720} />
                  <Line
                    type="monotone"
                    dataKey="netWorth"
                    name="Net worth"
                    stroke="url(#pfLineNwDashOv)"
                    strokeWidth={2.6}
                    dot={{ r: 2.5, strokeWidth: 1, fill: isDark ? '#0f172a' : '#fff' }}
                    activeDot={{ r: 5 }}
                    animationDuration={720}
                  />
                </LineChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        {assetAllocationPie}

        {incomeExpenseBlock}

        <div className={`min-w-0 ${card}`}>
          <h2 className={chartTitleCls}>Cashflow</h2>
          <p className={chartSubCls}>Money in, money out, and net · {dashYear}</p>
          <div className="mt-4 min-h-[280px] w-full">
            {!cashflowHealthData?.length ? (
              empty('No monthly cashflow yet')
            ) : (
              <ResponsiveContainer width="100%" height={280} minWidth={48} minHeight={220}>
                <LineChart data={cashflowHealthData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id="insOvNetArea" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#22d3ee" stopOpacity={0.2} />
                      <stop offset="100%" stopColor="#22d3ee" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke={gridStroke} strokeOpacity={0.32} />
                  <XAxis dataKey="month" tick={{ fontSize: 10, fill: axisStroke }} stroke={axisStroke} angle={-32} textAnchor="end" height={54} />
                  <YAxis tick={{ fontSize: 10, fill: axisStroke }} stroke={axisStroke} tickFormatter={(v) => `₹${(v / 1000).toFixed(0)}k`} />
                  <Tooltip formatter={(v) => formatInr(v)} contentStyle={tooltipBox} animationDuration={180} />
                  <Legend verticalAlign="bottom" height={28} wrapperStyle={{ fontSize: 11 }} />
                  <Area type="monotone" dataKey="net" stroke="none" fill="url(#insOvNetArea)" animationDuration={700} />
                  <Line type="monotone" dataKey="moneyIn" name="Money in" stroke="#22c55e" strokeWidth={2.2} dot={{ r: 2 }} animationDuration={700} />
                  <Line type="monotone" dataKey="moneyOut" name="Money out" stroke="#ef4444" strokeWidth={2.2} dot={{ r: 2 }} animationDuration={700} />
                  <Line type="monotone" dataKey="net" name="Net" stroke="#06b6d4" strokeWidth={2.4} dot={{ r: 2 }} animationDuration={700} />
                </LineChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        <div className={`min-w-0 ${card}`}>
          <h2 className={chartTitleCls}>Expense breakdown</h2>
          <p className={chartSubCls}>By category · {dashMonthLabel}</p>
          <div className="mt-4 min-h-[280px] w-full">
            {expenseCategoryHBarData.length === 0 ? (
              empty('No category split for this month')
            ) : (
              <ResponsiveContainer width="100%" height={280} minWidth={48} minHeight={220}>
                <BarChart data={expenseCategoryHBarData} layout="vertical" margin={{ top: 8, right: 16, left: 4, bottom: 0 }}>
                  <defs>
                    <linearGradient id="insOvCatBar" x1="0" y1="0" x2="1" y2="0">
                      <stop offset="0%" stopColor="#f87171" stopOpacity={0.35} />
                      <stop offset="100%" stopColor="#dc2626" stopOpacity={0.92} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke={gridStroke} strokeOpacity={0.32} horizontal={false} />
                  <XAxis type="number" tick={{ fontSize: 10, fill: axisStroke }} stroke={axisStroke} tickFormatter={(v) => `₹${(v / 1000).toFixed(0)}k`} />
                  <YAxis type="category" dataKey="name" width={108} tick={{ fontSize: 10, fill: axisStroke }} stroke={axisStroke} />
                  <Tooltip formatter={(v) => formatInr(v)} contentStyle={tooltipBox} animationDuration={180} />
                  <Bar dataKey="amount" name="Spent" fill="url(#insOvCatBar)" radius={[0, 8, 8, 0]} maxBarSize={22} animationDuration={750} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        <div className={`min-w-0 ${card}`}>
          <h2 className={chartTitleCls}>Investment allocation</h2>
          <p className={chartSubCls}>Book value by instrument type</p>
          <div className="mt-4 min-h-[280px] w-full">
            {investmentAllocationBarSorted.length === 0 ? (
              empty('No investments yet')
            ) : (
              <ResponsiveContainer width="100%" height={280} minWidth={48} minHeight={220}>
                <BarChart data={investmentAllocationBarSorted} layout="vertical" margin={{ top: 8, right: 16, left: 4, bottom: 0 }}>
                  <defs>
                    <linearGradient id="insOvInvBar" x1="0" y1="0" x2="1" y2="0">
                      <stop offset="0%" stopColor="#60a5fa" stopOpacity={0.35} />
                      <stop offset="100%" stopColor="#2563eb" stopOpacity={0.92} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke={gridStroke} strokeOpacity={0.32} horizontal={false} />
                  <XAxis type="number" tick={{ fontSize: 10, fill: axisStroke }} stroke={axisStroke} tickFormatter={(v) => `₹${(v / 1000).toFixed(0)}k`} />
                  <YAxis type="category" dataKey="type" width={112} tick={{ fontSize: 10, fill: axisStroke }} stroke={axisStroke} />
                  <Tooltip formatter={(v) => formatInr(v)} contentStyle={tooltipBox} animationDuration={180} />
                  <Bar dataKey="value" name="Value" fill="url(#insOvInvBar)" radius={[0, 8, 8, 0]} maxBarSize={24} animationDuration={750} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>
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
