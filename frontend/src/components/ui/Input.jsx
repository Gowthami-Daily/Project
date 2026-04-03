import { forwardRef, useId, useState } from 'react'

/**
 * Bottom-border floating label input (Aether). Mono for numeric types.
 */
export const FloatingInput = forwardRef(function FloatingInput(
  { label, id: idProp, className = '', inputClassName = '', type = 'text', onFocus, onBlur, ...rest },
  ref,
) {
  const gen = useId()
  const id = idProp || gen
  const [focus, setFocus] = useState(false)
  const hasValue =
    rest.value !== undefined &&
    rest.value !== null &&
    String(rest.value).length > 0 &&
    !(type === 'number' && (rest.value === '' || Number.isNaN(Number(rest.value))))
  const floated = focus || hasValue
  const mono = type === 'number' || type === 'tel' || rest.inputMode === 'decimal'

  return (
    <div className={`relative pt-4 ${className}`}>
      <label
        htmlFor={id}
        className={[
          'pointer-events-none absolute left-0 origin-left text-[var(--pf-text-muted)] transition-all duration-200',
          floated ? 'top-0 text-[11px] font-semibold uppercase tracking-wide' : 'top-5 text-sm',
        ].join(' ')}
      >
        {label}
      </label>
      <input
        ref={ref}
        id={id}
        type={type}
        className={[
          'w-full border-0 border-b border-[var(--pf-border)] bg-transparent pb-2 pt-1 text-sm text-[var(--pf-text)] outline-none transition-colors',
          'focus:border-[var(--pf-primary)]',
          mono ? 'font-mono tabular-nums' : '',
          inputClassName,
        ]
          .filter(Boolean)
          .join(' ')}
        onFocus={(e) => {
          setFocus(true)
          onFocus?.(e)
        }}
        onBlur={(e) => {
          setFocus(false)
          onBlur?.(e)
        }}
        {...rest}
      />
    </div>
  )
})
