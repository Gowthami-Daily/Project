import { Outlet } from 'react-router-dom'
import SettingsMenu from './SettingsMenu.jsx'

export default function SettingsLayout() {
  return (
    <div className="mx-auto max-w-[1400px] space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight text-slate-900">Settings</h2>
        <p className="mt-1 text-sm text-slate-500">
          Business profile, rate charts, pricing, geography, access control, and system defaults.
        </p>
      </div>

      <div className="flex min-h-[560px] flex-col gap-6 rounded-2xl border border-slate-200/90 bg-white p-4 shadow-sm sm:p-6 lg:flex-row lg:gap-8 lg:p-8">
        <SettingsMenu />
        <div className="min-w-0 flex-1 border-t border-slate-100 pt-6 lg:border-l lg:border-t-0 lg:pl-8 lg:pt-0">
          <Outlet />
        </div>
      </div>
    </div>
  )
}
