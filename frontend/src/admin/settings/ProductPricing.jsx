import { useState } from 'react'
import { PlusIcon, TrashIcon } from '@heroicons/react/24/outline'

const initialRows = [
  { id: 1, sku: 'MLK-BUF-1L', name: 'Buffalo milk 1L pouch', unit: 'Pouch', mrp: '72', subPrice: '68' },
  { id: 2, sku: 'MLK-COW-1L', name: 'Cow milk 1L pouch', unit: 'Pouch', mrp: '56', subPrice: '52' },
  { id: 3, sku: 'CRD-500', name: 'Curd 500g', unit: 'Cup', mrp: '45', subPrice: '42' },
  { id: 4, sku: 'PNR-200', name: 'Paneer 200g', unit: 'Pack', mrp: '120', subPrice: '115' },
]

const cellInput =
  'w-full rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-sm focus:border-[#004080] focus:outline-none focus:ring-1 focus:ring-[#004080]/30'
const mono = `${cellInput} font-mono`

export default function ProductPricing() {
  const [rows, setRows] = useState(initialRows)

  function updateRow(id, field, value) {
    setRows((r) => r.map((row) => (row.id === id ? { ...row, [field]: value } : row)))
  }

  function addRow() {
    const nextId = Math.max(0, ...rows.map((r) => r.id)) + 1
    setRows((r) => [...r, { id: nextId, sku: '', name: '', unit: '', mrp: '', subPrice: '' }])
  }

  function removeRow(id) {
    setRows((r) => r.filter((row) => row.id !== id))
  }

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-bold text-slate-900">Product pricing</h3>
        <p className="mt-1 text-sm text-slate-600">
          MRP for retail reference and subscription / wallet debit price per SKU.
        </p>
      </div>

      <div className="overflow-hidden rounded-xl border border-slate-200 shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[800px] text-left text-sm">
            <thead>
              <tr className="bg-sky-50/90 text-xs font-bold uppercase tracking-wide text-sky-900/85">
                <th className="px-3 py-3">SKU</th>
                <th className="px-3 py-3">Product name</th>
                <th className="px-3 py-3">Unit</th>
                <th className="px-3 py-3">MRP (₹)</th>
                <th className="px-3 py-3">Subscription price (₹)</th>
                <th className="w-14 px-3 py-3" aria-label="Actions" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {rows.map((row) => (
                <tr key={row.id} className="hover:bg-slate-50/80">
                  <td className="px-3 py-2">
                    <input className={mono} value={row.sku} onChange={(e) => updateRow(row.id, 'sku', e.target.value)} />
                  </td>
                  <td className="px-3 py-2">
                    <input className={cellInput} value={row.name} onChange={(e) => updateRow(row.id, 'name', e.target.value)} />
                  </td>
                  <td className="px-3 py-2">
                    <input className={cellInput} value={row.unit} onChange={(e) => updateRow(row.id, 'unit', e.target.value)} />
                  </td>
                  <td className="px-3 py-2">
                    <input className={mono} value={row.mrp} onChange={(e) => updateRow(row.id, 'mrp', e.target.value)} />
                  </td>
                  <td className="px-3 py-2">
                    <input className={mono} value={row.subPrice} onChange={(e) => updateRow(row.id, 'subPrice', e.target.value)} />
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
          Add product
        </button>
        <button
          type="button"
          className="rounded-xl bg-[#004080] px-5 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-[#003366]"
        >
          Save pricing
        </button>
      </div>
    </div>
  )
}
