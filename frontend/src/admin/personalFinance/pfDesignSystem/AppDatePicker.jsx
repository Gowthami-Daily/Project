import { CalendarDaysIcon } from '@heroicons/react/24/solid'
import { format, isValid, parse, parseISO } from 'date-fns'
import { useCallback, useEffect, useId, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { DayPicker } from 'react-day-picker'
import 'react-day-picker/style.css'

import { labelCls } from '../pfFormStyles.js'

const DISPLAY_FMT = 'dd-MM-yyyy'

function isoToDate(iso) {
  if (!iso || typeof iso !== 'string') return undefined
  const raw = iso.length >= 10 ? iso.slice(0, 10) : iso
  const d = parseISO(raw)
  return isValid(d) ? d : undefined
}

function dateToIso(d) {
  if (!d || !isValid(d)) return ''
  return format(d, 'yyyy-MM-dd')
}

function isoToDisplay(iso) {
  const d = isoToDate(iso)
  return d ? format(d, DISPLAY_FMT) : ''
}

function parseDisplay(s) {
  const d = parse(s.trim(), DISPLAY_FMT, new Date())
  return isValid(d) ? d : null
}

function portalRoot() {
  return document.querySelector('.pf-app') || document.body
}

const inputCls =
  'box-border h-10 min-w-0 flex-1 rounded-[10px] border border-[var(--pf-border)] bg-[var(--pf-input-bg)] px-3 text-[13px] text-[var(--pf-text)] outline-none transition-[border-color,box-shadow] placeholder:text-[var(--pf-text-muted)] focus:border-[var(--pf-primary)] focus:ring-2 focus:ring-[var(--pf-primary)]/25'

const calBtnCls =
  'inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-[10px] border border-[var(--pf-border)] bg-[var(--pf-input-bg)] text-[var(--pf-text-muted)] transition hover:bg-[var(--pf-card-hover)] hover:text-[var(--pf-text)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--pf-primary)]'

/**
 * Single date for Personal Finance — `value` / `onChange` use `yyyy-MM-dd`; displays **DD-MM-YYYY**.
 *
 * @param {{
 *   id?: string
 *   label?: string | null
 *   value: string
 *   onChange: (iso: string) => void
 *   disabled?: boolean
 *   className?: string
 *   placeholder?: string
 *   minDate?: Date
 *   maxDate?: Date
 *   name?: string
 * }} props
 */
export function AppDatePicker({
  id: idProp,
  label = null,
  value,
  onChange,
  disabled = false,
  className = '',
  placeholder = 'DD-MM-YYYY',
  minDate,
  maxDate,
  name,
}) {
  const autoId = useId()
  const id = idProp || `app-dp-${autoId.replace(/:/g, '')}`
  const panelId = `${id}-calendar`

  const [open, setOpen] = useState(false)
  const [entered, setEntered] = useState(false)
  const [text, setText] = useState(() => isoToDisplay(value))
  const typingRef = useRef(false)
  const wrapRef = useRef(null)
  const inputRef = useRef(null)
  const [pos, setPos] = useState({ top: 0, left: 0, width: 288 })

  useEffect(() => {
    if (typingRef.current) return
    setText(isoToDisplay(value))
  }, [value])

  useEffect(() => {
    if (!open) {
      setEntered(false)
      return
    }
    let r2 = 0
    const r1 = requestAnimationFrame(() => {
      r2 = requestAnimationFrame(() => setEntered(true))
    })
    return () => {
      cancelAnimationFrame(r1)
      cancelAnimationFrame(r2)
    }
  }, [open])

  const syncPos = useCallback(() => {
    const el = wrapRef.current
    if (!el) return
    const r = el.getBoundingClientRect()
    const w = Math.max(r.width, 288)
    let left = r.left
    if (left + w > window.innerWidth - 8) left = Math.max(8, window.innerWidth - w - 8)
    setPos({ top: r.bottom + 8, left, width: w })
  }, [])

  useLayoutEffect(() => {
    if (!open) return
    syncPos()
  }, [open, syncPos])

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
      if (document.getElementById(panelId)?.contains(t)) return
      setOpen(false)
    }
    document.addEventListener('mousedown', onDoc, true)
    return () => document.removeEventListener('mousedown', onDoc, true)
  }, [open, panelId])

  const selected = isoToDate(value)
  const defaultMonth = selected || new Date()
  const y = new Date().getFullYear()

  const disabledMatchers = []
  if (minDate) disabledMatchers.push({ before: minDate })
  if (maxDate) disabledMatchers.push({ after: maxDate })

  function commitFromText() {
    typingRef.current = false
    const parsed = parseDisplay(text)
    if (parsed) {
      onChange(dateToIso(parsed))
      setText(format(parsed, DISPLAY_FMT))
    } else if (!text.trim()) {
      onChange('')
      setText('')
    } else {
      setText(isoToDisplay(value))
    }
  }

  function onSelectDay(d) {
    if (!d) return
    onChange(dateToIso(d))
    setText(format(d, DISPLAY_FMT))
    setOpen(false)
    inputRef.current?.focus()
  }

  const popover =
    open &&
    createPortal(
      <div
        id={panelId}
        className="ds-dropdown-panel--enter fixed z-[118] overflow-hidden rounded-[12px] border border-[var(--pf-border)] bg-[var(--pf-card)] p-3 shadow-[var(--pf-modal-shadow)]"
        style={{
          top: pos.top,
          left: pos.left,
          width: pos.width,
          maxWidth: 'min(100vw - 16px, 340px)',
          opacity: entered ? 1 : 0,
          pointerEvents: entered ? 'auto' : 'none',
          transition: 'opacity 0.15s ease',
        }}
        role="dialog"
        aria-label="Calendar"
      >
        <DayPicker
          mode="single"
          selected={selected}
          onSelect={onSelectDay}
          defaultMonth={defaultMonth}
          captionLayout="dropdown"
          startMonth={new Date(y - 100, 0)}
          endMonth={new Date(y + 10, 11)}
          disabled={disabledMatchers.length ? disabledMatchers : undefined}
          className="ds-rdp"
        />
      </div>,
      portalRoot(),
    )

  return (
    <div ref={wrapRef} className={['min-w-0', className].filter(Boolean).join(' ')}>
      {name ? <input type="hidden" name={name} value={value || ''} /> : null}
      {label ? (
        <label className={labelCls} htmlFor={id}>
          {label}
        </label>
      ) : null}
      <div className={`flex min-w-0 gap-2 ${label ? 'mt-1' : ''}`}>
        <input
          ref={inputRef}
          id={id}
          type="text"
          inputMode="text"
          autoComplete="off"
          placeholder={placeholder}
          disabled={disabled}
          className={inputCls}
          value={text}
          onChange={(e) => {
            typingRef.current = true
            setText(e.target.value)
          }}
          onBlur={() => commitFromText()}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault()
              commitFromText()
            }
            if (e.key === 'Escape' && open) {
              e.preventDefault()
              setOpen(false)
            }
          }}
        />
        <button
          type="button"
          disabled={disabled}
          className={calBtnCls}
          aria-label="Open calendar"
          aria-expanded={open}
          aria-controls={open ? panelId : undefined}
          onClick={() => !disabled && setOpen((o) => !o)}
        >
          <CalendarDaysIcon className="h-5 w-5" />
        </button>
      </div>
      {popover}
    </div>
  )
}
