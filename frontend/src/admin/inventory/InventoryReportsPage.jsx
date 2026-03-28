import { ArrowDownTrayIcon } from '@heroicons/react/24/outline'

const reports = [
  { name: 'Stock report', purpose: 'Current on-hand by SKU and location' },
  { name: 'Tank report', purpose: 'Raw milk levels, temps, and utilization' },
  { name: 'Spoilage report', purpose: 'Loss by reason, product, and cost' },
  { name: 'Production report', purpose: 'Batch output, yield, and WIP aging' },
  { name: 'Dispatch report', purpose: 'Outflow vs plan — ties to dispatch module' },
  { name: 'Stock value', purpose: 'Valuation and movement for finance' },
]

export default function InventoryReportsPage() {
  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-lg font-bold text-slate-900">Inventory reports</h3>
        <p className="text-sm text-slate-500">Warehouse-style exports for ops review and month-end.</p>
      </div>

      <ul className="grid gap-3 sm:grid-cols-2">
        {reports.map((r) => (
          <li
            key={r.name}
            className="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:flex-row sm:items-center sm:justify-between"
          >
            <div>
              <p className="font-bold text-slate-900">{r.name}</p>
              <p className="mt-1 text-sm text-slate-500">{r.purpose}</p>
            </div>
            <button
              type="button"
              className="inline-flex shrink-0 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-semibold text-slate-800 hover:bg-slate-100"
            >
              <ArrowDownTrayIcon className="h-4 w-4" aria-hidden />
              Export
            </button>
          </li>
        ))}
      </ul>
    </div>
  )
}
