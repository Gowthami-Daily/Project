import { IconLeaf, IconShield, IconSun, IconTruck } from './icons.jsx'

const items = [
  {
    title: '100% Organic',
    body: 'Certified organic feed and pasture rotation — no synthetic hormones in our supply chain.',
    icon: IconLeaf,
    accent: 'from-emerald-400/20 to-sky-400/20',
  },
  {
    title: 'Farm Fresh',
    body: 'Milked, tested, and packed within hours. You taste the difference in every glass.',
    icon: IconSun,
    accent: 'from-amber-400/20 to-orange-400/20',
  },
  {
    title: 'No Preservatives',
    body: 'Short shelf life by design. Pure pasteurization — nothing you can’t pronounce.',
    icon: IconShield,
    accent: 'from-sky-400/20 to-blue-400/20',
  },
  {
    title: 'Fast Delivery',
    body: 'Insulated bags and morning drops before your day starts — track your route live.',
    icon: IconTruck,
    accent: 'from-cyan-400/20 to-emerald-400/20',
  },
]

export default function Features() {
  return (
    <section className="bg-white py-16 dark:bg-slate-950 sm:py-20" aria-labelledby="features-heading">
      <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-2xl text-center">
          <h2 id="features-heading" className="text-3xl font-bold tracking-tight text-slate-900 dark:text-white">
            Why families trust us
          </h2>
          <p className="mt-3 text-slate-600 dark:text-slate-400">
            Premium dairy shouldn’t feel complicated — just honest sourcing and careful delivery.
          </p>
        </div>
        <ul className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {items.map(({ title, body, icon: Icon, accent }) => (
            <li
              key={title}
              className="group rounded-2xl border border-sky-100 bg-gradient-to-b from-white to-sky-50/50 p-6 shadow-sm transition duration-300 hover:-translate-y-1 hover:shadow-lg dark:border-slate-800 dark:from-slate-900 dark:to-slate-900/80"
            >
              <div
                className={`mb-4 inline-flex rounded-xl bg-gradient-to-br ${accent} p-3 text-emerald-700 dark:text-emerald-400`}
              >
                <Icon className="h-7 w-7" />
              </div>
              <h3 className="text-lg font-semibold text-slate-900 dark:text-white">{title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-slate-600 dark:text-slate-400">{body}</p>
            </li>
          ))}
        </ul>
      </div>
    </section>
  )
}
