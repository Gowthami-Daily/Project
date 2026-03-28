import { PhoneIcon, TruckIcon } from '@heroicons/react/24/solid'
import { MapIcon } from '@heroicons/react/24/outline'

const shipments = [
  {
    id: '#127777489-DL-HYD',
    tags: ['Out for delivery', 'Milk'],
    active: true,
    steps: [
      { label: 'Left depot', sub: 'Gowthami plant', done: true },
      { label: 'Arrived hub', sub: 'Kukatpally DC', done: true },
      { label: 'Out for delivery', sub: 'Route North A', done: true },
      { label: 'Delivered', sub: '1567 Dove Street', done: false },
    ],
  },
  {
    id: '#127777490-DL-HYD',
    tags: ['In transit'],
    active: false,
    steps: [],
  },
  {
    id: '#127777491-DL-HYD',
    tags: ['Scheduled'],
    active: false,
    steps: [],
  },
]

const kpis = [
  { label: 'Payload', value: '101 kg' },
  { label: 'Volume', value: '123 L eq.' },
  { label: 'Distance', value: '51 km' },
  { label: 'ETA', value: '90 min' },
]

export default function LiveTrackingPage() {
  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-lg font-bold text-slate-900">Live delivery tracking</h3>
        <p className="text-sm text-slate-500">
          Driver location, route progress, delivered vs pending stops, delay alerts (demo layout).
        </p>
      </div>

      <div className="flex flex-col gap-4 lg:flex-row lg:items-stretch">
        <aside className="w-full shrink-0 space-y-2 lg:w-[320px]">
          {shipments.map((s) => (
            <button
              key={s.id}
              type="button"
              className={`w-full rounded-2xl border p-4 text-left shadow-sm transition ${
                s.active
                  ? 'border-amber-400 bg-amber-50/90 ring-2 ring-amber-300/60'
                  : 'border-slate-200 bg-white hover:border-slate-300'
              }`}
            >
              <p className="font-mono text-sm font-bold text-slate-900">{s.id}</p>
              <div className="mt-2 flex flex-wrap gap-1">
                {s.tags.map((t) => (
                  <span
                    key={t}
                    className="rounded-full bg-slate-900/90 px-2 py-0.5 text-[10px] font-bold uppercase text-white"
                  >
                    {t}
                  </span>
                ))}
              </div>
              {s.active && s.steps.length > 0 && (
                <ul className="mt-3 space-y-2 border-t border-amber-200/80 pt-3 text-xs">
                  {s.steps.map((st) => (
                    <li key={st.label} className="flex gap-2">
                      <span
                        className={`mt-1 h-2 w-2 shrink-0 rounded-full ${st.done ? 'bg-emerald-500' : 'bg-slate-300'}`}
                        aria-hidden
                      />
                      <div>
                        <p className="font-semibold text-slate-800">{st.label}</p>
                        <p className="text-slate-500">{st.sub}</p>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </button>
          ))}
        </aside>

        <div className="min-w-0 flex-1 space-y-4">
          <div className="grid gap-4 lg:grid-cols-2">
            <div className="rounded-2xl border border-slate-200 bg-gradient-to-br from-slate-50 to-sky-50 p-5 shadow-sm">
              <div className="flex items-center gap-3">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-900 text-white">
                  <TruckIcon className="h-7 w-7" aria-hidden />
                </div>
                <div>
                  <p className="text-xs font-bold uppercase tracking-wide text-slate-500">Vehicle</p>
                  <p className="text-lg font-bold text-slate-900">Refrigerated van</p>
                  <p className="font-mono text-sm text-slate-600">TS09 AB 1122</p>
                </div>
              </div>
              <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
                {kpis.map((k) => (
                  <div key={k.label} className="rounded-xl bg-white/90 p-3 ring-1 ring-slate-200">
                    <p className="text-[10px] font-bold uppercase text-slate-500">{k.label}</p>
                    <p className="mt-1 text-sm font-bold text-slate-900">{k.value}</p>
                  </div>
                ))}
              </div>
            </div>

            <div className="flex flex-col justify-between rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="flex items-start gap-3">
                <div className="h-14 w-14 shrink-0 overflow-hidden rounded-full bg-slate-200 ring-2 ring-sky-200" />
                <div className="min-w-0">
                  <p className="text-xs font-bold uppercase text-slate-500">Driver</p>
                  <p className="truncate text-lg font-bold text-slate-900">Matthew Perry</p>
                  <p className="text-sm text-slate-500">ID DRV-8841 · Route North A</p>
                </div>
              </div>
              <button
                type="button"
                className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-amber-400 py-3 text-sm font-bold text-slate-900 shadow-sm hover:bg-amber-300 lg:w-auto lg:px-8"
              >
                <PhoneIcon className="h-5 w-5" aria-hidden />
                Call driver
              </button>
            </div>
          </div>

          <div className="grid gap-4 lg:grid-cols-3">
            <div className="lg:col-span-2 flex min-h-[280px] flex-col rounded-2xl border border-slate-200 bg-slate-100 shadow-inner">
              <div className="flex items-center gap-2 border-b border-slate-200 bg-white px-4 py-2">
                <MapIcon className="h-5 w-5 text-[#004080]" aria-hidden />
                <span className="text-sm font-semibold text-slate-800">Live map</span>
                <span className="ml-auto text-xs font-medium text-amber-700">Delay risk: low</span>
              </div>
              <div className="flex flex-1 items-center justify-center text-sm text-slate-400">
                Map widget · route polyline, vehicle marker, stops
              </div>
            </div>
            <div className="rounded-2xl border border-slate-900 bg-slate-900 p-4 text-white shadow-lg">
              <p className="text-xs font-bold uppercase text-slate-400">Next stop</p>
              <p className="mt-2 text-lg font-bold leading-snug">Houston Lane, KPHB</p>
              <p className="mt-3 text-sm text-slate-300">Scheduled · 12:30 PM · 31 Jan</p>
              <div className="mt-4 rounded-xl bg-white/10 p-3 text-xs text-slate-200">
                <p className="font-semibold text-white">Progress</p>
                <p className="mt-1">Delivered: 32 · Pending: 16 · Skipped: 0</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
