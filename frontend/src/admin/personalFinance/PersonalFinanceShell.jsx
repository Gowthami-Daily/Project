import { Link, Outlet } from 'react-router-dom'
import { useCallback, useMemo, useState } from 'react'
import RiverLogo from '../RiverLogo.jsx'
import PersonalFinanceAuth from './PersonalFinanceAuth.jsx'
import PfSidebar from './PfSidebar.jsx'
import PfToolbar from './PfToolbar.jsx'
import { getPfToken, setPfToken } from './api.js'
import { PfRefreshProvider } from './pfRefreshContext.jsx'

/**
 * Standalone app shell — not wrapped in dairy ERP ``AdminLayout``.
 */
export default function PersonalFinanceShell() {
  const [authed, setAuthed] = useState(() => Boolean(getPfToken()))

  const handleSessionInvalid = useCallback(() => setAuthed(false), [])

  function handleLogout() {
    setPfToken(null)
    setAuthed(false)
  }

  if (!authed) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-sky-50/90 via-white to-sky-50/40 font-sans text-slate-800 antialiased">
        <header className="sticky top-0 z-10 border-b border-sky-200/70 bg-white/95 shadow-sm shadow-sky-950/[0.03] backdrop-blur-sm">
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
        <main className="mx-auto max-w-[1600px] px-4 py-8 sm:px-6">
          <PersonalFinanceAuth onSuccess={() => setAuthed(true)} />
        </main>
      </div>
    )
  }

  const sessionCtx = useMemo(() => ({ onSessionInvalid: handleSessionInvalid }), [handleSessionInvalid])

  return (
    <PfRefreshProvider>
      <div className="min-h-screen bg-gradient-to-b from-sky-50/90 via-white to-sky-50/40 font-sans text-slate-800 antialiased">
        <header className="sticky top-0 z-10 border-b border-sky-200/70 bg-white/95 shadow-sm shadow-sky-950/[0.03] backdrop-blur-sm">
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

        <div className="mx-auto flex max-w-[1600px] flex-col md:flex-row md:items-stretch">
          <PfSidebar />
          <div className="flex min-h-[calc(100vh-57px)] min-w-0 flex-1 flex-col border-sky-200/60 md:border-l md:bg-white/40">
            <PfToolbar onLogout={handleLogout} onSessionInvalid={handleSessionInvalid} />
            <main className="flex-1 px-4 py-6 sm:px-6">
              <Outlet context={sessionCtx} />
            </main>
          </div>
        </div>
      </div>
    </PfRefreshProvider>
  )
}
