import { cardCls } from '../pfFormStyles.js'

/**
 * Rounded 14px surface using shared `cardCls`; optional title and hover elevation.
 */
export function AppCard({ children, className = '', title = null, interactive = true }) {
  return (
    <section
      className={[cardCls, interactive ? 'ds-card-interactive' : '', className].filter(Boolean).join(' ')}
    >
      {title ? <h3 className="ds-card-title mb-3">{title}</h3> : null}
      {children}
    </section>
  )
}
