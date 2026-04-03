import { useRef, useEffect, useState } from 'react'

/**
 * Simple pill tabs with sliding highlight (Aether-style).
 */
export default function Tabs({ options, value, onChange, className = '' }) {
  const wrapRef = useRef(null)
  const btnRefs = useRef(/** @type {Record<string, HTMLButtonElement | null>} */ ({}))
  const [pill, setPill] = useState({ left: 0, width: 0 })

  useEffect(() => {
    const el = btnRefs.current[value]
    const wrap = wrapRef.current
    if (!el || !wrap) return
    const a = el.offsetLeft
    const w = el.offsetWidth
    setPill({ left: a, width: w })
  }, [value, options])

  return (
    <div
      ref={wrapRef}
      className={[
        'relative inline-flex rounded-xl border border-[var(--pf-border)] bg-[var(--pf-card-hover)]/40 p-1',
        className,
      ]
        .filter(Boolean)
        .join(' ')}
      role="tablist"
    >
      <span
        className="pointer-events-none absolute top-1 bottom-1 rounded-lg bg-[var(--pf-card)] shadow-sm ring-1 ring-[var(--pf-border)] transition-all duration-200 ease-out"
        style={{ left: pill.left, width: pill.width }}
        aria-hidden
      />
      {options.map((opt) => {
        const id = opt.id
        const selected = value === id
        return (
          <button
            key={id}
            ref={(n) => {
              btnRefs.current[id] = n
            }}
            type="button"
            role="tab"
            aria-selected={selected}
            className={[
              'relative z-[1] rounded-lg px-4 py-2 text-sm font-semibold transition-colors duration-150',
              selected ? 'text-[var(--pf-text)]' : 'text-[var(--pf-text-muted)] hover:text-[var(--pf-text)]',
            ].join(' ')}
            onClick={() => onChange(id)}
          >
            {opt.label}
          </button>
        )
      })}
    </div>
  )
}
