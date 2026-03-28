export default function ModulePlaceholder({ title, description }) {
  return (
    <div className="mx-auto max-w-lg py-16 text-center">
      <h2 className="text-2xl font-bold text-slate-900">{title}</h2>
      <p className="mt-2 text-slate-500">
        {description ?? 'This ERP module will be wired to APIs in a later sprint.'}
      </p>
    </div>
  )
}
