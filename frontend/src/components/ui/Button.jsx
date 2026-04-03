import { forwardRef } from 'react'

const baseTap = 'transition-transform duration-150 active:scale-[0.96] disabled:pointer-events-none disabled:opacity-50'

export const PrimaryButton = forwardRef(function PrimaryButton(
  { className = '', children, fullWidth, ...rest },
  ref,
) {
  return (
    <button
      ref={ref}
      type="button"
      className={[
        'inline-flex h-11 min-h-[44px] items-center justify-center rounded-[10px] bg-[var(--pf-primary)] px-4 text-sm font-semibold text-white md:h-10',
        'hover:bg-[var(--pf-primary-hover)]',
        baseTap,
        fullWidth ? 'w-full' : '',
        className,
      ]
        .filter(Boolean)
        .join(' ')}
      {...rest}
    >
      {children}
    </button>
  )
})

export const GhostButton = forwardRef(function GhostButton({ className = '', children, fullWidth, ...rest }, ref) {
  return (
    <button
      ref={ref}
      type="button"
      className={[
        'inline-flex h-11 min-h-[44px] items-center justify-center rounded-[10px] border border-transparent bg-transparent px-4 text-sm font-semibold text-[var(--pf-text)]',
        'hover:border-[var(--pf-border)] hover:bg-[var(--pf-card-hover)]',
        baseTap,
        fullWidth ? 'w-full' : '',
        className,
      ]
        .filter(Boolean)
        .join(' ')}
      {...rest}
    >
      {children}
    </button>
  )
})
