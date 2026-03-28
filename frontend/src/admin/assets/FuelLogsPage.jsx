import { theadRow, tableScroll, tableWrap } from './tableStyles.js'

const rows = [
  { date: '27 Mar 2026', vehicle: 'AP-XX-1234', liters: '4.2', ppl: '₹98.50', total: '₹413.70', driver: 'Raju K.' },
  { date: '27 Mar 2026', vehicle: 'AP-YY-5678', liters: '12.0', ppl: '₹97.20', total: '₹1,166.40', driver: 'Satyam N.' },
  { date: '26 Mar 2026', vehicle: 'AP-ZZ-9012', liters: '3.8', ppl: '₹98.10', total: '₹372.78', driver: 'Ravi T.' },
  { date: '26 Mar 2026', vehicle: 'AP-11-4455', liters: '45.0', ppl: '₹96.80', total: '₹4,356.00', driver: 'Hub pool' },
  { date: '25 Mar 2026', vehicle: 'AP-XX-1234', liters: '4.0', ppl: '₹97.90', total: '₹391.60', driver: 'Raju K.' },
]

export default function FuelLogsPage() {
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        <span className="rounded-full bg-[#004080]/10 px-3 py-1 text-xs font-semibold text-[#004080]">This month</span>
        <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">Export CSV</span>
      </div>
      <div className={tableWrap}>
        <div className={tableScroll}>
          <table className="w-full min-w-[800px] text-left text-sm">
            <thead>
              <tr className={theadRow}>
                <th className="px-4 py-3">Date</th>
                <th className="px-4 py-3">Vehicle</th>
                <th className="px-4 py-3">Liters</th>
                <th className="px-4 py-3">Price / liter</th>
                <th className="px-4 py-3">Total cost</th>
                <th className="px-4 py-3">Driver</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {rows.map((r, i) => (
                <tr key={`${r.date}-${r.vehicle}-${i}`} className="hover:bg-slate-50/80">
                  <td className="px-4 py-3 text-slate-700">{r.date}</td>
                  <td className="px-4 py-3 font-mono font-semibold text-[#004080]">{r.vehicle}</td>
                  <td className="px-4 py-3 font-mono tabular-nums">{r.liters}</td>
                  <td className="px-4 py-3 font-mono tabular-nums text-slate-600">{r.ppl}</td>
                  <td className="px-4 py-3 font-mono font-semibold tabular-nums text-emerald-800">{r.total}</td>
                  <td className="px-4 py-3 font-medium text-slate-800">{r.driver}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
