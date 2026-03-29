import { Link, Outlet } from 'react-router-dom'
import { Suspense, useCallback, useEffect, useMemo, useState } from 'react'
import RiverLogo from '../RiverLogo.jsx'
import PersonalFinanceAuth from './PersonalFinanceAuth.jsx'
import { PfAuthProvider, usePfAuth } from './PfAuthContext.jsx'
import PfBottomNav from './PfBottomNav.jsx'
import PfOutletErrorBoundary from './PfOutletErrorBoundary.jsx'
import PfSidebar from './PfSidebar.jsx'
import { readSidebarCollapsed, writeSidebarCollapsed } from './pfSidebarStorage.js'
import PfToolbar from './PfToolbar.jsx'
import { PfRefreshProvider } from './pfRefreshContext.jsx'
import { PfThemeProvider, usePfTheme } from './PfThemeContext.jsx'
import './pfMobile.css'

const pfPageFallback = (
  <div className="flex min-h-[50vh] flex-col items-center justify-center gap-3 px-4">
    <div
      className="h-9 w-9 animate-spin rounded-full border-2 border-[var(--pf-border)] border-t-[var(--pf-primary)]"
      aria-hidden
    />
    <p className="text-sm font-medium text-[var(--pf-text-muted)]">Loading page…</p>
  </div>
)

function PersonalFinanceShellInner() {
  const { user, logout, invalidateSession } = usePfAuth()
  const { resolved } = usePfTheme()
  const isDark = resolved === 'dark'

  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => readSidebarCollapsed())
  const [mobileNavOpen, setMobileNavOpen] = useState(false)

  const toggleSidebarCollapsed = useCallback(() => {
    setSidebarCollapsed((c) => {
      const next = !c
      writeSidebarCollapsed(next)
      return next
    })
  }, [])

  useEffect(() => {
    if (!mobileNavOpen) return
    document.body.style.overflow = 'hidden'
    const onKey = (e) => {
      if (e.key === 'Escape') setMobileNavOpen(false)
    }
    window.addEventListener('keydown', onKey)
    return () => {
      document.body.style.overflow = ''
      window.removeEventListener('keydown', onKey)
    }
  }, [mobileNavOpen])

  const sessionCtx = useMemo(
    () => ({ onSessionInvalid: invalidateSession, onLogout: logout, user }),
    [invalidateSession, logout, user],
  )

  if (!user) {
    return (
    <div
      className={`pf-app min-h-screen font-sans antialiased ${isDark ? 'dark' : ''} bg-[var(--pf-bg)] text-[var(--pf-text)]`}
      >
        <header className="sticky top-0 z-10 border-b border-[var(--pf-border)] bg-[var(--pf-header)] backdrop-blur-md">
          <div className="mx-auto flex h-[60px] max-w-[1600px] items-center justify-between gap-4 px-4 sm:px-6">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[var(--pf-primary)] text-white shadow-inner">
                <RiverLogo className="h-6 w-6 text-white" />
              </div>
              <p className="text-sm font-bold text-[var(--pf-text)]">Personal finance</p>
            </div>
            <Link
              to="/"
              className="rounded-[12px] px-3 py-2 text-sm font-semibold text-[var(--pf-primary)] transition hover:bg-black/5 dark:hover:bg-white/5"
            >
              ← Home
            </Link>
          </div>
        </header>
        <main className="mx-auto max-w-[1600px] px-4 py-8 sm:px-6">
          <PersonalFinanceAuth />
        </main>
      </div>
    )
  }

  return (
    <PfOutletErrorBoundary>
      <PfRefreshProvider>
        <div className={`pf-app min-h-screen antialiased ${isDark ? 'dark' : ''}`}>
          <PfToolbar
            onSessionInvalid={invalidateSession}
            onLogout={logout}
            sidebarCollapsed={sidebarCollapsed}
            onToggleSidebarCollapsed={toggleSidebarCollapsed}
            onOpenMobileNav={() => setMobileNavOpen(true)}
          />
          <div className="mx-auto flex max-w-[1600px] flex-col md:flex-row md:items-stretch">
            <PfSidebar
              user={user}
              collapsed={sidebarCollapsed}
              mobileOpen={mobileNavOpen}
              onCloseMobile={() => setMobileNavOpen(false)}
              onLogout={logout}
            />
            <div className="flex min-h-[calc(100vh-92px)] min-w-0 flex-1 flex-col border-[var(--pf-border)]/80 md:border-l md:bg-[var(--pf-content)]">
              <main className="pf-page-enter min-w-0 flex-1 px-4 py-4 pb-[calc(5.5rem+env(safe-area-inset-bottom))] sm:px-6 md:py-6 md:pb-6">
                <Suspense fallback={pfPageFallback}>
                  <Outlet context={sessionCtx} />
                </Suspense>
              </main>
            </div>
          </div>
          <PfBottomNav />
        </div>
      </PfRefreshProvider>
    </PfOutletErrorBoundary>
  )
}

/**
 * Standalone app shell — not wrapped in dairy ERP ``AdminLayout``.
 */
export default function PersonalFinanceShell() {
  return (
    <PfThemeProvider>
      <PfAuthProvider>
        <PersonalFinanceShellInner />
      </PfAuthProvider>
    </PfThemeProvider>
  )
}
