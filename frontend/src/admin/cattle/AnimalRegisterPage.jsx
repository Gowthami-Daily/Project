import { useState } from 'react'
import { theadRow, tableScroll, tableWrap } from './cattleTableStyles.js'

const animals = [
  {
    id: 'C-014',
    type: 'Cow',
    breed: 'HF cross',
    age: '4 y',
    weight: '420 kg',
    status: 'Milking',
    purchase: '₹ 45,000',
  },
  {
    id: 'B-003',
    type: 'Buffalo',
    breed: 'Murrah',
    age: '6 y',
    weight: '510 kg',
    status: 'Milking',
    purchase: '₹ 72,000',
  },
  {
    id: 'C-021',
    type: 'Cow',
    breed: 'Jersey',
    age: '3 y',
    weight: '380 kg',
    status: 'Pregnant',
    purchase: '₹ 38,000',
  },
  {
    id: 'C-008',
    type: 'Cow',
    breed: 'HF',
    age: '5 y',
    weight: '440 kg',
    status: 'Dry',
    purchase: '₹ 42,000',
  },
  {
    id: 'B-011',
    type: 'Buffalo',
    breed: 'Murrah',
    age: '2 y',
    weight: '390 kg',
    status: 'Sick',
    purchase: '₹ 55,000',
  },
]

const statusTone = {
  Milking: 'bg-sky-100 text-sky-900 ring-sky-200',
  Dry: 'bg-slate-100 text-slate-800 ring-slate-200',
  Pregnant: 'bg-violet-100 text-violet-900 ring-violet-200',
  Sick: 'bg-rose-100 text-rose-900 ring-rose-200',
  Sold: 'bg-amber-100 text-amber-900 ring-amber-200',
}

const profileTabs = ['Overview', 'Milk yield', 'Feed', 'Health', 'Breeding', 'Expenses']

export default function AnimalRegisterPage() {
  const [selected, setSelected] = useState(null)
  const [tab, setTab] = useState('Overview')

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h3 className="text-lg font-bold text-slate-900">Animal register</h3>
          <p className="text-sm text-slate-500">Individual cow / buffalo records — herd management core.</p>
        </div>
        <button
          type="button"
          className="min-h-[44px] rounded-xl bg-emerald-700 px-5 text-sm font-semibold text-white shadow-sm hover:bg-emerald-800"
        >
          + Add animal
        </button>
      </div>

      <div className={tableWrap}>
        <div className={tableScroll}>
          <table className="min-w-full text-left text-sm">
            <thead className={theadRow}>
              <tr>
                <th className="px-4 py-3">Animal ID</th>
                <th className="px-4 py-3">Type</th>
                <th className="px-4 py-3">Breed</th>
                <th className="px-4 py-3">Age</th>
                <th className="px-4 py-3">Weight</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Purchase cost</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {animals.map((a) => (
                <tr key={a.id} className="bg-white hover:bg-slate-50/80">
                  <td className="px-4 py-3 font-mono text-sm font-bold text-slate-900">{a.id}</td>
                  <td className="px-4 py-3 text-slate-700">{a.type}</td>
                  <td className="px-4 py-3 text-slate-700">{a.breed}</td>
                  <td className="px-4 py-3 tabular-nums text-slate-600">{a.age}</td>
                  <td className="px-4 py-3 tabular-nums text-slate-700">{a.weight}</td>
                  <td className="px-4 py-3">
                    <span
                      className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ${statusTone[a.status] || statusTone.Dry}`}
                    >
                      {a.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 font-mono text-sm text-slate-800">{a.purchase}</td>
                  <td className="px-4 py-3 text-right">
                    <button
                      type="button"
                      onClick={() => {
                        setSelected(a)
                        setTab('Overview')
                      }}
                      className="min-h-[40px] rounded-lg bg-emerald-50 px-3 text-sm font-semibold text-emerald-900 hover:bg-emerald-100"
                    >
                      Profile
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
              <p className="font-mono text-xs font-bold text-emerald-700">{selected.id}</p>
              <h4 className="text-xl font-bold text-slate-900">
                {selected.type} · {selected.breed}
              </h4>
              <p className="text-sm text-slate-500">
                {selected.age} · {selected.weight} ·{' '}
                <span className="font-semibold text-slate-700">{selected.status}</span>
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
                onClick={() => setTab(t)}
                className={`min-h-[44px] rounded-t-lg px-3 py-2 text-sm font-semibold sm:px-4 ${
                  tab === t ? 'bg-emerald-700 text-white' : 'text-slate-600 hover:bg-slate-100'
                }`}
              >
                {t}
              </button>
            ))}
          </div>
          <div className="pt-4 text-sm text-slate-600">
            {tab === 'Overview' && (
              <dl className="grid gap-3 sm:grid-cols-2">
                <div>
                  <dt className="text-xs font-bold uppercase text-slate-400">Purchase</dt>
                  <dd className="mt-1 font-mono font-semibold text-slate-900">{selected.purchase}</dd>
                </div>
                <div>
                  <dt className="text-xs font-bold uppercase text-slate-400">Tag / RFID</dt>
                  <dd className="mt-1 text-slate-700">RF-{selected.id} (demo)</dd>
                </div>
              </dl>
            )}
            {tab !== 'Overview' && (
              <p className="rounded-xl bg-slate-50 p-4 text-slate-500">
                <span className="font-semibold text-slate-800">{tab}</span> — link to yield, feed plan, vet visits,
                breeding events, and expense ledger (API placeholder).
              </p>
            )}
          </div>
        </div>
      ) : null}
    </div>
  )
}
