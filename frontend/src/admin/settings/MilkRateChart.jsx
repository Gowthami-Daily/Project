import { useState } from 'react'
import { PlusIcon, TrashIcon } from '@heroicons/react/24/outline'

const initialRows = [
  { id: 1, fat: '4.0', snf: '8.5', cow: '38.20', buffalo: '52.40', effective: '2026-03-01' },
  { id: 2, fat: '4.5', snf: '8.5', cow: '40.10', buffalo: '54.80', effective: '2026-03-01' },
  { id: 3, fat: '5.0', snf: '8.6', cow: '42.00', buffalo: '57.20', effective: '2026-03-01' },
  { id: 4, fat: '5.5', snf: '8.7', cow: '43.90', buffalo: '59.50', effective: '2026-03-01' },
]

const cellInput =
  'w-full min-w-[4rem] rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-sm font-mono focus:border-[#004080] focus:outline-none focus:ring-1 focus:ring-[#004080]/30'

export default function MilkRateChart() {
  const [rows, setRows] = useState(initialRows)

  function updateRow(id, field, value) {
    setRows((r) => r.map((row) => (row.id === id ? { ...row, [field]: value } : row)))
  }

  function addRow() {
    const nextId = Math.max(0, ...rows.map((r) => r.id)) + 1
    setRows((r) => [...r, { id: nextId, fat: '', snf: '', cow: '', buffalo: '', effective: '' }])
  }

  function removeRow(id) {
    setRows((r) => r.filter((row) => row.id !== id))
  }

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-bold text-slate-900">Milk rate chart</h3>
        <p className="mt-1 text-sm text-slate-600">
          Procurement rates by Fat / SNF slab (₹ per liter). Effective date controls roll-out to new collections.
        </p>
      </div>

      <div className="overflow-hidden rounded-xl border border-slate-200 shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] text-left text-sm">
            <thead>
              <tr className="bg-sky-50/90 text-xs font-bold uppercase tracking-wide text-sky-900/85">
                <th className="px-3 py-3">Fat %</th>
                <th className="px-3 py-3">SNF %</th>
                <th className="px-3 py-3">Cow (₹/L)</th>
                <th className="px-3 py-3">Buffalo (₹/L)</th>
                <th className="px-3 py-3">Effective from</th>
                <th className="px-3 py-3 w-14" aria-label="Actions" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {rows.map((row) => (
                <tr key={row.id} className="hover:bg-slate-50/80">
                  <td className="px-3 py-2">
                    <input className={cellInput} value={row.fat} onChange={(e) => updateRow(row.id, 'fat', e.target.value)} />
                  </td>
                  <td className="px-3 py-2">
                    <input className={cellInput} value={row.snf} onChange={(e) => updateRow(row.id, 'snf', e.target.value)} />
                  </td>
                  <td className="px-3 py-2">
                    <input className={cellInput} value={row.cow} onChange={(e) => updateRow(row.id, 'cow', e.target.value)} />
                  </td>
                  <td className="px-3 py-2">
                    <input className={cellInput} value={row.buffalo} onChange={(e) => updateRow(row.id, 'buffalo', e.target.value)} />
                  </td>
                  <td className="px-3 py-2">
                    <input type="date" className={cellInput} value={row.effective} onChange={(e) => updateRow(row.id, 'effective', e.target.value)} />
                  </td>
                  <td className="px-3 py-2">
                    <button
                      type="button"
                      onClick={() => removeRow(row.id)}
                      className="rounded-lg p-2 text-slate-400 hover:bg-red-50 hover:text-red-600"
                      aria-label="Remove row"
                    >
                      <TrashIcon className="h-5 w-5" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="flex flex-wrap gap-3">
        <button
          type="button"
          onClick={addRow}
          className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 shadow-sm hover:bg-slate-50"
        >
          <PlusIcon className="h-5 w-5" />
          Add slab
        </button>
        <button
          type="button"
          className="rounded-xl bg-[#004080] px-5 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-[#003366]"
        >
          Save rate chart
        </button>
      </div>
    </div>
  )
}
