import { NavLink, Outlet, useLocation } from 'react-router-dom'

const BASE = '/admin/ledger'

const tabs = [
  { to: `${BASE}/dashboard`, label: 'Dashboard', match: (p) => p === `${BASE}/dashboard` },
  { to: `${BASE}/wallet`, label: 'Customer wallet', match: (p) => p.startsWith(`${BASE}/wallet`) },
  { to: `${BASE}/farmer-ledger`, label: 'Farmer ledger', match: (p) => p.startsWith(`${BASE}/farmer-ledger`) },
  { to: `${BASE}/expenses`, label: 'Expenses', match: (p) => p.startsWith(`${BASE}/expenses`) },
  { to: `${BASE}/income`, label: 'Income', match: (p) => p.startsWith(`${BASE}/income`) },
  { to: `${BASE}/advances`, label: 'Advances', match: (p) => p.startsWith(`${BASE}/advances`) },
  { to: `${BASE}/payments`, label: 'Payments', match: (p) => p.startsWith(`${BASE}/payments`) },
  { to: `${BASE}/pl`, label: 'P & L', match: (p) => p.startsWith(`${BASE}/pl`) },
  { to: `${BASE}/balance-sheet`, label: 'Balance sheet', match: (p) => p.startsWith(`${BASE}/balance-sheet`) },
  { to: `${BASE}/cash-flow`, label: 'Cash flow', match: (p) => p.startsWith(`${BASE}/cash-flow`) },
  { to: `${BASE}/reports`, label: 'Reports', match: (p) => p.startsWith(`${BASE}/reports`) },
]

export default function FinanceLayout() {
  const { pathname } = useLocation()

  return (
    <div className="mx-auto max-w-[1600px] space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight text-slate-900">Finance &amp; accounts</h2>
        <p className="mt-1 text-sm text-slate-500">
          Wallets, farmer payables, income &amp; expense, statutory views, and double-entry readiness — Module 5.
        </p>
      </div>

      <div className="border-b border-slate-200">
        <nav className="-mb-px flex flex-wrap gap-1 overflow-x-auto pb-px" aria-label="Finance sections">
          {tabs.map((t) => (
            <NavLink
              key={t.to}
              to={t.to}
              className={() =>
                `whitespace-nowrap rounded-t-lg px-3 py-2 text-xs font-semibold transition sm:px-4 sm:text-sm ${
                  t.match(pathname) ? 'bg-[#004080] text-white shadow-sm' : 'text-slate-600 hover:bg-slate-100'
                }`
              }
            >
              {t.label}
            </NavLink>
          ))}
        </nav>
      </div>

      <Outlet />
    </div>
  )
}
