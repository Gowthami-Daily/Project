import ProductCard from './ProductCard.jsx'

const PRODUCTS = [
  {
    id: 'milk',
    name: 'Farm Milk',
    description: 'Full-cream, glass-bottle option available. Pasteurized same day.',
    price: '₹52 / L',
    image:
      'https://images.unsplash.com/photo-1563636619-e9143da7973b?auto=format&fit=crop&w=600&q=80',
  },
  {
    id: 'curd',
    name: 'Thick Curd',
    description: 'Slow-set with live cultures — perfect for meals and marinades.',
    price: '₹45 / 400g',
    image:
      'https://images.unsplash.com/photo-1488477181946-6428a0291777?auto=format&fit=crop&w=600&q=80',
  },
  {
    id: 'butter',
    name: 'Cultured Butter',
    description: 'Small-batch churned butter with a clean, sweet finish.',
    price: '₹120 / 200g',
    image:
      'https://images.unsplash.com/photo-1589985270826-457ba4917a8f?auto=format&fit=crop&w=600&q=80',
  },
  {
    id: 'ghee',
    name: 'A2 Ghee',
    description: 'Traditional slow-clarified ghee — nutty aroma, high smoke point.',
    price: '₹499 / 500ml',
    image:
      'https://images.unsplash.com/photo-1596797038530-2c107229974b?auto=format&fit=crop&w=600&q=80',
  },
]

export default function Products({ onAddToCart }) {
  return (
    <section id="products" className="bg-sky-50/80 py-16 dark:bg-slate-900/50 sm:py-20">
      <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="text-3xl font-bold tracking-tight text-slate-900 dark:text-white">Our products</h2>
          <p className="mt-3 text-slate-600 dark:text-slate-400">
            Staples your kitchen reorders weekly — transparent pricing, subscription-friendly.
          </p>
        </div>
        <div className="mt-12 grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
          {PRODUCTS.map((p) => (
            <ProductCard
              key={p.id}
              name={p.name}
              description={p.description}
              price={p.price}
              image={p.image}
              onAdd={() => onAddToCart(p)}
            />
          ))}
        </div>
      </div>
    </section>
  )
}
