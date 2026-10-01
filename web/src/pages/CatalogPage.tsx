import {ProductCard} from '../components/ProductCard';
import {useProducts} from '../hooks/useProducts';

export function CatalogPage() {
  const {products, loading, error, refetch} = useProducts();

  if (loading) {
    return <p className="status">Loading products…</p>;
  }
  if (error) {
    return (
      <div className="status">
        <p>Failed to load products: {error.message}</p>
        <button className="button" onClick={() => refetch()}>
          Retry
        </button>
      </div>
    );
  }
  if (products.length === 0) {
    return <p className="status">No products found.</p>;
  }

  return (
    <section className="grid">
      {products.map(product => (
        <ProductCard key={product.id} product={product} />
      ))}
    </section>
  );
}
