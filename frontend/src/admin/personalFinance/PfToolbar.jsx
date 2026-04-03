import {
  Bars3Icon,
  BellIcon,
  ChevronDoubleLeftIcon,
  ChevronDoubleRightIcon,
  ChevronDownIcon,
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
      refresh()
    } catch (e) {
      if (e.status === 401) {
        setPfToken(null)
        onSessionInvalid?.()
      }
    }
  }

  const activeLabel =
    profiles.find((p) => p.profile_id === activeProfileId)?.profile_name ??
    (loading ? 'Loading…' : 'Profile')

  return (
    <header className="z-40 shrink-0 border-b border-[var(--pf-border)] bg-[var(--pf-header)] backdrop-blur-md">
      <div className="mx-auto flex h-14 max-w-[1400px] items-center justify-between gap-2 px-4 sm:px-8">
        <div className="flex min-w-0 flex-1 items-center gap-2 sm:gap-3">
          <button
            type="button"
            onClick={() => onOpenMobileNav?.()}
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[10px] text-[var(--pf-text-muted)] transition hover:bg-black/[0.06] active:scale-95 dark:hover:bg-white/[0.06] md:hidden"
            aria-label="Open menu"
          >
            <Bars3Icon className="h-6 w-6" />
          </button>
          <button
            type="button"
            onClick={() => onToggleSidebarCollapsed?.()}
            className="hidden h-10 w-10 shrink-0 items-center justify-center rounded-[10px] text-[var(--pf-text-muted)] transition hover:bg-black/[0.06] active:scale-95 dark:hover:bg-white/[0.06] md:flex"
            aria-expanded={!sidebarCollapsed}
            aria-label={sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          >
            {sidebarCollapsed ? (
              <ChevronDoubleRightIcon className="h-5 w-5" />
            ) : (
              <ChevronDoubleLeftIcon className="h-5 w-5" />
            )}
          </button>
          <h1 className="min-w-0 truncate text-base font-bold tracking-tight text-[var(--pf-text)] sm:text-lg">
            Personal Finance
          </h1>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          <PrivacyToggle active={privacyBlur} onToggle={setPrivacyBlur} />
          <button
            type="button"
            className="flex h-10 w-10 items-center justify-center rounded-[10px] text-[var(--pf-text-muted)] transition hover:bg-black/[0.06] active:scale-95 dark:hover:bg-white/[0.06]"
            aria-label="Notifications (coming soon)"
          >
            <BellIcon className="h-[22px] w-[22px]" />
          </button>
          <div className="relative hidden sm:block" ref={menuRef}>
            <button
              type="button"
              onClick={() => setMenuOpen((v) => !v)}
              className="flex h-10 items-center gap-1 rounded-[10px] px-2 text-[var(--pf-text)] transition hover:bg-black/[0.06] active:scale-[0.97] dark:hover:bg-white/[0.06]"
              aria-expanded={menuOpen}
              aria-haspopup="menu"
              aria-label="Account menu"
            >
              <UserCircleIcon className="h-7 w-7 text-[var(--pf-primary)]" />
              <ChevronDownIcon className="h-4 w-4 text-[var(--pf-text-muted)]" />
            </button>
            {menuOpen ? (
              <div
                className="absolute right-0 z-50 mt-1 min-w-[11rem] rounded-[10px] border border-[var(--pf-border)] bg-[var(--pf-card)] py-1 shadow-[var(--pf-shadow)]"
                role="menu"
              >
                <Link
                  to="/personal-finance/more"
                  role="menuitem"
                  className="block px-4 py-2.5 text-sm font-semibold text-[var(--pf-text)] hover:bg-[var(--pf-card-hover)]"
                  onClick={() => setMenuOpen(false)}
                >
                  Profile
                </Link>
                <Link
                  to="/personal-finance/settings"
                  role="menuitem"
                  className="block px-4 py-2.5 text-sm font-semibold text-[var(--pf-text)] hover:bg-[var(--pf-card-hover)]"
                  onClick={() => setMenuOpen(false)}
                >
                  Settings
                </Link>
                <button
                  type="button"
                  role="menuitem"
                  className="w-full px-4 py-2.5 text-left text-sm font-semibold text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-950/40"
                  onClick={() => {
                    setMenuOpen(false)
                    onLogout?.()
                  }}
                >
                  Logout
                </button>
              </div>
            ) : null}
          </div>
          <Link
            to="/"
            className="hidden rounded-[10px] px-2 py-2 text-xs font-semibold text-[var(--pf-primary)] hover:bg-black/[0.06] dark:hover:bg-white/[0.06] md:inline"
          >
            Home
          </Link>
        </div>
      </div>
      <div className="mx-auto max-w-[1400px] border-t border-[var(--pf-border)]/80 px-4 pb-2 pt-1.5 sm:px-8">
        <label htmlFor="pf-profile" className="sr-only">
          Active profile
        </label>
        <select
          id="pf-profile"
          className="w-full max-w-md rounded-[10px] border border-[var(--pf-border)] bg-[var(--pf-input-bg)] px-3 py-1.5 text-xs font-semibold text-[var(--pf-text)] shadow-sm outline-none ring-[var(--pf-primary)]/25 focus:ring-2 disabled:opacity-60"
          value={activeProfileId ?? ''}
          onChange={(e) => handleProfileChange(e.target.value)}
          disabled={loading || profiles.length === 0}
          aria-label={`Active profile: ${activeLabel}`}
        >
          {profiles.length === 0 ? (
            <option value="">No profiles</option>
          ) : (
            profiles.map((p) => (
              <option key={p.profile_id} value={p.profile_id}>
                {p.profile_name} ({p.profile_type})
              </option>
            ))
          )}
        </select>
      </div>
    </header>
  )
}
