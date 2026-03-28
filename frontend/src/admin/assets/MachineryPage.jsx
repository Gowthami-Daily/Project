import { theadRow, tableScroll, tableWrap } from './tableStyles.js'

const rows = [
  {
    name: 'Batch pasteurizer P-01',
    location: 'Production — Hub A',
    status: 'Running',
    last: '01 Mar 2026',
    next: '01 Jun 2026',
  },
  {
    name: 'Homogenizer H-02',
    location: 'Production — Hub A',
    status: 'Running',
    last: '15 Feb 2026',
    next: '15 May 2026',
  },
  {
    name: 'CIP skid CIP-1',
    location: 'Wash bay',
    status: 'Idle',
    last: '20 Mar 2026',
    next: '20 Jun 2026',
  },
  {
    name: 'Cold room compressor CR-3',
    location: 'Cold storage',
    status: 'Warning',
    last: '10 Jan 2026',
    next: '28 Mar 2026',
  },
]

function statusPill(status) {
  const map = {
    Running: 'bg-emerald-100 text-emerald-800 ring-emerald-200/80',
    Idle: 'bg-slate-100 text-slate-700 ring-slate-200/80',
    Warning: 'bg-amber-100 text-amber-900 ring-amber-200/80',
    Down: 'bg-red-100 text-red-800 ring-red-200/80',
  }
  return map[status] || map.Idle
}

export default function MachineryPage() {
  return (
    <div className="space-y-4">
      <div className={tableWrap}>
        <div className={tableScroll}>
          <table className="w-full min-w-[720px] text-left text-sm">
            <thead>
              <tr className={theadRow}>
                <th className="px-4 py-3">Machine name</th>
                <th className="px-4 py-3">Location</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Last service</th>
                <th className="px-4 py-3">Next service</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {rows.map((r) => (
                <tr key={r.name} className="hover:bg-slate-50/80">
                  <td className="px-4 py-3 font-semibold text-slate-900">{r.name}</td>
                  <td className="px-4 py-3 text-slate-600">{r.location}</td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ${statusPill(r.status)}`}>
                      {r.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-slate-600">{r.last}</td>
                  <td className="px-4 py-3 text-slate-600">{r.next}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
