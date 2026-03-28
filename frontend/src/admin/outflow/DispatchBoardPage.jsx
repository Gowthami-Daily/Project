function RouteCard({ title, meta, detail, accent }) {
  const border =
    accent === 'yellow'
      ? 'border-amber-200 bg-amber-50/40'
      : accent === 'blue'
        ? 'border-sky-200 bg-sky-50/50'
        : 'border-emerald-200 bg-emerald-50/40'

  return (
    <div className={`rounded-xl border-2 p-4 shadow-sm ${border}`}>
      <p className="font-semibold text-slate-900">{title}</p>
      <p className="mt-1 font-mono text-xs text-slate-600">{meta}</p>
      <p className="mt-2 text-sm text-slate-700">{detail}</p>
    </div>
  )
}

const columns = [
  {
    title: 'Preparation',
    emoji: '⚠️',
    accent: 'yellow',
    subtitle: 'Not yet dispatched',
    cards: [
      {
        title: 'Route 3 (East Sector)',
        meta: 'Vehicle AP-05-XXXX',
        detail: 'Target: 300 L',
      },
    ],
  },
  {
    title: 'En Route',
    emoji: '🔵',
    accent: 'blue',
    subtitle: 'Agents delivering now',
    cards: [
      {
        title: 'Route 1 (Main Town)',
        meta: 'Agent Raju',
        detail: '75% complete (30/40 stops)',
      },
      {
        title: 'Route 4 (River Colony)',
        meta: 'Agent Ravi',
        detail: '40% complete (15/37 stops)',
      },
    ],
  },
  {
    title: 'Completed',
    emoji: '🟢',
    accent: 'green',
    subtitle: 'Finished routes',
    cards: [
      {
        title: 'Route 2 (Temple Road)',
        meta: 'Agent Satyam',
        detail: '100% complete · 0 missed',
      },
    ],
  },
]

export default function DispatchBoardPage() {
  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-bold text-slate-900">Dispatch board</h3>
        <p className="mt-1 text-sm text-slate-500">
          Morning routes at a glance (Module 3B — ties into packing lists and exceptions below).
        </p>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        {columns.map((col) => (
          <div
            key={col.title}
            className="flex min-h-[320px] flex-col rounded-xl border border-slate-200/80 bg-white p-4 shadow-sm"
          >
            <div className="mb-4 border-b border-slate-100 pb-3">
              <h4 className="flex items-center gap-2 text-sm font-bold uppercase tracking-wide text-slate-700">
                <span>{col.emoji}</span>
                {col.title}
              </h4>
              <p className="mt-1 text-xs text-slate-500">{col.subtitle}</p>
            </div>
            <div className="flex flex-1 flex-col gap-3">
              {col.cards.map((c, i) => (
                <RouteCard key={i} {...c} accent={col.accent === 'green' ? 'green' : col.accent} />
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
