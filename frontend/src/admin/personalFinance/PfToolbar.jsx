import { ArrowPathIcon } from '@heroicons/react/24/solid'
import { useCallback, useEffect, useState } from 'react'
import {
  getPfToken,
  listProfiles,
  readActiveProfileIdFromToken,
  setPfToken,
  switchProfile,
} from './api.js'
import { usePfRefresh } from './pfRefreshContext.jsx'

export default function PfToolbar({ onLogout, onSessionInvalid }) {
  const { tick, refresh } = usePfRefresh()
  const [profiles, setProfiles] = useState([])
  const [loading, setLoading] = useState(false)
  const [activeProfileId, setActiveProfileId] = useState(() => readActiveProfileIdFromToken())

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

  return (
    <div className="flex flex-wrap items-center justify-end gap-2 border-b border-slate-200/90 bg-white/80 px-4 py-3 sm:px-6">
      <label htmlFor="pf-profile" className="sr-only">
        Active profile
      </label>
      <select
        id="pf-profile"
        className="min-w-[12rem] rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-800 shadow-sm outline-none ring-sky-500/20 focus:ring-2"
        value={activeProfileId ?? ''}
        onChange={(e) => handleProfileChange(e.target.value)}
      >
        {profiles.map((p) => (
          <option key={p.profile_id} value={p.profile_id}>
            {p.profile_name} ({p.profile_type})
          </option>
        ))}
      </select>
      <button
        type="button"
        onClick={() => refresh()}
        disabled={loading}
        className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 shadow-sm hover:bg-slate-50 disabled:opacity-50"
      >
        <ArrowPathIcon className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
        Refresh
      </button>
      <button
        type="button"
        onClick={onLogout}
        className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-50"
      >
        Sign out
      </button>
    </div>
  )
}
