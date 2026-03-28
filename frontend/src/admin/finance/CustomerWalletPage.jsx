import WalletsPage from '../ledger/WalletsPage.jsx'
import { theadRow, tableScroll, tableWrap } from './tableStyles.js'

/** Demo ledger rows — production: customer_wallet_ledger */
const ledgerRows = [
  { date: '27 Mar 2026', customer: 'Ramesh (C2001)', type: 'Delivery deduction', amount: '−₹60', balance: '₹1,940' },
  { date: '27 Mar 2026', customer: 'Lakshmi (C3002)', type: 'Recharge', amount: '+₹2,000', balance: '₹3,450' },
  { date: '26 Mar 2026', customer: 'Lakshmi (C3002)', type: 'Delivery deduction', amount: '−₹52', balance: '₹1,450' },
  { date: '26 Mar 2026', customer: 'Sridevi (C3010)', type: 'Refund', amount: '+₹120', balance: '₹890' },
  { date: '25 Mar 2026', customer: 'Ramesh (C2001)', type: 'Adjustment', amount: '+₹40', balance: '₹2,000' },
  { date: '25 Mar 2026', customer: 'Ramesh (C2001)', type: 'Recharge', amount: '+₹2,000', balance: '₹1,960' },
]

function typePill(t) {
  if (t.includes('Recharge')) return 'bg-emerald-100 text-emerald-800 ring-emerald-200/80'
  if (t.includes('deduction')) return 'bg-sky-100 text-sky-900 ring-sky-200/80'
  if (t.includes('Refund')) return 'bg-violet-100 text-violet-900 ring-violet-200/80'
  return 'bg-amber-100 text-amber-900 ring-amber-200/80'
}

export default function CustomerWalletPage() {
  return (
    <div className="space-y-8">
      <div>
        <h3 className="text-lg font-bold text-slate-900">Customer wallet ledger</h3>
        <p className="mt-1 text-sm text-slate-600">
          Every movement is a line — recharge, delivery debit, refund, adjustment. Types:{' '}
          <strong>Recharge</strong>, <strong>Delivery deduction</strong>, <strong>Refund</strong>, <strong>Adjustment</strong>.
        </p>
      </div>

      <div className={tableWrap}>
        <div className={tableScroll}>
          <table className="w-full min-w-[720px] text-left text-sm">
            <thead>
              <tr className={theadRow}>
                <th className="px-4 py-3">Date</th>
                <th className="px-4 py-3">Customer</th>
                <th className="px-4 py-3">Transaction type</th>
                <th className="px-4 py-3">Amount</th>
                <th className="px-4 py-3">Running balance</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {ledgerRows.map((r, i) => (
                <tr key={i} className="hover:bg-slate-50/80">
                  <td className="px-4 py-3 text-slate-600">{r.date}</td>
                  <td className="px-4 py-3 font-medium text-slate-900">{r.customer}</td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ${typePill(r.type)}`}>
                      {r.type}
                    </span>
                  </td>
                  <td className="px-4 py-3 font-mono font-semibold tabular-nums">{r.amount}</td>
                  <td className="px-4 py-3 font-mono font-bold tabular-nums text-[#004080]">{r.balance}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50/50 p-4">
        <h4 className="text-sm font-bold text-slate-800">Live wallet float &amp; top-up reconciliation</h4>
        <p className="mt-1 text-xs text-slate-600">Connected to existing FastAPI ledger routes below.</p>
        <div className="mt-4 rounded-xl border border-slate-200 bg-white p-4">
          <WalletsPage />
        </div>
      </div>
    </div>
  )
}
