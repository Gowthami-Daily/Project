import {
  Bars3Icon,
  ChevronDoubleLeftIcon,
  ChevronDoubleRightIcon,
  EyeIcon,
  EyeSlashIcon,
  UserCircleIcon,
} from '@heroicons/react/24/solid'
import { Link } from 'react-router-dom'
import { useCallback, useEffect, useRef, useState } from 'react'
import {
  getPfToken,
  listProfiles,
  readActiveProfileIdFromToken,
  setPfToken,
  switchProfile,
} from './api.js'
import PrivacyToggle from '../../components/ui/PrivacyToggle.jsx'
import PfNotificationBell from './notifications/PfNotificationBell.jsx'
import { usePfPrivacy } from './PfPrivacyContext.jsx'
import { usePfRefresh } from './pfRefreshContext.jsx'

export default function PfToolbar({
  onSessionInvalid,
  onLogout,
  sidebarCollapsed = false,
  onToggleSidebarCollapsed,
  onOpenMobileNav,
}) {
  const { tick, refresh } = usePfRefresh()
  const { privacyBlur, setPrivacyBlur } = usePfPrivacy()
  const [profiles, setProfiles] = useState([])
  const [loading, setLoading] = useState(false)
  const [activeProfileId, setActiveProfileId] = useState(() => readActiveProfileIdFromToken())
  const [menuOpen, setMenuOpen] = useState(false)
  const menuRef = useRef(null)

  const loadProfiles = useCallback(async () => {
    if (!getPfToken()) return
    setLoading(true)
    try {
      const profs = await listProfiles()
      setProfiles(Array.isArray(profs) ? profs : [])
      const fromJwt = readActiveProfileIdFromToken()
      const ids = new Set((profs ?? []).map((p) => p.profile_id))
      const pick = fromJwt != null && ids.has(fromJwt) ? fromJwt : profs?.[0]?.profile_id ?? null
      setActiveProfileId(pick)
    } catch (e) {
      if (e.status === 401) {
        setPfToken(null)
        onSessionInvalid?.()
      }
    } finally {
      setLoading(false)
    }
  }, [onSessionInvalid])

  useEffect(() => {
    loadProfiles()
  }, [loadProfiles, tick])

  useEffect(() => {
    if (!menuOpen) return
    function onDocClick(ev) {
      if (menuRef.current && !menuRef.current.contains(ev.target)) setMenuOpen(false)
    }
    document.addEventListener('mousedown', onDocClick)
    return () => document.removeEventListener('mousedown', onDocClick)
  }, [menuOpen])

  async function handleProfileChange(profileId) {
    const id = Number(profileId)
    if (!id || Number.isNaN(id)) return
    try {
      const data = await switchProfile(id)
      setPfToken(data.access_token)
      setActiveProfileId(id)
      setMenuOpen(false)
      refresh()
    } catch (e) {
      if (e.status === 401) {
        setPfToken(null)
        onSessionInvalid?.()
      }
    }
  }

  return (
    <header className="z-40 shrink-0 border-b border-[var(--pf-border)] bg-[var(--pf-header)] backdrop-blur-md">
      <div className="mx-auto flex h-14 min-h-14 w-full max-w-full items-center justify-between gap-2 px-3 sm:px-4 lg:px-6">
        <div className="flex min-w-0 flex-1 items-center gap-2 sm:gap-3">
          <button
            type="button"
            onClick={() => onOpenMobileNav?.()}
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[10px] text-[var(--pf-text-muted)] transition hover:bg-black/[0.06] active:scale-95 dark:hover:bg-white/[0.06] lg:hidden"
            aria-label="Open menu"
          >
            <Bars3Icon className="h-6 w-6" />
          </button>
          <button
            type="button"
            onClick={() => onToggleSidebarCollapsed?.()}
            className="hidden h-11 w-11 shrink-0 items-center justify-center rounded-[10px] text-[var(--pf-text-muted)] transition hover:bg-black/[0.06] active:scale-95 dark:hover:bg-white/[0.06] lg:flex"
            aria-expanded={!sidebarCollapsed}
            aria-label={sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          >
            {sidebarCollapsed ? (
              <ChevronDoubleRightIcon className="h-5 w-5" />
            ) : (
              <ChevronDoubleLeftIcon className="h-5 w-5" />
            )}
          </button>
          <h1 className="min-w-0 truncate font-bold tracking-tight text-[var(--pf-text)] [font-size:clamp(1rem,2.8vw,1.25rem)]">
            Personal Finance
          </h1>
        </div>
        <div className="flex shrink-0 items-center gap-0.5 sm:gap-1">
          <div className="hidden lg:block">
            <PrivacyToggle active={privacyBlur} onToggle={setPrivacyBlur} />
          </div>
          <PfNotificationBell onSessionInvalid={onSessionInvalid} />
          <div className="relative" ref={menuRef}>
            <button
              type="button"
              onClick={() => setMenuOpen((v) => !v)}
              className="flex h-11 min-h-[44px] min-w-[44px] items-center justify-center rounded-[10px] text-[var(--pf-text)] transition hover:bg-black/[0.06] active:scale-[0.97] dark:hover:bg-white/[0.06]"
              aria-expanded={menuOpen}
              aria-haspopup="menu"
              aria-label="Profile and workspace menu"
            >
              <UserCircleIcon className="h-7 w-7 shrink-0 text-[var(--pf-primary)]" />
            </button>
            {menuOpen ? (
              <div
                className="absolute right-0 z-50 mt-1 w-[min(100vw-1.5rem,20rem)] min-w-0 overflow-hidden rounded-xl border border-[var(--pf-border)] bg-[var(--pf-card)] shadow-[var(--pf-shadow)]"
                role="menu"
              >
                <Link
                  to="/personal-finance/more"
                  role="menuitem"
                  className="block min-h-11 px-4 py-3 text-sm font-semibold leading-snug text-[var(--pf-text)] hover:bg-[var(--pf-card-hover)] sm:py-2.5"
                  onClick={() => setMenuOpen(false)}
                >
                  Profile
                </Link>
                <div className="border-t border-[var(--pf-border)]/80 px-3 py-2" role="group" aria-label="Switch workspace">
                  <p className="px-1 pb-2 text-[10px] font-bold uppercase tracking-wide text-[var(--pf-text-muted)]">
                    Switch workspace
                  </p>
                  <div className="max-h-48 overflow-y-auto overscroll-contain [scrollbar-width:thin]">
                    {loading ? (
                      <p className="px-1 py-2 text-xs text-[var(--pf-text-muted)]">Loading workspaces…</p>
                    ) : profiles.length === 0 ? (
                      <p className="px-1 py-2 text-xs text-[var(--pf-text-muted)]">No workspaces</p>
                    ) : (
                      profiles.map((p) => {
                        const isOn = p.profile_id === activeProfileId
                        return (
                          <button
                            key={p.profile_id}
                            type="button"
                            role="menuitem"
                            disabled={loading}
                            onClick={() => handleProfileChange(p.profile_id)}
                            className={`mb-0.5 flex w-full rounded-lg px-3 py-2.5 text-left text-sm font-semibold transition ${
                              isOn
                                ? 'bg-[var(--pf-primary)]/15 text-[var(--pf-text)] ring-1 ring-[var(--pf-primary)]/30'
                                : 'text-[var(--pf-text)] hover:bg-[var(--pf-card-hover)]'
                            }`}
                          >
                            <span className="min-w-0 flex-1 truncate">
                              {p.profile_name}
                              <span className="mt-0.5 block text-[11px] font-medium text-[var(--pf-text-muted)]">
                                {p.profile_type}
                              </span>
                            </span>
                            {isOn ? (
                              <span className="ml-2 shrink-0 text-xs font-bold text-[var(--pf-primary)]">✓</span>
                            ) : null}
                          </button>
                        )
                      })
                    )}
                  </div>
                </div>
                <div className="border-t border-[var(--pf-border)]/80 lg:hidden">
                  <button
                    type="button"
                    role="menuitem"
                    className="flex min-h-11 w-full items-center gap-3 px-4 py-3 text-left text-sm font-semibold text-[var(--pf-text)] hover:bg-[var(--pf-card-hover)] sm:py-2.5"
                    onClick={() => setPrivacyBlur(!privacyBlur)}
                  >
                    {privacyBlur ? (
                      <EyeSlashIcon className="h-5 w-5 shrink-0 text-[var(--pf-text-muted)]" aria-hidden />
                    ) : (
                      <EyeIcon className="h-5 w-5 shrink-0 text-[var(--pf-text-muted)]" aria-hidden />
                    )}
                    {privacyBlur ? 'Show amounts' : 'Blur amounts (privacy)'}
                  </button>
                </div>
                <div className="border-t border-[var(--pf-border)]/80">
                  <Link
                    to="/personal-finance/settings"
                    role="menuitem"
                    className="block min-h-11 px-4 py-3 text-sm font-semibold leading-snug text-[var(--pf-text)] hover:bg-[var(--pf-card-hover)] sm:py-2.5"
                    onClick={() => setMenuOpen(false)}
                  >
                    Settings
                  </Link>
                  <button
                    type="button"
                    role="menuitem"
                    className="min-h-11 w-full px-4 py-3 text-left text-sm font-semibold leading-snug text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-950/40 sm:py-2.5"
                    onClick={() => {
                      setMenuOpen(false)
                      onLogout?.()
                    }}
                  >
                    Logout
                  </button>
                </div>
              </div>
            ) : null}
          </div>
          <Link
            to="/personal-finance"
            className="hidden rounded-[10px] px-2 py-2 text-xs font-semibold text-[var(--pf-primary)] hover:bg-black/[0.06] dark:hover:bg-white/[0.06] lg:inline"
          >
            Home
          </Link>
        </div>
      </div>
    </header>
  )
}
