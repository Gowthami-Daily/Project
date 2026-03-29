import { ChevronDownIcon } from '@heroicons/react/24/solid'
import { useEffect, useRef, useState } from 'react'
import { btnSecondary } from './pfFormStyles.js'

/**
 * @param {{ disabled?: boolean, busy?: boolean, label?: string, items: { key: string, label: string, onClick: () => void }[] }} props
 */
export default function PfExportMenu({ disabled, busy, label = 'Export', items }) {
  const [open, setOpen] = useState(false)
  const ref = useRef(null)

  useEffect(() => {
    function onDoc(e) {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false)
    }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [])

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        disabled={disabled || busy}
        className={`${btnSecondary} inline-flex items-center gap-1`}
        aria-expanded={open}
        aria-haspopup="menu"
        onClick={() => setOpen((v) => !v)}
      >
        {busy ? 'Generating…' : label}
        <ChevronDownIcon className="h-4 w-4 shrink-0 opacity-80" aria-hidden />
      </button>
      {open ? (
        <div
          className="absolute right-0 z-50 mt-1 min-w-[11rem] overflow-hidden rounded-xl border border-slate-200 bg-white py-1 shadow-lg dark:border-slate-600 dark:bg-slate-800"
          role="menu"
        >
          {items.map((it) => (
            <button
              key={it.key}
              type="button"
              role="menuitem"
              className="block w-full px-4 py-2.5 text-left text-sm font-semibold text-slate-800 hover:bg-slate-50 dark:text-slate-100 dark:hover:bg-slate-700/80"
              onClick={() => {
                setOpen(false)
                it.onClick()
              }}
            >
              {it.label}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  )
}
