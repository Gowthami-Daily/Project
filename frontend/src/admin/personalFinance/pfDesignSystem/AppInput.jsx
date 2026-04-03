import { inputCls, labelCls } from '../pfFormStyles.js'

const dsInput =
  'mt-1.5 w-full rounded-none border-0 border-b border-[var(--pf-border)] bg-transparent px-0 py-2.5 text-sm text-[var(--pf-text)] outline-none ' +
  'placeholder:text-[var(--pf-text-muted)] transition-colors ' +
  'focus:border-[var(--pf-primary)] focus:ring-0'

const dsAmount = dsInput + ' text-right font-mono tabular-nums'

/**
 * Design-system field. `variant="ds"` = underline / transparent (modal premium). `variant="boxed"` = shared pf input.
 */
export function AppInput({
  id,
  label,
  hint,
  variant = 'ds',
  amount = false,
  className = '',
  inputClassName = '',
  ...inputProps
}) {
  const fieldCls = variant === 'boxed' ? inputCls : amount ? dsAmount : dsInput
  return (
    <div className={className}>
      {label ? (
        <label htmlFor={id} className={`${labelCls} !mt-0`}>
          {label}
        </label>
      ) : null}
      <input id={id} className={[fieldCls, inputClassName].filter(Boolean).join(' ')} {...inputProps} />
      {hint ? <p className="mt-1 text-xs text-[var(--pf-text-muted)]">{hint}</p> : null}
    </div>
  )
}

/**
 * Textarea with same DS underline treatment (minimal chrome underline approximated with border).
 */
export function AppTextarea({
  id,
  label,
  hint,
  variant = 'ds',
  className = '',
  inputClassName = '',
  rows = 3,
  ...props
}) {
  const fieldCls =
    variant === 'boxed'
      ? inputCls
      : 'mt-1.5 w-full resize-y rounded-[10px] border border-[var(--pf-border)] bg-transparent px-3 py-2 text-sm text-[var(--pf-text)] outline-none focus:border-[var(--pf-primary)]'
  return (
    <div className={className}>
      {label ? (
        <label htmlFor={id} className={`${labelCls} !mt-0`}>
          {label}
        </label>
      ) : null}
      <textarea id={id} rows={rows} className={[fieldCls, inputClassName].filter(Boolean).join(' ')} {...props} />
      {hint ? <p className="mt-1 text-xs text-[var(--pf-text-muted)]">{hint}</p> : null}
    </div>
  )
}
