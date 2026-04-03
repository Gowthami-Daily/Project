import { Outlet } from 'react-router-dom'
import { motion } from 'framer-motion'
import { Suspense, useCallback, useEffect, useMemo, useState } from 'react'
import AppShell from '../../components/layout/AppShell.jsx'
import PersonalFinanceAuth from './PersonalFinanceAuth.jsx'
import { PfAuthProvider, usePfAuth } from './PfAuthContext.jsx'
import PfBottomNav from './PfBottomNav.jsx'
import PfOutletErrorBoundary from './PfOutletErrorBoundary.jsx'
import { PfPrivacyProvider, usePfPrivacy } from './PfPrivacyContext.jsx'
import PfSidebar from './PfSidebar.jsx'
import { readSidebarCollapsed, writeSidebarCollapsed } from './pfSidebarStorage.js'
import PfToolbar from './PfToolbar.jsx'
import PfGlobalAdd from './globalAdd/PfGlobalAdd.jsx'
import { PfUniversalAddProvider } from './globalAdd/PfUniversalAddContext.jsx'
import { PfToastProvider } from './notifications/pfToastContext.jsx'
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
  const { privacyBlur } = usePfPrivacy()
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
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const onKey = (e) => {
      if (e.key === 'Escape') setMobileNavOpen(false)
    }
    window.addEventListener('keydown', onKey)
    return () => {
      document.body.style.overflow = prev
      window.removeEventListener('keydown', onKey)
    }
  }, [mobileNavOpen])

  /* Single-scroll shell: prevent document scroll; only .pf-main-scroll scrolls */
  useEffect(() => {
    if (!user) return undefined
    const prevHtml = document.documentElement.style.overflow
    const prevBody = document.body.style.overflow
    document.documentElement.style.overflow = 'hidden'
    document.body.style.overflow = 'hidden'
    return () => {
      document.documentElement.style.overflow = prevHtml
      document.body.style.overflow = prevBody
    }
  }, [user])

  const sessionCtx = useMemo(
    () => ({ onSessionInvalid: invalidateSession, onLogout: logout, user }),
    [invalidateSession, logout, user],
  )

  if (!user) {
    return (
      <div
        className={`pf-app min-h-[100dvh] font-sans antialiased ${isDark ? 'dark' : ''} bg-slate-950 text-[var(--pf-text)]`}
      >
        <PersonalFinanceAuth />
      </div>
    )
  }

  return (
    <PfOutletErrorBoundary>
      <PfRefreshProvider>
        <PfToastProvider>
        <PfUniversalAddProvider onSessionInvalid={invalidateSession}>
        <div className={`pf-app antialiased ${isDark ? 'dark' : ''}`}>
          <AppShell
            className="pf-app-layout"
            topbar={
              <PfToolbar
                onSessionInvalid={invalidateSession}
                onLogout={logout}
                sidebarCollapsed={sidebarCollapsed}
                onToggleSidebarCollapsed={toggleSidebarCollapsed}
                onOpenMobileNav={() => setMobileNavOpen(true)}
              />
            }
            sidebar={
              <PfSidebar
                user={user}
                collapsed={sidebarCollapsed}
                mobileOpen={mobileNavOpen}
                onCloseMobile={() => setMobileNavOpen(false)}
                onLogout={logout}
              />
            }
            bottomBar={<PfBottomNav />}
          >
            <main
              className={`pf-main-scroll pf-page-enter min-h-0 flex-1 overflow-y-auto overscroll-contain scroll-smooth px-4 py-4 pb-[calc(5.5rem+env(safe-area-inset-bottom))] md:px-8 md:py-6 md:pb-6 ${privacyBlur ? 'pf-main-privacy' : ''}`}
            >
              <Suspense fallback={pfPageFallback}>
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.22, ease: [0.25, 0.1, 0.25, 1] }}
                >
                  <Outlet context={sessionCtx} />
                </motion.div>
              </Suspense>
            </main>
          </AppShell>
          <PfGlobalAdd />
        </div>
        </PfUniversalAddProvider>
        </PfToastProvider>
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
        <PfPrivacyProvider>
          <PersonalFinanceShellInner />
        </PfPrivacyProvider>
      </PfAuthProvider>
    </PfThemeProvider>
  )
}
