import { NavLink, Outlet, useLocation } from 'react-router-dom'

const HR_BASE = '/admin/hr'

const tabs = [
  { to: `${HR_BASE}/dashboard`, label: 'HR dashboard', match: (p) => p === `${HR_BASE}/dashboard` },
  {
    to: `${HR_BASE}/staff`,
    label: 'Staff directory',
    end: false,
    match: (p) => p === `${HR_BASE}/staff` || p.startsWith(`${HR_BASE}/staff/`),
  },
  { to: `${HR_BASE}/attendance`, label: 'Attendance', match: (p) => p.startsWith(`${HR_BASE}/attendance`) },
  { to: `${HR_BASE}/shifts`, label: 'Shifts', match: (p) => p.startsWith(`${HR_BASE}/shifts`) },
  { to: `${HR_BASE}/payroll`, label: 'Payroll', match: (p) => p.startsWith(`${HR_BASE}/payroll`) },
  { to: `${HR_BASE}/advances`, label: 'Advances', match: (p) => p.startsWith(`${HR_BASE}/advances`) },
  { to: `${HR_BASE}/leaves`, label: 'Leaves', match: (p) => p.startsWith(`${HR_BASE}/leaves`) },
  { to: `${HR_BASE}/roles`, label: 'Roles & permissions', match: (p) => p.startsWith(`${HR_BASE}/roles`) },
  { to: `${HR_BASE}/documents`, label: 'Documents', match: (p) => p.startsWith(`${HR_BASE}/documents`) },
]

export default function HrLayout() {
  const { pathname } = useLocation()

  return (
    <div className="mx-auto max-w-[1600px] space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight text-slate-900">HR &amp; staff</h2>
        <p className="mt-1 text-sm text-slate-500">
          Directory, attendance, payroll, advances, leaves, and RBAC — enterprise-style HR operations.
        </p>
      </div>

      <div className="border-b border-slate-200">
        <nav className="-mb-px flex flex-wrap gap-1 overflow-x-auto pb-px" aria-label="HR sections">
          {tabs.map((t) => (
            <NavLink
              key={t.to}
              to={t.to}
              end={t.end !== false}
              className={() =>
                `whitespace-nowrap rounded-t-lg px-3 py-2.5 text-sm font-semibold transition sm:px-4 ${
                  t.match(pathname)
                    ? 'bg-[#004080] text-white shadow-sm'
                    : 'text-slate-600 hover:bg-slate-100'
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
