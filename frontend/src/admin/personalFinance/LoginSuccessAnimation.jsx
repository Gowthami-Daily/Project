import { useEffect, useMemo, useState } from 'react'
import confetti from 'canvas-confetti'
import { motion, useReducedMotion } from 'framer-motion'
import './loginSuccessCelebration.css'

function useGreetingLine(displayName) {
  const name = displayName?.trim() || 'there'
  return useMemo(() => {
    const pool = [
      `Welcome back, ${name} 👋`,
      `Good to see you again, ${name}`,
      `Ready to grow your wealth today?`,
      `Your money dashboard is ready`,
      `Let's check your finances 🚀`,
    ]
    return pool[Math.floor(Math.random() * pool.length)]
  }, [name])
}

function centerStarBurst() {
  const colors = ['#38bdf8', '#818cf8', '#a78bfa', '#e879f9', '#f0f9ff']
  confetti({
    particleCount: 88,
    spread: 108,
    startVelocity: 36,
    origin: { x: 0.5, y: 0.4 },
    colors,
    ticks: 220,
    gravity: 1.05,
    scalar: 0.95,
    disableForReducedMotion: true,
  })
  window.setTimeout(() => {
    confetti({
      particleCount: 42,
      spread: 360,
      startVelocity: 22,
      origin: { x: 0.5, y: 0.42 },
      colors,
      ticks: 120,
      gravity: 0.95,
      scalar: 0.75,
      shapes: ['circle'],
      disableForReducedMotion: true,
    })
  }, 90)
}

/**
 * @param {{ displayName: string, playConfetti: boolean, onDone: () => void | Promise<void> }} props
 * Special path (~2s): burst + flash mid-way. Normal path: brief fade then dashboard.
 */
export default function LoginSuccessAnimation({ displayName, playConfetti, onDone }) {
  const reduce = useReducedMotion()
  const line = useGreetingLine(displayName)
  const [phase, setPhase] = useState('hold')
  const [flash, setFlash] = useState(false)

  const timings = useMemo(() => {
    if (reduce) {
      return { blastAt: null, holdMs: playConfetti ? 720 : 380, exitMs: 260 }
    }
    if (playConfetti) {
      return { blastAt: 800, holdMs: 1380, exitMs: 400 }
    }
    return { blastAt: null, holdMs: 520, exitMs: 320 }
  }, [playConfetti, reduce])

  useEffect(() => {
    if (!playConfetti || reduce || timings.blastAt == null) return undefined
    let flashOff
    const t = window.setTimeout(() => {
      setFlash(true)
      centerStarBurst()
      flashOff = window.setTimeout(() => setFlash(false), 700)
    }, timings.blastAt)
    return () => {
      clearTimeout(t)
      if (flashOff) clearTimeout(flashOff)
    }
  }, [playConfetti, reduce, timings.blastAt])

  useEffect(() => {
    const { holdMs, exitMs } = timings
    const tExit = window.setTimeout(() => setPhase('exit'), holdMs)
    const tDone = window.setTimeout(() => {
      Promise.resolve(onDone()).catch(() => {})
    }, holdMs + exitMs)
    return () => {
      clearTimeout(tExit)
      clearTimeout(tDone)
    }
  }, [onDone, timings])

  return (
    <motion.div
      className="pf-login-success-root"
      initial={{ opacity: 0 }}
      animate={{ opacity: phase === 'exit' ? 0 : 1 }}
      transition={{
        duration: phase === 'exit' ? 0.36 : 0.28,
        ease: [0.22, 1, 0.36, 1],
      }}
      role="status"
      aria-live="polite"
      aria-atomic="true"
    >
      <div className={`pf-login-success-flash ${flash ? 'pf-login-success-flash--on' : ''}`} aria-hidden />
      <div className="pf-login-success-glow" aria-hidden />
      <motion.div
        className="pf-login-success-inner"
        initial={{ opacity: 0, y: 20, scale: 0.98 }}
        animate={{
          opacity: phase === 'exit' ? 0 : 1,
          y: phase === 'exit' ? -10 : 0,
          scale: phase === 'exit' ? 0.98 : 1,
        }}
        transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
      >
        <p className="pf-login-success-emoji" aria-hidden>
          ✨
        </p>
        <h1 id="pf-login-success-title" className="pf-login-success-title">
          {line}
        </h1>
        <p id="pf-login-success-sub" className="pf-login-success-sub">
          Loading your dashboard…
        </p>
      </motion.div>
    </motion.div>
  )
}
