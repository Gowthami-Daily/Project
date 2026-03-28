import { theadRow, tableScroll, tableWrap } from './cattleTableStyles.js'

const rows = [
  { animal: 'C-014', milkIncome: '₹ 10,220', feed: '₹ 4,050', doctor: '₹ 520', profit: '₹ 5,650' },
  { animal: 'C-021', milkIncome: '₹ 9,540', feed: '₹ 3,720', doctor: '₹ 0', profit: '₹ 5,820' },
  { animal: 'B-003', milkIncome: '₹ 8,100', feed: '₹ 4,680', doctor: '₹ 2,000', profit: '₹ 1,420' },
  { animal: 'C-008', milkIncome: '₹ 0', feed: '₹ 3,900', doctor: '₹ 1,050', profit: '₹ −4,950' },
  { animal: 'B-011', milkIncome: '₹ 6,200', feed: '₹ 4,200', doctor: '₹ 3,150', profit: '₹ −1,150' },
]

export default function ProfitReportPage() {
  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-lg font-bold text-slate-900">Profit per animal</h3>
        <p className="text-sm text-slate-500">
          <code className="rounded bg-slate-100 px-1.5 py-0.5 text-xs">Milk income − feed − doctor (± medicine)</code>{' '}
          — highlights stars vs loss animals.
        </p>
      </div>

      <div className={tableWrap}>
        <div className={tableScroll}>
          <table className="min-w-full text-left text-sm">
            <thead className={theadRow}>
              <tr>
                <th className="px-4 py-3">Animal</th>
                <th className="px-4 py-3 text-right">Milk income</th>
                <th className="px-4 py-3 text-right">Feed cost</th>
                <th className="px-4 py-3 text-right">Doctor</th>
                <th className="px-4 py-3 text-right">Profit</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {rows.map((r) => {
                const neg = r.profit.includes('−')
                return (
                  <tr key={r.animal} className="bg-white hover:bg-slate-50/80">
                    <td className="px-4 py-3 font-mono font-bold text-slate-900">{r.animal}</td>
                    <td className="px-4 py-3 text-right font-mono text-emerald-800">{r.milkIncome}</td>
                    <td className="px-4 py-3 text-right font-mono text-amber-900">{r.feed}</td>
                    <td className="px-4 py-3 text-right font-mono text-rose-800">{r.doctor}</td>
                    <td
                      className={`px-4 py-3 text-right font-mono text-lg font-bold ${neg ? 'text-rose-700' : 'text-emerald-800'}`}
                    >
                      {r.profit}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
