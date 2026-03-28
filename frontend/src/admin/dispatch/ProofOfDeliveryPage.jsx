import { CheckBadgeIcon } from '@heroicons/react/24/solid'
import { theadRow, tableScroll, tableWrap } from './dispatchTableStyles.js'

const methods = [
  { name: 'OTP', enabled: true },
  { name: 'Photo', enabled: true },
  { name: 'Signature', enabled: true },
]

const rows = [
  { time: '06:42', customer: 'Lakshmi Reddy', status: 'Delivered', otp: true, photo: true, sig: true },
  { time: '07:05', customer: 'Venkatesh K', status: 'Delivered', otp: true, photo: false, sig: true },
  { time: '07:18', customer: 'Priya Sharma', status: 'Delivered', otp: false, photo: true, sig: false },
  { time: '08:02', customer: 'Ramesh Iyer', status: 'Missed', otp: false, photo: false, sig: false },
]

function yesNo(v) {
  return v ? (
    <span className="inline-flex items-center gap-1 text-emerald-700">
      <CheckBadgeIcon className="h-4 w-4" aria-hidden />
      Yes
    </span>
  ) : (
    <span className="text-slate-400">—</span>
  )
}

export default function ProofOfDeliveryPage() {
  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-lg font-bold text-slate-900">Proof of delivery</h3>
        <p className="text-sm text-slate-500">OTP, photo, and signature capture per stop (configuration + audit).</p>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        {methods.map((m) => (
          <div
            key={m.name}
            className="flex items-center justify-between rounded-2xl border border-slate-200 bg-white px-4 py-3 shadow-sm"
          >
            <span className="text-sm font-bold text-slate-900">{m.name}</span>
            <span className="rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-bold text-emerald-800">
              Required
            </span>
          </div>
        ))}
      </div>

      <div className={tableWrap}>
        <div className={tableScroll}>
          <table className="min-w-full text-left text-sm">
            <thead className={theadRow}>
              <tr>
                <th className="px-4 py-3">Time</th>
                <th className="px-4 py-3">Customer</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">OTP</th>
                <th className="px-4 py-3">Photo</th>
                <th className="px-4 py-3">Signature</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {rows.map((r) => (
                <tr key={r.time + r.customer} className="bg-white hover:bg-slate-50/80">
                  <td className="px-4 py-3 font-mono text-xs text-slate-700">{r.time}</td>
                  <td className="px-4 py-3 font-medium text-slate-900">{r.customer}</td>
                  <td className="px-4 py-3">
                    <span
                      className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ${
                        r.status === 'Delivered'
                          ? 'bg-emerald-100 text-emerald-900 ring-emerald-200'
                          : 'bg-rose-100 text-rose-900 ring-rose-200'
                      }`}
                    >
                      {r.status}
                    </span>
                  </td>
                  <td className="px-4 py-3">{yesNo(r.otp)}</td>
                  <td className="px-4 py-3">{yesNo(r.photo)}</td>
                  <td className="px-4 py-3">{yesNo(r.sig)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
