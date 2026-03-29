/**
 * Inline segmented control (36px height, ~10px radius). Single row only.
 */
export default function PfSegmentedControl({ options, value, onChange, className = '' }) {
  return (
    <div
      className={`inline-flex h-[34px] max-w-full rounded-[10px] border border-slate-200/90 bg-slate-100/90 p-0.5 shadow-inner ${className}`}
      role="tablist"
    >
      {options.map((opt) => {
        const id = opt.value ?? opt.id
        const active = value === id
        return (
          <button
            key={String(id)}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange(id)}
            className={`min-h-0 min-w-0 flex-1 rounded-[8px] px-3 text-xs font-semibold leading-none transition-all duration-200 active:scale-[0.97] sm:px-4 sm:text-sm ${
              active ? 'bg-[#1E3A8A] text-white shadow-sm' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            {opt.label}
          </button>
        )
      })}
    </div>
  )
}
