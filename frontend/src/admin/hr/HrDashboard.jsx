import {
  BanknotesIcon,
  BuildingOffice2Icon,
  TruckIcon,
  UserGroupIcon,
  UsersIcon,
  WalletIcon,
  XCircleIcon,
} from '@heroicons/react/24/solid'
import KpiCard from '../dashboard/KpiCard.jsx'

const kpis = [
  {
    title: 'Total employees',
    value: '186',
    subtitle: 'All branches · active contracts',
    icon: UsersIcon,
    gradientClass: 'bg-gradient-to-br from-blue-600 via-blue-500 to-cyan-400',
  },
  {
    title: 'Present today',
    value: '162',
    subtitle: 'Checked in by 9:30 AM',
    icon: UserGroupIcon,
    gradientClass: 'bg-gradient-to-br from-emerald-500 to-teal-400',
  },
  {
    title: 'Absent today',
    value: '14',
    subtitle: 'Excl. approved leave',
    icon: XCircleIcon,
    gradientClass: 'bg-gradient-to-br from-rose-500 to-pink-500',
  },
  {
    title: 'Drivers',
    value: '24',
    subtitle: 'Delivery + hub shuttle',
    icon: TruckIcon,
    gradientClass: 'bg-gradient-to-br from-violet-600 to-indigo-500',
  },
  {
    title: 'Plant workers',
    value: '38',
    subtitle: 'Production & CIP',
    icon: BuildingOffice2Icon,
    gradientClass: 'bg-gradient-to-br from-amber-500 to-orange-500',
  },
  {
    title: 'Collection staff',
    value: '42',
    subtitle: 'Centers & field collection',
    icon: UserGroupIcon,
    gradientClass: 'bg-gradient-to-br from-sky-500 to-blue-600',
  },
  {
    title: 'Salary payable',
    value: '₹24.8L',
    subtitle: 'March 2026 payroll · pending approval',
    icon: BanknotesIcon,
    gradientClass: 'bg-gradient-to-br from-lime-500 to-green-600',
  },
  {
    title: 'Advances given',
    value: '₹3.2L',
    subtitle: 'Outstanding staff loans',
    icon: WalletIcon,
    gradientClass: 'bg-gradient-to-br from-fuchsia-600 to-purple-500',
  },
]

export default function HrDashboard() {
  return (
    <div className="space-y-6">
      <section aria-label="HR KPIs" className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-4 2xl:grid-cols-4">
        {kpis.map((k) => (
          <KpiCard key={k.title} {...k} />
        ))}
      </section>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h3 className="text-sm font-bold text-slate-900">Attendance methods (today)</h3>
          <ul className="mt-3 space-y-2 text-sm text-slate-600">
            <li className="flex justify-between border-b border-slate-100 py-2">
              <span>Mobile GPS (delivery)</span>
              <span className="font-mono font-semibold text-[#004080]">58</span>
            </li>
            <li className="flex justify-between border-b border-slate-100 py-2">
              <span>Biometric (plant)</span>
              <span className="font-mono font-semibold text-[#004080]">41</span>
            </li>
            <li className="flex justify-between border-b border-slate-100 py-2">
              <span>Manual / office</span>
              <span className="font-mono font-semibold text-[#004080]">48</span>
            </li>
            <li className="flex justify-between py-2">
              <span>QR @ collection centers</span>
              <span className="font-mono font-semibold text-[#004080]">15</span>
            </li>
          </ul>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h3 className="text-sm font-bold text-slate-900">Quick actions</h3>
          <div className="mt-3 flex flex-wrap gap-2">
            <button
              type="button"
              className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
            >
              Run payroll preview
            </button>
            <button
              type="button"
              className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
            >
              Export attendance
            </button>
            <button
              type="button"
              className="rounded-xl bg-[#004080] px-4 py-2 text-sm font-semibold text-white hover:bg-[#003366]"
            >
              Add employee
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
