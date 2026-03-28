import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { theadRow, tableWrap } from './tableStyles.js'

const summary = [
  { label: 'Cash in (collections + recharges)', value: '₹8,42,000' },
  { label: 'Cash out (payments + expenses)', value: '₹6,18,400' },
  { label: 'Net cash movement', value: '₹2,23,600' },
]

const monthly = [
  { m: 'Jan', inn: 720, out: 610 },
  { m: 'Feb', inn: 740, out: 625 },
  { m: 'Mar', inn: 780, out: 640 },
]

export default function CashFlowPage() {
  return (
    <div className="space-y-8">
      <div className="grid gap-4 sm:grid-cols-3">
        {summary.map((s) => (
          <div key={s.label} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <p className="text-xs font-semibold uppercase text-slate-500">{s.label}</p>
            <p className="mt-2 font-mono text-xl font-bold text-[#004080]">{s.value}</p>
          </div>
        ))}
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <h3 className="text-sm font-bold text-slate-900">Operating cash flow</h3>
        <p className="text-xs text-slate-500">₹ Thousands · demo</p>
        <div className="mt-4 h-[280px]">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={monthly} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis dataKey="m" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip />
              <Legend />
              <Bar dataKey="inn" name="Cash in" fill="#16a34a" radius={[6, 6, 0, 0]} />
              <Bar dataKey="out" name="Cash out" fill="#f97316" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className={tableWrap}>
        <table className="w-full text-sm">
          <thead>
            <tr className={theadRow}>
              <th className="px-4 py-3 text-left">Type</th>
              <th className="px-4 py-3 text-right">Amount (demo)</th>
            </tr>
          </thead>
          <tbody>
            <tr className="border-t border-slate-100">
              <td className="px-4 py-3 font-medium text-emerald-800">Cash in</td>
              <td className="px-4 py-3 text-right font-mono font-bold">₹8,42,000</td>
            </tr>
            <tr className="border-t border-slate-100">
              <td className="px-4 py-3 font-medium text-orange-800">Cash out</td>
              <td className="px-4 py-3 text-right font-mono font-bold">₹6,18,400</td>
            </tr>
            <tr className="border-t border-slate-200 bg-sky-50/50 font-bold">
              <td className="px-4 py-3">Net cash</td>
              <td className="px-4 py-3 text-right font-mono text-[#004080]">₹2,23,600</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  )
}
