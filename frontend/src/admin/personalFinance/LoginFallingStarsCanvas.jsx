import { useEffect, useRef, useState } from 'react'

const MOBILE_MAX = 768

function shouldRunStars() {
  if (typeof window === 'undefined') return false
  try {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return false
  } catch {
    /* ignore */
  }
  return window.innerWidth >= MOBILE_MAX
}

/**
 * Subtle falling particles behind the login UI. Off on small viewports and when reduced motion is requested.
 */
export default function LoginFallingStarsCanvas({ className = '' }) {
  const canvasRef = useRef(null)
  const rafRef = useRef(0)
  const starsRef = useRef([])
  const runningRef = useRef(false)
  const [active, setActive] = useState(false)

  useEffect(() => {
    setActive(shouldRunStars())
    const onResize = () => setActive(shouldRunStars())
    let mq
    try {
      mq = window.matchMedia('(prefers-reduced-motion: reduce)')
      mq.addEventListener('change', onResize)
    } catch {
      mq = null
    }
    window.addEventListener('resize', onResize)
    return () => {
      window.removeEventListener('resize', onResize)
      mq?.removeEventListener('change', onResize)
    }
  }, [])

  useEffect(() => {
    if (!active) return undefined

    const canvas = canvasRef.current
    if (!canvas) return undefined

    const ctx = canvas.getContext('2d', { alpha: true })
    if (!ctx) return undefined

    const rand = (a, b) => a + Math.random() * (b - a)

    function pickColor() {
      const hueRoll = Math.random()
      if (hueRoll < 0.45) {
        return {
          cr: 220 + Math.random() * 35,
          cg: 230 + Math.random() * 25,
          cb: 255,
        }
      }
      if (hueRoll < 0.78) {
        return {
          cr: 147 + Math.random() * 40,
          cg: 180 + Math.random() * 50,
          cb: 255,
        }
      }
      return {
        cr: 196 + Math.random() * 40,
        cg: 181 + Math.random() * 50,
        cb: 253,
      }
    }

    function initStars(w, h) {
      const n = Math.min(52, Math.floor((w * h) / 24000) + 26)
      starsRef.current = Array.from({ length: n }, () => {
        const { cr, cg, cb } = pickColor()
        return {
          x: Math.random() * w,
          y: Math.random() * h,
          rad: rand(0.35, 1.55),
          vy: rand(0.035, 0.2),
          vx: rand(-0.028, 0.028),
          baseA: rand(0.1, 0.38),
          tw: rand(0, Math.PI * 2),
          twSp: rand(0.012, 0.042),
          cr,
          cg,
          cb,
        }
      })
    }

    function resize() {
      const dpr = Math.min(window.devicePixelRatio || 1, 2)
      const w = window.innerWidth
      const h = window.innerHeight
      canvas.width = Math.floor(w * dpr)
      canvas.height = Math.floor(h * dpr)
      canvas.style.width = `${w}px`
      canvas.style.height = `${h}px`
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      initStars(w, h)
    }

    resize()

    const onResize = () => {
      if (!shouldRunStars()) {
        runningRef.current = false
        cancelAnimationFrame(rafRef.current)
        return
      }
      resize()
    }
    window.addEventListener('resize', onResize)

    let last = performance.now()
    const step = (now) => {
      if (!runningRef.current || !shouldRunStars()) return
      const w = window.innerWidth
      const h = window.innerHeight

      const dt = Math.min(32, now - last)
      last = now

      ctx.clearRect(0, 0, w, h)

      const stars = starsRef.current
      for (let i = 0; i < stars.length; i += 1) {
        const s = stars[i]
        s.y += s.vy * dt * 0.075
        s.x += s.vx * dt * 0.055
        s.tw += s.twSp * dt * 0.018
        if (s.y > h + 6) {
          s.y = rand(-12, -2)
          s.x = Math.random() * w
        }
        if (s.x < -6) s.x = w + 6
        if (s.x > w + 6) s.x = -6

        const pulse = 0.72 + 0.28 * Math.sin(s.tw)
        const a = s.baseA * pulse

        ctx.beginPath()
        ctx.arc(s.x, s.y, s.rad, 0, Math.PI * 2)
        ctx.fillStyle = `rgba(${s.cr},${s.cg},${s.cb},${a})`
        ctx.shadowBlur = s.rad * 3.4
        ctx.shadowColor = `rgba(${s.cr},${s.cg},${s.cb},${a * 0.85})`
        ctx.fill()
        ctx.shadowBlur = 0
      }

      rafRef.current = requestAnimationFrame(step)
    }

    runningRef.current = true
    rafRef.current = requestAnimationFrame(step)

    return () => {
      runningRef.current = false
      cancelAnimationFrame(rafRef.current)
      window.removeEventListener('resize', onResize)
    }
  }, [active])

  if (!active) return null

  return (
    <canvas
      ref={canvasRef}
      className={['pointer-events-none fixed inset-0 z-[1] opacity-[0.92]', className].filter(Boolean).join(' ')}
      aria-hidden
    />
  )
}
