import { NavLink, Outlet, useLocation } from 'react-router-dom'

const BASE = '/admin/inflow'

const tabs = [
  { to: `${BASE}/dashboard`, label: 'Dashboard', match: (p) => p === `${BASE}/dashboard` || p === BASE },
  { to: `${BASE}/farmers`, label: 'Farmers', match: (p) => p.startsWith(`${BASE}/farmers`) },
  { to: `${BASE}/collection`, label: 'Milk collection', match: (p) => p.startsWith(`${BASE}/collection`) },
  { to: `${BASE}/quality`, label: 'Quality testing', match: (p) => p.startsWith(`${BASE}/quality`) },
  { to: `${BASE}/transfer`, label: 'Transfer to tank', match: (p) => p.startsWith(`${BASE}/transfer`) },
  { to: `${BASE}/reports`, label: 'Reports', match: (p) => p.startsWith(`${BASE}/reports`) },
]

const legacy = [
  { to: `${BASE}/lab`, label: 'Lab QA (detailed)' },
  { to: `${BASE}/centers`, label: 'Centers register' },
  { to: `${BASE}/tanks`, label: 'Collection tanks' },
]

export default function InflowLayout() {
  const { pathname } = useLocation()

  return (
    <div className="mx-auto max-w-[1600px] space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight text-slate-900">Inflow · milk procurement</h2>
        <p className="mt-1 text-sm text-slate-500">
          Where the day starts: farmer milk → quality → accepted to tank → production. Optimized for busy mornings and
          tablets.
        </p>
      </div>

      <div className="border-b border-slate-200">
        <nav className="-mb-px flex flex-wrap gap-1 overflow-x-auto pb-px" aria-label="Inflow sections">
          {tabs.map((t) => (
            <NavLink
              key={t.to}
              to={t.to}
              className={() =>
                `whitespace-nowrap rounded-t-lg px-3 py-2.5 text-xs font-semibold transition sm:px-4 sm:text-sm ${
                  t.match(pathname) ? 'bg-[#004080] text-white shadow-sm' : 'text-slate-600 hover:bg-slate-100'
                }`
              }
            >
              {t.label}
            </NavLink>
          ))}
        </nav>
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 border-t border-slate-100 py-2 text-xs text-slate-500">
          <span className="font-semibold text-slate-400">Also:</span>
          {legacy.map((l) => (
            <NavLink
              key={l.to}
              to={l.to}
              className={({ isActive }) =>
                `font-medium underline-offset-2 hover:text-[#004080] hover:underline ${isActive ? 'text-[#004080]' : ''}`
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
