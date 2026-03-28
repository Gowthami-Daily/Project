import { theadRow, tableScroll, tableWrap } from './inflowTableStyles.js'

const rows = [
  {
    farmer: 'F-1001 · G. Venkata Raju',
    fat: '6.2',
    snf: '8.5',
    water: 'No',
    clr: '28.4',
    smell: 'OK',
    result: 'Pass',
  },
  {
    farmer: 'F-1002 · K. Lakshmi',
    fat: '4.0',
    snf: '8.2',
    water: 'No',
    clr: '27.9',
    smell: 'OK',
    result: 'Pass',
  },
  {
    farmer: 'F-1003 · P. Krishna',
    fat: '5.8',
    snf: '7.9',
    water: 'Yes',
    clr: '26.1',
    smell: 'Bad',
    result: 'Reject',
  },
]

export default function InflowQualityPage() {
  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-lg font-bold text-slate-900">Quality testing</h3>
        <p className="text-sm text-slate-500">
          Gate before bulk storage — <strong className="font-semibold text-rose-700">rejected milk must not go to tank</strong>.
        </p>
      </div>

      <div className={tableWrap}>
        <div className={tableScroll}>
          <table className="min-w-full text-left text-sm">
            <thead className={theadRow}>
              <tr>
                <th className="px-4 py-3">Farmer</th>
                <th className="px-4 py-3 text-right">Fat %</th>
                <th className="px-4 py-3 text-right">SNF %</th>
                <th className="px-4 py-3">Water</th>
                <th className="px-4 py-3 text-right">CLR</th>
                <th className="px-4 py-3">Smell</th>
                <th className="px-4 py-3">Result</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {rows.map((r) => (
                <tr key={r.farmer} className="bg-white hover:bg-slate-50/80">
                  <td className="max-w-[220px] px-4 py-3 text-slate-800">{r.farmer}</td>
                  <td className="px-4 py-3 text-right tabular-nums font-medium">{r.fat}</td>
                  <td className="px-4 py-3 text-right tabular-nums font-medium">{r.snf}</td>
                  <td className="px-4 py-3">
                    <span
                      className={`rounded-full px-2 py-1 text-xs font-bold ${
                        r.water === 'Yes' ? 'bg-rose-100 text-rose-800' : 'bg-emerald-100 text-emerald-800'
                      }`}
                    >
                      {r.water}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums text-slate-700">{r.clr}</td>
                  <td className="px-4 py-3">
                    <span
                      className={`rounded-full px-2 py-1 text-xs font-bold ${
                        r.smell === 'OK' ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'
                      }`}
                    >
                      {r.smell}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`rounded-full px-2.5 py-1 text-xs font-bold ${
                        r.result === 'Pass' ? 'bg-emerald-100 text-emerald-900' : 'bg-rose-100 text-rose-900'
                      }`}
                    >
                      {r.result}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <button
        type="button"
        className="min-h-[44px] rounded-xl bg-[#004080] px-5 text-sm font-semibold text-white hover:bg-[#003366]"
      >
        + Log test result
      </button>
    </div>
  )
}
