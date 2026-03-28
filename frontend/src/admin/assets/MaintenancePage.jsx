import { theadRow, tableScroll, tableWrap } from './tableStyles.js'

const rows = [
  {
    date: '08 Mar 2026',
    vehicle: 'AP-ZZ-9012',
    type: 'Full service + chain',
    cost: '₹8,400',
    vendor: 'City Motors',
    nextDue: '08 Jun 2026',
    status: 'Completed',
  },
  {
    date: '06 Mar 2026',
    vehicle: 'AP-YY-5678',
    type: 'Brake pads',
    cost: '₹3,200',
    vendor: 'AutoCare Hub',
    nextDue: '06 Sep 2026',
    status: 'Completed',
  },
  {
    date: '10 Mar 2026',
    vehicle: 'AP-11-4455',
    type: 'AC gas + filter',
    cost: '₹5,100',
    vendor: 'CoolDrive',
    nextDue: '10 Mar 2027',
    status: 'In progress',
  },
  {
    date: '12 Mar 2026',
    vehicle: 'AP-XX-1234',
    type: 'Periodic inspection',
    cost: '₹1,850',
    vendor: 'Gowthami workshop',
    nextDue: '12 Jun 2026',
    status: 'Scheduled',
  },
]

function statusPill(status) {
  const map = {
    Completed: 'bg-emerald-100 text-emerald-800 ring-emerald-200/80',
    'In progress': 'bg-sky-100 text-sky-900 ring-sky-200/80',
    Scheduled: 'bg-violet-100 text-violet-900 ring-violet-200/80',
  }
  return map[status] || 'bg-slate-100 text-slate-700 ring-slate-200/80'
}

export default function MaintenancePage() {
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        <span className="rounded-full bg-[#004080]/10 px-3 py-1 text-xs font-semibold text-[#004080]">All jobs</span>
        <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">Under repair</span>
        <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">Scheduled</span>
      </div>
      <div className={tableWrap}>
        <div className={tableScroll}>
          <table className="w-full min-w-[900px] text-left text-sm">
            <thead>
              <tr className={theadRow}>
                <th className="px-4 py-3">Date</th>
                <th className="px-4 py-3">Vehicle</th>
                <th className="px-4 py-3">Service type</th>
                <th className="px-4 py-3">Cost</th>
                <th className="px-4 py-3">Vendor</th>
                <th className="px-4 py-3">Next service date</th>
                <th className="px-4 py-3">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {rows.map((r, i) => (
                <tr key={`${r.vehicle}-${i}`} className="hover:bg-slate-50/80">
                  <td className="px-4 py-3 text-slate-700">{r.date}</td>
                  <td className="px-4 py-3 font-mono font-semibold text-[#004080]">{r.vehicle}</td>
                  <td className="px-4 py-3 text-slate-800">{r.type}</td>
                  <td className="px-4 py-3 font-mono font-semibold tabular-nums">{r.cost}</td>
                  <td className="px-4 py-3 text-slate-600">{r.vendor}</td>
                  <td className="px-4 py-3 text-slate-600">{r.nextDue}</td>
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
