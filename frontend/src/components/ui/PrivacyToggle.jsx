import { EyeIcon, EyeSlashIcon } from '@heroicons/react/24/solid'

/** Controlled privacy toggle (blur main content via parent / CSS). */
export default function PrivacyToggle({ active, onToggle, className = '' }) {
  return (
    <button
      type="button"
      onClick={() => onToggle?.(!active)}
      className={[
        'flex h-10 w-10 items-center justify-center rounded-[10px] text-[var(--pf-text-muted)] transition hover:bg-black/[0.06] active:scale-95 dark:hover:bg-white/[0.06]',
        className,
      ]
        .filter(Boolean)
        .join(' ')}
      aria-pressed={active}
      title={active ? 'Show amounts' : 'Privacy blur'}
    >
      {active ? <EyeSlashIcon className="h-5 w-5" /> : <EyeIcon className="h-5 w-5" />}
    </button>
  )
}
