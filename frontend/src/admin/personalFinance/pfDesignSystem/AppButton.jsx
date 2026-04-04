import { forwardRef } from 'react'

const base =
  'inline-flex h-10 min-h-10 shrink-0 items-center justify-center gap-2 rounded-[10px] px-4 text-[13px] font-medium ' +
  'outline-none focus-visible:ring-2 focus-visible:ring-[var(--pf-primary)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--pf-bg)] ' +
  'disabled:pointer-events-none disabled:opacity-50 ' +
  'transition-[transform,box-shadow,background-color,border-color,filter] duration-150 ease-out ' +
  'motion-safe:active:scale-[0.97] motion-safe:active:duration-100 ' +
  'hover:-translate-y-px hover:shadow-md motion-reduce:hover:translate-y-0'

const variants = {
  primary:
    'border border-transparent bg-[var(--pf-primary)] text-white shadow-sm hover:brightness-110 hover:bg-[var(--pf-primary-hover)] hover:shadow-lg',
  secondary:
    'border border-[var(--pf-border)] bg-[var(--pf-card)] text-[var(--pf-text)] shadow-sm hover:bg-[var(--pf-card-hover)] hover:border-[var(--pf-border)] dark:bg-[var(--pf-input-bg)]',
  ghost: 'border border-transparent bg-transparent text-[var(--pf-text)] hover:bg-[var(--pf-card-hover)] hover:shadow-none',
  danger:
    'border-2 border-[var(--pf-danger)] bg-transparent text-[var(--pf-danger)] shadow-sm hover:bg-[var(--pf-danger)]/10 hover:shadow-md',
  dangerSolid:
    'border border-transparent bg-[var(--pf-danger)] text-white shadow-sm hover:bg-red-600 hover:shadow-lg',
  success:
    'border border-transparent bg-[var(--pf-success)] text-white shadow-sm hover:bg-emerald-600 dark:hover:bg-emerald-500 hover:shadow-lg',
}

/**
 * @param {{ variant?: keyof typeof variants, className?: string, type?: string, children?: import('react').ReactNode }} props
 */
export const AppButton = forwardRef(function AppButton(
  { variant = 'primary', className = '', type = 'button', ...rest },
  ref,
) {
  return (
    <button
      ref={ref}
      type={type}
      className={[base, variants[variant] || variants.primary, className].filter(Boolean).join(' ')}
      {...rest}
    />
  )
})
