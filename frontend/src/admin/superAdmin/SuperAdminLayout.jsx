import { NavLink, Outlet } from 'react-router-dom'

const navCls =
  'rounded-lg px-3 py-2 text-sm font-semibold transition hover:bg-slate-800/80 aria-[current=page]:bg-slate-800 aria-[current=page]:text-white'

export default function SuperAdminLayout() {
  return (
    <div className="min-h-screen bg-slate-950 font-sans text-slate-100">
      <header className="border-b border-slate-800 bg-slate-900/90">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-4 py-3">
          <div>
            <p className="text-xs font-bold uppercase tracking-widest text-amber-400">Super Admin</p>
            <h1 className="text-lg font-bold text-white">Platform control</h1>
          </div>
          <nav className="flex flex-wrap gap-1">
            <NavLink to="/super-admin" end className={navCls}>
              Dashboard
            </NavLink>
            <NavLink to="/super-admin/users" className={navCls}>
              Users
            </NavLink>
            <NavLink to="/super-admin/permissions" className={navCls}>
              Permissions
            </NavLink>
            <NavLink to="/super-admin/logs" className={navCls}>
              Logs
            </NavLink>
            <NavLink to="/super-admin/backup" className={navCls}>
              Backup
            </NavLink>
            <NavLink to="/personal-finance" className={`${navCls} text-sky-300`}>
              PF app →
            </NavLink>
          </nav>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-6">
        <Outlet />
      </main>
    </div>
  )
}
