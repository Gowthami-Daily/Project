import { theadRow, tableScroll, tableWrap } from './tableStyles.js'

const rows = [
  { staff: 'Ramesh Kumar', basic: '₹45,000', ot: '₹0', bonus: '₹5,000', ded: '₹4,200', net: '₹45,800', status: 'Approved' },
  { staff: 'Lakshmi P.', basic: '₹32,000', ot: '₹0', bonus: '₹2,000', ded: '₹2,800', net: '₹31,200', status: 'Paid' },
  { staff: 'Satyam N.', basic: '₹12,000', ot: '₹1,500', bonus: '₹1,000', ded: '₹2,000', net: '₹17,500', status: 'Pending' },
  { staff: 'Raju K.', basic: '₹11,000', ot: '₹800', bonus: '₹500', ded: '₹1,200', net: '₹11,100', status: 'Pending' },
  { staff: 'Anil Kumar', basic: '₹14,000', ot: '₹2,200', bonus: '₹0', ded: '₹1,500', net: '₹14,700', status: 'Approved' },
]

function statusPill(s) {
  const map = {
    Pending: 'bg-amber-100 text-amber-900 ring-amber-200/80',
    Approved: 'bg-sky-100 text-sky-900 ring-sky-200/80',
    Paid: 'bg-emerald-100 text-emerald-800 ring-emerald-200/80',
  }
  return map[s] || map.Pending
}

export default function PayrollPage() {
  return (
    <div className="space-y-6">
      <div className="grid gap-4 lg:grid-cols-3">
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm lg:col-span-2">
          <h3 className="text-sm font-bold text-slate-900">Salary structure template</h3>
          <p className="mt-1 text-xs text-slate-500">Components roll into monthly payroll run.</p>
          <div className="mt-4 grid gap-2 sm:grid-cols-2">
            {[
              ['Basic', '₹12,000'],
              ['HRA', '₹3,000'],
              ['Allowance', '₹2,000'],
              ['Overtime', 'varies'],
              ['Bonus', 'varies'],
              ['Deductions', 'PF, ESI, advance'],
            ].map(([k, v]) => (
              <div key={k} className="flex justify-between rounded-lg border border-slate-100 px-3 py-2 text-sm">
                <span className="text-slate-600">{k}</span>
                <span className="font-mono font-semibold">{v}</span>
              </div>
            ))}
          </div>
        </div>
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50/50 p-5 shadow-sm">
          <p className="text-xs font-bold uppercase text-emerald-800">March 2026 net (demo)</p>
          <p className="mt-2 text-3xl font-bold text-emerald-900">₹17,500</p>
          <p className="mt-1 text-sm text-emerald-800">Example net after standard deductions</p>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        <span className="rounded-full bg-[#004080]/10 px-3 py-1 text-xs font-semibold text-[#004080]">March 2026</span>
        <button type="button" className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">
          Approve batch
        </button>
      </div>

      <div className={tableWrap}>
        <div className={tableScroll}>
          <table className="w-full min-w-[880px] text-left text-sm">
            <thead>
              <tr className={theadRow}>
                <th className="px-4 py-3">Staff</th>
                <th className="px-4 py-3">Basic</th>
                <th className="px-4 py-3">OT</th>
                <th className="px-4 py-3">Bonus</th>
                <th className="px-4 py-3">Deductions</th>
                <th className="px-4 py-3">Net salary</th>
                <th className="px-4 py-3">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {rows.map((r) => (
                <tr key={r.staff} className="hover:bg-slate-50/80">
                  <td className="px-4 py-3 font-medium text-slate-900">{r.staff}</td>
                  <td className="px-4 py-3 font-mono tabular-nums">{r.basic}</td>
                  <td className="px-4 py-3 font-mono tabular-nums">{r.ot}</td>
                  <td className="px-4 py-3 font-mono tabular-nums">{r.bonus}</td>
                  <td className="px-4 py-3 font-mono tabular-nums text-rose-700">{r.ded}</td>
                  <td className="px-4 py-3 font-mono font-bold tabular-nums text-[#004080]">{r.net}</td>
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
