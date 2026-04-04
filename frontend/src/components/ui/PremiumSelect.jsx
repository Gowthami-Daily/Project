import { ChevronDownIcon, MagnifyingGlassIcon } from '@heroicons/react/24/solid'
import {
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react'
import { createPortal } from 'react-dom'

import { labelCls } from '../../admin/personalFinance/pfFormStyles.js'

import './premiumSelect.css'

function portalRoot() {
  return document.querySelector('.pf-app') || document.body
}

const triggerCls =
  'pf-premium-select__trigger flex h-10 min-h-10 w-full min-w-0 items-center justify-between gap-2 rounded-[12px] border px-3 text-left text-[14px] font-medium outline-none transition-all duration-200 ease-out ' +
  'border-slate-200/90 bg-white text-slate-900 shadow-sm hover:border-slate-300 hover:bg-slate-50 ' +
  'focus-visible:ring-2 focus-visible:ring-[#2563EB]/35 focus-visible:ring-offset-2 focus-visible:ring-offset-white ' +
  'dark:border-[rgba(255,255,255,0.08)] dark:bg-[#121722] dark:text-[#E6EAF2] dark:shadow-none ' +
  'dark:hover:border-[rgba(255,255,255,0.16)] dark:hover:bg-[#151B28] ' +
  'dark:focus-visible:ring-[#2563EB]/40 dark:focus-visible:ring-offset-[#0b0e13]'

const triggerDisabled =
  'cursor-not-allowed opacity-50 hover:border-slate-200/90 hover:bg-white dark:hover:border-[rgba(255,255,255,0.08)] dark:hover:bg-[#121722]'

const panelCls =
  'pf-premium-select__panel pf-premium-select__panel--anim fixed z-[120] flex max-h-[min(240px,calc(100dvh-6rem))] flex-col overflow-hidden rounded-[12px] border border-[rgba(255,255,255,0.08)] bg-[#151B28] text-[#E6EAF2] shadow-[0_10px_30px_rgba(0,0,0,0.4)] backdrop-blur-md ' +
  'dark:border-[rgba(255,255,255,0.08)] dark:bg-[#151B28]'

const itemBase =
  'flex w-full cursor-pointer items-center gap-2 rounded-lg border-0 px-3 py-2.5 text-left text-[14px] font-medium transition-colors duration-150 ease-out disabled:pointer-events-none disabled:opacity-40'

/**
 * @typedef {{ value: string, label: string, disabled?: boolean }} PremiumSelectOption
 */

/**
 * Fintech single-select — portal listbox, search, keyboard nav, consistent dark styling inside `.pf-app`.
 *
 * @param {{
 *   label?: string | null
 *   id?: string
 *   name?: string
 *   options: PremiumSelectOption[]
 *   value: string
 *   onChange: (value: string) => void
 *   placeholder?: string
 *   disabled?: boolean
 *   searchable?: boolean
 *   searchPlaceholder?: string
 *   searchFromCount?: number
 *   className?: string
 *   labelClassName?: string
 *   'aria-label'?: string
 *   required?: boolean
 * }} props
 */
export function PremiumSelect({
  label = null,
  id: idProp,
  name,
  options = [],
  value,
  onChange,
  placeholder = 'Select…',
  disabled = false,
  searchable = false,
  searchPlaceholder = 'Search…',
  searchFromCount = 8,
  className = '',
  labelClassName,
  required = false,
  'aria-label': ariaLabel,
}) {
  const autoId = useId()
  const id = idProp || `premium-select-${autoId.replace(/:/g, '')}`
  const listboxId = `${id}-listbox`
  const searchId = `${id}-search`

  const [open, setOpen] = useState(false)
  const [entered, setEntered] = useState(false)
  const [query, setQuery] = useState('')
  const [highlight, setHighlight] = useState(0)
  const [pos, setPos] = useState({ top: undefined, bottom: undefined, left: 0, width: 0, flip: false })

  const wrapRef = useRef(null)
  const btnRef = useRef(null)
  const searchRef = useRef(null)
  const listRef = useRef(null)
  const itemRefs = useRef([])
  const wasOpenRef = useRef(false)
  const prevQueryRef = useRef(query)

  const showSearch = searchable || options.length >= searchFromCount

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return options
    return options.filter((o) => o.label.toLowerCase().includes(q))
  }, [options, query])

  const selected = useMemo(() => options.find((o) => o.value === value), [options, value])

  const syncPos = useCallback(() => {
    const el = btnRef.current
    if (!el) return
    const r = el.getBoundingClientRect()
    const gap = 8
    const maxPanel = 260
    const spaceBelow = window.innerHeight - r.bottom - gap
    const spaceAbove = r.top - gap
    const flip = spaceBelow < Math.min(maxPanel, 200) && spaceAbove > spaceBelow
    const vw = window.innerWidth
    let width = Math.max(r.width, 160)
    width = Math.min(width, vw - 16)
    let left = r.left
    if (left + width > vw - 8) left = Math.max(8, vw - width - 8)
    setPos({
      top: flip ? undefined : r.bottom + gap,
      bottom: flip ? window.innerHeight - r.top + gap : undefined,
      left,
      width,
      flip,
    })
  }, [])

  useLayoutEffect(() => {
    if (!open) return
    syncPos()
  }, [open, syncPos, filtered.length, showSearch])

  useEffect(() => {
    if (!open) {
      setEntered(false)
      setQuery('')
      return
    }
    let raf2 = 0
    const raf1 = requestAnimationFrame(() => {
      raf2 = requestAnimationFrame(() => setEntered(true))
    })
    return () => {
      cancelAnimationFrame(raf1)
      cancelAnimationFrame(raf2)
    }
  }, [open])

  useLayoutEffect(() => {
    if (open && !wasOpenRef.current) {
      const selIdx = options.findIndex((o) => o.value === value && !o.disabled)
      const firstEn = options.findIndex((o) => !o.disabled)
      setHighlight(selIdx >= 0 ? selIdx : firstEn >= 0 ? firstEn : 0)
      prevQueryRef.current = query
    }
    wasOpenRef.current = open
    if (!open) prevQueryRef.current = ''
  }, [open, options, value])

  useLayoutEffect(() => {
    if (!open) return
    if (prevQueryRef.current === query) return
    prevQueryRef.current = query
    const fi = filtered.findIndex((o) => !o.disabled)
    setHighlight(fi >= 0 ? fi : 0)
  }, [open, query, filtered])

  useEffect(() => {
    if (!open || !showSearch) return
    const t = window.setTimeout(() => searchRef.current?.focus(), 0)
    return () => window.clearTimeout(t)
  }, [open, showSearch])

  useEffect(() => {
    if (!open) return
    const onScrollResize = () => syncPos()
    window.addEventListener('scroll', onScrollResize, true)
    window.addEventListener('resize', onScrollResize)
    return () => {
      window.removeEventListener('scroll', onScrollResize, true)
      window.removeEventListener('resize', onScrollResize)
    }
  }, [open, syncPos])

  useEffect(() => {
    if (!open) return
    const onDoc = (e) => {
      const t = e.target
      if (wrapRef.current?.contains(t)) return
      if (document.querySelector(`[data-premium-select-panel="${id}"]`)?.contains(t)) return
      setOpen(false)
    }
    document.addEventListener('mousedown', onDoc, true)
    return () => document.removeEventListener('mousedown', onDoc, true)
  }, [open, id])

  useEffect(() => {
    if (!open) return
    const onKey = (e) => {
      if (e.key === 'Escape') {
        e.preventDefault()
        setOpen(false)
        btnRef.current?.focus()
        return
      }
      if (e.key === 'Tab') {
        setOpen(false)
        return
      }
      if (filtered.filter((o) => !o.disabled).length === 0) return

      if (e.key === 'ArrowDown') {
        e.preventDefault()
        setHighlight((h) => {
          const enabledIndices = filtered.map((o, i) => (o.disabled ? -1 : i)).filter((i) => i >= 0)
          if (enabledIndices.length === 0) return 0
          const curPos = enabledIndices.indexOf(h)
          const next = curPos < 0 ? 0 : (curPos + 1) % enabledIndices.length
          return enabledIndices[next]
        })
        return
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault()
        setHighlight((h) => {
          const enabledIndices = filtered.map((o, i) => (o.disabled ? -1 : i)).filter((i) => i >= 0)
          if (enabledIndices.length === 0) return 0
          const curPos = enabledIndices.indexOf(h)
          const next =
            curPos <= 0 ? enabledIndices[enabledIndices.length - 1] : enabledIndices[curPos - 1]
          return next
        })
        return
      }
      if (e.key === 'Enter') {
        const t = e.target
        if (t instanceof HTMLButtonElement && t.getAttribute('role') === 'option') return
        const panel = document.querySelector(`[data-premium-select-panel="${id}"]`)
        const inPanel = panel?.contains(t)
        const inSearch = t === searchRef.current
        if (!inPanel && !inSearch) return
        e.preventDefault()
        const row = filtered[highlight]
        if (row && !row.disabled) {
          onChange(row.value)
          setOpen(false)
          btnRef.current?.focus()
        }
      }
    }
    window.addEventListener('keydown', onKey, true)
    return () => window.removeEventListener('keydown', onKey, true)
  }, [open, filtered, highlight, onChange, id])

  useEffect(() => {
    if (!open) return
    const el = itemRefs.current[highlight]
    el?.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
  }, [highlight, open])

  function selectOption(v) {
    onChange(v)
    setOpen(false)
    btnRef.current?.focus()
  }

  const panelTransformHidden = pos.flip ? 'translateY(8px) scale(0.98)' : 'translateY(-8px) scale(0.98)'
  const panelVisible = entered

  const listMaxH = showSearch ? 168 : 220

  const menu =
    open &&
    createPortal(
      <div
        data-premium-select-panel={id}
        role="listbox"
        id={listboxId}
        aria-labelledby={label ? id : undefined}
        aria-activedescendant={filtered[highlight] ? `${id}-opt-${highlight}` : undefined}
        className={panelCls}
        style={{
          top: pos.flip ? 'auto' : pos.top,
          bottom: pos.flip ? pos.bottom : 'auto',
          left: pos.left,
          width: pos.width,
          opacity: panelVisible ? 1 : 0,
          transform: panelVisible ? 'translateY(0) scale(1)' : panelTransformHidden,
          transformOrigin: pos.flip ? 'bottom center' : 'top center',
          transition: 'opacity 0.18s cubic-bezier(0.4, 0, 0.2, 1), transform 0.18s cubic-bezier(0.4, 0, 0.2, 1)',
          pointerEvents: panelVisible ? 'auto' : 'none',
        }}
      >
        {showSearch ? (
          <div className="shrink-0 border-b border-[rgba(255,255,255,0.08)] p-2">
            <div className="relative">
              <MagnifyingGlassIcon
                className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[#9AA4B2]"
                aria-hidden
              />
              <input
                ref={searchRef}
                id={searchId}
                type="search"
                autoComplete="off"
                placeholder={searchPlaceholder}
                className="w-full rounded-lg border border-[rgba(255,255,255,0.08)] bg-[#121722] py-2 pl-9 pr-3 text-[13px] text-[#E6EAF2] placeholder:text-[#9AA4B2] outline-none focus:border-[#2563EB]/45 focus:ring-2 focus:ring-[#2563EB]/25"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'ArrowDown') {
                    e.preventDefault()
                    setHighlight((h) => {
                      const enabledIndices = filtered.map((o, i) => (o.disabled ? -1 : i)).filter((i) => i >= 0)
                      if (!enabledIndices.length) return 0
                      const cur = enabledIndices.indexOf(h)
                      const next = cur < 0 ? 0 : (cur + 1) % enabledIndices.length
                      return enabledIndices[next]
                    })
                  }
                }}
              />
            </div>
          </div>
        ) : null}
        <div
          ref={listRef}
          className="pf-premium-select-options min-h-0 flex-1 overflow-y-auto overscroll-contain px-1 py-1"
          style={{ maxHeight: listMaxH }}
        >
          {filtered.length === 0 ? (
            <p className="px-3 py-6 text-center text-[13px] text-[#9AA4B2]">No matches</p>
          ) : (
            filtered.map((o, i) => {
              const isSelected = o.value === value
              const isHi = i === highlight
              let itemStyle = `${itemBase} text-[#E6EAF2] `
              if (isSelected) {
                itemStyle += 'bg-[rgba(37,99,235,0.2)] text-[#6EA8FE] '
              } else if (isHi) {
                itemStyle += 'bg-[#1E2532] '
              } else {
                itemStyle += 'hover:bg-[#1E2532] '
              }
              return (
                <button
                  key={`${o.value}-${i}`}
                  ref={(el) => {
                    itemRefs.current[i] = el
                  }}
                  id={`${id}-opt-${i}`}
                  type="button"
                  role="option"
                  aria-selected={isSelected}
                  disabled={o.disabled}
                  className={itemStyle}
                  onMouseEnter={() => setHighlight(i)}
                  onClick={() => !o.disabled && selectOption(o.value)}
                >
                  <span className="min-w-0 flex-1 truncate">{o.label}</span>
                  {isSelected ? (
                    <span className="shrink-0 text-xs font-semibold text-[#6EA8FE]" aria-hidden>
                      ✓
                    </span>
                  ) : null}
                </button>
              )
            })
          )}
        </div>
      </div>,
      portalRoot(),
    )

  const lbl = labelClassName ?? labelCls

  return (
    <div ref={wrapRef} className={['pf-premium-select min-w-0', className].filter(Boolean).join(' ')}>
      {name ? <input type="hidden" name={name} value={value} required={required} /> : null}
      {label ? (
        <label className={lbl} htmlFor={id}>
          {label}
        </label>
      ) : null}
      <button
        ref={btnRef}
        id={id}
        type="button"
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={open ? listboxId : undefined}
        aria-label={!label ? ariaLabel : undefined}
        aria-required={required || undefined}
        className={`${triggerCls} ${disabled ? triggerDisabled : ''} ${label ? 'mt-1' : ''}`}
        onClick={() => !disabled && setOpen((v) => !v)}
      >
        <span className="min-w-0 flex-1 truncate">
          {selected ? (
            <span className="block truncate text-slate-900 dark:text-[#E6EAF2]">{selected.label}</span>
          ) : (
            <span className="text-slate-500 dark:text-[#9AA4B2]">{placeholder}</span>
          )}
        </span>
        <ChevronDownIcon
          className={`h-4 w-4 shrink-0 text-slate-500 transition-transform duration-[var(--pf-motion-normal,180ms)] [transition-timing-function:cubic-bezier(0.4,0,0.2,1)] dark:text-[#9AA4B2] ${
            open ? 'rotate-180' : ''
          }`}
          aria-hidden
        />
      </button>
      {menu}
    </div>
  )
}
