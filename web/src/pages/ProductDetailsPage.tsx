import {Link, useParams} from 'react-router-dom';
import {useProducts} from '../hooks/useProducts';
import {useCart} from '../context/Cart';
import {formatPrice} from '../utils';

export function ProductDetailsPage() {
  const {id} = useParams<{id: string}>();
  const {products, loading, error} = useProducts();
  const {addToCart, pending, checkoutUrl, checkout} = useCart();

  if (loading) {
    return <p className="status">Loading…</p>;
  }
  if (error) {
    return <p className="status">Failed to load product: {error.message}</p>;
  }

  const product = products.find(p => p.id === decodeURIComponent(id ?? ''));
  if (!product) {
    return (
      <div className="status">
        <p>Product not found.</p>
        <Link to="/">Back to catalog</Link>
      </div>
    );
  }

  const image = product.images.edges[0]?.node;
  const variant = product.variants.edges[0]?.node;
  const busy = variant ? pending.has(variant.id) : false;

  return (
    <article className="details">
      {image && (
        <img
          className="details-image"
          src={image.url}
          alt={image.altText ?? product.title}
        />
      )}
      <div className="details-body">
        <Link to="/">← Back to catalog</Link>
        <h1>{product.title}</h1>
        {variant && <p className="price">{formatPrice(variant.price)}</p>}
        <p>{product.description}</p>
        <div className="actions">
          <button
            className="button"
            disabled={!variant || busy}
            onClick={() => variant && addToCart(variant.id)}>
            {busy ? 'Adding…' : 'Add to cart'}
          </button>
          {checkoutUrl && (
            <button className="button button-primary" onClick={checkout}>
              Checkout
            </button>
          )}
        </div>
      </div>
    </article>
  );
}
