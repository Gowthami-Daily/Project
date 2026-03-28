import { theadRow, tableScroll, tableWrap } from './tableStyles.js'

const rows = [
  {
    name: 'Raw milk tank A',
    cap: '5,000 L',
    level: '3,420 L (68%)',
    temp: '3.8 °C',
    status: 'OK',
    cleaned: '22 Mar 2026',
  },
  {
    name: 'Raw milk tank B',
    cap: '5,000 L',
    level: '4,100 L (82%)',
    temp: '4.1 °C',
    status: 'Watch',
    cleaned: '20 Mar 2026',
  },
  {
    name: 'Pasteurized buffer T-1',
    cap: '2,000 L',
    level: '890 L',
    temp: '4.0 °C',
    status: 'OK',
    cleaned: '25 Mar 2026',
  },
  {
    name: 'North center tank N1',
    cap: '1,500 L',
    level: '1,100 L',
    temp: '3.6 °C',
    status: 'OK',
    cleaned: '18 Mar 2026',
  },
]

function statusPill(status) {
  const map = {
    OK: 'bg-emerald-100 text-emerald-800 ring-emerald-200/80',
    Watch: 'bg-amber-100 text-amber-900 ring-amber-200/80',
    Critical: 'bg-red-100 text-red-800 ring-red-200/80',
  }
  return map[status] || map.OK
}

export default function AssetsTanksPage() {
  return (
    <div className="space-y-4">
      <p className="text-sm text-slate-500">
        Cold-chain storage assets (distinct from inflow inventory tanks if you split domains in API).
      </p>
      <div className={tableWrap}>
        <div className={tableScroll}>
          <table className="w-full min-w-[880px] text-left text-sm">
            <thead>
              <tr className={theadRow}>
                <th className="px-4 py-3">Tank name</th>
                <th className="px-4 py-3">Capacity</th>
                <th className="px-4 py-3">Current level</th>
                <th className="px-4 py-3">Temperature</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Last cleaned</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {rows.map((r) => (
                <tr key={r.name} className="hover:bg-slate-50/80">
                  <td className="px-4 py-3 font-semibold text-slate-900">{r.name}</td>
                  <td className="px-4 py-3 font-mono tabular-nums text-slate-600">{r.cap}</td>
                  <td className="px-4 py-3 font-mono tabular-nums text-slate-800">{r.level}</td>
                  <td className="px-4 py-3 font-mono tabular-nums">{r.temp}</td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ${statusPill(r.status)}`}>
                      {r.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-slate-600">{r.cleaned}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
