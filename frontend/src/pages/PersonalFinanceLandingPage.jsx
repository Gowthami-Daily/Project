import { useEffect, useRef, useState } from 'react'
import { Link, Navigate } from 'react-router-dom'
import {
  AnimatePresence,
  motion,
  useInView,
  useReducedMotion,
} from 'framer-motion'
import {
  ArrowRightIcon,
  ArrowTrendingUpIcon,
  BanknotesIcon,
  ChartPieIcon,
  ChevronRightIcon,
  CreditCardIcon,
  CubeIcon,
  DocumentChartBarIcon,
  LockClosedIcon,
  ScaleIcon,
  ShieldCheckIcon,
  WalletIcon,
} from '@heroicons/react/24/outline'
import RiverLogo from '../admin/RiverLogo.jsx'
import { getPfToken } from '../admin/personalFinance/api.js'
import './pfLandingPremium.css'

const fadeUp = {
  initial: { opacity: 0, y: 28 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true, margin: '-80px' },
  transition: { duration: 0.55, ease: [0.22, 1, 0.36, 1] },
}

const staggerContainer = {
  hidden: {},
  visible: {
    transition: { staggerChildren: 0.09, delayChildren: 0.06 },
  },
}

const staggerItem = {
  hidden: { opacity: 0, y: 22 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.5, ease: [0.22, 1, 0.36, 1] },
  },
}

const glass =
  'rounded-2xl border border-white/10 bg-white/[0.06] shadow-xl shadow-black/25 backdrop-blur-xl'

const btnGradient =
  'pf-landing-btn-primary group relative inline-flex items-center justify-center gap-2 overflow-hidden rounded-xl bg-gradient-to-r from-sky-500 via-indigo-500 to-violet-600 px-5 py-3 text-sm font-bold text-white shadow-lg shadow-indigo-500/30 hover:brightness-110'

const btnGhost =
  'inline-flex items-center justify-center gap-2 rounded-xl border border-white/15 bg-white/5 px-5 py-3 text-sm font-bold text-white backdrop-blur-md transition hover:bg-white/10 active:scale-[0.99]'

const features = [
  {
    title: 'Expense tracking',
    desc: 'See where every rupee goes with categories and trends.',
    icon: WalletIcon,
  },
  {
    title: 'Income tracking',
    desc: 'Monitor salary, business income, and inflows in one ledger.',
    icon: BanknotesIcon,
  },
  {
    title: 'Loans manager',
    desc: 'Track loans you gave and EMIs you receive or pay.',
    icon: ScaleIcon,
  },
  {
    title: 'Credit cards',
    desc: 'Bills, due dates, and utilization without spreadsheet chaos.',
    icon: CreditCardIcon,
  },
  {
    title: 'Investments',
    desc: 'Holdings, SIPs, and growth alongside the rest of your money.',
    icon: ArrowTrendingUpIcon,
  },
  {
    title: 'Assets',
    desc: 'Property, gold, vehicles — everything that builds wealth.',
    icon: CubeIcon,
  },
  {
    title: 'Net worth',
    desc: 'A live picture of assets minus liabilities, in INR.',
    icon: ChartPieIcon,
  },
  {
    title: 'Reports',
    desc: 'Insights and statements you can actually use for decisions.',
    icon: DocumentChartBarIcon,
  },
]

const steps = [
  { n: '1', title: 'Track your money', desc: 'Log income, spends, loans, cards, and investments.' },
  { n: '2', title: 'Understand your finances', desc: 'Net worth, cash flow, and reports in one OS.' },
  { n: '3', title: 'Grow your wealth', desc: 'Decide with clarity instead of guessing from memory.' },
]

const useCases = [
  {
    title: 'Individuals',
    desc: 'Personal budgets, goals, and a single ledger for all accounts.',
  },
  {
    title: 'Families',
    desc: 'Shared visibility on expenses, EMIs, and household cash flow.',
  },
  {
    title: 'Loan & EMI heavy',
    desc: 'Money you lent, EMIs you collect, and liabilities you owe — together.',
  },
  {
    title: 'Investors',
    desc: 'SIPs, allocation, and net worth — not just a brokerage statement.',
  },
  {
    title: 'Founders & owners',
    desc: 'Keep personal money separate from business books, one OS for life.',
  },
]

const securityPoints = [
  { title: 'Your data stays yours', desc: 'You control what you enter. No selling your patterns.' },
  { title: 'No automatic bank login', desc: 'No screen-scraping or forced bank linking. Manual, intentional entries.' },
  { title: 'Export anytime', desc: 'Take your data out when you need backups or audits.' },
  { title: 'Built for privacy-first use', desc: 'Designed for clarity on your device — backups are yours to manage.' },
]

const faqItems = [
  {
    q: 'Is this free?',
    a: 'Personal use is supported today; pricing may evolve as the product grows. Sign in and explore your workspace.',
  },
  {
    q: 'Is my data safe?',
    a: 'Credentials are handled with standard app security practices. You choose what to store — we don’t pull banks without your action.',
  },
  {
    q: 'Can I export my data?',
    a: 'Yes. Use exports and reports from the app to keep offline copies and spreadsheets in sync.',
  },
  {
    q: 'Does it connect to my bank automatically?',
    a: 'No automatic bank feeds by default. You record transactions and balances intentionally — fewer surprises, more control.',
  },
  {
    q: 'Can I track cash and UPI?',
    a: 'Yes. Tag cash, wallet, and bank-style accounts so spending matches how you actually pay.',
  },
]

