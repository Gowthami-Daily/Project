import { useEffect, useMemo, useState } from 'react'
import { XMarkIcon } from '@heroicons/react/24/solid'

const MONTHS = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec',
]

export default function PfMonthYearModal({ open, onClose, year, month, onApply, minYear, maxYear }) {
  const [y, setY] = useState(year)
  const [m, setM] = useState(month)

  useEffect(() => {
    if (open) {
      setY(year)
      setM(month)
    }
  }, [open, year, month])

  const years = useMemo(() => {
    const lo = minYear ?? new Date().getFullYear() - 6
    const hi = maxYear ?? new Date().getFullYear() + 1
    const out = []
    for (let i = hi; i >= lo; i -= 1) out.push(i)
    return out
  }, [minYear, maxYear])

  if (!open) return null

  function apply() {
    onApply(y, m)
    onClose()
  }

  return (
    <div
      className="fixed inset-0 z-[70] flex flex-col justify-end bg-slate-900/45 backdrop-blur-sm sm:items-center sm:justify-center sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-label="Choose month"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <div
        className="pf-sheet-panel max-h-[85vh] w-full overflow-hidden rounded-t-2xl border border-slate-200 bg-white shadow-xl sm:max-h-[min(90vh,520px)] sm:rounded-2xl"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
          <h2 className="text-base font-bold text-slate-900">Select month</h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-[12px] p-2 text-slate-500 transition hover:bg-slate-100 active:scale-95"
            aria-label="Close"
          >
            <XMarkIcon className="h-6 w-6" />
          </button>
        </div>
        <div className="grid max-h-[50vh] grid-cols-1 gap-3 overflow-y-auto p-4 sm:max-h-none sm:grid-cols-2">
          <div>
            <p className="mb-2 text-xs font-bold uppercase tracking-wide text-slate-500">Year</p>
            <div className="max-h-40 space-y-1 overflow-y-auto rounded-xl border border-slate-100 bg-slate-50/80 p-2 sm:max-h-56">
              {years.map((yr) => (
                <button
                  key={yr}
                  type="button"
                  onClick={() => setY(yr)}
                  className={`w-full rounded-[10px] py-2 text-sm font-semibold transition active:scale-[0.98] ${
                    y === yr ? 'bg-[#1E3A8A] text-white' : 'text-slate-700 hover:bg-white'
                  }`}
                >
                  {yr}
                </button>
              ))}
            </div>
          </div>
          <div>
            <p className="mb-2 text-xs font-bold uppercase tracking-wide text-slate-500">Month</p>
            <div className="grid grid-cols-3 gap-2">
              {MONTHS.map((label, i) => {
                const mi = i + 1
                return (
                  <button
                    key={label}
                    type="button"
                    onClick={() => setM(mi)}
                    className={`rounded-[10px] py-2.5 text-xs font-bold transition active:scale-[0.97] sm:text-sm ${
                      m === mi ? 'bg-[#1E3A8A] text-white shadow-sm' : 'bg-slate-100 text-slate-700 hover:bg-slate-200/80'
                    }`}
                  >
                    {label}
                  </button>
                )
              })}
            </div>
          </div>
        </div>
        <div className="flex gap-2 border-t border-slate-100 p-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 rounded-[12px] border border-slate-200 py-3 text-sm font-semibold text-slate-600 transition hover:bg-slate-50 active:scale-[0.98]"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={apply}
            className="flex-1 rounded-[12px] bg-[#1E3A8A] py-3 text-sm font-bold text-white shadow-md transition hover:bg-[#172554] active:scale-[0.98]"
          >
            Apply
          </button>
        </div>
      </div>
    </div>
  )
}
