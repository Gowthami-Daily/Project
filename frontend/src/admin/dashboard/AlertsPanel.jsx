import {
  BanknotesIcon,
  ClockIcon,
  ExclamationTriangleIcon,
  FireIcon,
} from '@heroicons/react/24/solid'

const ALERTS = [
  {
    id: 1,
    icon: FireIcon,
    tone: 'border-amber-200 bg-amber-50/90 text-amber-950',
    iconWrap: 'bg-amber-100 text-amber-700',
    title: 'Tank temperature high',
    body: 'Chilling Tank B at Center North — 5.2°C (target ≤ 4°C). Check compressor.',
    time: '6 min ago',
  },
  {
    id: 2,
    icon: ClockIcon,
    tone: 'border-rose-200 bg-rose-50/80 text-rose-950',
    iconWrap: 'bg-rose-100 text-rose-700',
    title: 'Route delayed',
    body: 'R-03 running 22 min behind SLA · 12 stops remaining.',
    time: '18 min ago',
  },
  {
    id: 3,
    icon: BanknotesIcon,
    tone: 'border-sky-200 bg-sky-50/90 text-sky-950',
    iconWrap: 'bg-sky-100 text-sky-800',
    title: 'Low wallet balances',
    body: '23 customers under ₹100 — auto SMS queued for morning batch.',
    time: '32 min ago',
  },
  {
    id: 4,
    icon: ExclamationTriangleIcon,
    tone: 'border-violet-200 bg-violet-50/80 text-violet-950',
    iconWrap: 'bg-violet-100 text-violet-800',
    title: 'Farmer payment pending',
    body: '₹1,84,500 scheduled payouts — 4 farmers missing bank verification.',
    time: '1 hr ago',
  },
]

export default function AlertsPanel() {
  return (
    <aside className="flex h-full min-h-[320px] flex-col rounded-2xl border border-slate-200/90 bg-white p-4 shadow-sm lg:sticky lg:top-24">
      <div className="mb-4 flex items-center justify-between border-b border-slate-100 pb-3">
        <h3 className="text-base font-bold text-slate-900">Alerts</h3>
        <span className="rounded-full bg-red-500 px-2 py-0.5 text-xs font-bold text-white">{ALERTS.length}</span>
      </div>
      <ul className="flex flex-1 flex-col gap-3 overflow-y-auto">
        {ALERTS.map((a) => {
          const Icon = a.icon
          return (
            <li
              key={a.id}
              className={`rounded-xl border p-3 shadow-sm transition hover:shadow-md ${a.tone}`}
            >
              <div className="flex gap-3">
                <div
                  className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${a.iconWrap}`}
                >
                  <Icon className="h-5 w-5" aria-hidden />
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-bold leading-snug">{a.title}</p>
                  <p className="mt-1 text-xs leading-relaxed opacity-90">{a.body}</p>
                  <p className="mt-2 text-[11px] font-medium opacity-70">{a.time}</p>
                </div>
              </div>
            </li>
          )
        })}
      </ul>
      <button
        type="button"
        className="mt-4 w-full rounded-xl border border-slate-200 bg-slate-50 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-100"
      >
        View all alerts
      </button>
    </aside>
  )
}