const previewTabs = [
  { id: 'dashboard', label: 'Dashboard' },
  { id: 'reports', label: 'Reports' },
  { id: 'investments', label: 'Investments' },
  { id: 'loans', label: 'Loans' },
  { id: 'cards', label: 'Credit cards' },
]

const trustChips = ['Salary accounts', 'UPI & wallets', 'Mutual funds', 'EMIs', 'Net worth', 'Ledger']

function easeOutCubic(t) {
  return 1 - (1 - t) ** 3
}

function useLandingNavScrolled(thresholdPx = 16) {
  const [scrolled, setScrolled] = useState(false)
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > thresholdPx)
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [thresholdPx])
  return scrolled
}

function useHeroParallaxMouse(enabled) {
  const [pos, setPos] = useState({ x: 0, y: 0 })
  useEffect(() => {
    if (!enabled) return undefined
    const onMove = (e) => {
      const w = window.innerWidth || 1
      const h = window.innerHeight || 1
      setPos({
        x: (e.clientX / w - 0.5) * 28,
        y: (e.clientY / h - 0.5) * 20,
      })
    }
    window.addEventListener('mousemove', onMove, { passive: true })
    return () => window.removeEventListener('mousemove', onMove)
  }, [enabled])
  return pos
}

function useAnimatedNumber(target, enabled, durationMs = 1800) {
  const [v, setV] = useState(0)
  useEffect(() => {
    if (!enabled) {
      setV(0)
      return undefined
    }
    let raf
    const t0 = performance.now()
    const tick = (now) => {
      const p = Math.min((now - t0) / durationMs, 1)
      setV(Math.round(target * easeOutCubic(p)))
      if (p < 1) raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [target, enabled, durationMs])
  return v
}

/** Count up to 2.4 for "₹2.4Cr+" style stats (tenths). */
function useAnimatedTenths(targetTenths, enabled, durationMs = 2000) {
  const [v, setV] = useState(0)
  useEffect(() => {
    if (!enabled) {
      setV(0)
      return undefined
    }
    let raf
    const t0 = performance.now()
    const tick = (now) => {
      const p = Math.min((now - t0) / durationMs, 1)
      setV(Math.round(targetTenths * easeOutCubic(p)))
      if (p < 1) raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [targetTenths, enabled, durationMs])
  return v
}

function StatCrPlus({ label }) {
  const ref = useRef(null)
  const inView = useInView(ref, { once: true, margin: '-20%' })
  const reduce = useReducedMotion()
  const tenths = useAnimatedTenths(24, inView && !reduce, 2200)
  const display = reduce ? 2.4 : tenths / 10
  return (
    <div ref={ref} className="text-center">
      <p className="font-mono text-2xl font-bold tabular-nums tracking-tight text-white sm:text-3xl">
        ₹{display.toFixed(1)}Cr+
      </p>
      <p className="mt-2 text-xs font-medium text-slate-400 sm:text-sm">{label}</p>
    </div>
  )
}

function StatCounter({ end, prefix = '', suffix = '', label }) {
  const ref = useRef(null)
  const inView = useInView(ref, { once: true, margin: '-20%' })
  const reduce = useReducedMotion()
  const n = useAnimatedNumber(end, inView && !reduce, 2000)
  const display = reduce ? end : n
  return (
    <div ref={ref} className="text-center">
      <p className="font-mono text-2xl font-bold tabular-nums tracking-tight text-white sm:text-3xl">
        {prefix}
        {display.toLocaleString('en-IN')}
        {suffix}
      </p>
      <p className="mt-2 text-xs font-medium text-slate-400 sm:text-sm">{label}</p>
    </div>
  )
}

function LandingKeyframes() {
  return (
    <style>
      {`
        @keyframes pf-landing-grad {
          0%, 100% { background-position: 0% 50%; }
          50% { background-position: 100% 50%; }
        }
        .pf-landing-animated-bg {
          background: linear-gradient(125deg, #0b1020 0%, #121a35 32%, #1a1040 58%, #0c1228 100%);
          background-size: 220% 220%;
          animation: pf-landing-grad 16s ease-in-out infinite;
        }
      `}
    </style>
  )
}

function MockBrowserChrome({ children, url = '/personal-finance', glow = false }) {
  return (
    <div
      className={`${glass} overflow-hidden rounded-2xl ${glow ? 'pf-landing-preview-glow ring-1 ring-sky-400/20' : ''}`}
    >
      <div className="flex items-center gap-2 border-b border-white/10 bg-black/25 px-3 py-2.5 sm:px-4">
        <div className="flex gap-1.5" aria-hidden>
          <span className="h-2.5 w-2.5 rounded-full bg-red-500/60" />
          <span className="h-2.5 w-2.5 rounded-full bg-amber-400/60" />
          <span className="h-2.5 w-2.5 rounded-full bg-emerald-500/60" />
        </div>
        <div className="mx-auto min-w-0 flex-1 truncate rounded-lg bg-white/5 px-3 py-1 text-center font-mono text-[10px] text-slate-400 sm:text-xs">
          {url}
        </div>
      </div>
      {children}
    </div>
  )
}

const barHeights = [38, 62, 44, 78, 52, 88, 48, 72, 56, 92, 64, 70]

function PreviewPanelChartBars({ slice = 8 }) {
  const reduce = useReducedMotion()
  const heights = barHeights.slice(0, slice)
  return (
    <div className="flex h-full items-end gap-1 p-3">
      {heights.map((h, i) => (
        <motion.div
          key={i}
          className="flex-1 rounded-t bg-gradient-to-t from-indigo-500/60 to-sky-400/30"
          initial={{ height: reduce ? `${h}%` : '0%' }}
          animate={{ height: `${h}%` }}
          transition={{
            delay: reduce ? 0 : 0.12 + i * 0.045,
            duration: reduce ? 0 : 0.52,
            ease: [0.22, 1, 0.36, 1],
          }}
        />
      ))}
    </div>
  )
}

function HeroDashboardPreview() {
  const reduce = useReducedMotion()
  return (
    <MockBrowserChrome glow>
      <div className="space-y-4 p-4 sm:p-6">
        <div className="grid grid-cols-3 gap-2 sm:gap-3">
          {['Net worth', 'Cash', 'Investments'].map((label, i) => (
            <motion.div
              key={label}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.15 + i * 0.08, duration: 0.45 }}
              className="rounded-xl border border-white/5 bg-white/[0.04] p-3 sm:p-4"
            >
              <p className="text-[10px] font-medium uppercase tracking-wide text-slate-400 sm:text-xs">{label}</p>
              <motion.div
                className="mt-2 h-7 max-w-[5.5rem] rounded-md bg-gradient-to-r from-sky-400/60 to-indigo-500/50 sm:h-8"
                initial={{ scaleX: 0.2, opacity: 0.5 }}
                animate={{ scaleX: 1, opacity: 1 }}
                transition={{ delay: 0.4 + i * 0.1, duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
                style={{ originX: 0 }}
              />
            </motion.div>
          ))}
        </div>
        <div className="relative h-36 overflow-hidden rounded-xl border border-white/5 bg-gradient-to-br from-slate-900/90 to-indigo-950/70 sm:h-44">
          <p className="absolute left-3 top-3 text-[10px] font-semibold uppercase tracking-wide text-slate-500 sm:text-xs">
            Cash flow
          </p>
          <div className="absolute bottom-0 left-3 right-3 top-10 flex items-end gap-1">
            {barHeights.map((h, i) => (
              <motion.div
                key={i}
                className="flex-1 rounded-t bg-gradient-to-t from-indigo-600/80 to-sky-400/50"
                initial={{ height: reduce ? `${h}%` : '0%' }}
                animate={{ height: `${h}%` }}
                transition={{
                  delay: reduce ? 0 : 0.35 + i * 0.04,
                  duration: reduce ? 0 : 0.55,
                  ease: [0.22, 1, 0.36, 1],
                }}
              />
            ))}
          </div>
        </div>
        <div className="grid grid-cols-2 gap-2 sm:gap-3">
          <div className="h-20 rounded-xl border border-dashed border-white/10 bg-white/[0.02] sm:h-24" />
          <div className="h-20 rounded-xl border border-dashed border-white/10 bg-white/[0.02] sm:h-24" />
        </div>
      </div>
    </MockBrowserChrome>
  )
}

function ProductPreviewPanel({ tab }) {
  const variants = {
    dashboard: (
      <div className="space-y-3 p-4 sm:p-5">
        <div className="h-3 w-2/5 rounded bg-white/20" />
        <div className="grid grid-cols-3 gap-2">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-16 rounded-lg bg-gradient-to-br from-violet-500/20 to-sky-500/15" />
          ))}
        </div>
        <div className="h-32 rounded-xl bg-white/[0.04]">
          <PreviewPanelChartBars slice={8} />
        </div>
      </div>
    ),
    reports: (
      <div className="space-y-3 p-4 sm:p-5">
        <div className="flex gap-2">
          <div className="h-8 flex-1 rounded-lg bg-white/10" />
          <div className="h-8 w-24 rounded-lg bg-emerald-500/20" />
        </div>
        {[1, 2, 3].map((i) => (
          <div key={i} className="flex items-center gap-3 rounded-lg border border-white/5 bg-white/[0.03] p-3">
            <div className="h-10 w-10 rounded-full bg-violet-500/25" />
            <div className="flex-1 space-y-2">
              <div className="h-2 w-3/5 rounded bg-white/15" />
              <div className="h-2 w-2/5 rounded bg-white/10" />
            </div>
          </div>
        ))}
      </div>
    ),
    investments: (
      <div className="space-y-3 p-4 sm:p-5">
        <div className="h-3 w-1/3 rounded bg-white/20" />
        <div className="space-y-2">
          {['Equity MF', 'Debt FD', 'SIP'].map((name, i) => (
            <div key={name} className="flex items-center gap-3 rounded-lg bg-white/[0.04] p-3">
              <p className="w-24 shrink-0 font-mono text-[10px] text-slate-500">{name}</p>
              <div className="h-2 min-h-[8px] flex-1 rounded-full bg-white/10">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-sky-500/70 to-indigo-500/60"
                  style={{ width: `${72 - i * 18}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      </div>
    ),
    loans: (
      <div className="space-y-3 p-4 sm:p-5">
        <div className="h-3 w-2/5 rounded bg-amber-400/30" />
        <div className="grid gap-2 sm:grid-cols-2">
          <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-4">
            <div className="h-2 w-16 rounded bg-white/20" />
            <div className="mt-3 h-8 w-28 rounded bg-white/10" />
          </div>
          <div className="rounded-xl border border-orange-500/20 bg-orange-500/5 p-4">
            <div className="h-2 w-20 rounded bg-white/20" />
            <div className="mt-3 h-8 w-24 rounded bg-white/10" />
          </div>
        </div>
      </div>
    ),
    cards: (
      <div className="space-y-3 p-4 sm:p-5">
        <div className="h-3 w-1/2 rounded bg-rose-400/25" />
        <div className="rounded-xl bg-gradient-to-br from-slate-800/80 to-indigo-900/50 p-4">
          <div className="flex justify-between">
            <div className="h-2 w-20 rounded bg-white/25" />
            <div className="h-6 w-10 rounded bg-white/15" />
          </div>
          <div className="mt-6 h-3 w-3/4 rounded bg-white/20" />
          <div className="mt-2 h-2 w-1/2 rounded bg-white/10" />
        </div>
        <div className="h-10 rounded-lg bg-white/[0.06]" />
      </div>
    ),
  }
  return variants[tab] ?? variants.dashboard
}

function FloatingDecor() {
  const reduce = useReducedMotion()
  const float = reduce
    ? {}
    : {
        y: [0, -10, 0],
        transition: { duration: 5, repeat: Infinity, ease: 'easeInOut' },
      }
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden>
      {[
        { t: '₹', l: '8%', tpos: '18%', d: 6 },
        { t: '↗', l: '88%', tpos: '22%', d: 7 },
        { t: '◐', l: '12%', tpos: '72%', d: 8 },
        { t: '⌁', l: '78%', tpos: '68%', d: 6.5 },
      ].map((x, i) => (
        <motion.span
          key={i}
          className="absolute text-2xl text-white/[0.07] sm:text-3xl"
          style={{ left: x.l, top: x.tpos }}
          animate={float}
          transition={{ ...float.transition, delay: i * 0.4, duration: x.d }}
        >
          {x.t}
        </motion.span>
      ))}
    </div>
  )
}

function FaqAccordion() {
  const [open, setOpen] = useState(0)
  return (
    <div className="mx-auto max-w-2xl space-y-2">
      {faqItems.map((item, i) => {
        const isOpen = open === i
        return (
          <motion.div
            key={item.q}
            initial={false}
            className={`overflow-hidden rounded-2xl border transition-colors ${
              isOpen ? 'border-sky-500/30 bg-white/[0.08]' : 'border-white/10 bg-white/[0.04]'
            }`}
          >
            <button
              type="button"
              onClick={() => setOpen(isOpen ? -1 : i)}
              className="flex w-full items-center justify-between gap-4 px-5 py-4 text-left"
            >
              <span className="text-sm font-semibold text-white sm:text-base">{item.q}</span>
              <motion.span
                animate={{ rotate: isOpen ? 180 : 0 }}
                className="shrink-0 text-slate-400"
              >
                ▼
              </motion.span>
            </button>
            <AnimatePresence initial={false}>
              {isOpen ? (
                <motion.div
                  layout
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
                  className="overflow-hidden"
                >
                  <p className="border-t border-white/5 px-5 pb-4 pt-0 text-sm leading-relaxed text-slate-400">
                    {item.a}
                  </p>
                </motion.div>
              ) : null}
            </AnimatePresence>
          </motion.div>
        )
      })}
    </div>
  )
}

export default function PersonalFinanceLandingPage() {
  const [hasSession, setHasSession] = useState(null)
  const [previewTab, setPreviewTab] = useState('dashboard')
  const reduce = useReducedMotion()
  const navScrolled = useLandingNavScrolled(14)
  const parallax = useHeroParallaxMouse(!reduce)

  useEffect(() => {
    document.documentElement.classList.add('pf-landing-smooth-scroll')
    return () => document.documentElement.classList.remove('pf-landing-smooth-scroll')
  }, [])

  useEffect(() => {
    setHasSession(!!getPfToken())
    const onStorage = () => setHasSession(!!getPfToken())
    window.addEventListener('storage', onStorage)
    return () => window.removeEventListener('storage', onStorage)
  }, [])

  if (hasSession === true) {
    return <Navigate to="/personal-finance" replace />
  }

  if (hasSession === null) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-950 text-slate-400">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-white/20 border-t-sky-400" />
      </div>
    )
  }

  return (
    <div
      id="top"
      className="dark relative min-h-screen overflow-x-hidden font-sans text-slate-100 antialiased"
    >
      <LandingKeyframes />
      <div className="pf-landing-animated-bg fixed inset-0 -z-20" />
      <div className="pf-landing-grid" aria-hidden />
      <div className="pf-landing-noise" aria-hidden />
      <div className="pointer-events-none fixed inset-0 -z-10 bg-[radial-gradient(ellipse_90%_60%_at_50%_-10%,rgba(56,189,248,0.14),transparent)]" />
      <div className="pointer-events-none fixed inset-0 -z-10 bg-[radial-gradient(ellipse_70%_50%_at_100%_80%,rgba(139,92,246,0.1),transparent)]" />

      <header
        className={`sticky top-0 z-50 border-b backdrop-blur-2xl transition-[background-color,box-shadow,border-color] duration-300 ${
          navScrolled
            ? 'border-white/10 bg-slate-950/80 shadow-lg shadow-black/20'
            : 'border-transparent bg-slate-950/40 backdrop-blur-xl'
        }`}
      >
        <nav className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-3.5 sm:gap-4 sm:px-6">
          <a href="#top" className="flex min-w-0 items-center gap-2.5 text-white no-underline">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-sky-500 to-indigo-600 text-white shadow-lg shadow-indigo-500/35">
              <RiverLogo className="h-6 w-6 text-white" />
            </span>
            <span className="truncate text-sm font-bold sm:text-base">Personal Finance OS</span>
          </a>
          <div className="hidden items-center gap-6 text-[13px] font-semibold lg:flex">
            <a href="#social-proof" className="pf-landing-nav-link text-slate-300 transition-colors hover:text-white">
              Trust
            </a>
            <a href="#features" className="pf-landing-nav-link text-slate-300 transition-colors hover:text-white">
              Features
            </a>
            <a href="#product" className="pf-landing-nav-link text-slate-300 transition-colors hover:text-white">
              Product
            </a>
            <a href="#how-it-works" className="pf-landing-nav-link text-slate-300 transition-colors hover:text-white">
              How it works
            </a>
            <a href="#use-cases" className="pf-landing-nav-link text-slate-300 transition-colors hover:text-white">
              Use cases
            </a>
            <a href="#security" className="pf-landing-nav-link text-slate-300 transition-colors hover:text-white">
              Security
            </a>
            <a href="#pricing" className="pf-landing-nav-link text-slate-300 transition-colors hover:text-white">
              Pricing
            </a>
            <a href="#faq" className="pf-landing-nav-link text-slate-300 transition-colors hover:text-white">
              FAQ
            </a>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <Link to="/personal-finance" className={`${btnGhost} !px-3 !py-2 text-xs sm:!px-4 sm:!py-2.5 sm:text-sm`}>
              Login
            </Link>
            <Link
              to="/personal-finance"
              className={`${btnGradient} !px-3 !py-2 text-xs sm:inline-flex sm:!px-4 sm:!py-2.5 sm:text-sm`}
            >
              Get started
              <ArrowRightIcon className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
            </Link>
          </div>
        </nav>
      </header>

      <main>
        {/* Hero */}
        <section className="relative mx-auto max-w-6xl overflow-hidden px-4 pb-16 pt-10 sm:px-6 sm:pb-24 sm:pt-14">
          <div className="pf-landing-orb pf-landing-orb--a" aria-hidden />
          <div className="pf-landing-orb pf-landing-orb--b" aria-hidden />
          <div className="pf-landing-orb pf-landing-orb--c" aria-hidden />
          <FloatingDecor />
          <div className="grid items-center gap-12 lg:grid-cols-2 lg:gap-16">
            <motion.div
              initial={{ opacity: 0, y: 28 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
            >
              <div
                style={{
                  transform: `translate3d(${-parallax.x * 0.38}px, ${-parallax.y * 0.3}px, 0)`,
                }}
              >
              <p className="text-xs font-bold uppercase tracking-[0.22em] text-sky-400/95 sm:text-sm">
                Track · Analyze · Grow
              </p>
              <h1 className="mt-3 text-[2rem] font-extrabold leading-[1.1] tracking-tight sm:text-5xl lg:text-[3.1rem]">
                <span className="pf-landing-gradient-text">Personal Finance OS</span>
              </h1>
              <p className="mt-2 text-lg font-semibold text-slate-200 sm:text-xl">
                The operating system for your money.
              </p>
              <p className="mt-4 max-w-xl text-base leading-relaxed text-slate-400 sm:text-lg">
                Track expenses, income, loans, investments, assets, and net worth — all in one place.
              </p>
              <div className="mt-8 flex flex-wrap gap-3">
                <motion.div
                  whileHover={reduce ? {} : { scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  className="relative"
                >
                  <motion.span
                    className="absolute inset-0 rounded-xl bg-gradient-to-r from-sky-400 to-violet-500 opacity-40 blur-xl"
                    animate={
                      reduce
                        ? {}
                        : { opacity: [0.25, 0.45, 0.25], scale: [1, 1.05, 1] }
                    }
                    transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
                  />
                  <Link
                    to="/personal-finance"
                    className={`${btnGradient} relative z-[1] shadow-indigo-500/40`}
                  >
                    Start tracking your money
                    <ArrowRightIcon className="h-4 w-4 transition group-hover:translate-x-0.5" />
                  </Link>
                </motion.div>
                <Link to="/personal-finance" className={btnGhost}>
                  Login
                </Link>
              </div>
              </div>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 32 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.65, delay: 0.1, ease: [0.22, 1, 0.36, 1] }}
              className="relative"
            >
              <div className="absolute -inset-6 rounded-[2rem] bg-gradient-to-tr from-sky-500/25 via-indigo-500/15 to-violet-500/10 blur-3xl" />
              <div
                style={{
                  transform: `translate3d(${parallax.x * 0.45}px, ${parallax.y * 0.35}px, 0)`,
                }}
              >
              <motion.div
                animate={
                  reduce ? {} : { y: [0, -10, 0] }
                }
                transition={{ duration: 5.5, repeat: Infinity, ease: 'easeInOut' }}
              >
                <HeroDashboardPreview />
              </motion.div>
              </div>
            </motion.div>
          </div>
        </section>

        {/* Social proof */}
        <section
          id="social-proof"
          className="scroll-mt-24 border-t border-white/5 bg-black/25 py-14 backdrop-blur-sm sm:py-16"
        >
          <div className="mx-auto max-w-6xl px-4 sm:px-6">
            <motion.div {...fadeUp} className="text-center">
              <h2 className="text-lg font-semibold text-white sm:text-xl">
                Trusted by people who want clarity over money
              </h2>
              <p className="mx-auto mt-2 max-w-lg text-sm text-slate-400">
                A serious ledger for Indian households — INR-first, EMI-aware, net-worth aware.
              </p>
            </motion.div>
            <motion.div
              variants={staggerContainer}
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true, margin: '-40px' }}
              className="mt-10 grid grid-cols-1 gap-8 sm:grid-cols-3"
            >
              <motion.div variants={staggerItem}>
                <StatCounter end={10000} suffix="+" label="Transactions tracked (illustrative)" />
              </motion.div>
              <motion.div variants={staggerItem}>
                <StatCrPlus label="Assets on books (illustrative)" />
              </motion.div>
              <motion.div variants={staggerItem}>
                <StatCounter end={120} suffix="+" label="Active workspaces (illustrative)" />
              </motion.div>
            </motion.div>
            <motion.div
              {...fadeUp}
              className="mt-10 flex flex-wrap items-center justify-center gap-2 sm:gap-3"
            >
              {trustChips.map((chip) => (
                <span
                  key={chip}
                  className="rounded-full border border-white/10 bg-white/[0.05] px-3 py-1.5 text-xs font-medium text-slate-300 backdrop-blur-md"
                >
                  {chip}
                </span>
              ))}
            </motion.div>
            <p className="mt-6 text-center text-[11px] text-slate-500">
              Illustrative metrics for product storytelling — your real numbers stay private in your workspace.
            </p>
          </div>
        </section>

        {/* Features */}
        <section id="features" className="scroll-mt-24 py-20 sm:py-24">
          <div className="mx-auto max-w-6xl px-4 sm:px-6">
            <motion.div {...fadeUp} className="mx-auto max-w-2xl text-center">
              <h2 className="text-3xl font-bold tracking-tight text-white sm:text-4xl">Everything you need</h2>
              <p className="mt-4 text-slate-400">
                One workspace for day-to-day flows and long-term wealth — built for clarity, not clutter.
              </p>
            </motion.div>
            <motion.div
              variants={staggerContainer}
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true, margin: '-60px' }}
              className="mt-14 grid gap-4 sm:grid-cols-2 lg:grid-cols-4"
            >
              {features.map(({ title, desc, icon: Icon }) => (
                <motion.div
                  key={title}
                  variants={staggerItem}
                  whileHover={reduce ? {} : { y: -6, transition: { duration: 0.25 } }}
                  className={`group relative ${glass} flex flex-col overflow-hidden p-5 transition-shadow duration-300 hover:border-sky-500/25 hover:shadow-lg hover:shadow-sky-500/10`}
                >
                  <div className="absolute inset-0 bg-gradient-to-br from-sky-500/0 via-transparent to-violet-600/0 opacity-0 transition-opacity duration-300 group-hover:from-sky-500/[0.07] group-hover:to-violet-600/[0.06] group-hover:opacity-100" />
                  <div className="relative flex items-start justify-between gap-2">
                    <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br from-sky-500/35 to-indigo-600/25 text-sky-200 shadow-inner shadow-sky-500/10 transition group-hover:shadow-sky-400/25">
                      <Icon className="h-5 w-5" />
                    </div>
                    <ChevronRightIcon className="h-5 w-5 shrink-0 text-slate-600 opacity-0 transition group-hover:translate-x-0.5 group-hover:text-sky-400 group-hover:opacity-100" />
                  </div>
                  <h3 className="relative mt-4 text-base font-bold text-white">{title}</h3>
                  <p className="relative mt-2 text-sm leading-relaxed text-slate-400">{desc}</p>
                </motion.div>
              ))}
            </motion.div>
          </div>
        </section>

        {/* Interactive product preview */}
        <section id="product" className="scroll-mt-24 border-t border-white/5 bg-black/20 py-20 sm:py-24">
          <div className="mx-auto max-w-6xl px-4 sm:px-6">
            <motion.div {...fadeUp} className="text-center">
              <h2 className="text-3xl font-bold text-white sm:text-4xl">See the workspace</h2>
              <p className="mx-auto mt-4 max-w-xl text-slate-400">
                Switch views — same glass, same calm hierarchy. Drop real screenshots into{' '}
                <code className="rounded bg-white/10 px-1.5 py-0.5 font-mono text-xs text-sky-300">public/</code>{' '}
                when you&apos;re ready.
              </p>
            </motion.div>
            <motion.div {...fadeUp} className="mt-10">
              <div className="mb-6 flex flex-wrap justify-center gap-2">
                {previewTabs.map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => setPreviewTab(t.id)}
                    className={`rounded-full px-4 py-2 text-xs font-bold transition sm:text-sm ${
                      previewTab === t.id
                        ? 'bg-gradient-to-r from-sky-500 to-indigo-600 text-white shadow-lg shadow-indigo-500/25'
                        : 'border border-white/10 bg-white/[0.04] text-slate-400 hover:border-white/20 hover:text-white'
                    }`}
                  >
                    {t.label}
                  </button>
                ))}
              </div>
              <MockBrowserChrome
                glow
                url={`/personal-finance/${previewTab === 'dashboard' ? '' : previewTab}`}
              >
                <AnimatePresence mode="wait">
                  <motion.div
                    key={previewTab}
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -8 }}
                    transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
                    className="min-h-[220px] sm:min-h-[260px]"
                  >
                    <ProductPreviewPanel tab={previewTab} />
                  </motion.div>
                </AnimatePresence>
              </MockBrowserChrome>
            </motion.div>
          </div>
        </section>

        {/* How it works */}
        <section id="how-it-works" className="scroll-mt-24 py-20 sm:py-24">
          <div className="mx-auto max-w-6xl px-4 sm:px-6">
            <motion.div {...fadeUp} className="text-center">
              <h2 className="text-3xl font-bold text-white sm:text-4xl">How it works</h2>
              <p className="mx-auto mt-4 max-w-lg text-slate-400">
                Track → Analyze → Grow. From entries to decisions without spreadsheet chaos.
              </p>
            </motion.div>
            <div className="mt-14 grid gap-6 md:grid-cols-3">
              {steps.map((s, i) => (
                <motion.div
                  key={s.n}
                  {...fadeUp}
                  transition={{ ...fadeUp.transition, delay: i * 0.1 }}
                  className={`${glass} relative p-6 text-center md:text-left`}
                >
                  <span className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br from-sky-500 to-indigo-600 text-sm font-black text-white">
                    {s.n}
                  </span>
                  <h3 className="mt-4 text-lg font-bold text-white">{s.title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-slate-400">{s.desc}</p>
                </motion.div>
              ))}
            </div>
          </div>
        </section>

        {/* Use cases */}
        <section id="use-cases" className="scroll-mt-24 border-t border-white/5 bg-black/15 py-20 sm:py-24">
          <div className="mx-auto max-w-6xl px-4 sm:px-6">
            <motion.div {...fadeUp} className="text-center">
              <h2 className="text-3xl font-bold text-white sm:text-4xl">Who is this for?</h2>
              <p className="mx-auto mt-4 max-w-lg text-slate-400">
                If money touches more than one app in your life, it belongs in one OS.
              </p>
            </motion.div>
            <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {useCases.map((uc, i) => (
                <motion.div
                  key={uc.title}
                  {...fadeUp}
                  transition={{ ...fadeUp.transition, delay: i * 0.06 }}
                  className={`${glass} p-5 transition hover:border-white/15`}
                >
                  <h3 className="text-base font-bold text-white">{uc.title}</h3>
                  <p className="mt-2 text-sm text-slate-400">{uc.desc}</p>
                </motion.div>
              ))}
            </div>
          </div>
        </section>

        {/* Security */}
        <section id="security" className="scroll-mt-24 py-20 sm:py-24">
          <div className="mx-auto max-w-6xl px-4 sm:px-6">
            <motion.div {...fadeUp} className="mx-auto max-w-2xl text-center">
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-500/15 text-emerald-300">
                <ShieldCheckIcon className="h-8 w-8" />
              </div>
              <h2 className="mt-6 text-3xl font-bold text-white sm:text-4xl">Your data stays yours</h2>
              <p className="mt-4 text-slate-400">
                Finance apps earn trust with restraint — not with noise.
              </p>
            </motion.div>
            <div className="mt-12 grid gap-4 sm:grid-cols-2">
              {securityPoints.map((sp, i) => (
                <motion.div
                  key={sp.title}
                  {...fadeUp}
                  transition={{ ...fadeUp.transition, delay: i * 0.08 }}
                  className={`${glass} flex gap-4 p-5`}
                >
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white/[0.06] text-sky-300">
                    <LockClosedIcon className="h-5 w-5" />
                  </div>
                  <div>
                    <h3 className="font-bold text-white">{sp.title}</h3>
                    <p className="mt-1 text-sm text-slate-400">{sp.desc}</p>
                  </div>
                </motion.div>
              ))}
            </div>
          </div>
        </section>

        {/* Pricing */}
        <section id="pricing" className="scroll-mt-24 border-t border-white/5 py-16 sm:py-20">
          <div className="mx-auto max-w-3xl px-4 text-center sm:px-6">
            <motion.div {...fadeUp} className={`${glass} px-6 py-10 sm:px-10`}>
              <h2 className="text-2xl font-bold text-white sm:text-3xl">Pricing</h2>
              <p className="mt-4 text-slate-400">
                Built for individuals who want a serious ledger without juggling five tabs. Team plans are on the
                roadmap — for now, open the app and explore.
              </p>
              <Link to="/personal-finance" className={`${btnGradient} mt-8`}>
                Open the app
                <ArrowRightIcon className="h-4 w-4" />
              </Link>
            </motion.div>
          </div>
        </section>

        {/* FAQ */}
        <section id="faq" className="scroll-mt-24 py-16 sm:py-20">
          <div className="mx-auto max-w-6xl px-4 sm:px-6">
            <motion.div {...fadeUp} className="mb-10 text-center">
              <h2 className="text-3xl font-bold text-white sm:text-4xl">FAQ</h2>
              <p className="mt-3 text-slate-400">Straight answers — no fine-print vibes.</p>
            </motion.div>
            <FaqAccordion />
          </div>
        </section>

        {/* About (short) */}
        <section id="about" className="scroll-mt-24 border-t border-white/5 py-12 sm:py-16">
          <div className="mx-auto max-w-3xl px-4 text-center sm:px-6">
            <motion.div {...fadeUp}>
              <h2 className="text-xl font-bold text-white sm:text-2xl">About</h2>
              <p className="mt-4 leading-relaxed text-slate-400">
                Personal Finance OS is a full-stack workspace: accounts, transfers, statements, reports, and
                settings — designed to feel like a product, not a spreadsheet glued to a website.
              </p>
            </motion.div>
          </div>
        </section>

        {/* Final CTA */}
        <section id="cta" className="scroll-mt-24 pb-24 pt-8">
          <div className="mx-auto max-w-4xl px-4 sm:px-6">
            <motion.div
              initial={{ opacity: 0, y: 24 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.55 }}
              className="pf-landing-cta-border overflow-hidden p-px"
            >
            <div className={`pf-landing-cta-inner relative overflow-hidden px-6 py-14 text-center sm:px-12 sm:py-16`}>
              <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-sky-500/12 via-transparent to-violet-600/12" />
              <div
                className="pointer-events-none absolute -left-1/4 top-0 h-64 w-[150%] opacity-40 blur-3xl"
                style={{
                  background:
                    'radial-gradient(ellipse at center, rgba(56,189,248,0.25), transparent 55%)',
                }}
                aria-hidden
              />
              <h2 className="relative text-2xl font-extrabold tracking-tight text-white sm:text-4xl">
                Start tracking your money the right way.
              </h2>
              <p className="relative mx-auto mt-4 max-w-lg text-slate-400">
                Personal Finance OS — calm UI, real hierarchy, one place for your rupees.
              </p>
              <div className="relative mt-8 flex flex-wrap justify-center gap-3">
                <Link to="/personal-finance" className={btnGradient}>
                  Get started free
                  <ArrowRightIcon className="h-4 w-4" />
                </Link>
                <Link to="/personal-finance" className={btnGhost}>
                  Login
                </Link>
              </div>
              <Link
                to="/legacy-home"
                className="relative mt-6 inline-block text-sm font-semibold text-slate-500 underline-offset-2 hover:text-slate-300 hover:underline"
              >
                River Dairy business suite
              </Link>
            </div>
            </motion.div>
          </div>
        </section>
      </main>

      <footer className="border-t border-white/10 bg-black/35 py-10 backdrop-blur-md">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-6 px-4 text-sm text-slate-500 sm:flex-row sm:px-6">
          <div className="flex items-center gap-2 text-slate-400">
            <RiverLogo className="h-5 w-5 text-sky-400" />
            <span className="font-semibold text-slate-300">Personal Finance OS</span>
          </div>
          <div className="flex flex-wrap justify-center gap-6 font-medium">
            <a href="#about" className="pf-landing-footer-link text-slate-500 hover:text-white">
              About
            </a>
            <a href="#security" className="pf-landing-footer-link text-slate-500 hover:text-white">
              Security
            </a>
            <a href="#faq" className="pf-landing-footer-link text-slate-500 hover:text-white">
              FAQ
            </a>
            <Link to="/legacy-home" className="pf-landing-footer-link text-slate-500 hover:text-white">
              Business home
            </Link>
          </div>
        </div>
      </footer>
    </div>
  )
}
