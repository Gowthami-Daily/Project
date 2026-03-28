import {
  Bars3Icon,
  BellIcon,
  MagnifyingGlassIcon,
  Squares2X2Icon,
} from '@heroicons/react/24/outline'
import { ADMIN_DISPLAY_NAME } from '../config.js'

export default function Header({ onMenuClick }) {
  const today = new Date().toISOString().slice(0, 10)
  const alertCount = 7

  return (
    <header className="sticky top-0 z-30 border-b border-slate-200/80 bg-white shadow-sm shadow-slate-200/40">
      <div className="flex flex-wrap items-center gap-3 px-4 py-3 sm:gap-4 sm:px-6 sm:py-3.5 lg:flex-nowrap">
        <button
          type="button"
          onClick={onMenuClick}
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 lg:hidden"
          aria-label="Open menu"
        >
          <Bars3Icon className="h-5 w-5" />
        </button>

        <div className="hidden min-w-0 sm:block lg:max-w-[200px]">
          <p className="text-xs font-medium text-slate-500">Welcome back</p>
          <p className="truncate text-lg font-bold tracking-tight text-slate-900">{ADMIN_DISPLAY_NAME}</p>
        </div>

        <div className="order-last flex w-full flex-1 lg:order-none lg:max-w-xl lg:px-2">
          <label className="relative block w-full">
            <span className="sr-only">Search</span>
            <MagnifyingGlassIcon className="pointer-events-none absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" />
            <input
              type="search"
              placeholder="Search farmers, routes, customers…"
              className="w-full rounded-xl border border-slate-200 bg-slate-50 py-2.5 pl-10 pr-4 text-sm text-slate-800 placeholder:text-slate-400 focus:border-[#004080] focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#004080]/20"
            />
          </label>
        </div>

        <div className="ml-auto flex shrink-0 items-center gap-2 sm:gap-3">
          <button
            type="button"
            className="hidden h-10 w-10 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 sm:flex"
            aria-label="Apps"
          >
            <Squares2X2Icon className="h-5 w-5" />
          </button>

          <label className="sr-only" htmlFor="dashboard-date">
            Business date
          </label>
          <input
            id="dashboard-date"
            type="date"
            defaultValue={today}
            className="rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-700 focus:border-[#004080] focus:outline-none focus:ring-2 focus:ring-[#004080]/20"
          />

          <button
            type="button"
            className="relative flex h-10 w-10 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
            aria-label={`Notifications, ${alertCount} unread`}
          >
            <BellIcon className="h-5 w-5" />
            <span className="absolute right-1 top-1 flex h-4 min-w-[1rem] items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white ring-2 ring-white">
              {alertCount}
            </span>
          </button>

          <div className="hidden items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 py-1 pl-1 pr-3 sm:flex">
            <div
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-sky-400 to-[#004080] text-xs font-bold text-white"
              aria-hidden
            >
              {ADMIN_DISPLAY_NAME.slice(0, 1).toUpperCase()}
            </div>
            <div className="min-w-0">
              <p className="truncate text-xs font-semibold text-slate-900">{ADMIN_DISPLAY_NAME}</p>
              <p className="truncate text-[11px] text-slate-500">admin@gowthamidaily.example</p>
            </div>
          </div>
        </div>
      </div>
    </header>
  )
}
