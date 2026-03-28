import { IconQuote } from './icons.jsx'

const reviews = [
  {
    quote:
      'Tastes like the milk I grew up with. The glass bottles and morning delivery slot actually work for our routine.',
    name: 'Ananya K.',
    role: 'Parent · Indiranagar',
    avatar: 'https://i.pravatar.cc/120?img=47',
  },
  {
    quote:
      'Curd is thick without gelatin tricks. I cancelled my supermarket subscription after week two.',
    name: 'Rahul M.',
    role: 'Home chef · Whitefield',
    avatar: 'https://i.pravatar.cc/120?img=12',
  },
  {
    quote:
      'Cold bags in summer sold me. Support replies on WhatsApp in minutes when I skip a week.',
    name: 'Priya S.',
    role: 'IT consultant · Koramangala',
    avatar: 'https://i.pravatar.cc/120?img=32',
  },
]

export default function Testimonials() {
  return (
    <section id="reviews" className="bg-white py-16 dark:bg-slate-950 sm:py-20">
      <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="text-3xl font-bold tracking-tight text-slate-900 dark:text-white">Loved by locals</h2>
          <p className="mt-3 text-slate-600 dark:text-slate-400">Real reviews from weekly subscribers.</p>
        </div>
        <ul className="mt-12 grid gap-8 md:grid-cols-3">
          {reviews.map((r) => (
            <li
              key={r.name}
              className="flex flex-col rounded-2xl border border-sky-100 bg-sky-50/40 p-6 shadow-sm transition hover:shadow-md dark:border-slate-800 dark:bg-slate-900/60"
            >
              <IconQuote className="h-6 w-6 text-sky-300 dark:text-sky-600" />
              <blockquote className="mt-4 flex-1 text-sm leading-relaxed text-slate-700 dark:text-slate-300">
                &ldquo;{r.quote}&rdquo;
              </blockquote>
              <div className="mt-6 flex items-center gap-3">
                <img
                  src={r.avatar}
                  alt=""
                  className="h-11 w-11 rounded-full object-cover ring-2 ring-white dark:ring-slate-800"
                />
                <div>
                  <p className="text-sm font-semibold text-slate-900 dark:text-white">{r.name}</p>
                  <p className="text-xs text-slate-500 dark:text-slate-400">{r.role}</p>
                </div>
              </div>
            </li>
          ))}
        </ul>
      </div>
    </section>
  )
}
