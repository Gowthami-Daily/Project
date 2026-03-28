import OpexPage from '../ledger/OpexPage.jsx'

export default function FinanceExpensesPage() {
  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-slate-200 bg-slate-50/80 p-4 text-sm text-slate-700">
        <p className="font-semibold text-slate-900">Expense categories</p>
        <p className="mt-1">
          Fuel · Salary · Maintenance · Electricity · Packing material · Rent · Office · Misc — map to{' '}
          <code className="rounded bg-white px-1">expense_categories</code> / chart of accounts.
        </p>
      </div>
      <OpexPage />
    </div>
  )
}
