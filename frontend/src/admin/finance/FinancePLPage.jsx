import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import OverviewPage from '../ledger/OverviewPage.jsx'

const plBars = [
  { name: 'Revenue', amt: 485 },
  { name: 'COGS', amt: -310 },
  { name: 'OpEx', amt: -85 },
  { name: 'Net', amt: 90 },
]

export default function FinancePLPage() {
  return (
    <div className="space-y-8">
      <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
        <h3 className="text-sm font-bold text-slate-900">P&amp;L bridge (₹ thousands · demo)</h3>
        <p className="text-xs text-slate-500">Visual summary — detailed lines come from GL / API below.</p>
        <div className="mt-4 h-[240px]">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={plBars} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis dataKey="name" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip formatter={(v) => [`₹${v}k`, '']} />
              <Bar dataKey="amt" fill="#004080" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div>
        <h3 className="mb-2 text-base font-bold text-slate-900">Statement detail (FastAPI)</h3>
        <OverviewPage />
      </div>
    </div>
  )
}
