import { theadRow, tableScroll, tableWrap } from './tableStyles.js'

const rows = [
  { asset: 'AP-YY-5678', type: 'Insurance renewal', due: '02 Apr 2026', status: 'Upcoming' },
  { asset: 'Batch pasteurizer P-01', type: 'AMC visit', due: '05 Apr 2026', status: 'Upcoming' },
  { asset: 'AP-XX-1234', type: 'Periodic service', due: '12 May 2026', status: 'Scheduled' },
  { asset: 'Raw milk tank B', type: 'CIP deep clean', due: '28 Mar 2026', status: 'Due soon' },
  { asset: 'Cold room CR-3', type: 'Compressor check', due: '28 Mar 2026', status: 'Overdue' },
  { asset: 'AP-11-4455', type: 'Fitness certificate', due: '15 Apr 2026', status: 'Scheduled' },
]

function statusPill(status) {
  const map = {
    Upcoming: 'bg-sky-100 text-sky-900 ring-sky-200/80',
    Scheduled: 'bg-violet-100 text-violet-900 ring-violet-200/80',
    'Due soon': 'bg-amber-100 text-amber-900 ring-amber-200/80',
    Overdue: 'bg-red-100 text-red-800 ring-red-200/80',
  }
  return map[status] || 'bg-slate-100 text-slate-700 ring-slate-200/80'
}

export default function ServiceSchedulePage() {
  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
        <p className="text-sm font-semibold text-slate-800">Legend</p>
        <div className="mt-3 flex flex-wrap gap-4 text-xs">
          <span className="flex items-center gap-2">
            <span className="h-2.5 w-2.5 rounded-full bg-sky-500" /> Upcoming
          </span>
          <span className="flex items-center gap-2">
            <span className="h-2.5 w-2.5 rounded-full bg-amber-500" /> Due soon
          </span>
          <span className="flex items-center gap-2">
            <span className="h-2.5 w-2.5 rounded-full bg-red-500" /> Overdue
          </span>
          <span className="flex items-center gap-2">
            <span className="h-2.5 w-2.5 rounded-full bg-violet-500" /> Scheduled
          </span>
        </div>
      </div>
      <div className={tableWrap}>
        <div className={tableScroll}>
          <table className="w-full min-w-[640px] text-left text-sm">
            <thead>
              <tr className={theadRow}>
                <th className="px-4 py-3">Asset name</th>
                <th className="px-4 py-3">Service type</th>
                <th className="px-4 py-3">Due date</th>
                <th className="px-4 py-3">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {rows.map((r, i) => (
                <tr key={`${r.asset}-${i}`} className="hover:bg-slate-50/80">
                  <td className="px-4 py-3 font-medium text-slate-900">{r.asset}</td>
                  <td className="px-4 py-3 text-slate-600">{r.type}</td>
                  <td className="px-4 py-3 font-mono tabular-nums text-slate-800">{r.due}</td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ${statusPill(r.status)}`}>
                      {r.status}
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
