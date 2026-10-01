import {ApolloProvider} from '@apollo/client';
import {BrowserRouter, Route, Routes} from 'react-router-dom';
import {client} from './graphql/client';
import {CartProvider} from './context/Cart';
import {Layout} from './components/Layout';
import {CatalogPage} from './pages/CatalogPage';
import {ProductDetailsPage} from './pages/ProductDetailsPage';
import {CartPage} from './pages/CartPage';

export default function App() {
  return (
    <ApolloProvider client={client}>
      <CartProvider>
        <BrowserRouter>
          <Routes>
            <Route element={<Layout />}>
              <Route index element={<CatalogPage />} />
              <Route path="products/:id" element={<ProductDetailsPage />} />
              <Route path="cart" element={<CartPage />} />
            </Route>
          </Routes>
        </BrowserRouter>
      </CartProvider>
    </ApolloProvider>
  );
}
