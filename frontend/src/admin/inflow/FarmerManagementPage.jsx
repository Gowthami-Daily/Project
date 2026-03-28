import { useState } from 'react'
import { theadRow, tableScroll, tableWrap } from './inflowTableStyles.js'

const farmers = [
  {
    id: 'F-1001',
    name: 'G. Venkata Raju',
    village: 'Kistapur',
    phone: '9988776655',
    milkType: 'Buffalo',
    status: 'Active',
    balance: '₹ 15,000',
  },
  {
    id: 'F-1002',
    name: 'K. Lakshmi',
    village: 'Bowrampet',
    phone: '9876543210',
    milkType: 'Cow',
    status: 'Active',
    balance: '₹ 0',
  },
  {
    id: 'F-1003',
    name: 'P. Krishna',
    village: 'Ameenpur',
    phone: '9123456789',
    milkType: 'Buffalo',
    status: 'Suspended',
    balance: '₹ 8,200',
  },
]

const profileTabs = ['Profile', 'Milk history', 'Payments', 'Advances', 'Quality reports']

export default function FarmerManagementPage() {
  const [selected, setSelected] = useState(null)
  const [profileTab, setProfileTab] = useState('Profile')

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h3 className="text-lg font-bold text-slate-900">Farmer management</h3>
          <p className="text-sm text-slate-500">Directory, contact, milk type, and ledger balance.</p>
        </div>
        <button
          type="button"
          className="min-h-[44px] rounded-xl bg-[#004080] px-5 py-3 text-sm font-semibold text-white shadow-sm hover:bg-[#003366] active:scale-[0.99]"
        >
          + Add farmer
        </button>
      </div>

      <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <select
          className="min-h-[44px] rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm font-medium"
          defaultValue="active"
          aria-label="Status filter"
        >
          <option value="all">All</option>
          <option value="active">Active</option>
          <option value="inactive">Inactive</option>
        </select>
        <input
          type="search"
          placeholder="Search name, ID, village…"
          className="min-h-[44px] min-w-[200px] flex-1 rounded-xl border border-slate-200 px-3 text-base sm:max-w-md"
          aria-label="Search farmers"
        />
      </div>

      <div className={tableWrap}>
        <div className={tableScroll}>
          <table className="min-w-full text-left text-sm">
            <thead className={theadRow}>
              <tr>
                <th className="px-4 py-3">Farmer ID</th>
                <th className="px-4 py-3">Name</th>
                <th className="px-4 py-3">Village</th>
                <th className="px-4 py-3">Phone</th>
                <th className="px-4 py-3">Milk type</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Balance</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {farmers.map((f) => (
                <tr key={f.id} className="bg-white hover:bg-slate-50/80">
                  <td className="px-4 py-3 font-mono text-sm font-bold text-slate-900">{f.id}</td>
                  <td className="px-4 py-3 font-medium text-slate-900">{f.name}</td>
                  <td className="px-4 py-3 text-slate-600">{f.village}</td>
                  <td className="px-4 py-3 font-mono text-slate-700">{f.phone}</td>
                  <td className="px-4 py-3">
                    <span className="rounded-full bg-sky-100 px-2.5 py-1 text-xs font-semibold text-sky-900">
                      {f.milkType}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`rounded-full px-2.5 py-1 text-xs font-semibold ${
                        f.status === 'Active'
                          ? 'bg-emerald-100 text-emerald-900'
                          : 'bg-amber-100 text-amber-900'
                      }`}
                    >
                      {f.status}
                    </span>
                  </td>
                  <td
                    className={`px-4 py-3 font-mono text-sm font-semibold tabular-nums ${
                      f.balance !== '₹ 0' ? 'text-slate-900' : 'text-slate-400'
                    }`}
                  >
                    {f.balance}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button
                      type="button"
                      onClick={() => {
                        setSelected(f)
                        setProfileTab('Profile')
                      }}
                      className="min-h-[40px] rounded-lg bg-slate-100 px-3 text-sm font-semibold text-slate-800 hover:bg-slate-200"
                    >
                      View
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {selected ? (
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-lg sm:p-6">
          <div className="flex flex-col gap-3 border-b border-slate-100 pb-4 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <p className="font-mono text-xs font-bold text-slate-500">{selected.id}</p>
              <h4 className="text-xl font-bold text-slate-900">{selected.name}</h4>
              <p className="text-sm text-slate-500">
                {selected.village} · {selected.phone}
              </p>
            </div>
            <button
              type="button"
              onClick={() => setSelected(null)}
              className="min-h-[44px] rounded-xl border border-slate-200 px-4 text-sm font-semibold text-slate-700 hover:bg-slate-50"
            >
              Close
            </button>
          </div>
          <div className="mt-4 flex flex-wrap gap-1 border-b border-slate-200 pb-px">
            {profileTabs.map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setProfileTab(t)}
                className={`min-h-[44px] rounded-t-lg px-3 py-2 text-sm font-semibold sm:px-4 ${
                  profileTab === t ? 'bg-[#004080] text-white' : 'text-slate-600 hover:bg-slate-100'
                }`}
              >
                {t}
              </button>
            ))}
          </div>
          <div className="pt-4 text-sm text-slate-600">
            {profileTab === 'Profile' && (
              <dl className="grid gap-3 sm:grid-cols-2">
                <div>
                  <dt className="text-xs font-bold uppercase text-slate-400">Milk type</dt>
                  <dd className="mt-1 font-medium text-slate-900">{selected.milkType}</dd>
                </div>
                <div>
                  <dt className="text-xs font-bold uppercase text-slate-400">Status</dt>
                  <dd className="mt-1 font-medium text-slate-900">{selected.status}</dd>
                </div>
                <div>
                  <dt className="text-xs font-bold uppercase text-slate-400">Outstanding</dt>
                  <dd className="mt-1 font-mono font-semibold text-slate-900">{selected.balance}</dd>
                </div>
                <div>
                  <dt className="text-xs font-bold uppercase text-slate-400">Route / center</dt>
                  <dd className="mt-1 text-slate-700">Kukatpally BMC (demo)</dd>
                </div>
              </dl>
            )}
            {profileTab !== 'Profile' && (
              <p className="rounded-xl bg-slate-50 p-4 text-slate-500">
                <strong className="text-slate-700">{profileTab}</strong> — connect to ledger API (demo placeholder).
              </p>
            )}
          </div>
        </div>
      ) : null}
    </div>
  )
}
