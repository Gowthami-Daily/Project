import { useMemo } from 'react'
import './loginShootingStars.css'

/**
 * @param {{ speedMultiplier?: number, reducedMotion?: boolean }} props
 * speedMultiplier > 1 while signing in / transition (stars feel “rushed”).
 */
export default function LoginShootingStars({ speedMultiplier = 1, reducedMotion = false }) {
  const mult = Math.max(0.85, Math.min(speedMultiplier, 4))

  const stars = useMemo(() => {
    const n = reducedMotion ? 14 : 30
    return Array.from({ length: n }, (_, i) => {
      const isDot = Math.random() < 0.38
      return {
        id: i,
        leftPct: Math.random() * 100,
        topPct: -5 + Math.random() * 58,
        sizePx: isDot ? 0 : 11 + Math.random() * 9,
        delaySec: Math.random() * 5.5,
        baseDurSec: 5 + Math.random() * 5.5,
        blurPx: Math.random() < 0.32 ? 0.7 + Math.random() * 1.2 : 0,
        peakOp: 0.45 + Math.random() * 0.38,
        midOp: 0.28 + Math.random() * 0.28,
        isDot,
      }
    })
  }, [reducedMotion])

  if (reducedMotion) {
    return (
      <div className="pf-shooting-stars pf-shooting-stars--reduced" aria-hidden>
        {stars.map((s) => (
          <span
            key={s.id}
            className={`pf-shooting-star ${s.isDot ? 'pf-shooting-star--dot' : ''}`}
            style={{
              left: `${s.leftPct}%`,
              top: `${s.topPct}%`,
              fontSize: s.isDot ? 0 : `${Math.max(10, s.sizePx)}px`,
              filter: s.blurPx > 0 ? `blur(${s.blurPx}px)` : undefined,
            }}
          >
            {s.isDot ? null : '✨'}
          </span>
        ))}
      </div>
    )
  }

  return (
    <div className="pf-shooting-stars" aria-hidden>
      {stars.map((s) => {
        const dur = s.baseDurSec / mult
        return (
          <span
            key={s.id}
            className={`pf-shooting-star ${s.isDot ? 'pf-shooting-star--dot' : ''}`}
            style={{
              left: `${s.leftPct}%`,
              top: `${s.topPct}%`,
              fontSize: s.isDot ? 0 : `${Math.max(10, s.sizePx)}px`,
              width: s.isDot ? `${4 + (s.sizePx % 3)}px` : undefined,
              height: s.isDot ? `${4 + (s.sizePx % 3)}px` : undefined,
              animationDuration: `${dur}s`,
              animationDelay: `${s.delaySec}s`,
              filter: s.blurPx > 0 ? `blur(${s.blurPx}px)` : undefined,
              ['--pf-star-peak-op']: String(s.peakOp),
              ['--pf-star-mid-op']: String(s.midOp),
            }}
          >
            {s.isDot ? null : '✨'}
          </span>
        )
      })}
    </div>
  )
}
