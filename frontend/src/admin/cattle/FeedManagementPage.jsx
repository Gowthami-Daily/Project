import { useMemo } from 'react'
import { theadRow, tableScroll, tableWrap } from './cattleTableStyles.js'

const feedTypes = [
  { name: 'Dry fodder', unit: 'Kg' },
  { name: 'Green fodder', unit: 'Kg' },
  { name: 'Concentrate', unit: 'Kg' },
  { name: 'Mineral mix', unit: 'Grams' },
  { name: 'Silage', unit: 'Kg' },
]

/** ₹ per kg; mineral priced per kg (grams converted) */
const unitPrices = {
  dry: 8,
  green: 4,
  conc: 25,
  mineralPerKg: 100,
  silage: 6,
}

const plans = [
  { animal: 'C-014', dry: 5, green: 10, conc: 2, mineralG: 50, silage: 0 },
  { animal: 'B-003', dry: 6, green: 12, conc: 2.5, mineralG: 60, silage: 2 },
  { animal: 'C-021', dry: 4, green: 8, conc: 1.8, mineralG: 45, silage: 0 },
]

function dailyCost(row) {
  const dry = row.dry * unitPrices.dry
  const green = row.green * unitPrices.green
  const conc = row.conc * unitPrices.conc
  const mineral = (row.mineralG / 1000) * unitPrices.mineralPerKg
  const sil = row.silage * unitPrices.silage
  return Math.round((dry + green + conc + mineral + sil) * 100) / 100
}

const exampleBreakdown = [
  { feed: 'Dry fodder', qtyDay: '5 kg', priceKg: '₹8', costDay: 40 },
  { feed: 'Green fodder', qtyDay: '10 kg', priceKg: '₹4', costDay: 40 },
  { feed: 'Concentrate', qtyDay: '2 kg', priceKg: '₹25', costDay: 50 },
  { feed: 'Mineral mix', qtyDay: '50 g', priceKg: '₹100/kg', costDay: 5 },
]

export default function FeedManagementPage() {
  const exampleTotalDay = useMemo(() => exampleBreakdown.reduce((s, r) => s + r.costDay, 0), [])
  const exampleMonth = exampleTotalDay * 30

  return (
    <div className="space-y-8">
      <div>
        <h3 className="text-lg font-bold text-slate-900">Feed management</h3>
        <p className="text-sm text-slate-500">
          Daily rations drive <strong className="text-slate-800">feed cost per liter</strong> and margin per animal.
        </p>
      </div>

      <div>
        <h4 className="mb-2 text-sm font-bold text-slate-800">Feed types</h4>
        <div className="flex flex-wrap gap-2">
          {feedTypes.map((f) => (
            <span
              key={f.name}
              className="rounded-full bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-900 ring-1 ring-amber-200"
            >
              {f.name} · {f.unit}
            </span>
          ))}
        </div>
      </div>

      <div>
        <h4 className="mb-3 text-sm font-bold text-slate-800">Feed plan per animal (daily)</h4>
        <div className={tableWrap}>
          <div className={tableScroll}>
            <table className="min-w-full text-left text-sm">
              <thead className={theadRow}>
                <tr>
                  <th className="px-4 py-3">Animal</th>
                  <th className="px-4 py-3 text-right">Dry (kg)</th>
                  <th className="px-4 py-3 text-right">Green (kg)</th>
                  <th className="px-4 py-3 text-right">Conc. (kg)</th>
                  <th className="px-4 py-3 text-right">Mineral (g)</th>
                  <th className="px-4 py-3 text-right">Silage (kg)</th>
                  <th className="px-4 py-3 text-right">₹ / day</th>
                  <th className="px-4 py-3 text-right">₹ / month (30d)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {plans.map((p) => {
                  const d = dailyCost(p)
                  return (
                    <tr key={p.animal} className="bg-white hover:bg-slate-50/80">
                      <td className="px-4 py-3 font-mono font-bold text-slate-900">{p.animal}</td>
                      <td className="px-4 py-3 text-right tabular-nums">{p.dry}</td>
                      <td className="px-4 py-3 text-right tabular-nums">{p.green}</td>
                      <td className="px-4 py-3 text-right tabular-nums">{p.conc}</td>
                      <td className="px-4 py-3 text-right tabular-nums">{p.mineralG}</td>
                      <td className="px-4 py-3 text-right tabular-nums">{p.silage}</td>
                      <td className="px-4 py-3 text-right tabular-nums font-semibold text-amber-800">₹{d}</td>
                      <td className="px-4 py-3 text-right tabular-nums font-bold text-slate-900">
                        ₹{(d * 30).toLocaleString('en-IN')}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <div>
        <h4 className="mb-3 text-sm font-bold text-slate-800">Monthly feed cost example (one animal)</h4>
        <div className={tableWrap}>
          <div className={tableScroll}>
            <table className="min-w-full text-left text-sm">
              <thead className={theadRow}>
                <tr>
                  <th className="px-4 py-3">Feed</th>
                  <th className="px-4 py-3">Qty / day</th>
                  <th className="px-4 py-3">Price</th>
                  <th className="px-4 py-3 text-right">Cost / day</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {exampleBreakdown.map((r) => (
                  <tr key={r.feed} className="bg-white">
                    <td className="px-4 py-3 font-medium text-slate-900">{r.feed}</td>
                    <td className="px-4 py-3 text-slate-700">{r.qtyDay}</td>
                    <td className="px-4 py-3 text-slate-600">{r.priceKg}</td>
                    <td className="px-4 py-3 text-right font-mono font-semibold text-slate-800">₹{r.costDay}</td>
                  </tr>
                ))}
                <tr className="bg-emerald-50 font-bold">
                  <td className="px-4 py-3 text-emerald-950" colSpan={3}>
                    Total / day
                  </td>
                  <td className="px-4 py-3 text-right font-mono text-emerald-950">₹{exampleTotalDay}</td>
                </tr>
                <tr className="bg-emerald-100/80 font-bold">
                  <td className="px-4 py-3 text-emerald-950" colSpan={3}>
                    × 30 days
                  </td>
                  <td className="px-4 py-3 text-right font-mono text-emerald-950">₹{exampleMonth.toLocaleString('en-IN')}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
        <p className="mt-2 text-xs text-slate-500">
          Feed cost per liter = (daily feed ₹) ÷ (daily milk L) — computed in profit view when yield is linked.
        </p>
      </div>
    </div>
  )
}
