import { useEffect, useId, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { BuildingLibraryIcon, CheckIcon, ChevronDownIcon } from '@heroicons/react/24/solid'

/** Title case when the backend stores SHOUTY NAMES; leave mixed case as-is. */
function displayAccountName(raw) {
  if (raw == null || String(raw).trim() === '') return 'Account'
  const s = String(raw).trim()
  if (s !== s.toUpperCase()) return s
  return s.toLowerCase().replace(/\b\w/g, (ch) => ch.toUpperCase())
}

/**
 * Dashboard-style account filter — glass panel instead of a native select menu.
 */
export default function PfBankAccountSelect({ value, onChange, accounts = [], className = '' }) {
  const [open, setOpen] = useState(false)
  const rootRef = useRef(null)
  const listId = useId()

  useEffect(() => {
    if (!open) return
    const onDoc = (e) => {
      if (rootRef.current && !rootRef.current.contains(e.target)) setOpen(false)
    }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [open])

  useEffect(() => {
    if (!open) return
    const onKey = (e) => {
      if (e.key === 'Escape') setOpen(false)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open])

  const selected =
    value === '' || value == null
      ? null
      : accounts.find((a) => String(a.id) === String(value))
  const triggerLabel = selected ? displayAccountName(selected.account_name) : 'All accounts'

  const triggerCls =
    'flex h-11 min-h-[44px] w-full min-w-0 max-w-full items-center gap-2 rounded-xl border px-3 py-2 text-left text-xs font-semibold shadow-[var(--pf-shadow)] outline-none backdrop-blur-md transition-all duration-200 sm:h-auto sm:min-h-0 sm:min-w-[10.5rem] sm:max-w-[min(100%,16rem)] ' +
    'border-[var(--pf-border)] bg-[var(--pf-card)]/85 text-[var(--pf-text)] hover:border-[var(--pf-border)] hover:bg-[var(--pf-card-hover)] active:scale-[0.98] ' +
    'focus-visible:ring-2 focus-visible:ring-[var(--pf-primary)]/40 dark:bg-white/[0.06] dark:hover:bg-white/[0.09]'

  const itemCls = (isActive) =>
    [
      'flex w-full cursor-pointer items-center gap-2 px-3 py-2.5 text-left text-sm transition-colors',
      isActive
        ? 'bg-[var(--pf-primary)]/12 font-semibold text-[var(--pf-text)]'
        : 'text-[var(--pf-text)] hover:bg-[var(--pf-card-hover)]/90',
    ].join(' ')

  return (
    <div ref={rootRef} className={`relative ${className}`}>
      <span id={`${listId}-label`} className="sr-only">
        Filter dashboard by bank or account
      </span>
      <button
        type="button"
        className={triggerCls}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-labelledby={`${listId}-label`}
        aria-controls={`${listId}-listbox`}
        onClick={() => setOpen((o) => !o)}
      >
        <BuildingLibraryIcon className="h-4 w-4 shrink-0 text-[var(--pf-text-muted)]" aria-hidden />
        <span className="min-w-0 flex-1 truncate">{triggerLabel}</span>
        <ChevronDownIcon
          className={`h-4 w-4 shrink-0 text-[var(--pf-text-muted)] transition-transform duration-200 ${open ? 'rotate-180' : ''}`}
          aria-hidden
        />
      </button>

      <AnimatePresence>
        {open ? (
          <motion.div
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.15, ease: [0.25, 0.1, 0.25, 1] }}
            className="absolute left-0 right-0 z-[200] mt-1.5 max-h-[min(18rem,calc(100dvh-8rem))] overflow-hidden rounded-xl border border-[var(--pf-border)] bg-[var(--pf-card)]/95 shadow-[0_12px_40px_-12px_rgba(0,0,0,0.45)] backdrop-blur-xl dark:bg-[rgba(22,24,28,0.97)] dark:shadow-[0_12px_40px_-8px_rgba(0,0,0,0.65)]"
          >
            <ul
              id={`${listId}-listbox`}
              role="listbox"
              aria-label="Accounts"
              className="max-h-60 overflow-y-auto overscroll-contain py-1 [scrollbar-width:thin] [scrollbar-color:rgba(148,163,184,0.45)_transparent]"
            >
              <li role="presentation" className="px-1">
                <button
                  type="button"
                  role="option"
                  aria-selected={value === '' || value == null}
                  className={itemCls(value === '' || value == null)}
                  onClick={() => {
                    onChange('')
                    setOpen(false)
                  }}
                >
                  <span className="flex h-4 w-4 shrink-0 items-center justify-center">
                    {value === '' || value == null ? (
                      <CheckIcon className="h-4 w-4 text-[var(--pf-primary)]" aria-hidden />
                    ) : null}
                  </span>
                  <span className="min-w-0 flex-1">All accounts</span>
                </button>
              </li>
              {accounts.length > 0 ? (
                <li aria-hidden className="mx-2 my-0.5 h-px bg-[var(--pf-border)]/80" role="presentation" />
              ) : null}
              {accounts.map((a) => {
                const idStr = String(a.id)
                const isOn = String(value) === idStr
                return (
                  <li key={a.id} role="presentation" className="px-1">
                    <button
                      type="button"
                      role="option"
                      aria-selected={isOn}
                      className={itemCls(isOn)}
                      onClick={() => {
                        onChange(idStr)
                        setOpen(false)
                      }}
                    >
                      <span className="flex h-4 w-4 shrink-0 items-center justify-center">
                        {isOn ? <CheckIcon className="h-4 w-4 text-[var(--pf-primary)]" aria-hidden /> : null}
                      </span>
                      <span className="min-w-0 flex-1 truncate">{displayAccountName(a.account_name)}</span>
                    </button>
                  </li>
                )
              })}
            </ul>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  )
}
