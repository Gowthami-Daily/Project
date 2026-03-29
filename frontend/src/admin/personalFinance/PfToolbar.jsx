import { BellIcon, ChevronDownIcon, UserCircleIcon } from '@heroicons/react/24/solid'
import { Link } from 'react-router-dom'
import { useCallback, useEffect, useRef, useState } from 'react'
import {
  getPfToken,
  listProfiles,
  readActiveProfileIdFromToken,
  setPfToken,
  switchProfile,
} from './api.js'
import { usePfRefresh } from './pfRefreshContext.jsx'

export default function PfToolbar({ onSessionInvalid, onLogout }) {
  const { tick, refresh } = usePfRefresh()
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
    <header className="sticky top-0 z-40 border-b border-slate-200/80 bg-white/95 backdrop-blur-md dark:border-slate-700 dark:bg-slate-900/95">
      <div className="mx-auto flex h-14 max-w-[1600px] items-center justify-between gap-2 px-4 sm:px-6">
        <h1 className="truncate text-base font-bold tracking-tight text-slate-900 sm:text-lg">Personal Finance</h1>
        <div className="flex shrink-0 items-center gap-1">
          <button
            type="button"
            className="flex h-10 w-10 items-center justify-center rounded-[10px] text-slate-500 transition hover:bg-slate-100 active:scale-95"
            aria-label="Notifications (coming soon)"
          >
            <BellIcon className="h-[22px] w-[22px]" />
          </button>
          <div className="relative hidden sm:block" ref={menuRef}>
            <button
              type="button"
              onClick={() => setMenuOpen((v) => !v)}
              className="flex h-10 items-center gap-1 rounded-[10px] px-2 text-slate-700 transition hover:bg-slate-100 active:scale-[0.97] dark:text-slate-200 dark:hover:bg-slate-800"
              aria-expanded={menuOpen}
              aria-haspopup="menu"
              aria-label="Account menu"
            >
              <UserCircleIcon className="h-7 w-7 text-[#1E3A8A]" />
              <ChevronDownIcon className="h-4 w-4 text-slate-500" />
            </button>
            {menuOpen ? (
              <div
                className="absolute right-0 z-50 mt-1 min-w-[11rem] rounded-[10px] border border-slate-200 bg-white py-1 shadow-[0_4px_12px_rgba(0,0,0,0.12)] dark:border-slate-600 dark:bg-slate-800 dark:shadow-[0_4px_12px_rgba(0,0,0,0.45)]"
                role="menu"
              >
                <Link
                  to="/personal-finance/more"
                  role="menuitem"
                  className="block px-4 py-2.5 text-sm font-semibold text-slate-800 hover:bg-slate-50 dark:text-slate-100 dark:hover:bg-slate-700/80"
                  onClick={() => setMenuOpen(false)}
                >
                  Profile
                </Link>
                <Link
                  to="/personal-finance/settings"
                  role="menuitem"
                  className="block px-4 py-2.5 text-sm font-semibold text-slate-800 hover:bg-slate-50 dark:text-slate-100 dark:hover:bg-slate-700/80"
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
            className="hidden rounded-[10px] px-2 py-2 text-xs font-semibold text-[#1E3A8A] hover:bg-slate-100 md:inline"
          >
            Home
          </Link>
        </div>
      </div>
      <div className="mx-auto max-w-[1600px] border-t border-slate-100/90 px-4 pb-2 pt-1.5 dark:border-slate-700/80 sm:px-6">
        <label htmlFor="pf-profile" className="sr-only">
          Active profile
        </label>
        <select
          id="pf-profile"
          className="w-full max-w-md rounded-[10px] border border-slate-200/90 bg-slate-50/80 px-3 py-1.5 text-xs font-semibold text-slate-800 shadow-sm outline-none ring-[#1E3A8A]/20 focus:bg-white focus:ring-2 disabled:opacity-60 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100 dark:focus:bg-slate-800"
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
