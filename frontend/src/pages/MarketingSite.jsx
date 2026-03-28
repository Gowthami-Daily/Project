import { useEffect, useState } from 'react'
import About from '../components/About.jsx'
import CtaSection from '../components/CtaSection.jsx'
import Features from '../components/Features.jsx'
import Footer from '../components/Footer.jsx'
import Header from '../components/Header.jsx'
import Hero from '../components/Hero.jsx'
import HowItWorks from '../components/HowItWorks.jsx'
import Products from '../components/Products.jsx'
import Testimonials from '../components/Testimonials.jsx'

function getInitialDark() {
  if (typeof window === 'undefined') return false
  const stored = localStorage.getItem('theme')
  if (stored === 'dark') return true
  if (stored === 'light') return false
  return window.matchMedia('(prefers-color-scheme: dark)').matches
}

export default function MarketingSite() {
  const [dark, setDark] = useState(getInitialDark)
  const [cartCount, setCartCount] = useState(0)

  useEffect(() => {
    document.documentElement.classList.toggle('dark', dark)
    localStorage.setItem('theme', dark ? 'dark' : 'light')
  }, [dark])

  return (
    <div className="min-h-screen bg-white text-slate-900 antialiased dark:bg-slate-950 dark:text-slate-100">
      <Header dark={dark} onToggleDark={() => setDark((d) => !d)} cartCount={cartCount} />
      <main>
        <Hero />
        <Features />
        <Products onAddToCart={() => setCartCount((c) => c + 1)} />
        <About />
        <HowItWorks />
        <Testimonials />
        <CtaSection />
      </main>
      <Footer />
    </div>
  )
}
