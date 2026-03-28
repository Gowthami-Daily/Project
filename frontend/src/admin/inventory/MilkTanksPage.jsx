import { SignalIcon } from '@heroicons/react/24/outline'
import { theadRow, tableScroll, tableWrap } from './inventoryTableStyles.js'

const statusTone = {
  Normal: 'bg-emerald-100 text-emerald-900 ring-emerald-200',
  Low: 'bg-amber-100 text-amber-900 ring-amber-200',
  Full: 'bg-sky-100 text-sky-900 ring-sky-200',
  Cleaning: 'bg-violet-100 text-violet-900 ring-violet-200',
  Maintenance: 'bg-slate-200 text-slate-800 ring-slate-300',
}

const tanks = [
  { name: 'T1 — Raw intake', cap: 15000, current: 11200, type: 'Mixed', temp: 3.8, status: 'Normal', pct: 75 },
  { name: 'T2 — Raw intake', cap: 15000, current: 4200, type: 'Cow', temp: 4.1, status: 'Low', pct: 28 },
  { name: 'T3 — Silo A', cap: 25000, current: 24800, type: 'Buffalo', temp: 3.6, status: 'Full', pct: 99 },
  { name: 'T4 — Silo B', cap: 20000, current: 0, type: '—', temp: '—', status: 'Cleaning', pct: 0 },
  { name: 'T5 — Balance tank', cap: 8000, current: 6100, type: 'Mixed', temp: 5.8, status: 'Normal', pct: 76 },
]

const alerts = [
  { type: 'Temperature high', detail: 'T5 · 5.8 °C · threshold 4.5 °C' },
  { type: 'Tank low', detail: 'T2 · below 30% · schedule collection' },
  { type: 'Cleaning due', detail: 'T4 · CIP window · QC sign-off pending' },
]

export default function MilkTanksPage() {
  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-bold text-slate-900">Milk tanks (raw storage)</h3>
        <p className="text-sm text-slate-500">Capacity, live level, type, temperature — ties to inflow collection.</p>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        {tanks.slice(0, 3).map((t) => (
          <div
            key={t.name}
            className="rounded-2xl border border-slate-200 bg-gradient-to-b from-white to-slate-50 p-4 shadow-sm"
          >
            <div className="flex items-center justify-between gap-2">
              <p className="text-sm font-bold text-slate-900">{t.name}</p>
              <span
                className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ring-1 ${statusTone[t.status]}`}
              >
                {t.status}
              </span>
            </div>
            <div className="mt-4 flex items-end gap-3">
              <div className="relative h-36 w-14 overflow-hidden rounded-full bg-slate-200 ring-2 ring-slate-300">
                <div
                  className={`absolute bottom-0 left-0 right-0 rounded-b-full transition-all ${
                    t.status === 'Full' ? 'bg-sky-500' : t.status === 'Low' ? 'bg-amber-400' : 'bg-[#004080]'
                  }`}
                  style={{ height: `${Math.min(100, t.pct)}%` }}
                />
              </div>
              <div className="flex-1 space-y-1 text-xs text-slate-600">
                <p>
                  <span className="font-semibold text-slate-800">{t.current.toLocaleString()} L</span> /{' '}
                  {t.cap.toLocaleString()} L
                </p>
                <p className="text-slate-600">
                  <span className="font-medium text-slate-700">Temp</span> {t.temp} °C · {t.type}
                </p>
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="rounded-2xl border border-amber-200 bg-amber-50/80 p-4 shadow-sm">
        <div className="flex items-center gap-2 text-sm font-bold text-amber-950">
          <SignalIcon className="h-5 w-5" aria-hidden />
          Tank alerts
        </div>
        <ul className="mt-3 space-y-2 text-sm text-amber-950/90">
          {alerts.map((a) => (
            <li key={a.type}>
              <span className="font-semibold">{a.type}:</span> {a.detail}
            </li>
          ))}
        </ul>
      </div>

      <div className={tableWrap}>
        <div className={tableScroll}>
          <table className="min-w-full text-left text-sm">
            <thead className={theadRow}>
              <tr>
                <th className="px-4 py-3">Tank</th>
                <th className="px-4 py-3 text-right">Capacity (L)</th>
                <th className="px-4 py-3 text-right">Current (L)</th>
                <th className="px-4 py-3">Milk type</th>
                <th className="px-4 py-3">Temp (°C)</th>
                <th className="px-4 py-3">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {tanks.map((t) => (
                <tr key={t.name} className="bg-white hover:bg-slate-50/80">
                  <td className="px-4 py-3 font-semibold text-slate-900">{t.name}</td>
                  <td className="px-4 py-3 text-right tabular-nums text-slate-700">{t.cap.toLocaleString()}</td>
                  <td className="px-4 py-3 text-right tabular-nums font-medium text-slate-900">
                    {typeof t.current === 'number' ? t.current.toLocaleString() : t.current}
                  </td>
                  <td className="px-4 py-3 text-slate-700">{t.type}</td>
                  <td className="px-4 py-3 tabular-nums text-slate-700">{t.temp}</td>
                  <td className="px-4 py-3">
                    <span
                      className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ${statusTone[t.status]}`}
                    >
                      {t.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
