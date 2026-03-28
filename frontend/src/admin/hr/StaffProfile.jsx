import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { ArrowLeftIcon } from '@heroicons/react/24/outline'
import { theadRow, tableScroll, tableWrap } from './tableStyles.js'

const DEMO = {
  id: 'GD-EMP-088',
  name: 'Satyam N.',
  role: 'Dispatch Manager',
  phone: '+91 98765 11103',
  branch: 'Hub A',
  email: 'satyam@gowthamidaily.example',
  aadhaar: 'XXXX-XXXX-4521',
  address: 'Near Hub A, Bengaluru',
  emergency: 'Sridevi — +91 98765 99999',
}

const profileTabs = [
  { id: 'personal', label: 'Personal info' },
  { id: 'attendance', label: 'Attendance' },
  { id: 'salary', label: 'Salary' },
  { id: 'advances', label: 'Advances' },
  { id: 'documents', label: 'Documents' },
  { id: 'performance', label: 'Performance' },
]

const attendanceRows = [
  { date: '27 Mar 2026', in: '05:42', out: '13:05', shift: 'Morning', hours: '7.4', ot: '0', status: 'Present' },
  { date: '26 Mar 2026', in: '05:38', out: '13:10', shift: 'Morning', hours: '7.5', ot: '0.5', status: 'Present' },
  { date: '25 Mar 2026', in: '—', out: '—', shift: '—', hours: '0', ot: '0', status: 'Leave' },
]

export default function StaffProfile() {
  const { staffId } = useParams()
  const [tab, setTab] = useState('personal')
  const staff = { ...DEMO, id: staffId || DEMO.id }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-3">
        <Link
          to="/admin/hr/staff"
          className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
        >
          <ArrowLeftIcon className="h-4 w-4" />
          Staff directory
        </Link>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-4">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-sky-400 to-[#004080] text-lg font-bold text-white">
              {staff.name.slice(0, 1)}
            </div>
            <div>
              <h3 className="text-xl font-bold text-slate-900">{staff.name}</h3>
              <p className="text-sm text-slate-500">
                <span className="font-mono font-semibold text-[#004080]">{staff.id}</span> · {staff.role} · {staff.branch}
              </p>
            </div>
          </div>
          <div className="flex gap-2">
            <button type="button" className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold hover:bg-slate-50">
              Edit
            </button>
            <button type="button" className="rounded-xl bg-[#004080] px-4 py-2 text-sm font-semibold text-white hover:bg-[#003366]">
              Assign shift
            </button>
          </div>
        </div>

        <div className="mt-6 flex flex-wrap gap-1 border-b border-slate-200">
          {profileTabs.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setTab(t.id)}
              className={`rounded-t-lg px-4 py-2 text-sm font-semibold transition ${
                tab === t.id ? 'bg-slate-100 text-[#004080]' : 'text-slate-600 hover:bg-slate-50'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        <div className="mt-6">
          {tab === 'personal' && (
            <dl className="grid max-w-2xl gap-4 sm:grid-cols-2">
              <div>
                <dt className="text-xs font-bold uppercase text-slate-500">Phone</dt>
                <dd className="mt-1 font-mono text-sm">{staff.phone}</dd>
              </div>
              <div>
                <dt className="text-xs font-bold uppercase text-slate-500">Email</dt>
                <dd className="mt-1 text-sm">{staff.email}</dd>
              </div>
              <div>
                <dt className="text-xs font-bold uppercase text-slate-500">Aadhaar (masked)</dt>
                <dd className="mt-1 font-mono text-sm">{staff.aadhaar}</dd>
              </div>
              <div>
                <dt className="text-xs font-bold uppercase text-slate-500">Emergency</dt>
                <dd className="mt-1 text-sm">{staff.emergency}</dd>
              </div>
              <div className="sm:col-span-2">
                <dt className="text-xs font-bold uppercase text-slate-500">Address</dt>
                <dd className="mt-1 text-sm">{staff.address}</dd>
              </div>
            </dl>
          )}

          {tab === 'attendance' && (
            <div className={tableWrap}>
              <div className={tableScroll}>
                <table className="w-full min-w-[720px] text-left text-sm">
                  <thead>
                    <tr className={theadRow}>
                      <th className="px-3 py-2">Date</th>
                      <th className="px-3 py-2">Check in</th>
                      <th className="px-3 py-2">Check out</th>
                      <th className="px-3 py-2">Shift</th>
                      <th className="px-3 py-2">Hours</th>
                      <th className="px-3 py-2">OT</th>
                      <th className="px-3 py-2">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {attendanceRows.map((r) => (
                      <tr key={r.date}>
                        <td className="px-3 py-2">{r.date}</td>
                        <td className="px-3 py-2 font-mono">{r.in}</td>
                        <td className="px-3 py-2 font-mono">{r.out}</td>
                        <td className="px-3 py-2">{r.shift}</td>
                        <td className="px-3 py-2 font-mono">{r.hours}</td>
                        <td className="px-3 py-2 font-mono">{r.ot}</td>
                        <td className="px-3 py-2">{r.status}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {tab === 'salary' && (
            <div className="max-w-xl space-y-4">
              <p className="text-sm text-slate-600">Salary structure (March 2026)</p>
              <div className="rounded-xl border border-slate-200">
                <table className="w-full text-sm">
                  <tbody className="divide-y divide-slate-100">
                    {[
                      ['Basic', '₹12,000'],
                      ['HRA', '₹3,000'],
                      ['Allowance', '₹2,000'],
                      ['Overtime', '₹1,500'],
                      ['Bonus', '₹1,000'],
                      ['Deductions', '− ₹2,000'],
                    ].map(([k, v]) => (
                      <tr key={k}>
                        <td className="px-4 py-2 text-slate-600">{k}</td>
                        <td className="px-4 py-2 text-right font-mono font-semibold">{v}</td>
                      </tr>
                    ))}
                    <tr className="bg-sky-50/50 font-bold">
                      <td className="px-4 py-3">Net salary</td>
                      <td className="px-4 py-3 text-right font-mono text-[#004080]">₹17,500</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {tab === 'advances' && (
            <ul className="space-y-2 text-sm">
              <li className="rounded-xl border border-slate-200 px-4 py-3">
                <span className="font-semibold">₹15,000</span> on 10 Jan 2026 · ₹2,500/mo deduction ·{' '}
                <span className="text-amber-700">Balance ₹10,000</span>
              </li>
            </ul>
          )}

          {tab === 'documents' && (
            <ul className="divide-y divide-slate-100 rounded-xl border border-slate-200 text-sm">
              {['Driving license', 'Aadhaar (vault)', 'Employment contract', 'Medical fitness'].map((d) => (
                <li key={d} className="flex items-center justify-between px-4 py-3">
                  <span>{d}</span>
                  <button type="button" className="text-[#004080] font-semibold hover:underline">
                    View
                  </button>
                </li>
              ))}
            </ul>
          )}

          {tab === 'performance' && (
            <p className="text-sm text-slate-600">
              KPIs and reviews — connect to <code className="rounded bg-slate-100 px-1">performance_reviews</code> table.
              Demo: Q1 rating <strong className="text-emerald-700">Meets expectations</strong>.
            </p>
          )}
        </div>
      </div>
    </div>
  )
}
