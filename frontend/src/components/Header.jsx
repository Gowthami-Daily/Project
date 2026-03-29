import { useState } from 'react'
import { Link } from 'react-router-dom'
import { IconCart, IconMoon, IconSun } from './icons.jsx'

const nav = [
  { href: '#home', label: 'Home' },
  { href: '#products', label: 'Products' },
  { href: '#about', label: 'About' },
  { href: '#how', label: 'How it works' },
  { href: '#reviews', label: 'Reviews' },
]

export default function Header({ dark, onToggleDark, cartCount }) {
  const [menuOpen, setMenuOpen] = useState(false)

  return (
    <header className="sticky top-0 z-50 border-b border-sky-100/80 bg-white/80 backdrop-blur-md transition-colors dark:border-slate-800 dark:bg-slate-950/80">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3 sm:px-6 lg:px-8">
        <a
          href="#home"
          className="flex items-center gap-2 text-lg font-bold tracking-tight text-emerald-800 transition hover:text-emerald-600 dark:text-emerald-400 dark:hover:text-emerald-300"
          onClick={() => setMenuOpen(false)}
        >
          <span className="flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-br from-sky-200 to-emerald-200 text-xs font-extrabold leading-tight text-emerald-900 shadow-sm dark:from-sky-900 dark:to-emerald-900 dark:text-emerald-100">
            GD
          </span>
          <span className="hidden sm:inline">Gowthami Daily</span>
        </a>

        <nav className="hidden items-center gap-6 text-sm font-medium text-slate-600 md:flex dark:text-slate-300" aria-label="Primary">
          {nav.map((item) => (
            <a
              key={item.href}
              href={item.href}
              className="transition hover:text-emerald-600 dark:hover:text-emerald-400"
            >
              {item.label}
            </a>
          ))}
        </nav>

        <div className="flex items-center gap-2 sm:gap-3">
          <Link
            to="/personal-finance"
            className="hidden rounded-full border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm font-semibold text-emerald-900 shadow-sm transition hover:bg-emerald-100 sm:inline dark:border-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-100 dark:hover:bg-emerald-900/80"
          >
            Finance login
          </Link>
          <button
            type="button"
            onClick={() => setMenuOpen((o) => !o)}
            className="flex h-10 w-10 items-center justify-center rounded-full border border-sky-100 bg-white text-slate-700 shadow-sm md:hidden dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
            aria-expanded={menuOpen}
            aria-controls="mobile-nav"
            aria-label={menuOpen ? 'Close menu' : 'Open menu'}
          >
            <span className="sr-only">Menu</span>
            {menuOpen ? (
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden>
                <path strokeLinecap="round" d="M6 18 18 6M6 6l12 12" />
              </svg>
            ) : (
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden>
                <path strokeLinecap="round" d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            )}
          </button>

          <button
            type="button"
            onClick={onToggleDark}
            className="flex h-10 w-10 items-center justify-center rounded-full border border-sky-100 bg-sky-50/80 text-amber-600 shadow-sm transition hover:bg-sky-100 dark:border-slate-700 dark:bg-slate-800 dark:text-amber-400 dark:hover:bg-slate-700"
            aria-label={dark ? 'Switch to light mode' : 'Switch to dark mode'}
          >
            {dark ? <IconSun /> : <IconMoon />}
          </button>

          <button
            type="button"
            className="relative flex h-10 w-10 items-center justify-center rounded-full border border-sky-100 bg-white text-slate-700 shadow-sm transition hover:border-emerald-200 hover:text-emerald-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:border-emerald-700"
            aria-label={`Shopping cart, ${cartCount} items`}
          >
            <IconCart />
            {cartCount > 0 && (
              <span className="absolute -right-0.5 -top-0.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-emerald-500 px-1 text-[10px] font-bold text-white shadow">
                {cartCount > 99 ? '99+' : cartCount}
              </span>
            )}
          </button>
        </div>
      </div>

      <div
        id="mobile-nav"
        className={`border-t border-sky-100 bg-white/95 px-4 py-3 dark:border-slate-800 dark:bg-slate-950/95 md:hidden ${menuOpen ? 'block' : 'hidden'}`}
      >
        <nav className="flex flex-col gap-1 text-sm font-medium text-slate-700 dark:text-slate-300" aria-label="Mobile">
          {nav.map((item) => (
            <a
              key={item.href}
              href={item.href}
              className="rounded-lg px-3 py-2 transition hover:bg-sky-50 hover:text-emerald-700 dark:hover:bg-slate-800 dark:hover:text-emerald-400"
              onClick={() => setMenuOpen(false)}
            >
              {item.label}
            </a>
          ))}
          <Link
            to="/personal-finance"
            className="rounded-lg px-3 py-2 font-semibold text-emerald-800 transition hover:bg-emerald-50 dark:text-emerald-300 dark:hover:bg-emerald-950/50"
            onClick={() => setMenuOpen(false)}
          >
            Finance login
          </Link>
        </nav>
      </div>
    </header>
  )
}
