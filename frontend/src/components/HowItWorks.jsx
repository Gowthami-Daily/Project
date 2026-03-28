const steps = [
  {
    n: '1',
    title: 'Choose Products',
    body: 'Pick milk, curd, butter, ghee — set quantities and your preferred delivery days.',
  },
  {
    n: '2',
    title: 'Subscribe or Order',
    body: 'Go subscription for savings or one-time when you need a top-up. Change anytime.',
  },
  {
    n: '3',
    title: 'Get Home Delivery',
    body: 'Morning insulated drop with SMS alerts. Swap empties; we handle the rest.',
  },
]

export default function HowItWorks() {
  return (
    <section id="how" className="border-y border-sky-100 bg-gradient-to-b from-sky-50 to-white py-16 dark:border-slate-800 dark:from-slate-900 dark:to-slate-950 sm:py-20">
      <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="text-3xl font-bold tracking-tight text-slate-900 dark:text-white">How it works</h2>
          <p className="mt-3 text-slate-600 dark:text-slate-400">From cart to doorstep in three calm steps.</p>
        </div>
        <ol className="mt-14 grid gap-8 md:grid-cols-3">
          {steps.map((s, i) => (
            <li
              key={s.n}
              className="relative rounded-2xl border border-sky-100 bg-white/80 p-6 pt-10 shadow-sm dark:border-slate-800 dark:bg-slate-900/80"
            >
              <span className="absolute -top-4 left-6 flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br from-sky-500 to-emerald-500 text-sm font-bold text-white shadow-lg">
                {s.n}
              </span>
              {i < steps.length - 1 && (
                <span
                  className="absolute -right-4 top-1/2 hidden h-0.5 w-8 -translate-y-1/2 bg-gradient-to-r from-sky-200 to-transparent md:block dark:from-slate-700"
                  aria-hidden
                />
              )}
              <h3 className="text-lg font-semibold text-slate-900 dark:text-white">{s.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-slate-600 dark:text-slate-400">{s.body}</p>
            </li>
          ))}
        </ol>
      </div>
    </section>
  )
}
