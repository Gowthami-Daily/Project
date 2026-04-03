import { forwardRef } from 'react'

const base =
  'inline-flex h-10 min-h-[40px] shrink-0 items-center justify-center gap-2 rounded-[10px] px-4 text-sm font-medium transition duration-200 ' +
  'outline-none focus-visible:ring-2 focus-visible:ring-[var(--pf-primary)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--pf-bg)] ' +
  'disabled:pointer-events-none disabled:opacity-50 active:scale-[0.96]'

const variants = {
  primary:
    'border border-transparent bg-[var(--pf-primary)] text-white shadow-sm hover:bg-[var(--pf-primary-hover)]',
  secondary:
    'border-2 border-[var(--pf-primary)] bg-[var(--pf-card)] text-[var(--pf-primary)] hover:bg-[var(--pf-card-hover)] dark:bg-transparent',
  ghost: 'border border-transparent bg-transparent text-[var(--pf-text)] hover:bg-[var(--pf-card-hover)]',
  danger: 'border border-transparent bg-[var(--pf-danger)] text-white shadow-sm hover:bg-red-600',
  success:
    'border border-transparent bg-[var(--pf-success)] text-white shadow-sm hover:bg-emerald-600 dark:hover:bg-emerald-500',
}

/**
 * @param {{ variant?: keyof typeof variants, className?: string, type?: string, children?: import('react').ReactNode }} props
 */
export const AppButton = forwardRef(function AppButton(
  { variant = 'primary', className = '', type = 'button', ...rest },
  ref,
) {
  return <button ref={ref} type={type} className={[base, variants[variant] || variants.primary, className].filter(Boolean).join(' ')} {...rest} />
})
