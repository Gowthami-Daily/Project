import { theadRow, tableWrap } from './tableStyles.js'

const assets = [
  ['Cash in hand', '₹48,200'],
  ['Bank balances', '₹12,40,000'],
  ['Inventory (milk & products)', '₹3,20,000'],
  ['Vehicles (net)', '₹18,50,000'],
  ['Machinery (net)', '₹42,00,000'],
]

const liabilities = [
  ['Farmer payable', '₹4,50,000'],
  ['Customer wallet (liability)', '₹3,20,000'],
  ['Staff advances (recoverable asset / contra per policy)', '₹1,10,000'],
  ['Term loan', '₹8,00,000'],
]

function SideTable({ title, rows, totalLabel, accent }) {
  const sum = rows.reduce((acc, [, v]) => {
    const n = Number(v.replace(/[₹,]/g, ''))
    return acc + n
  }, 0)
  const fmt = new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(sum)

  return (
    <div className={tableWrap}>
      <div className="border-b border-slate-100 px-4 py-3">
        <h3 className={`text-sm font-bold ${accent}`}>{title}</h3>
      </div>
      <table className="w-full text-sm">
        <thead>
          <tr className={theadRow}>
            <th className="px-4 py-2 text-left">Item</th>
            <th className="px-4 py-2 text-right">Amount</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {rows.map(([k, v]) => (
            <tr key={k} className="hover:bg-slate-50/80">
              <td className="px-4 py-2.5 text-slate-700">{k}</td>
              <td className="px-4 py-2.5 text-right font-mono font-semibold tabular-nums">{v}</td>
            </tr>
          ))}
          <tr className="bg-sky-50/50 font-bold">
            <td className="px-4 py-3">{totalLabel}</td>
            <td className="px-4 py-3 text-right font-mono text-[#004080]">{fmt}</td>
          </tr>
        </tbody>
      </table>
    </div>
  )
}

export default function BalanceSheetPage() {
  return (
    <div className="space-y-6">
      <p className="text-sm text-slate-600">
        Snapshot from <code className="rounded bg-slate-100 px-1">accounts</code> &amp; sub-ledgers. Align staff advances with your
        accounting policy (asset vs contra-liability).
      </p>
      <div className="grid gap-6 lg:grid-cols-2">
        <SideTable title="Assets" rows={assets} totalLabel="Total assets" accent="text-emerald-800" />
        <SideTable title="Liabilities" rows={liabilities} totalLabel="Total liabilities" accent="text-rose-800" />
      </div>
    </div>
  )
}
