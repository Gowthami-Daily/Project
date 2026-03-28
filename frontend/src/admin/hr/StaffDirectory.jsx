import { Link } from 'react-router-dom'
import { theadRow, tableScroll, tableWrap } from './tableStyles.js'

const rows = [
  { id: 'GD-EMP-001', name: 'Ramesh Kumar', role: 'Admin', phone: '+91 98765 11101', branch: 'HQ', status: 'Active', joined: '12 Apr 2022' },
  { id: 'GD-EMP-042', name: 'Lakshmi P.', role: 'Accountant', phone: '+91 98765 11102', branch: 'HQ', status: 'Active', joined: '03 Jun 2023' },
  { id: 'GD-EMP-088', name: 'Satyam N.', role: 'Dispatch Manager', phone: '+91 98765 11103', branch: 'Hub A', status: 'Active', joined: '18 Jan 2024' },
  { id: 'GD-EMP-102', name: 'Raju K.', role: 'Driver', phone: '+91 98765 11104', branch: 'Hub A', status: 'Active', joined: '05 Sep 2023' },
  { id: 'GD-EMP-115', name: 'Ravi Teja', role: 'Delivery Boy', phone: '+91 98765 11105', branch: 'Hub A', status: 'Active', joined: '22 Nov 2024' },
  { id: 'GD-EMP-056', name: 'Sridevi M.', role: 'Lab Technician', phone: '+91 98765 11106', branch: 'Center North', status: 'On leave', joined: '14 Feb 2023' },
  { id: 'GD-EMP-067', name: 'Krishna Rao', role: 'Collection Operator', phone: '+91 98765 11107', branch: 'Center East', status: 'Active', joined: '01 Aug 2023' },
  { id: 'GD-EMP-073', name: 'Anil Kumar', role: 'Plant Operator', phone: '+91 98765 11108', branch: 'Hub A', status: 'Active', joined: '19 Oct 2022' },
  { id: 'GD-EMP-091', name: 'Venkat Helper', role: 'Helper', phone: '+91 98765 11109', branch: 'Hub A', status: 'Active', joined: '07 Mar 2025' },
]

function statusPill(s) {
  const map = {
    Active: 'bg-emerald-100 text-emerald-800 ring-emerald-200/80',
    'On leave': 'bg-amber-100 text-amber-900 ring-amber-200/80',
    Inactive: 'bg-slate-100 text-slate-600 ring-slate-200/80',
  }
  return map[s] || map.Inactive
}

export default function StaffDirectory() {
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-2">
          <span className="rounded-full bg-[#004080]/10 px-3 py-1 text-xs font-semibold text-[#004080]">All roles</span>
          <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">Drivers &amp; delivery</span>
          <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">Plant</span>
        </div>
        <button
          type="button"
          className="rounded-xl bg-[#004080] px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-[#003366]"
        >
          Add staff
        </button>
      </div>

      <div className={tableWrap}>
        <div className={tableScroll}>
          <table className="w-full min-w-[900px] text-left text-sm">
            <thead>
              <tr className={theadRow}>
                <th className="px-4 py-3">Staff ID</th>
                <th className="px-4 py-3">Name</th>
                <th className="px-4 py-3">Role</th>
                <th className="px-4 py-3">Phone</th>
                <th className="px-4 py-3">Branch</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Join date</th>
                <th className="px-4 py-3">Profile</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {rows.map((r) => (
                <tr key={r.id} className="hover:bg-slate-50/80">
                  <td className="px-4 py-3 font-mono text-sm font-semibold text-[#004080]">{r.id}</td>
                  <td className="px-4 py-3 font-medium text-slate-900">{r.name}</td>
                  <td className="px-4 py-3 text-slate-700">{r.role}</td>
                  <td className="px-4 py-3 font-mono text-xs text-slate-600">{r.phone}</td>
                  <td className="px-4 py-3 text-slate-600">{r.branch}</td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ${statusPill(r.status)}`}>
                      {r.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-slate-600">{r.joined}</td>
                  <td className="px-4 py-3">
                    <Link
                      to={r.id}
                      className="text-sm font-semibold text-[#004080] hover:underline"
                    >
                      Open
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      <p className="text-xs text-slate-500">
        Roles include Admin, Manager, Accountant, Collection Operator, Lab Technician, Plant Operator, Dispatch Manager,
        Driver, Delivery Boy, Helper — map to <code className="rounded bg-slate-100 px-1">staff_roles</code> in API.
      </p>
    </div>
  )
}
