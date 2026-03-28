import { theadRow, tableScroll, tableWrap } from './tableStyles.js'

const rows = [
  { date: '27 Mar 2026', staff: 'Raju K.', in: '05:15', out: '13:02', shift: 'Morning', hours: '7.8', ot: '0.3', status: 'Present', method: 'GPS' },
  { date: '27 Mar 2026', staff: 'Anil Kumar', in: '05:00', out: '13:00', shift: 'Morning', hours: '8.0', ot: '0', status: 'Present', method: 'Biometric' },
  { date: '27 Mar 2026', staff: 'Lakshmi P.', in: '09:05', out: '18:00', shift: 'Office', hours: '8.0', ot: '0', status: 'Present', method: 'Manual' },
  { date: '27 Mar 2026', staff: 'Krishna Rao', in: '06:10', out: '14:05', shift: 'Morning', hours: '7.9', ot: '0', status: 'Present', method: 'QR' },
  { date: '27 Mar 2026', staff: 'Ravi Teja', in: '—', out: '—', shift: 'Morning', hours: '0', ot: '0', status: 'Absent', method: '—' },
  { date: '27 Mar 2026', staff: 'Sridevi M.', in: '06:00', out: '10:00', shift: 'Morning', hours: '4.0', ot: '0', status: 'Half day', method: 'QR' },
]

function statusPill(s) {
  const map = {
    Present: 'bg-emerald-100 text-emerald-800 ring-emerald-200/80',
    Absent: 'bg-red-100 text-red-800 ring-red-200/80',
    'Half day': 'bg-amber-100 text-amber-900 ring-amber-200/80',
    Leave: 'bg-violet-100 text-violet-900 ring-violet-200/80',
    Holiday: 'bg-slate-100 text-slate-600 ring-slate-200/80',
  }
  return map[s] || map.Present
}

export default function AttendancePage() {
  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-slate-200 bg-slate-50/80 p-4 text-sm text-slate-700">
        <p className="font-semibold text-slate-900">Capture methods</p>
        <p className="mt-1">
          <strong>Mobile GPS</strong> — delivery staff · <strong>Biometric</strong> — plant · <strong>Manual</strong> — office ·{' '}
          <strong>QR</strong> — collection centers.
        </p>
      </div>
      <div className="flex flex-wrap gap-2">
        <span className="rounded-full bg-[#004080]/10 px-3 py-1 text-xs font-semibold text-[#004080]">Today</span>
        <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">Export</span>
      </div>
      <div className={tableWrap}>
        <div className={tableScroll}>
          <table className="w-full min-w-[960px] text-left text-sm">
            <thead>
              <tr className={theadRow}>
                <th className="px-4 py-3">Date</th>
                <th className="px-4 py-3">Staff</th>
                <th className="px-4 py-3">Check in</th>
                <th className="px-4 py-3">Check out</th>
                <th className="px-4 py-3">Shift</th>
                <th className="px-4 py-3">Hours</th>
                <th className="px-4 py-3">OT</th>
                <th className="px-4 py-3">Method</th>
                <th className="px-4 py-3">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {rows.map((r, i) => (
                <tr key={`${r.staff}-${i}`} className="hover:bg-slate-50/80">
                  <td className="px-4 py-3 text-slate-700">{r.date}</td>
                  <td className="px-4 py-3 font-medium text-slate-900">{r.staff}</td>
                  <td className="px-4 py-3 font-mono">{r.in}</td>
                  <td className="px-4 py-3 font-mono">{r.out}</td>
                  <td className="px-4 py-3">{r.shift}</td>
                  <td className="px-4 py-3 font-mono tabular-nums">{r.hours}</td>
                  <td className="px-4 py-3 font-mono tabular-nums">{r.ot}</td>
                  <td className="px-4 py-3 text-slate-600">{r.method}</td>
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
