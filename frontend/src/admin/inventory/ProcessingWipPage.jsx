import { theadRow, tableScroll, tableWrap } from './inventoryTableStyles.js'

const statusTone = {
  Running: 'bg-sky-100 text-sky-900 ring-sky-200',
  Holding: 'bg-amber-100 text-amber-900 ring-amber-200',
  Complete: 'bg-emerald-100 text-emerald-900 ring-emerald-200',
  QA: 'bg-violet-100 text-violet-900 ring-violet-200',
}

const rows = [
  {
    batch: 'PB-2026-0312',
    stage: 'Pasteurization',
    input: '4,200 L raw',
    output: '4,050 L pasteurized',
    loss: '150 L',
    status: 'Running',
  },
  {
    batch: 'PK-2026-0881',
    stage: 'Packing · 500ml',
    input: '2,000 L',
    output: '3,920 packs',
    loss: '40 L',
    status: 'Running',
  },
  {
    batch: 'CD-2026-0044',
    stage: 'Curd making',
    input: '800 L',
    output: '—',
    loss: '12 L',
    status: 'Holding',
  },
  {
    batch: 'PN-2026-0019',
    stage: 'Paneer',
    input: '600 L',
    output: '58 kg',
    loss: '8 L eq.',
    status: 'QA',
  },
  {
    batch: 'GH-2026-0007',
    stage: 'Ghee',
    input: '180 kg butter oil',
    output: '155 L ghee',
    loss: '4 L eq.',
    status: 'Complete',
  },
]

const stages = ['Pasteurization', 'Packing', 'Curd making', 'Paneer making', 'Ghee making']

export default function ProcessingWipPage() {
  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-lg font-bold text-slate-900">Processing / WIP</h3>
        <p className="text-sm text-slate-500">
          Milk in process: {stages.join(' · ')} — batches bridge tanks and finished SKU stock.
        </p>
      </div>

      <div className={tableWrap}>
        <div className={tableScroll}>
          <table className="min-w-full text-left text-sm">
            <thead className={theadRow}>
              <tr>
                <th className="px-4 py-3">Batch</th>
                <th className="px-4 py-3">Stage</th>
                <th className="px-4 py-3">Input milk / material</th>
                <th className="px-4 py-3">Output product</th>
                <th className="px-4 py-3">Loss</th>
                <th className="px-4 py-3">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {rows.map((r) => (
                <tr key={r.batch} className="bg-white hover:bg-slate-50/80">
                  <td className="px-4 py-3 font-mono text-xs font-semibold text-slate-800">{r.batch}</td>
                  <td className="px-4 py-3 font-medium text-slate-900">{r.stage}</td>
                  <td className="px-4 py-3 text-slate-700">{r.input}</td>
                  <td className="px-4 py-3 text-slate-700">{r.output}</td>
                  <td className="px-4 py-3 tabular-nums text-amber-800">{r.loss}</td>
                  <td className="px-4 py-3">
                    <span
                      className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ${statusTone[r.status]}`}
                    >
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
