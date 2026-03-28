import { ArrowRightCircleIcon } from '@heroicons/react/24/outline'
import { theadRow, tableScroll, tableWrap } from './inflowTableStyles.js'

const rows = [
  { center: 'Kukatpally BMC', liters: 5200, tank: 'T1 intake', time: '07:42' },
  { center: 'Uppal BMC', liters: 4100, tank: 'T2 intake', time: '08:05' },
  { center: 'Miyapur BMC', liters: 3800, tank: 'T1 intake', time: '08:28' },
  { center: 'Attapur BMC', liters: 2900, tank: 'T3 Silo A', time: '09:10' },
]

export default function MilkTransferPage() {
  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-lg font-bold text-slate-900">Milk transfer to tank</h3>
        <p className="text-sm text-slate-500">
          After accepted QC — links <strong className="text-slate-700">inflow → inventory bulk tank</strong>.
        </p>
      </div>

      <div className="flex items-start gap-3 rounded-2xl border border-sky-200 bg-sky-50/80 p-4 text-sm text-sky-950">
        <ArrowRightCircleIcon className="h-8 w-8 shrink-0 text-sky-600" aria-hidden />
        <p>
          Log each dump with time stamp for traceability to pasteurization batches. Rejected routes stay out of this
          list.
        </p>
      </div>

      <div className={tableWrap}>
        <div className={tableScroll}>
          <table className="min-w-full text-left text-sm">
            <thead className={theadRow}>
              <tr>
                <th className="px-4 py-3">Center</th>
                <th className="px-4 py-3 text-right">Liters</th>
                <th className="px-4 py-3">Tank</th>
                <th className="px-4 py-3">Time</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {rows.map((r) => (
                <tr key={`${r.center}-${r.time}`} className="bg-white hover:bg-slate-50/80">
                  <td className="px-4 py-3 font-semibold text-slate-900">{r.center}</td>
                  <td className="px-4 py-3 text-right tabular-nums font-bold text-[#004080]">
                    {r.liters.toLocaleString()}
                  </td>
                  <td className="px-4 py-3 font-mono text-slate-700">{r.tank}</td>
                  <td className="px-4 py-3 font-mono tabular-nums text-slate-600">{r.time}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <button
        type="button"
        className="min-h-[44px] rounded-xl bg-[#004080] px-5 text-sm font-semibold text-white hover:bg-[#003366]"
      >
        + Record transfer
      </button>
    </div>
  )
}
