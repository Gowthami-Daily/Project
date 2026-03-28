import { NavLink, Outlet, useLocation } from 'react-router-dom'

const BASE = '/admin/customers'

const tabs = [
  { to: `${BASE}/dashboard`, label: 'Dashboard', match: (p) => p === `${BASE}/dashboard` },
  {
    to: `${BASE}/directory`,
    label: 'Customers',
    match: (p) => p === `${BASE}/directory` || p.startsWith(`${BASE}/directory/`),
  },
  { to: `${BASE}/subscriptions`, label: 'Subscriptions', match: (p) => p.startsWith(`${BASE}/subscriptions`) },
  { to: `${BASE}/wallet`, label: 'Wallet', match: (p) => p.startsWith(`${BASE}/wallet`) },
  { to: `${BASE}/orders`, label: 'Orders', match: (p) => p.startsWith(`${BASE}/orders`) },
  { to: `${BASE}/delivery`, label: 'Delivery schedule', match: (p) => p.startsWith(`${BASE}/delivery`) },
  { to: `${BASE}/complaints`, label: 'Complaints', match: (p) => p.startsWith(`${BASE}/complaints`) },
  { to: `${BASE}/notifications`, label: 'Notifications', match: (p) => p.startsWith(`${BASE}/notifications`) },
  { to: `${BASE}/reports`, label: 'Reports', match: (p) => p.startsWith(`${BASE}/reports`) },
]

export default function CustomersLayout() {
  const { pathname } = useLocation()

  return (
    <div className="mx-auto max-w-[1600px] space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight text-slate-900">Customers &amp; subscriptions</h2>
        <p className="mt-1 text-sm text-slate-500">
          CRM, plans, wallet, micro-orders, delivery windows, and support — ties to dispatch &amp; finance.
        </p>
      </div>

      <div className="border-b border-slate-200">
        <nav className="-mb-px flex flex-wrap gap-1 overflow-x-auto pb-px" aria-label="Customers sections">
          {tabs.map((t) => (
            <NavLink
              key={t.to}
              to={t.to}
              end
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
