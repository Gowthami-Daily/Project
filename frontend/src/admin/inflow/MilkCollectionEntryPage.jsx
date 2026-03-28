import { useMemo, useState } from 'react'
import { PrinterIcon } from '@heroicons/react/24/outline'

const farmers = [
  { id: 'F-1001', label: 'F-1001 · G. Venkata Raju' },
  { id: 'F-1002', label: 'F-1002 · K. Lakshmi' },
  { id: 'F-1003', label: 'F-1003 · P. Krishna' },
]

function demoRate(fat, snf, milkType) {
  const base = milkType === 'Buffalo' ? 52 : 48
  const bump = (Number(fat) || 0) * 0.8 + (Number(snf) || 0) * 0.35
  return Math.round((base + bump) * 100) / 100
}

export default function MilkCollectionEntryPage() {
  const today = new Date().toISOString().slice(0, 10)
  const [shift, setShift] = useState('Morning')
  const [farmerId, setFarmerId] = useState('F-1001')
  const [milkType, setMilkType] = useState('Buffalo')
  const [qty, setQty] = useState('12.5')
  const [fat, setFat] = useState('6.2')
  const [snf, setSnf] = useState('8.5')

  const rate = useMemo(() => demoRate(fat, snf, milkType), [fat, snf, milkType])
  const amount = useMemo(() => {
    const q = Number(qty) || 0
    return Math.round(q * rate * 100) / 100
  }, [qty, rate])

  const fieldClass =
    'mt-1 min-h-[52px] w-full rounded-xl border-2 border-slate-200 bg-white px-4 text-lg font-semibold text-slate-900 shadow-sm transition focus:border-[#004080] focus:outline-none focus:ring-4 focus:ring-[#004080]/15'

  const labelClass = 'text-xs font-bold uppercase tracking-wide text-slate-500'

  const resetForNext = () => {
    setQty('')
    setFat('6.0')
    setSnf('8.4')
  }

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-bold text-slate-900">Milk collection entry</h3>
        <p className="text-sm text-slate-500">
          Large touch targets for tablets. Rate sheet from settings; amount auto-calculated. Bluetooth thermal printer
          via browser print / native bridge (wire on integration).
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-5 rounded-2xl border-2 border-slate-200 bg-white p-5 shadow-sm lg:col-span-2">
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className={labelClass} htmlFor="mc-date">
                Date
              </label>
              <input id="mc-date" type="text" readOnly value={today} className={`${fieldClass} bg-slate-50`} />
            </div>
            <div>
              <span className={labelClass}>Shift</span>
              <div className="mt-1 grid grid-cols-2 gap-2">
                {['Morning', 'Evening'].map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => setShift(s)}
                    className={`min-h-[52px] rounded-xl text-base font-bold transition ${
                      shift === s ? 'bg-[#004080] text-white shadow-md' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                    }`}
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div>
            <label className={labelClass} htmlFor="mc-farmer">
              Farmer
            </label>
            <select
              id="mc-farmer"
              value={farmerId}
              onChange={(e) => setFarmerId(e.target.value)}
              className={fieldClass}
            >
              {farmers.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.label}
                </option>
              ))}
            </select>
            <p className="mt-1 text-xs text-slate-400">Replace with barcode / quick search in production.</p>
          </div>

          <div>
            <span className={labelClass}>Milk type</span>
            <div className="mt-1 grid grid-cols-2 gap-2">
              {['Cow', 'Buffalo'].map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setMilkType(t)}
                  className={`min-h-[52px] rounded-xl text-base font-bold transition ${
                    milkType === t ? 'bg-teal-600 text-white shadow-md' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                  }`}
                >
                  {t}
                </button>
              ))}
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
            <div>
              <label className={labelClass} htmlFor="mc-qty">
                Quantity (L)
              </label>
              <input
                id="mc-qty"
                type="number"
                inputMode="decimal"
                step="0.1"
                value={qty}
                onChange={(e) => setQty(e.target.value)}
                className={fieldClass}
                autoComplete="off"
              />
            </div>
            <div>
              <label className={labelClass} htmlFor="mc-fat">
                Fat %
              </label>
              <input
                id="mc-fat"
                type="number"
                inputMode="decimal"
                step="0.01"
                value={fat}
                onChange={(e) => setFat(e.target.value)}
                className={fieldClass}
              />
            </div>
            <div>
              <label className={labelClass} htmlFor="mc-snf">
                SNF %
              </label>
              <input
                id="mc-snf"
                type="number"
                inputMode="decimal"
                step="0.01"
                value={snf}
                onChange={(e) => setSnf(e.target.value)}
                className={fieldClass}
              />
            </div>
          </div>

          <div className="grid gap-4 rounded-2xl bg-slate-50 p-4 sm:grid-cols-2">
            <div>
              <p className={labelClass}>Rate (₹/L)</p>
              <p className="mt-1 font-mono text-2xl font-bold text-[#004080]">₹ {rate.toFixed(2)}</p>
              <p className="text-xs text-slate-500">Auto from chart + type (demo)</p>
            </div>
            <div>
              <p className={labelClass}>Amount (₹)</p>
              <p className="mt-1 font-mono text-2xl font-bold text-slate-900">₹ {amount.toLocaleString('en-IN')}</p>
            </div>
          </div>

          <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap">
            <button
              type="button"
              className="min-h-[52px] flex-1 rounded-xl bg-[#004080] px-6 text-base font-bold text-white shadow-md hover:bg-[#003366] active:scale-[0.99]"
            >
              Save
            </button>
            <button
              type="button"
              onClick={resetForNext}
              className="min-h-[52px] flex-1 rounded-xl bg-amber-400 px-6 text-base font-bold text-slate-900 shadow-md hover:bg-amber-300 active:scale-[0.99]"
            >
              Save &amp; next
            </button>
            <button
              type="button"
              onClick={() => window.print()}
              className="inline-flex min-h-[52px] flex-1 items-center justify-center gap-2 rounded-xl border-2 border-slate-300 bg-white px-6 text-base font-bold text-slate-800 hover:bg-slate-50"
            >
              <PrinterIcon className="h-6 w-6" aria-hidden />
              Print slip
            </button>
          </div>
        </div>

        <aside className="space-y-4 rounded-2xl border border-dashed border-slate-300 bg-slate-50/80 p-5">
          <p className="text-sm font-bold text-slate-800">Morning tips</p>
          <ul className="list-inside list-disc space-y-2 text-sm text-slate-600">
            <li>Confirm CLR / organoleptic on quality screen before tank transfer.</li>
            <li>Rejected cans must not enter bulk line.</li>
            <li>Use Save &amp; next to keep farmer selected or clear qty only.</li>
          </ul>
          <div className="rounded-xl bg-white p-4 text-xs text-slate-500 ring-1 ring-slate-200">
            Thermal: expose <code className="rounded bg-slate-100 px-1">window.print()</code> template or ESC/POS via
            native wrapper.
          </div>
        </aside>
      </div>
    </div>
  )
}
