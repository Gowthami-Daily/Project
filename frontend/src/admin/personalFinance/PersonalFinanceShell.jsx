import { Link, Outlet } from 'react-router-dom'
import { Suspense, useCallback, useMemo, useState } from 'react'
import RiverLogo from '../RiverLogo.jsx'
import PersonalFinanceAuth from './PersonalFinanceAuth.jsx'
import PfBottomNav from './PfBottomNav.jsx'
import PfOutletErrorBoundary from './PfOutletErrorBoundary.jsx'
import PfSidebar from './PfSidebar.jsx'
import PfToolbar from './PfToolbar.jsx'
import { getPfToken, setPfToken } from './api.js'
import { PfRefreshProvider } from './pfRefreshContext.jsx'
import { PfThemeProvider, usePfTheme } from './PfThemeContext.jsx'
import './pfMobile.css'

const pfPageFallback = (
  <div className="flex min-h-[50vh] flex-col items-center justify-center gap-3 px-4">
    <div
      className="h-9 w-9 animate-spin rounded-full border-2 border-slate-200 border-t-[#1E3A8A] dark:border-slate-600 dark:border-t-blue-400"
      aria-hidden
    />
    <p className="text-sm font-medium text-slate-600 dark:text-slate-400">Loading page…</p>
  </div>
)

function PersonalFinanceShellInner() {
  const [authed, setAuthed] = useState(() => Boolean(getPfToken()))
  const { resolved } = usePfTheme()
  const isDark = resolved === 'dark'

  const handleSessionInvalid = useCallback(() => setAuthed(false), [])

  function handleLogout() {
    setPfToken(null)
    setAuthed(false)
  }

  if (!authed) {
    return (
      <div
        className={`min-h-screen font-sans antialiased ${isDark ? 'dark' : ''} bg-[#F1F5F9] text-slate-800 dark:bg-slate-900 dark:text-slate-100`}
      >
        <header className="sticky top-0 z-10 border-b border-slate-200/80 bg-white/95 backdrop-blur-md dark:border-slate-700 dark:bg-slate-900/95">
          <div className="mx-auto flex h-[60px] max-w-[1600px] items-center justify-between gap-4 px-4 sm:px-6">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#1E3A8A] text-white shadow-inner">
                <RiverLogo className="h-6 w-6 text-white" />
              </div>
              <p className="text-sm font-bold text-slate-900 dark:text-slate-100">Personal finance</p>
            </div>
            <Link
              to="/"
              className="rounded-[12px] px-3 py-2 text-sm font-semibold text-[#1E3A8A] transition hover:bg-slate-100 dark:text-blue-400 dark:hover:bg-slate-800"
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

  const sessionCtx = useMemo(
    () => ({ onSessionInvalid: handleSessionInvalid, onLogout: handleLogout }),
    [handleSessionInvalid],
  )

  return (
    <PfRefreshProvider>
      <div
        className={`pf-app min-h-screen antialiased ${isDark ? 'dark' : ''} bg-[#F1F5F9] text-slate-800 dark:bg-slate-900 dark:text-slate-100`}
      >
        <PfToolbar onSessionInvalid={handleSessionInvalid} onLogout={handleLogout} />
        <div className="mx-auto flex max-w-[1600px] flex-col md:flex-row md:items-stretch">
          <PfSidebar />
          <div className="flex min-h-[calc(100vh-92px)] min-w-0 flex-1 flex-col border-slate-200/60 dark:border-slate-700/80 md:border-l md:bg-white/50 dark:md:bg-slate-800/30">
            <main className="pf-page-enter flex-1 px-4 py-4 pb-[calc(5.5rem+env(safe-area-inset-bottom))] sm:px-6 md:py-6 md:pb-6">
              <PfOutletErrorBoundary>
                <Suspense fallback={pfPageFallback}>
                  <Outlet context={sessionCtx} />
                </Suspense>
              </PfOutletErrorBoundary>
            </main>
          </div>
        </div>
        <PfBottomNav />
      </div>
    </PfRefreshProvider>
  )
}

/**
 * Standalone app shell — not wrapped in dairy ERP ``AdminLayout``.
 */
export default function PersonalFinanceShell() {
  return (
    <PfThemeProvider>
      <PersonalFinanceShellInner />
    </PfThemeProvider>
  )
}
