import ScalingPage from '../ledger/ScalingPage.jsx'
import { theadRow, tableWrap } from './tableStyles.js'

const milkSale = [
  { account: 'Customer wallet', dr: '100', cr: '—' },
  { account: 'Sales — subscription', dr: '—', cr: '100' },
]

const fuel = [
  { account: 'Fuel expense', dr: '500', cr: '—' },
  { account: 'Cash', dr: '—', cr: '500' },
]

export default function FinanceReportsPage() {
  return (
    <div className="space-y-10">
      <div>
        <h3 className="text-lg font-bold text-slate-900">Double-entry journal (examples)</h3>
        <p className="mt-1 text-sm text-slate-600">
          Every business event posts <strong>debit = credit</strong> via <code className="rounded bg-slate-100 px-1">journal_entries</code>{' '}
          + <code className="rounded bg-slate-100 px-1">journal_lines</code>.
        </p>

        <div className="mt-4 grid gap-6 lg:grid-cols-2">
          <div className={tableWrap}>
            <div className="border-b border-slate-100 px-4 py-2 text-xs font-bold uppercase text-slate-600">
              Milk sale ₹100 (wallet debit)
            </div>
            <table className="w-full text-sm">
              <thead>
                <tr className={theadRow}>
                  <th className="px-3 py-2 text-left">Account</th>
                  <th className="px-3 py-2 text-right">Debit</th>
                  <th className="px-3 py-2 text-right">Credit</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {milkSale.map((r) => (
                  <tr key={r.account}>
                    <td className="px-3 py-2">{r.account}</td>
                    <td className="px-3 py-2 text-right font-mono">{r.dr}</td>
                    <td className="px-3 py-2 text-right font-mono">{r.cr}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className={tableWrap}>
            <div className="border-b border-slate-100 px-4 py-2 text-xs font-bold uppercase text-slate-600">
              Fuel expense ₹500
            </div>
            <table className="w-full text-sm">
              <thead>
                <tr className={theadRow}>
                  <th className="px-3 py-2 text-left">Account</th>
                  <th className="px-3 py-2 text-right">Debit</th>
                  <th className="px-3 py-2 text-right">Credit</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {fuel.map((r) => (
                  <tr key={r.account}>
                    <td className="px-3 py-2">{r.account}</td>
                    <td className="px-3 py-2 text-right font-mono">{r.dr}</td>
                    <td className="px-3 py-2 text-right font-mono">{r.cr}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <div>
        <h3 className="mb-2 text-lg font-bold text-slate-900">Scaling &amp; analytics</h3>
        <p className="mb-4 text-sm text-slate-600">Existing ledger analytics (FastAPI) below.</p>
        <div className="rounded-2xl border border-slate-200 bg-white p-4">
          <ScalingPage />
        </div>
      </div>
    </div>
  )
}
