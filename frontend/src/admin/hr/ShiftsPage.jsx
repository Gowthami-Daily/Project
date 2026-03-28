import { theadRow, tableScroll, tableWrap } from './tableStyles.js'

const shifts = [
  { name: 'Morning', start: '5:00 AM', end: '1:00 PM', hours: '8', assigned: 'Plant, collection, dispatch prep' },
  { name: 'Evening', start: '1:00 PM', end: '9:00 PM', hours: '8', assigned: 'Dispatch, hub ops' },
  { name: 'Night', start: '9:00 PM', end: '5:00 AM', hours: '8', assigned: 'Cold storage, security' },
]

const assignments = [
  { staff: 'Raju K.', role: 'Driver', shift: 'Morning', branch: 'Hub A' },
  { staff: 'Ravi Teja', role: 'Delivery Boy', shift: 'Morning', branch: 'Hub A' },
  { staff: 'Anil Kumar', role: 'Plant Operator', shift: 'Morning', branch: 'Hub A' },
  { staff: 'Krishna Rao', role: 'Collection Operator', shift: 'Morning', branch: 'Center East' },
  { staff: 'Night security pool', role: 'Helper', shift: 'Night', branch: 'Hub A' },
]

export default function ShiftsPage() {
  return (
    <div className="space-y-8">
      <div>
        <h3 className="text-lg font-bold text-slate-900">Shift definitions</h3>
        <p className="mt-1 text-sm text-slate-600">Assign to plant workers, drivers, and collection staff.</p>
        <div className={`mt-4 ${tableWrap}`}>
          <div className={tableScroll}>
            <table className="w-full min-w-[640px] text-left text-sm">
              <thead>
                <tr className={theadRow}>
                  <th className="px-4 py-3">Shift</th>
                  <th className="px-4 py-3">Start</th>
                  <th className="px-4 py-3">End</th>
                  <th className="px-4 py-3">Hours</th>
                  <th className="px-4 py-3">Typical coverage</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {shifts.map((s) => (
                  <tr key={s.name} className="hover:bg-slate-50/80">
                    <td className="px-4 py-3 font-semibold text-[#004080]">{s.name}</td>
                    <td className="px-4 py-3 font-mono">{s.start}</td>
                    <td className="px-4 py-3 font-mono">{s.end}</td>
                    <td className="px-4 py-3 font-mono">{s.hours}</td>
                    <td className="px-4 py-3 text-slate-600">{s.assigned}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <div>
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
          <h3 className="text-lg font-bold text-slate-900">Current assignments (sample)</h3>
          <button type="button" className="rounded-xl bg-[#004080] px-4 py-2 text-sm font-semibold text-white hover:bg-[#003366]">
            Bulk assign
          </button>
        </div>
        <div className={tableWrap}>
          <div className={tableScroll}>
            <table className="w-full min-w-[600px] text-left text-sm">
              <thead>
                <tr className={theadRow}>
                  <th className="px-4 py-3">Staff</th>
                  <th className="px-4 py-3">Role</th>
                  <th className="px-4 py-3">Shift</th>
                  <th className="px-4 py-3">Branch</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {assignments.map((a, i) => (
                  <tr key={i} className="hover:bg-slate-50/80">
                    <td className="px-4 py-3 font-medium">{a.staff}</td>
                    <td className="px-4 py-3 text-slate-600">{a.role}</td>
                    <td className="px-4 py-3">{a.shift}</td>
                    <td className="px-4 py-3 text-slate-600">{a.branch}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  )
}
