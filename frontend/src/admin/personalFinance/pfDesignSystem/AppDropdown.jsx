import { ChevronDownIcon } from '@heroicons/react/24/solid'
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'

const triggerCls =
  'flex h-10 min-h-10 w-full min-w-0 items-center justify-between gap-2 rounded-[10px] border px-4 text-left text-[13px] font-medium shadow-sm outline-none transition-all ' +
  'border-slate-200/90 bg-white text-slate-900 hover:border-slate-300 hover:bg-slate-50 ' +
  'focus-visible:ring-2 focus-visible:ring-[var(--pf-primary)] focus-visible:ring-offset-2 focus-visible:ring-offset-white ' +
  'dark:border-[var(--pf-border)] dark:bg-[var(--pf-input-bg)] dark:text-[var(--pf-text)] dark:hover:bg-[var(--pf-card-hover)] dark:focus-visible:ring-offset-[var(--pf-bg)]'

const panelCls =
  'fixed z-[70] max-h-72 min-w-[var(--dd-w,12rem)] overflow-y-auto rounded-[12px] border py-2 shadow-[var(--pf-modal-shadow)] ' +
  'border-slate-200/90 bg-white text-slate-900 dark:border-[var(--pf-border)] dark:bg-[var(--pf-card)] dark:text-[var(--pf-text)]'

const itemCls =
  'flex w-full items-start gap-2 px-3 py-2.5 text-left text-[13px] transition hover:bg-slate-100 disabled:pointer-events-none disabled:opacity-40 dark:hover:bg-[var(--pf-card-hover)]'

function portalEl() {
  return document.querySelector('.pf-app') || document.body
}

/**
 * @typedef {{ value: string, label: string, description?: string, icon?: import('react').ReactNode, disabled?: boolean }} AppDropdownOption
 * @typedef {{ label: string, options: AppDropdownOption[] }} AppDropdownGroup
 */
export function AppDropdown({
  id,
  value,
  onChange,
  options = [],
  groups = null,
  placeholder = 'Select…',
  disabled = false,
  'aria-label': ariaLabel,
  className = '',
}) {
  const [open, setOpen] = useState(false)
  const wrapRef = useRef(null)
  const btnRef = useRef(null)
  const [pos, setPos] = useState({ top: 0, left: 0, width: 240 })

  const flat = useMemo(() => {
    if (groups && groups.length) return { useGroups: true, groups }
    return { useGroups: false, options: options || [] }
  }, [groups, options])

  const selectedLabel = useMemo(() => {
    const find = (opts) => opts.find((o) => o.value === value)
    if (flat.useGroups) {
      for (const g of flat.groups) {
        const hit = find(g.options)
        if (hit) return hit
      }
      return null
    }
    return find(flat.options)
  }, [flat, value])

  const syncPos = useCallback(() => {
    const el = btnRef.current
    if (!el) return
    const r = el.getBoundingClientRect()
    setPos({ top: r.bottom + 6, left: r.left, width: Math.max(r.width, 220) })
  }, [])

  useLayoutEffect(() => {
    if (!open) return
    syncPos()
  }, [open, syncPos])

  useEffect(() => {
    if (!open) return
    const onDoc = (e) => {
      const t = e.target
      if (wrapRef.current?.contains(t)) return
      setOpen(false)
    }
    const onScroll = () => syncPos()
    document.addEventListener('mousedown', onDoc, true)
    window.addEventListener('scroll', onScroll, true)
    window.addEventListener('resize', onScroll)
    return () => {
      document.removeEventListener('mousedown', onDoc, true)
      window.removeEventListener('scroll', onScroll, true)
      window.removeEventListener('resize', onScroll)
    }
  }, [open, syncPos])

  useEffect(() => {
    if (!open) return
    const onKey = (e) => {
      if (e.key === 'Escape') setOpen(false)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open])

  function selectOption(v) {
    onChange(v)
    setOpen(false)
  }

  const menu = open
    ? createPortal(
        <div
          role="listbox"
          className={`${panelCls} ds-dropdown-panel--enter`}
          style={{
            top: pos.top,
            left: pos.left,
            width: pos.width,
            ['--dd-w']: `${pos.width}px`,
          }}
        >
          {flat.useGroups
            ? flat.groups.map((g) => (
                <div key={g.label}>
                  <div className="px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-zinc-500">
                    {g.label}
                  </div>
                  {g.options.map((o) => (
                    <button
                      key={o.value}
                      type="button"
                      role="option"
                      aria-selected={value === o.value}
                      disabled={o.disabled}
                      className={`${itemCls} ${value === o.value ? 'bg-[var(--pf-primary)]/15 text-[var(--pf-primary)]' : 'text-[var(--pf-text)]'}`}
                      onClick={() => !o.disabled && selectOption(o.value)}
                    >
                      {o.icon ? <span className="mt-0.5 shrink-0 text-base leading-none opacity-90">{o.icon}</span> : null}
                      <span className="min-w-0 flex-1">
                        <span className="block font-medium leading-snug">{o.label}</span>
                        {o.description ? (
                          <span className="mt-0.5 block text-xs font-normal text-slate-500 dark:text-zinc-400">{o.description}</span>
                        ) : null}
                      </span>
                    </button>
                  ))}
                </div>
              ))
            : flat.options.map((o) => (
                <button
                  key={o.value}
                  type="button"
                  role="option"
                  aria-selected={value === o.value}
                  disabled={o.disabled}
                  className={`${itemCls} ${value === o.value ? 'bg-[var(--pf-primary)]/15 text-[var(--pf-primary)]' : 'text-[var(--pf-text)]'}`}
                  onClick={() => !o.disabled && selectOption(o.value)}
                >
                  {o.icon ? <span className="mt-0.5 shrink-0 text-base leading-none opacity-90">{o.icon}</span> : null}
                  <span className="min-w-0 flex-1">
                    <span className="block font-medium leading-snug">{o.label}</span>
                    {o.description ? (
                      <span className="mt-0.5 block text-xs font-normal text-slate-500 dark:text-zinc-400">{o.description}</span>
                    ) : null}
                  </span>
                </button>
              ))}
        </div>,
        portalEl(),
      )
    : null

  return (
    <div ref={wrapRef} className={['relative', className].filter(Boolean).join(' ')}>
      <button
        ref={btnRef}
        id={id}
        type="button"
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={ariaLabel}
        className={triggerCls}
        onClick={() => !disabled && setOpen((v) => !v)}
      >
        <span className="min-w-0 flex-1 truncate text-left">
          {selectedLabel ? (
            <>
              <span className="block truncate font-medium">{selectedLabel.label}</span>
              {selectedLabel.description ? (
                <span className="block truncate text-xs font-normal text-[var(--pf-text-muted)]">{selectedLabel.description}</span>
              ) : null}
            </>
          ) : (
            <span className="text-[var(--pf-text-muted)]">{placeholder}</span>
          )}
        </span>
        <ChevronDownIcon className={`h-4 w-4 shrink-0 text-[var(--pf-text-muted)] transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {menu}
    </div>
  )
}
