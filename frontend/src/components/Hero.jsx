const HERO_IMG =
  'https://images.unsplash.com/photo-1500590237359-06f7e6a5b1e2?auto=format&fit=crop&w=1920&q=80'

export default function Hero() {
  return (
    <section id="home" className="relative isolate overflow-hidden bg-sky-50 dark:bg-slate-950">
      <img
        src={HERO_IMG}
        alt="Cattle grazing on a green pasture at sunrise"
        className="absolute inset-0 h-full w-full object-cover opacity-90 dark:opacity-40"
      />
      <div className="absolute inset-0 bg-gradient-to-r from-white/95 via-white/85 to-sky-100/40 dark:from-slate-950/95 dark:via-slate-950/90 dark:to-emerald-950/50" />
      <div className="relative mx-auto flex min-h-[min(88vh,720px)] max-w-6xl flex-col justify-center px-4 py-20 sm:px-6 lg:px-8">
        <p className="mb-3 inline-flex w-fit items-center rounded-full bg-emerald-500/10 px-3 py-1 text-xs font-semibold uppercase tracking-wider text-emerald-800 ring-1 ring-emerald-500/20 dark:text-emerald-300">
          Farm to home · Daily routes
        </p>
        <h1 className="max-w-3xl text-4xl font-bold tracking-tight text-slate-900 sm:text-5xl lg:text-6xl dark:text-white">
          Fresh Milk
          <span className="block bg-gradient-to-r from-sky-600 to-emerald-600 bg-clip-text text-transparent dark:from-sky-400 dark:to-emerald-400">
            Delivered Daily
          </span>
        </h1>
        <p className="mt-5 max-w-xl text-lg text-slate-600 dark:text-slate-300">
          Pure, organic, farm-to-home dairy products. Cold-chain delivery keeps every bottle as fresh as
          the morning milking.
        </p>
        <div className="mt-8 flex flex-wrap gap-3">
          <a
            href="#products"
            className="inline-flex items-center justify-center rounded-full bg-emerald-600 px-7 py-3 text-sm font-semibold text-white shadow-lg shadow-emerald-600/25 transition hover:bg-emerald-500 hover:shadow-emerald-500/30"
          >
            Order Now
          </a>
          <a
            href="#products"
            className="inline-flex items-center justify-center rounded-full border-2 border-sky-200 bg-white/80 px-7 py-3 text-sm font-semibold text-sky-800 backdrop-blur transition hover:border-emerald-300 hover:bg-white dark:border-slate-600 dark:bg-slate-900/60 dark:text-sky-100 dark:hover:border-emerald-500"
          >
            Explore Products
          </a>
        </div>
      </div>
    </section>
  )
}
