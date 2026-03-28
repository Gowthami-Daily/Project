import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  ArrowPathIcon,
  BanknotesIcon,
  BuildingLibraryIcon,
  ChartPieIcon,
  CreditCardIcon,
  ArrowTrendingUpIcon,
  ReceiptPercentIcon,
  ScaleIcon,
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
import {
  getDashboardSummary,
  getExpenseByCategory,
  getIncomeVsExpense,
  getInvestmentAllocation,
  getNetworthGrowth,
  getPfToken,
  listProfiles,
  loginPf,
  readActiveProfileIdFromToken,
  setPfToken,
  switchProfile,
} from './api.js'

const CHART_COLORS = ['#004080', '#0ea5e9', '#22c55e', '#a855f7', '#f59e0b', '#ec4899', '#64748b']

function formatInr(n) {
  if (n == null || Number.isNaN(Number(n))) return '—'
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(Number(n))
}

const chartCard = 'rounded-2xl border border-slate-200/90 bg-white p-4 shadow-sm sm:p-5'
const chartTitle = 'text-base font-bold text-slate-900'
const chartSub = 'mt-0.5 text-xs text-slate-500'

export default function PersonalFinanceDashboardPage() {
  const [tokenPresent, setTokenPresent] = useState(() => Boolean(getPfToken()))
  const [loginEmail, setLoginEmail] = useState('')
  const [loginPassword, setLoginPassword] = useState('')
  const [loginError, setLoginError] = useState('')
  const [loading, setLoading] = useState(false)
  const [loadError, setLoadError] = useState('')

  const [profiles, setProfiles] = useState([])
  const [activeProfileId, setActiveProfileId] = useState(null)
  const [summary, setSummary] = useState(null)
  const [incomeExpense, setIncomeExpense] = useState([])
  const [expenseCats, setExpenseCats] = useState([])
  const [networth, setNetworth] = useState([])
  const [invAlloc, setInvAlloc] = useState([])

  const year = useMemo(() => new Date().getFullYear(), [])

  const loadAll = useCallback(async () => {
    if (!getPfToken()) return
    setLoading(true)
    setLoadError('')
    try {
      const [s, ie, ec, nw, ia, profs] = await Promise.all([
        getDashboardSummary(),
        getIncomeVsExpense(year),
        getExpenseByCategory(),
        getNetworthGrowth(year),
        getInvestmentAllocation(),
        listProfiles(),
      ])
      setSummary(s)
      setIncomeExpense(Array.isArray(ie) ? ie : [])
      setExpenseCats(Array.isArray(ec) ? ec : [])
      setNetworth(Array.isArray(nw) ? nw : [])
      setInvAlloc(Array.isArray(ia) ? ia : [])
      setProfiles(profs)
      const fromJwt = readActiveProfileIdFromToken()
      const ids = new Set((profs ?? []).map((p) => p.profile_id))
      const pick = fromJwt != null && ids.has(fromJwt) ? fromJwt : profs?.[0]?.profile_id ?? null
      setActiveProfileId(pick)
    } catch (e) {
      if (e.status === 401) {
        setPfToken(null)
        setTokenPresent(false)
        setLoadError('Session expired — sign in again.')
      } else {
        setLoadError(e.message || 'Failed to load dashboard')
      }
    } finally {
      setLoading(false)
    }
  }, [year])

  useEffect(() => {
    if (tokenPresent) loadAll()
  }, [tokenPresent, loadAll])

  async function handleLogin(e) {
    e.preventDefault()
    setLoginError('')
    try {
      const data = await loginPf(loginEmail.trim(), loginPassword)
      setPfToken(data.access_token)
      setTokenPresent(true)
      setLoginPassword('')
    } catch (err) {
      setLoginError(err.message || 'Login failed')
    }
  }

  function handleLogout() {
    setPfToken(null)
    setTokenPresent(false)
    setSummary(null)
    setProfiles([])
    setLoadError('')
  }

  async function handleProfileChange(profileId) {
    const id = Number(profileId)
    if (!id || Number.isNaN(id)) return
    try {
      const data = await switchProfile(id)
      setPfToken(data.access_token)
      await loadAll()
    } catch (e) {
      setLoadError(e.message || 'Could not switch profile')
    }
  }

  const pieData = useMemo(
    () =>
      (expenseCats || []).map((row) => ({
        name: row.category || 'Other',
        value: Number(row.total) || 0,
      })),
    [expenseCats],
  )

  const barIeData = useMemo(
    () =>
      (incomeExpense || []).map((row) => ({
        month: row.month,
        income: Number(row.income) || 0,
        expense: Number(row.expense) || 0,
      })),
    [incomeExpense],
  )

  const networthData = useMemo(
    () =>
      (networth || []).map((row) => ({
        month: row.month,
        netWorth: Number(row.net_worth) || 0,
      })),
    [networth],
  )

  const invBarData = useMemo(
    () =>
      (invAlloc || []).map((row) => ({
        type: row.type || 'Other',
        value: Number(row.value) || 0,
      })),
    [invAlloc],
  )

  if (!tokenPresent) {
    return (
      <div className="mx-auto max-w-lg space-y-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">Personal finance</h1>
          <p className="mt-1 text-sm text-slate-500">
            Sign in to view your profiles, net worth, and cashflow (multi-profile).
          </p>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label htmlFor="pf-email" className="block text-sm font-medium text-slate-700">
                Email
              </label>
              <input
                id="pf-email"
                type="email"
                autoComplete="username"
                value={loginEmail}
                onChange={(ev) => setLoginEmail(ev.target.value)}
                className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none ring-sky-500/30 focus:ring-2"
                placeholder="finance.demo@example.com"
                required
              />
            </div>
            <div>
              <label htmlFor="pf-password" className="block text-sm font-medium text-slate-700">
                Password
              </label>
              <input
                id="pf-password"
                type="password"
                autoComplete="current-password"
                value={loginPassword}
                onChange={(ev) => setLoginPassword(ev.target.value)}
                className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none ring-sky-500/30 focus:ring-2"
                required
              />
            </div>
            {loginError ? <p className="text-sm text-red-600">{loginError}</p> : null}
            {import.meta.env.DEV ? (
              <p className="rounded-xl bg-slate-100 px-3 py-2 text-xs text-slate-600">
                <span className="font-semibold text-slate-700">Local demo:</span>{' '}
                finance.demo@example.com / FinanceDemo123!
              </p>
            ) : null}
            <button
              type="submit"
              className="w-full rounded-xl bg-[#004080] py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-[#003366]"
            >
              Sign in
            </button>
          </form>
        </div>
      </div>
    )
  }

  const periodLabel = summary
    ? `${summary.period_start?.slice?.(0, 10) ?? ''} → ${summary.period_end?.slice?.(0, 10) ?? ''}`
    : ''

  return (
    <div className="mx-auto max-w-[1600px] space-y-6 lg:space-y-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">Personal finance</h1>
          <p className="mt-1 text-sm text-slate-500 sm:text-base">
            Profile-scoped dashboard — income, spending, investments, and loans. Period: {periodLabel}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <label htmlFor="pf-profile" className="sr-only">
            Active profile
          </label>
          <select
            id="pf-profile"
            className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-800 shadow-sm outline-none ring-sky-500/20 focus:ring-2"
            value={readActiveProfileIdFromToken() ?? activeProfileId ?? ''}
            onChange={(e) => handleProfileChange(e.target.value)}
          >
            {profiles.map((p) => (
              <option key={p.profile_id} value={p.profile_id}>
                {p.profile_name} ({p.profile_type})
              </option>
            ))}
          </select>
          <button
            type="button"
            onClick={() => loadAll()}
            disabled={loading}
            className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 shadow-sm hover:bg-slate-50 disabled:opacity-50"
          >
            <ArrowPathIcon className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
          <button
            type="button"
            onClick={handleLogout}
            className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-50"
          >
            Sign out
          </button>
        </div>
      </div>

      {loadError ? (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">{loadError}</div>
      ) : null}

      <section aria-label="Financial summary">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <KpiCard
            title="Net worth"
            value={formatInr(summary?.net_worth)}
            subtitle="Assets + investments − liabilities − loans (approx.)"
            icon={ScaleIcon}
            gradientClass="bg-gradient-to-br from-violet-600 to-indigo-600"
          />
          <KpiCard
            title="Income (YTD)"
            value={formatInr(summary?.total_income)}
            subtitle="Recorded in active profile"
            icon={ArrowTrendingUpIcon}
            gradientClass="bg-gradient-to-br from-emerald-500 to-teal-600"
          />
          <KpiCard
            title="Expense (YTD)"
            value={formatInr(summary?.total_expense)}
            subtitle="Recorded in active profile"
            icon={CreditCardIcon}
            gradientClass="bg-gradient-to-br from-rose-500 to-orange-500"
          />
          <KpiCard
            title="Cash in accounts"
            value={formatInr(summary?.cash_balance)}
            subtitle="Sum of finance account balances"
            icon={BanknotesIcon}
            gradientClass="bg-gradient-to-br from-sky-500 to-blue-600"
          />
          <KpiCard
            title="Investments (market value)"
            value={formatInr(summary?.total_investment)}
            subtitle="Current value aggregate"
            icon={ChartPieIcon}
            gradientClass="bg-gradient-to-br from-cyan-500 to-blue-500"
          />
          <KpiCard
            title="Fixed assets"
            value={formatInr(summary?.total_assets)}
            subtitle="Recorded asset rows"
            icon={BuildingLibraryIcon}
            gradientClass="bg-gradient-to-br from-amber-500 to-yellow-600"
          />
          <KpiCard
            title="Liabilities"
            value={formatInr(summary?.total_liabilities)}
            subtitle="Non-loan liabilities"
            icon={ReceiptPercentIcon}
            gradientClass="bg-gradient-to-br from-slate-600 to-slate-800"
          />
          <KpiCard
            title="Loans outstanding"
            value={formatInr(summary?.loan_outstanding)}
            subtitle="Approx. from latest payments"
            icon={CreditCardIcon}
            gradientClass="bg-gradient-to-br from-red-600 to-rose-700"
          />
        </div>
      </section>

      <section aria-label="Charts" className="grid gap-4 lg:grid-cols-2">
        <div className={chartCard}>
          <h2 className={chartTitle}>Income vs expense</h2>
          <p className={chartSub}>Monthly · {year}</p>
          <div className="mt-3 h-[280px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={barIeData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="month" tick={{ fontSize: 10 }} stroke="#64748b" angle={-35} textAnchor="end" height={56} />
                <YAxis tick={{ fontSize: 11 }} stroke="#64748b" tickFormatter={(v) => `₹${(v / 1000).toFixed(0)}k`} />
                <Tooltip
                  formatter={(v) => formatInr(v)}
                  contentStyle={{ borderRadius: 12, border: '1px solid #e2e8f0' }}
                />
                <Legend />
                <Bar dataKey="income" name="Income" fill="#22c55e" radius={[4, 4, 0, 0]} />
                <Bar dataKey="expense" name="Expense" fill="#f97316" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className={chartCard}>
          <h2 className={chartTitle}>Expense by category</h2>
          <p className={chartSub}>All time in window (default)</p>
          <div className="mt-3 h-[280px] w-full">
            {pieData.length === 0 ? (
              <p className="flex h-full items-center justify-center text-sm text-slate-500">No expense data yet</p>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={pieData}
                    dataKey="value"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    outerRadius={100}
                    label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                  >
                    {pieData.map((_, i) => (
                      <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(v) => formatInr(v)} />
                </PieChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        <div className={chartCard}>
          <h2 className={chartTitle}>Net worth trend</h2>
          <p className={chartSub}>Estimated from balance sheet + cumulative savings · {year}</p>
          <div className="mt-3 h-[280px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={networthData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="month" tick={{ fontSize: 10 }} stroke="#64748b" angle={-35} textAnchor="end" height={56} />
                <YAxis tick={{ fontSize: 11 }} stroke="#64748b" tickFormatter={(v) => `₹${(v / 1000).toFixed(0)}k`} />
                <Tooltip formatter={(v) => formatInr(v)} contentStyle={{ borderRadius: 12, border: '1px solid #e2e8f0' }} />
                <Line type="monotone" dataKey="netWorth" name="Net worth" stroke="#004080" strokeWidth={2.5} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className={chartCard}>
          <h2 className={chartTitle}>Investment allocation</h2>
          <p className={chartSub}>By instrument type</p>
          <div className="mt-3 h-[280px] w-full">
            {invBarData.length === 0 ? (
              <p className="flex h-full items-center justify-center text-sm text-slate-500">No investments yet</p>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={invBarData} layout="vertical" margin={{ top: 8, right: 8, left: 8, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis type="number" tick={{ fontSize: 11 }} stroke="#64748b" tickFormatter={(v) => `₹${(v / 1000).toFixed(0)}k`} />
                  <YAxis type="category" dataKey="type" width={100} tick={{ fontSize: 11 }} stroke="#64748b" />
                  <Tooltip formatter={(v) => formatInr(v)} contentStyle={{ borderRadius: 12, border: '1px solid #e2e8f0' }} />
                  <Bar dataKey="value" name="Value" fill="#0ea5e9" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>
      </section>

      <section aria-label="Recent transactions" className={chartCard}>
        <h2 className={chartTitle}>Recent transactions</h2>
        <p className={chartSub}>Latest income and expense rows</p>
        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[520px] text-left text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-xs font-semibold uppercase tracking-wide text-slate-500">
                <th className="pb-2 pr-4">Type</th>
                <th className="pb-2 pr-4">Date</th>
                <th className="pb-2 pr-4">Category</th>
                <th className="pb-2 pr-4 text-right">Amount</th>
              </tr>
            </thead>
            <tbody>
              {(summary?.recent_transactions ?? []).length === 0 ? (
                <tr>
                  <td colSpan={4} className="py-8 text-center text-slate-500">
                    No transactions yet — add income or expenses under Finance API.
                  </td>
                </tr>
              ) : (
                summary.recent_transactions.map((tx) => (
                  <tr key={`${tx.kind}-${tx.id}`} className="border-b border-slate-100">
                    <td className="py-2 pr-4">
                      <span
                        className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
                          tx.kind === 'income' ? 'bg-emerald-100 text-emerald-800' : 'bg-orange-100 text-orange-800'
                        }`}
                      >
                        {tx.kind}
                      </span>
                    </td>
                    <td className="py-2 pr-4 text-slate-600">{tx.date}</td>
                    <td className="py-2 pr-4 text-slate-800">{tx.category}</td>
                    <td className="py-2 text-right font-mono tabular-nums text-slate-900">{formatInr(tx.amount)}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  )
}
