import { NavLink, Outlet, useLocation } from 'react-router-dom'

const BASE = '/admin/cattle'

const tabs = [
  { to: `${BASE}/dashboard`, label: 'Dashboard', match: (p) => p === `${BASE}/dashboard` || p === BASE },
  { to: `${BASE}/animals`, label: 'Animal register', match: (p) => p.startsWith(`${BASE}/animals`) },
  { to: `${BASE}/milk`, label: 'Milk yield', match: (p) => p.startsWith(`${BASE}/milk`) },
  { to: `${BASE}/feed`, label: 'Feed management', match: (p) => p.startsWith(`${BASE}/feed`) && !p.startsWith(`${BASE}/feed-inventory`) },
  { to: `${BASE}/feed-inventory`, label: 'Feed inventory', match: (p) => p.startsWith(`${BASE}/feed-inventory`) },
  { to: `${BASE}/health`, label: 'Health & doctor', match: (p) => p.startsWith(`${BASE}/health`) },
  { to: `${BASE}/vaccination`, label: 'Vaccination', match: (p) => p.startsWith(`${BASE}/vaccination`) },
  { to: `${BASE}/breeding`, label: 'Breeding', match: (p) => p.startsWith(`${BASE}/breeding`) },
  { to: `${BASE}/expenses`, label: 'Animal expenses', match: (p) => p.startsWith(`${BASE}/expenses`) },
  { to: `${BASE}/farm-expenses`, label: 'Farm expenses', match: (p) => p.startsWith(`${BASE}/farm-expenses`) },
  { to: `${BASE}/profit`, label: 'Profit', match: (p) => p.startsWith(`${BASE}/profit`) },
  { to: `${BASE}/reports`, label: 'Reports', match: (p) => p.startsWith(`${BASE}/reports`) },
]

const related = [
  { to: '/admin/inflow/dashboard', label: 'Inflow' },
  { to: '/admin/ledger/farmer-ledger', label: 'Farmer ledger' },
]

export default function CattleLayout() {
  const { pathname } = useLocation()

  return (
    <div className="mx-auto max-w-[1600px] space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight text-slate-900">Cattle &amp; farm management</h2>
        <p className="mt-1 text-sm text-slate-500">
          Herd register, yield, feed economics, health, breeding, and profit per animal — herd management style.
        </p>
      </div>

      <div className="border-b border-slate-200">
        <nav className="-mb-px flex flex-wrap gap-1 overflow-x-auto pb-px" aria-label="Cattle sections">
          {tabs.map((t) => (
            <NavLink
              key={t.to}
              to={t.to}
              className={() =>
                `whitespace-nowrap rounded-t-lg px-2.5 py-2 text-[11px] font-semibold transition sm:px-3 sm:text-xs ${
                  t.match(pathname) ? 'bg-emerald-700 text-white shadow-sm' : 'text-slate-600 hover:bg-slate-100'
                }`
              }
            >
              {t.label}
            </NavLink>
          ))}
        </nav>
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 border-t border-slate-100 py-2 text-xs text-slate-500">
          <span className="font-semibold text-slate-400">Related:</span>
          {related.map((l) => (
            <NavLink
              key={l.to}
              to={l.to}
              className={({ isActive }) =>
                `font-medium underline-offset-2 hover:text-emerald-800 hover:underline ${isActive ? 'text-emerald-800' : ''}`
              }
            >
              {l.label}
            </NavLink>
          ))}
        </div>
      </div>

      <Outlet />
    </div>
  )
}
