import { NavLink, Outlet, useLocation } from 'react-router-dom'

const BASE = '/admin/production'

const tabs = [
  { to: `${BASE}/dashboard`, label: 'Dashboard', match: (p) => p === `${BASE}/dashboard` || p === BASE },
  { to: `${BASE}/pasteurization`, label: 'Pasteurization', match: (p) => p.startsWith(`${BASE}/pasteurization`) },
  { to: `${BASE}/packing`, label: 'Packing', match: (p) => p.startsWith(`${BASE}/packing`) },
  { to: `${BASE}/packed`, label: 'Packed inventory', match: (p) => p.startsWith(`${BASE}/packed`) },
  { to: `${BASE}/loss`, label: 'Production loss', match: (p) => p.startsWith(`${BASE}/loss`) },
  { to: `${BASE}/tracking`, label: 'Batch tracking', match: (p) => p.startsWith(`${BASE}/tracking`) },
  { to: `${BASE}/reports`, label: 'Reports', match: (p) => p.startsWith(`${BASE}/reports`) },
]

const related = [
  { to: '/admin/inventory/tanks', label: 'Inventory · raw tanks' },
  { to: '/admin/inventory/products', label: 'Inventory · FG stock' },
  { to: '/admin/outflow/entry', label: 'Dispatch entry' },
]

export default function ProductionLayout() {
  const { pathname } = useLocation()

  return (
    <div className="mx-auto max-w-[1600px] space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight text-slate-900">Milk production</h2>
        <p className="mt-1 text-sm text-slate-500">
          Pasteurization → standardization → packing → cold storage → dispatch. Milk-only plant flow.
        </p>
      </div>

      <div className="border-b border-slate-200">
        <nav className="-mb-px flex flex-wrap gap-1 overflow-x-auto pb-px" aria-label="Production sections">
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
          <span className="font-semibold text-slate-400">Related:</span>
          {related.map((l) => (
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
