import {Link} from 'react-router-dom';
import {useCart} from '../context/Cart';
import {formatPrice} from '../utils';

export function CartPage() {
  const {
    cart,
    cartId,
    loading,
    pending,
    removeFromCart,
    checkout,
    checkoutUrl,
  } = useCart();

  if (!cartId || (cart && cart.lines.edges.length === 0)) {
    return (
      <div className="status">
        <p>Your cart is empty.</p>
        <Link to="/">Browse the catalog</Link>
      </div>
    );
  }
  if (!cart) {
    return (
      <p className="status">
        {loading ? 'Loading cart…' : 'Unable to load cart.'}
      </p>
    );
  }

  return (
    <section className="cart">
      <ul className="lines">
        {cart.lines.edges.map(({node: line}) => (
          <li key={line.id} className="line">
            {line.merchandise.image && (
              <img
                src={line.merchandise.image.thumbnailUrl}
                alt={
                  line.merchandise.image.altText ??
                  line.merchandise.product.title
                }
              />
            )}
            <div className="line-body">
              <strong>{line.merchandise.product.title}</strong>
              <span>
                {line.quantity} × {formatPrice(line.merchandise.price)}
              </span>
            </div>
            <span className="line-total">
              {formatPrice(line.cost.totalAmount)}
            </span>
            <button
              className="button button-link"
              disabled={pending.has(line.id)}
              onClick={() => removeFromCart(line.id)}>
              {pending.has(line.id) ? 'Removing…' : 'Remove'}
            </button>
          </li>
        ))}
      </ul>
      <aside className="summary">
        <div className="summary-row">
          <span>Subtotal</span>
          <span>{formatPrice(cart.cost.subtotalAmount)}</span>
        </div>
        {cart.cost.totalTaxAmount && (
          <div className="summary-row">
            <span>Tax</span>
            <span>{formatPrice(cart.cost.totalTaxAmount)}</span>
          </div>
        )}
        <div className="summary-row summary-total">
          <span>Total</span>
          <span>{formatPrice(cart.cost.totalAmount)}</span>
        </div>
        <button
          className="button button-primary"
          disabled={!checkoutUrl || loading}
          onClick={checkout}>
          Checkout
        </button>
      </aside>
    </section>
  );
}
