import { MoonIcon, SunIcon } from '@heroicons/react/24/solid'

/** Controlled light/dark toggle for shells that manage theme externally. */
export default function ThemeToggle({ dark, onToggle, className = '' }) {
  return (
    <button
      type="button"
      onClick={() => onToggle?.(!dark)}
      className={[
        'flex h-10 w-10 items-center justify-center rounded-[10px] text-[var(--pf-text-muted)] transition hover:bg-black/[0.06] active:scale-95 dark:hover:bg-white/[0.06]',
        className,
      ]
        .filter(Boolean)
        .join(' ')}
      title={dark ? 'Light mode' : 'Dark mode'}
    >
      {dark ? <SunIcon className="h-5 w-5" /> : <MoonIcon className="h-5 w-5" />}
    </button>
  )
}
