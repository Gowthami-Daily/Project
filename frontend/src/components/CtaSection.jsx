export default function CtaSection() {
  return (
    <section
      id="subscribe"
      className="relative overflow-hidden bg-gradient-to-br from-sky-500 via-sky-600 to-emerald-600 py-16 dark:from-sky-900 dark:via-slate-900 dark:to-emerald-950 sm:py-20"
    >
      <div className="pointer-events-none absolute -right-20 -top-20 h-64 w-64 rounded-full bg-white/10 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-16 -left-16 h-56 w-56 rounded-full bg-emerald-400/20 blur-3xl" />
      <div className="relative mx-auto max-w-3xl px-4 text-center sm:px-6">
        <h2 className="text-3xl font-bold tracking-tight text-white sm:text-4xl">
          Start Your Healthy Journey Today
        </h2>
        <p className="mt-4 text-lg text-sky-100">
          Join thousands of families getting organic dairy on their schedule — pause or skip anytime.
        </p>
        <a
          href="#products"
          className="mt-8 inline-flex items-center justify-center rounded-full bg-white px-8 py-3.5 text-sm font-bold text-sky-700 shadow-xl transition hover:bg-sky-50 hover:shadow-2xl dark:bg-emerald-500 dark:text-white dark:hover:bg-emerald-400"
        >
          Subscribe Now
        </a>
      </div>
    </section>
  )
}
