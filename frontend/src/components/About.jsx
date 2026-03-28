const ABOUT_IMG =
  'https://images.unsplash.com/photo-1628088062854-d1870b4553da?auto=format&fit=crop&w=900&q=80'

export default function About() {
  return (
    <section id="about" className="bg-white py-16 dark:bg-slate-950 sm:py-20">
      <div className="mx-auto grid max-w-6xl items-center gap-10 px-4 sm:px-6 lg:grid-cols-2 lg:gap-14 lg:px-8">
        <div className="order-2 lg:order-1">
          <h2 className="text-3xl font-bold tracking-tight text-slate-900 dark:text-white">About Gowthami Daily</h2>
          <p className="mt-4 text-slate-600 dark:text-slate-400">
            We started as a single-route milk run for our neighborhood — today we partner with audited
            farms within a two-hour radius. Our micro-hubs chill, test, and pack before sunrise so your
            family gets dairy that never sits in a distant warehouse.
          </p>
          <p className="mt-4 text-slate-600 dark:text-slate-400">
            From organic fodder programs to transparent batch codes on every bottle, we built Gowthami Daily
            for parents who read labels — and still want the convenience of home delivery.
          </p>
          <ul className="mt-6 flex flex-wrap gap-3 text-sm font-medium text-emerald-800 dark:text-emerald-300">
            <li className="rounded-full bg-emerald-50 px-3 py-1 dark:bg-emerald-950/50">FSSAI compliant</li>
            <li className="rounded-full bg-sky-50 px-3 py-1 dark:bg-sky-950/40">Cold chain GPS</li>
            <li className="rounded-full bg-emerald-50 px-3 py-1 dark:bg-emerald-950/50">Women-led ops team</li>
          </ul>
        </div>
        <div className="order-1 lg:order-2">
          <div className="overflow-hidden rounded-2xl shadow-xl shadow-sky-200/50 ring-1 ring-sky-100 dark:shadow-none dark:ring-slate-800">
            <img
              src={ABOUT_IMG}
              alt="Dairy worker pouring fresh milk in a modern facility"
              className="h-full w-full object-cover"
            />
          </div>
        </div>
      </div>
    </section>
  )
}
