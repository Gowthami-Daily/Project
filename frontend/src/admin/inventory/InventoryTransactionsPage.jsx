import { theadRow, tableScroll, tableWrap } from './inventoryTableStyles.js'

const types = [
  'Milk collection',
  'Tank transfer',
  'Production use',
  'Packed',
  'Dispatch',
  'Return',
  'Spoilage',
  'Adjustment',
]

const rows = [
  {
    date: '2026-03-27 05:12',
    item: 'Raw milk',
    type: 'Milk collection',
    qty: '+2,400 L',
    from: 'Farmers / routes',
    to: 'T1 intake',
  },
  {
    date: '2026-03-27 06:40',
    item: 'Raw milk',
    type: 'Tank transfer',
    qty: '1,800 L',
    from: 'T1',
    to: 'Pasteurizer line',
  },
  {
    date: '2026-03-27 07:05',
    item: 'Pasteurized milk',
    type: 'Production use',
    qty: '−2,000 L',
    from: 'Buffer tank',
    to: 'Packing line PB-2',
  },
  {
    date: '2026-03-27 08:22',
    item: 'Cow 500ml',
    type: 'Packed',
    qty: '+3,920 pkt',
    from: 'Packing',
    to: 'FG cold store A',
  },
  {
    date: '2026-03-27 09:15',
    item: 'Mixed SKU',
    type: 'Dispatch',
    qty: '−1,240 eq. L',
    from: 'Cold store A',
    to: 'Vehicle TS09 AB 1122',
  },
  {
    date: '2026-03-27 10:02',
    item: 'Toned 1L',
    type: 'Return',
    qty: '+18 pkt',
    from: 'Route North A',
    to: 'Returns quarantine',
  },
  {
    date: '2026-03-27 11:30',
    item: 'Curd 400g',
    type: 'Spoilage',
    qty: '−24 units',
    from: 'Cold store B',
    to: 'Wastage',
  },
  {
    date: '2026-03-27 14:00',
    item: 'Paneer',
    type: 'Adjustment',
    qty: '−2 kg',
    from: 'System',
    to: 'Physical count',
  },
]

const typeTone = {
  'Milk collection': 'bg-emerald-50 text-emerald-900',
  'Tank transfer': 'bg-sky-50 text-sky-900',
  'Production use': 'bg-indigo-50 text-indigo-900',
  Packed: 'bg-cyan-50 text-cyan-900',
  Dispatch: 'bg-blue-50 text-blue-900',
  Return: 'bg-amber-50 text-amber-900',
  Spoilage: 'bg-rose-50 text-rose-900',
  Adjustment: 'bg-slate-100 text-slate-800',
}

export default function InventoryTransactionsPage() {
  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-lg font-bold text-slate-900">Inventory transactions</h3>
        <p className="text-sm text-slate-500">
          Full movement ledger — source of truth for audits and finance. Types: {types.join(' · ')}.
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        <input
          type="search"
          placeholder="Search item, location…"
          className="min-w-[200px] flex-1 rounded-xl border border-slate-200 px-3 py-2 text-sm shadow-sm"
        />
        <select className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium shadow-sm">
          <option value="">All types</option>
          {types.map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </select>
        <button
          type="button"
          className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 shadow-sm hover:bg-slate-50"
        >
          Export CSV
        </button>
      </div>

      <div className={tableWrap}>
        <div className={tableScroll}>
          <table className="min-w-full text-left text-sm">
            <thead className={theadRow}>
              <tr>
                <th className="px-4 py-3">Date / time</th>
                <th className="px-4 py-3">Item</th>
                <th className="px-4 py-3">Type</th>
                <th className="px-4 py-3">Qty</th>
                <th className="px-4 py-3">From</th>
                <th className="px-4 py-3">To</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {rows.map((r, i) => (
                <tr key={`${r.date}-${i}`} className="bg-white hover:bg-slate-50/80">
                  <td className="whitespace-nowrap px-4 py-3 font-mono text-xs text-slate-700">{r.date}</td>
                  <td className="px-4 py-3 font-medium text-slate-900">{r.item}</td>
                  <td className="px-4 py-3">
                    <span
                      className={`inline-flex rounded-lg px-2 py-1 text-xs font-semibold ${typeTone[r.type] || 'bg-slate-100'}`}
                    >
                      {r.type}
                    </span>
                  </td>
                  <td className="px-4 py-3 tabular-nums font-semibold text-slate-800">{r.qty}</td>
                  <td className="max-w-[160px] px-4 py-3 text-slate-600">{r.from}</td>
                  <td className="max-w-[160px] px-4 py-3 text-slate-600">{r.to}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
