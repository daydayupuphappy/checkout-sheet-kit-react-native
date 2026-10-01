import {Link} from 'react-router-dom';
import type {ShopifyProduct} from '../types';
import {formatPrice} from '../utils';
import {useCart} from '../context/Cart';

export function ProductCard({product}: {product: ShopifyProduct}) {
  const {addToCart, pending} = useCart();
  const image = product.images.edges[0]?.node;
  const variant = product.variants.edges[0]?.node;
  const busy = variant ? pending.has(variant.id) : false;
  const handle = encodeURIComponent(product.id);

  return (
    <article className="card">
      <Link to={`/products/${handle}`} className="card-image">
        {image && (
          <img src={image.thumbnailUrl} alt={image.altText ?? product.title} />
        )}
      </Link>
      <div className="card-body">
        <Link to={`/products/${handle}`} className="card-title">
          {product.title}
        </Link>
        {variant && <p className="price">{formatPrice(variant.price)}</p>}
        <button
          className="button"
          disabled={!variant || busy}
          onClick={() => variant && addToCart(variant.id)}>
          {busy ? 'Adding…' : 'Add to cart'}
        </button>
      </div>
    </article>
  );
}
