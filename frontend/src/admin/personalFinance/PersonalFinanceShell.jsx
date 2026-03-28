import { Link } from 'react-router-dom'
import RiverLogo from '../RiverLogo.jsx'
import PersonalFinanceDashboardPage from './PersonalFinanceDashboardPage.jsx'

/**
 * Standalone app shell — not wrapped in dairy ERP ``AdminLayout``.
 */
export default function PersonalFinanceShell() {
  return (
    <div className="min-h-screen bg-[#F7FAFC] font-sans text-slate-800 antialiased">
      <header className="sticky top-0 z-10 border-b border-slate-200/90 bg-white/95 shadow-sm backdrop-blur-sm">
        <div className="mx-auto flex max-w-[1600px] items-center justify-between gap-4 px-4 py-3 sm:px-6">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#004080] text-white shadow-inner">
              <RiverLogo className="h-6 w-6 text-white" />
            </div>
            <div>
              <p className="text-sm font-bold text-slate-900">Personal finance</p>
              <p className="text-[11px] text-slate-500">Profiles, budgets and net worth</p>
            </div>
          </div>
          <Link
            to="/"
            className="rounded-xl px-3 py-2 text-sm font-semibold text-[#004080] transition hover:bg-slate-100"
          >
            ← Home
          </Link>
        </div>
      </header>
      <main className="mx-auto max-w-[1600px] px-4 py-6 sm:px-6">
        <PersonalFinanceDashboardPage />
      </main>
    </div>
  )
}
