export default function ProductCard({ name, description, price, image, onAdd }) {
  return (
    <article className="group flex flex-col overflow-hidden rounded-2xl border border-sky-100 bg-white shadow-sm transition duration-300 hover:-translate-y-1 hover:shadow-xl dark:border-slate-800 dark:bg-slate-900">
      <div className="relative aspect-[4/3] overflow-hidden bg-sky-100 dark:bg-slate-800">
        <img
          src={image}
          alt=""
          className="h-full w-full object-cover transition duration-500 group-hover:scale-105"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent opacity-0 transition group-hover:opacity-100" />
      </div>
      <div className="flex flex-1 flex-col p-5">
        <h3 className="text-lg font-semibold text-slate-900 dark:text-white">{name}</h3>
        <p className="mt-1 flex-1 text-sm text-slate-600 dark:text-slate-400">{description}</p>
        <div className="mt-4 flex items-center justify-between gap-3">
          <span className="text-xl font-bold text-emerald-700 dark:text-emerald-400">{price}</span>
          <button
            type="button"
            onClick={onAdd}
            className="rounded-full bg-sky-500 px-4 py-2 text-sm font-semibold text-white shadow-md shadow-sky-500/20 transition hover:bg-sky-600 dark:bg-emerald-600 dark:hover:bg-emerald-500"
          >
            Add to Cart
          </button>
        </div>
      </div>
    </article>
  )
}
