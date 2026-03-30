import {
  ArrowRightOnRectangleIcon,
  BuildingLibraryIcon,
  ChartBarIcon,
  ChartPieIcon,
  ChevronRightIcon,
  Cog6ToothIcon,
  DocumentArrowDownIcon,
  ReceiptPercentIcon,
  TableCellsIcon,
  UserCircleIcon,
  WalletIcon,
} from '@heroicons/react/24/solid'
import { useCallback, useEffect, useState } from 'react'
import { Link, useOutletContext } from 'react-router-dom'
import {
  getPfToken,
  listProfiles,
  readActiveProfileIdFromToken,
  setPfToken,
  switchProfile,
} from './api.js'
import { usePfRefresh } from './pfRefreshContext.jsx'

const rowCls =
  'flex w-full items-center gap-3 rounded-2xl border border-slate-200/70 bg-white p-4 text-left shadow-sm transition hover:border-slate-300 hover:shadow-md active:scale-[0.99] dark:border-slate-600 dark:bg-slate-800/90 dark:hover:border-slate-500 dark:shadow-[0_1px_3px_rgba(0,0,0,0.35)]'

export default function PfMorePage() {
  const { onSessionInvalid, onLogout } = useOutletContext() || {}
  const { tick, refresh } = usePfRefresh()
  const [profiles, setProfiles] = useState([])
  const [activeProfileId, setActiveProfileId] = useState(() => readActiveProfileIdFromToken())
  const [loading, setLoading] = useState(false)

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

  const activeProfile = profiles.find((p) => p.profile_id === activeProfileId)

  return (
    <div className="pf-page-enter mx-auto max-w-lg space-y-4 pb-4">
      <h1 className="text-xl font-bold text-slate-900 dark:text-slate-100">More</h1>

      <section
        className="rounded-2xl border border-slate-200/70 bg-white p-4 shadow-sm dark:border-slate-600 dark:bg-slate-800/90"
        aria-label="Profile"
      >
        <div className="flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-100 text-[#1E3A8A] dark:bg-slate-700/80 dark:text-blue-400">
            <UserCircleIcon className="h-8 w-8" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Profile</p>
            <p className="truncate font-semibold text-slate-900">{activeProfile?.profile_name ?? '—'}</p>
            <p className="truncate text-xs text-slate-500">{activeProfile?.profile_type ?? ''}</p>
          </div>
        </div>
        <label htmlFor="pf-more-profile" className="mt-3 block text-xs font-semibold text-slate-600 dark:text-slate-400">
          Switch profile
        </label>
        <select
          id="pf-more-profile"
          className="mt-1 w-full rounded-[12px] border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-medium text-slate-800 outline-none focus:ring-2 focus:ring-[#1E3A8A]/30 dark:border-slate-600 dark:bg-slate-900/60 dark:text-slate-100"
          value={activeProfileId ?? ''}
          onChange={(e) => handleProfileChange(e.target.value)}
          disabled={loading || profiles.length === 0}
        >
          {profiles.map((p) => (
            <option key={p.profile_id} value={p.profile_id}>
              {p.profile_name} ({p.profile_type})
            </option>
          ))}
        </select>
      </section>

      <nav className="flex flex-col gap-3" aria-label="More links">
        <Link to="/personal-finance/accounts" className={rowCls}>
          <WalletIcon className="h-[22px] w-[22px] shrink-0 text-[#1E3A8A]" />
          <span className="flex-1 font-semibold text-slate-900 dark:text-slate-100">Accounts</span>
          <ChevronRightIcon className="h-5 w-5 shrink-0 text-slate-400 dark:text-slate-500" />
        </Link>
        <Link to="/personal-finance/reports" className={rowCls}>
          <ChartBarIcon className="h-[22px] w-[22px] shrink-0 text-[#1E3A8A]" />
          <span className="flex-1 font-semibold text-slate-900 dark:text-slate-100">Categories &amp; reports</span>
        </Link>
        <Link to="/personal-finance/monthly-statements" className={rowCls}>
          <TableCellsIcon className="h-[22px] w-[22px] shrink-0 text-[#1E3A8A]" />
          <span className="flex-1 font-semibold text-slate-900 dark:text-slate-100">Financial statement</span>
        </Link>
        <Link to="/personal-finance/reports" className={rowCls}>
          <DocumentArrowDownIcon className="h-[22px] w-[22px] shrink-0 text-[#1E3A8A]" />
          <span className="flex-1 font-semibold text-slate-900 dark:text-slate-100">Export data</span>
        </Link>
        <Link to="/personal-finance/investments" className={rowCls}>
          <ChartPieIcon className="h-[22px] w-[22px] shrink-0 text-[#1E3A8A]" />
          <span className="flex-1 font-semibold text-slate-900 dark:text-slate-100">Investments</span>
        </Link>
        <Link to="/personal-finance/assets" className={rowCls}>
          <BuildingLibraryIcon className="h-[22px] w-[22px] shrink-0 text-[#1E3A8A]" />
          <span className="flex-1 font-semibold text-slate-900 dark:text-slate-100">Fixed assets</span>
        </Link>
        <Link to="/personal-finance/liabilities" className={rowCls}>
          <ReceiptPercentIcon className="h-[22px] w-[22px] shrink-0 text-[#1E3A8A]" />
          <span className="flex-1 font-semibold text-slate-900 dark:text-slate-100">Loans &amp; liabilities</span>
        </Link>
        <Link to="/personal-finance/settings" className={rowCls}>
          <Cog6ToothIcon className="h-[22px] w-[22px] shrink-0 text-[#1E3A8A] dark:text-blue-400" />
          <span className="flex-1 font-semibold text-slate-900 dark:text-slate-100">Settings</span>
          <ChevronRightIcon className="h-5 w-5 shrink-0 text-slate-400 dark:text-slate-500" />
        </Link>
      </nav>

      <button
        type="button"
        onClick={onLogout}
        className="flex w-full items-center justify-center gap-2 rounded-[16px] border border-red-200 bg-red-50 py-3.5 text-sm font-bold text-red-700 transition hover:bg-red-100 active:scale-[0.99] dark:border-red-900/50 dark:bg-red-950/40 dark:text-red-300 dark:hover:bg-red-950/60"
      >
        <ArrowRightOnRectangleIcon className="h-5 w-5" />
        Logout
      </button>

      <Link
        to="/"
        className="block text-center text-sm font-semibold text-[#1E3A8A] underline-offset-2 hover:underline dark:text-blue-400"
      >
        ← River Dairy home
      </Link>
    </div>
  )
}
