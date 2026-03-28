export default function CustomerReportsPage() {
  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[
          ['Churn report', 'Last 90 days'],
          ['Wallet liability', 'By branch'],
          ['Subscription mix', 'SKU × schedule'],
          ['NPS / CSAT', 'Post-delivery survey'],
        ].map(([t, s]) => (
          <div key={t} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <p className="text-sm font-bold text-slate-900">{t}</p>
            <p className="mt-1 text-xs text-slate-500">{s}</p>
            <button type="button" className="mt-3 text-sm font-semibold text-[#004080] hover:underline">
              Export CSV
            </button>
          </div>
        ))}
      </div>
      <div className="rounded-2xl border border-slate-200 bg-slate-50/80 p-6 text-sm text-slate-700">
        <p className="font-semibold text-slate-900">Scheduled reports</p>
        <p className="mt-2">
          Connect to email / S3 exports — daily delivery exceptions, weekly wallet float, monthly churn. Align with finance close calendar.
        </p>
      </div>
    </div>
  )
}
