import { NavLink, Outlet } from 'react-router-dom'

const tabs = [
  { to: '/admin/outflow/dispatch', label: 'Dispatch' },
  { to: '/admin/outflow/crm', label: 'CRM & messaging' },
  { to: '/admin/outflow/crates', label: 'Crates' },
  { to: '/admin/outflow/fleet', label: 'Fleet & telematics' },
  { to: '/admin/outflow/exceptions', label: 'Vacation & micro-orders' },
]

export default function OutflowLayout() {
  return (
    <div className="mx-auto max-w-[1400px]">
      <div className="mb-6 border-b border-slate-200">
        <h2 className="text-2xl font-bold tracking-tight text-slate-900">Outflow</h2>
        <p className="mt-1 text-sm text-slate-500">
          Logistics, customer comms, crate assets, fleet analytics, and delivery exceptions — Module 3
          (FastAPI).
        </p>
        <nav className="mt-4 flex flex-wrap gap-1" aria-label="Outflow sections">
          {tabs.map((t) => (
            <NavLink
              key={t.to}
              to={t.to}
              className={({ isActive }) =>
                `rounded-lg px-4 py-2 text-sm font-semibold transition ${
                  isActive ? 'bg-[#004080] text-white shadow-sm' : 'text-slate-600 hover:bg-slate-100'
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
