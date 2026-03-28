import { NavLink, Outlet, useLocation } from 'react-router-dom'

const BASE = '/admin/outflow'

const tabs = [
  { to: `${BASE}/dashboard`, label: 'Dashboard', match: (p) => p === `${BASE}/dashboard` || p === BASE },
  { to: `${BASE}/routes`, label: 'Routes', match: (p) => p.startsWith(`${BASE}/routes`) },
  { to: `${BASE}/schedule`, label: 'Delivery schedule', match: (p) => p.startsWith(`${BASE}/schedule`) },
  { to: `${BASE}/entry`, label: 'Dispatch entry', match: (p) => p.startsWith(`${BASE}/entry`) },
  { to: `${BASE}/tracking`, label: 'Live tracking', match: (p) => p.startsWith(`${BASE}/tracking`) },
  { to: `${BASE}/proof`, label: 'Proof of delivery', match: (p) => p.startsWith(`${BASE}/proof`) },
  { to: `${BASE}/missed`, label: 'Missed deliveries', match: (p) => p.startsWith(`${BASE}/missed`) },
  { to: `${BASE}/returns`, label: 'Returns', match: (p) => p.startsWith(`${BASE}/returns`) },
  { to: `${BASE}/reports`, label: 'Reports', match: (p) => p.startsWith(`${BASE}/reports`) },
]

const legacy = [
  { to: `${BASE}/board`, label: 'Dispatch board' },
  { to: `${BASE}/crm`, label: 'CRM & messaging' },
  { to: `${BASE}/crates`, label: 'Crates' },
  { to: `${BASE}/fleet`, label: 'Fleet' },
  { to: `${BASE}/exceptions`, label: 'Exceptions' },
]

export default function DispatchLayout() {
  const { pathname } = useLocation()

  return (
    <div className="mx-auto max-w-[1600px] space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight text-slate-900">Dispatch &amp; delivery</h2>
        <p className="mt-1 text-sm text-slate-500">
          Route planning, daily schedule, loading, live tracking, proof, and exceptions — ties to customers,
          inventory, production, and finance.
        </p>
      </div>

      <div className="border-b border-slate-200">
        <nav className="-mb-px flex flex-wrap gap-1 overflow-x-auto pb-px" aria-label="Dispatch sections">
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
