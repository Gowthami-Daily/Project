import { useEffect, useMemo, useState } from 'react'
import { XMarkIcon } from '@heroicons/react/24/solid'
import { pfModalCloseBtn, pfModalFooter, pfModalHeader, pfModalOverlay70, pfModalSurface } from './pfFormStyles.js'

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
      className={`${pfModalOverlay70} flex flex-col justify-end sm:items-center sm:justify-center sm:p-4`}
      role="dialog"
      aria-modal="true"
      aria-label="Choose month"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <div
        className={`${pfModalSurface} flex max-h-[85vh] w-full flex-col overflow-hidden sm:max-h-[min(90vh,520px)] sm:max-w-md`}
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className={`${pfModalHeader} !-mx-0 !-mt-0 shrink-0 rounded-none border-b sm:rounded-t-[14px]`}>
          <h2 className="text-base font-semibold text-[var(--pf-text)]">Select month</h2>
          <button type="button" onClick={onClose} className={pfModalCloseBtn} aria-label="Close">
            <XMarkIcon className="h-6 w-6" />
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto p-4">
          <div className="grid max-h-[50vh] grid-cols-1 gap-3 overflow-y-auto sm:max-h-none sm:grid-cols-2">
            <div>
              <p className="mb-2 text-xs font-bold uppercase tracking-wide text-[var(--pf-text-muted)]">Year</p>
              <div className="max-h-40 space-y-1 overflow-y-auto rounded-[10px] border border-[var(--pf-border)] bg-slate-50 p-2 dark:bg-[var(--pf-input-bg)] sm:max-h-56">
                {years.map((yr) => (
                  <button
                    key={yr}
                    type="button"
                    onClick={() => setY(yr)}
                    className={`w-full rounded-[10px] py-2 text-sm font-semibold transition active:scale-[0.98] ${
                      y === yr
                        ? 'bg-[var(--pf-primary)] text-white'
                        : 'text-[var(--pf-text)] hover:bg-[var(--pf-card-hover)]'
                    }`}
                  >
                    {yr}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <p className="mb-2 text-xs font-bold uppercase tracking-wide text-[var(--pf-text-muted)]">Month</p>
              <div className="grid grid-cols-3 gap-2">
                {MONTHS.map((label, i) => {
                  const mi = i + 1
                  return (
                    <button
                      key={label}
                      type="button"
                      onClick={() => setM(mi)}
                      className={`rounded-[10px] py-2.5 text-xs font-bold transition active:scale-[0.97] sm:text-sm ${
                        m === mi
                          ? 'bg-[var(--pf-primary)] text-white shadow-sm'
                          : 'border border-[var(--pf-border)] bg-[var(--pf-card)] text-[var(--pf-text)] hover:bg-[var(--pf-card-hover)]'
                      }`}
                    >
                      {label}
                    </button>
                  )
                })}
              </div>
            </div>
          </div>
        </div>
        <div className={`${pfModalFooter} justify-stretch sm:justify-end`}>
          <button
            type="button"
            onClick={onClose}
            className="min-h-[44px] flex-1 rounded-[10px] border border-[var(--pf-border)] bg-[var(--pf-card)] py-3 text-sm font-semibold text-[var(--pf-text)] transition hover:bg-[var(--pf-card-hover)] active:scale-[0.98] sm:flex-none sm:px-6"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={apply}
            className="min-h-[44px] flex-1 rounded-[10px] bg-[var(--pf-primary)] py-3 text-sm font-bold text-white shadow-md transition hover:bg-[var(--pf-primary-hover)] active:scale-[0.98] sm:flex-none sm:px-6"
          >
            Apply
          </button>
        </div>
      </div>
    </div>
  )
}
