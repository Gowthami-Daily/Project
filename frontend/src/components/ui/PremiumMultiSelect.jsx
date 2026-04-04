import { ChevronDownIcon, MagnifyingGlassIcon } from '@heroicons/react/24/solid'
import { useCallback, useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'

import { labelCls } from '../../admin/personalFinance/pfFormStyles.js'

import './premiumSelect.css'

function portalRoot() {
  return document.querySelector('.pf-app') || document.body
}

const triggerCls =
  'flex h-10 min-h-10 w-full min-w-0 items-center justify-between gap-2 rounded-[12px] border px-3 text-left text-[14px] font-medium outline-none transition-all duration-200 ' +
  'border-slate-200/90 bg-white text-slate-900 hover:border-slate-300 hover:bg-slate-50 ' +
  'dark:border-[rgba(255,255,255,0.08)] dark:bg-[#121722] dark:text-[#E6EAF2] dark:hover:border-[rgba(255,255,255,0.16)] dark:hover:bg-[#151B28]'

const panelCls =
  'pf-premium-select__panel pf-premium-select__panel--anim fixed z-[120] flex max-h-[min(280px,calc(100dvh-6rem))] flex-col overflow-hidden rounded-[12px] border border-[rgba(255,255,255,0.08)] bg-[#151B28] text-[#E6EAF2] shadow-[0_10px_30px_rgba(0,0,0,0.4)] backdrop-blur-md'

const itemBase =
  'flex w-full cursor-pointer items-center gap-2 rounded-lg border-0 px-3 py-2.5 text-left text-[14px] font-medium transition-colors duration-150 disabled:pointer-events-none disabled:opacity-40'

/**
 * @typedef {{ value: string, label: string, disabled?: boolean }} PremiumMultiOption
 */

/**
 * Multi-select listbox — same visual language as {@link PremiumSelect}.
 *
 * @param {{
 *   label?: string | null
 *   id?: string
 *   name?: string
 *   options: PremiumMultiOption[]
 *   value: string[]
 *   onChange: (next: string[]) => void
 *   placeholder?: string
 *   disabled?: boolean
 *   searchable?: boolean
 *   searchPlaceholder?: string
 *   searchFromCount?: number
 *   className?: string
 *   labelClassName?: string
 *   summaryMax?: number
 * }} props
 */
export function PremiumMultiSelect({
  label = null,
  id: idProp,
  name,
  options = [],
  value = [],
  onChange,
  placeholder = 'Select…',
  disabled = false,
  searchable = false,
  searchPlaceholder = 'Search…',
  searchFromCount = 8,
  className = '',
  labelClassName,
  summaryMax = 2,
}) {
  const autoId = useId()
  const id = idProp || `premium-multi-${autoId.replace(/:/g, '')}`
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
  const itemRefs = useRef([])
  const wasOpenRef = useRef(false)
  const prevQueryRef = useRef(query)

  const set = useMemo(() => new Set(value), [value])
  const showSearch = searchable || options.length >= searchFromCount

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return options
    return options.filter((o) => o.label.toLowerCase().includes(q))
  }, [options, query])

  const summary = useMemo(() => {
    if (!value.length) return null
    const labels = value
      .map((v) => options.find((o) => o.value === v)?.label)
      .filter(Boolean)
    if (labels.length === 0) return `${value.length} selected`
    if (labels.length <= summaryMax) return labels.join(', ')
    return `${labels.slice(0, summaryMax).join(', ')} +${labels.length - summaryMax}`
  }, [value, options, summaryMax])

  const syncPos = useCallback(() => {
    const el = btnRef.current
    if (!el) return
    const r = el.getBoundingClientRect()
    const gap = 8
    const vw = window.innerWidth
    let width = Math.max(r.width, 160)
    width = Math.min(width, vw - 16)
    let left = r.left
    if (left + width > vw - 8) left = Math.max(8, vw - width - 8)
    const spaceBelow = window.innerHeight - r.bottom - gap
    const flip = spaceBelow < 200 && r.top > spaceBelow
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
    let r2 = 0
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
      const fi = filtered.findIndex((o) => !o.disabled)
      setHighlight(fi >= 0 ? fi : 0)
    }
    wasOpenRef.current = open
  }, [open, filtered])

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
    const h = () => syncPos()
    window.addEventListener('scroll', h, true)
    window.addEventListener('resize', h)
    return () => {
      window.removeEventListener('scroll', h, true)
      window.removeEventListener('resize', h)
    }
  }, [open, syncPos])

  useEffect(() => {
    if (!open) return
    const onDoc = (e) => {
      const t = e.target
      if (wrapRef.current?.contains(t)) return
      if (document.querySelector(`[data-premium-multi-panel="${id}"]`)?.contains(t)) return
      setOpen(false)
    }
    document.addEventListener('mousedown', onDoc, true)
    return () => document.removeEventListener('mousedown', onDoc, true)
  }, [open, id])

  function toggle(v) {
    const next = new Set(value)
    if (next.has(v)) next.delete(v)
    else next.add(v)
    onChange([...next])
  }

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
      const enabled = filtered.filter((o) => !o.disabled)
      if (enabled.length === 0) return

      if (e.key === 'ArrowDown') {
        e.preventDefault()
        setHighlight((h) => {
          const idx = filtered.map((o, i) => (!o.disabled ? i : -1)).filter((i) => i >= 0)
          if (!idx.length) return 0
          const p = idx.indexOf(h)
          const n = p < 0 ? 0 : (p + 1) % idx.length
          return idx[n]
        })
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault()
        setHighlight((h) => {
          const idx = filtered.map((o, i) => (!o.disabled ? i : -1)).filter((i) => i >= 0)
          if (!idx.length) return 0
          const p = idx.indexOf(h)
          const n = p <= 0 ? idx[idx.length - 1] : idx[p - 1]
          return n
        })
      }
      if (e.key === 'Enter') {
        const t = e.target
        if (t instanceof HTMLButtonElement && t.getAttribute('role') === 'option') return
        const panel = document.querySelector(`[data-premium-multi-panel="${id}"]`)
        if (!panel?.contains(t) && t !== searchRef.current) return
        e.preventDefault()
        const row = filtered[highlight]
        if (row && !row.disabled) toggle(row.value)
      }
    }
    window.addEventListener('keydown', onKey, true)
    return () => window.removeEventListener('keydown', onKey, true)
  }, [open, filtered, highlight, id])

  useEffect(() => {
    if (!open) return
    itemRefs.current[highlight]?.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
  }, [highlight, open])

  const panelVisible = entered
  const panelTransformHidden = pos.flip ? 'translateY(8px) scale(0.98)' : 'translateY(-8px) scale(0.98)'

  const menu =
    open &&
    createPortal(
      <div
        data-premium-multi-panel={id}
        role="listbox"
        id={listboxId}
        aria-multiselectable="true"
        className={panelCls}
        style={{
          top: pos.flip ? 'auto' : pos.top,
          bottom: pos.flip ? pos.bottom : 'auto',
          left: pos.left,
          width: pos.width,
          opacity: panelVisible ? 1 : 0,
          transform: panelVisible ? 'translateY(0) scale(1)' : panelTransformHidden,
          transformOrigin: pos.flip ? 'bottom center' : 'top center',
          transition: 'opacity 0.18s ease, transform 0.18s ease',
          pointerEvents: panelVisible ? 'auto' : 'none',
        }}
      >
        {showSearch ? (
          <div className="shrink-0 border-b border-[rgba(255,255,255,0.08)] p-2">
            <div className="relative">
              <MagnifyingGlassIcon className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[#9AA4B2]" />
              <input
                ref={searchRef}
                id={searchId}
                type="search"
                autoComplete="off"
                placeholder={searchPlaceholder}
                className="w-full rounded-lg border border-[rgba(255,255,255,0.08)] bg-[#121722] py-2 pl-9 pr-3 text-[13px] text-[#E6EAF2] placeholder:text-[#9AA4B2] outline-none focus:ring-2 focus:ring-[#2563EB]/25"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
            </div>
          </div>
        ) : null}
        <div
          className="pf-premium-select-options min-h-0 flex-1 overflow-y-auto px-1 py-1"
          style={{ maxHeight: showSearch ? 180 : 220 }}
        >
          {filtered.map((o, i) => {
            const isOn = set.has(o.value)
            const isHi = i === highlight
            let cls = `${itemBase} text-[#E6EAF2] `
            if (isOn) cls += 'bg-[rgba(37,99,235,0.2)] text-[#6EA8FE] '
            else if (isHi) cls += 'bg-[#1E2532] '
            else cls += 'hover:bg-[#1E2532] '
            return (
              <button
                key={`${o.value}-${i}`}
                ref={(el) => {
                  itemRefs.current[i] = el
                }}
                type="button"
                role="option"
                aria-selected={isOn}
                disabled={o.disabled}
                className={cls}
                onMouseEnter={() => setHighlight(i)}
                onClick={() => !o.disabled && toggle(o.value)}
              >
                <span className="min-w-0 flex-1 truncate">{o.label}</span>
                {isOn ? <span className="shrink-0 text-xs font-semibold text-[#6EA8FE]">✓</span> : null}
              </button>
            )
          })}
        </div>
      </div>,
      portalRoot(),
    )

  const lbl = labelClassName ?? labelCls

  return (
    <div ref={wrapRef} className={['min-w-0', className].filter(Boolean).join(' ')}>
      {name
        ? value.map((v) => <input key={v} type="hidden" name={`${name}[]`} value={v} />)
        : null}
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
        className={`${triggerCls} ${disabled ? 'cursor-not-allowed opacity-50' : ''} ${label ? 'mt-1' : ''}`}
        onClick={() => !disabled && setOpen((v) => !v)}
      >
        <span className="min-w-0 flex-1 truncate text-left">
          {summary ? (
            <span className="block truncate dark:text-[#E6EAF2]">{summary}</span>
          ) : (
            <span className="text-slate-500 dark:text-[#9AA4B2]">{placeholder}</span>
          )}
        </span>
        <ChevronDownIcon
          className={`h-4 w-4 shrink-0 text-slate-500 transition-transform dark:text-[#9AA4B2] ${open ? 'rotate-180' : ''}`}
        />
      </button>
      {menu}
    </div>
  )
}
