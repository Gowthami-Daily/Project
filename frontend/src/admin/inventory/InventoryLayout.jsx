import { NavLink, Outlet, useLocation } from 'react-router-dom'

const BASE = '/admin/inventory'

const tabs = [
  { to: `${BASE}/dashboard`, label: 'Dashboard', match: (p) => p === `${BASE}/dashboard` || p === BASE },
  { to: `${BASE}/tanks`, label: 'Milk tanks', match: (p) => p.startsWith(`${BASE}/tanks`) },
  { to: `${BASE}/processing`, label: 'Processing', match: (p) => p.startsWith(`${BASE}/processing`) },
  { to: `${BASE}/products`, label: 'Product stock', match: (p) => p.startsWith(`${BASE}/products`) },
  { to: `${BASE}/transactions`, label: 'Transactions', match: (p) => p.startsWith(`${BASE}/transactions`) },
  { to: `${BASE}/spoilage`, label: 'Spoilage', match: (p) => p.startsWith(`${BASE}/spoilage`) },
  { to: `${BASE}/adjustments`, label: 'Stock adjustment', match: (p) => p.startsWith(`${BASE}/adjustments`) },
  { to: `${BASE}/transfers`, label: 'Stock transfer', match: (p) => p.startsWith(`${BASE}/transfers`) },
  { to: `${BASE}/reports`, label: 'Reports', match: (p) => p.startsWith(`${BASE}/reports`) },
]

const related = [
  { to: '/admin/inflow/tanks', label: 'Inflow · collection tanks' },
  { to: '/admin/assets/tanks', label: 'Assets · tank register' },
  { to: '/admin/outflow/dashboard', label: 'Dispatch' },
]

export default function InventoryLayout() {
  const { pathname } = useLocation()

  return (
    <div className="mx-auto max-w-[1600px] space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight text-slate-900">Inventory management</h2>
        <p className="mt-1 text-sm text-slate-500">
          Raw milk, WIP, finished goods, and the movement ledger — connects inflow, production, and dispatch.
        </p>
      </div>

      <div className="border-b border-slate-200">
        <nav className="-mb-px flex flex-wrap gap-1 overflow-x-auto pb-px" aria-label="Inventory sections">
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
