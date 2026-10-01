import {Link, NavLink, Outlet} from 'react-router-dom';
import {useCart} from '../context/Cart';

export function Layout() {
  const {totalQuantity} = useCart();

  return (
    <>
      <header className="header">
        <Link to="/" className="brand">
          Storefront
        </Link>
        <nav>
          <NavLink to="/">Catalog</NavLink>
          <NavLink to="/cart">
            Cart
            {totalQuantity > 0 && (
              <span className="badge">{totalQuantity}</span>
            )}
          </NavLink>
        </nav>
      </header>
      <main className="main">
        <Outlet />
      </main>
    </>
  );
}
