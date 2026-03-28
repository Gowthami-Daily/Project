import { SunIcon } from '@heroicons/react/24/solid'
import { theadRow, tableScroll, tableWrap } from './dispatchTableStyles.js'

const rows = [
  { route: 'North A', product: 'Toned 1L', planned: 612, loaded: 598, diff: -14 },
  { route: 'North A', product: 'Full cream 500ml', planned: 240, loaded: 240, diff: 0 },
  { route: 'East B', product: 'Toned 1L', planned: 420, loaded: 430, diff: 10 },
  { route: 'West C', product: 'Toned 1L', planned: 705, loaded: 690, diff: -15 },
]

function diffClass(d) {
  if (d === 0) return 'text-slate-600'
  if (d > 0) return 'text-amber-700 font-semibold'
  return 'text-rose-700 font-semibold'
}

export default function DispatchEntryPage() {
  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h3 className="text-lg font-bold text-slate-900">Dispatch entry</h3>
          <p className="text-sm text-slate-500">
            Morning load reconciliation (~5:00 AM) — links inventory, production, and dispatch.
          </p>
        </div>
        <div className="inline-flex items-center gap-2 rounded-xl bg-amber-50 px-3 py-2 text-sm font-semibold text-amber-900 ring-1 ring-amber-200">
          <SunIcon className="h-5 w-5" aria-hidden />
          Shift: Morning load
        </div>
      </div>

      <div className={tableWrap}>
        <div className={tableScroll}>
          <table className="min-w-full text-left text-sm">
            <thead className={theadRow}>
              <tr>
                <th className="px-4 py-3">Route</th>
                <th className="px-4 py-3">Product</th>
                <th className="px-4 py-3 text-right">Planned qty</th>
                <th className="px-4 py-3 text-right">Loaded qty</th>
                <th className="px-4 py-3 text-right">Difference</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {rows.map((r, i) => (
                <tr key={`${r.route}-${r.product}-${i}`} className="bg-white hover:bg-slate-50/80">
                  <td className="px-4 py-3 font-semibold text-slate-900">{r.route}</td>
                  <td className="px-4 py-3 text-slate-700">{r.product}</td>
                  <td className="px-4 py-3 text-right tabular-nums text-slate-800">{r.planned}</td>
                  <td className="px-4 py-3 text-right tabular-nums">
                    <input
                      type="number"
                      defaultValue={r.loaded}
                      className="w-24 rounded-lg border border-slate-200 px-2 py-1 text-right font-medium"
                      aria-label={`Loaded qty ${r.route} ${r.product}`}
                    />
                  </td>
                  <td className={`px-4 py-3 text-right tabular-nums ${diffClass(r.diff)}`}>
                    {r.diff > 0 ? `+${r.diff}` : r.diff}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          className="rounded-xl bg-[#004080] px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-[#003366]"
        >
          Save &amp; post to inventory
        </button>
        <button
          type="button"
          className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 shadow-sm hover:bg-slate-50"
        >
          Print load sheet
        </button>
      </div>
    </div>
  )
}
