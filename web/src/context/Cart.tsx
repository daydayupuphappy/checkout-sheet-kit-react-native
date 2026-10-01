import type {PropsWithChildren} from 'react';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import {useLazyQuery, useMutation} from '@apollo/client';
import {
  ADD_TO_CART_MUTATION,
  CART_QUERY,
  CREATE_CART_MUTATION,
  REMOVE_FROM_CART_MUTATION,
} from '../graphql/documents';
import type {ShopifyCart} from '../types';
import {getCountry} from '../utils';

const CART_ID_STORAGE_KEY = 'shopify:cartId';

interface UserError {
  code: string;
  field: string[] | null;
  message: string;
}

interface CartContextValue {
  cart: ShopifyCart | undefined;
  cartId: string | undefined;
  checkoutUrl: string | undefined;
  totalQuantity: number;
  loading: boolean;
  pending: Set<string>;
  addToCart: (variantId: string, quantity?: number) => Promise<void>;
  removeFromCart: (lineId: string) => Promise<void>;
  checkout: () => void;
  clearCart: () => void;
}

const CartContext = createContext<CartContextValue | undefined>(undefined);

function throwOnUserErrors(errors: UserError[] | undefined) {
  if (errors && errors.length > 0) {
    throw new Error(errors.map(e => e.message).join(', '));
  }
}

export function CartProvider({children}: PropsWithChildren) {
  const country = getCountry();
  const [cartId, setCartId] = useState<string | undefined>(
    () => localStorage.getItem(CART_ID_STORAGE_KEY) ?? undefined,
  );
  const [checkoutUrl, setCheckoutUrl] = useState<string>();
  const [pending, setPending] = useState<Set<string>>(new Set());

  const [fetchCart, {data, loading}] = useLazyQuery<{cart: ShopifyCart | null}>(
    CART_QUERY,
    {fetchPolicy: 'network-only', variables: {country}},
  );
  const [createCart] = useMutation<{
    cartCreate: {
      cart: {id: string; checkoutUrl: string} | null;
      userErrors: UserError[];
    };
  }>(CREATE_CART_MUTATION, {variables: {country}});
  const [addLines] = useMutation<{
    cartLinesAdd: {
      cart: {id: string; checkoutUrl: string; totalQuantity: number} | null;
      userErrors: UserError[];
    };
  }>(ADD_TO_CART_MUTATION);
  const [removeLines] = useMutation<{
    cartLinesRemove: {
      cart: {id: string; checkoutUrl: string; totalQuantity: number} | null;
      userErrors: UserError[];
    };
  }>(REMOVE_FROM_CART_MUTATION);

  const cart = data?.cart ?? undefined;

  const clearCart = useCallback(() => {
    localStorage.removeItem(CART_ID_STORAGE_KEY);
    setCartId(undefined);
    setCheckoutUrl(undefined);
  }, []);

  // Restore a cart persisted from a previous visit. Runs only on mount so it
  // never races with the refetch issued by addToCart after cartCreate.
  useEffect(() => {
    const storedCartId = localStorage.getItem(CART_ID_STORAGE_KEY);
    if (!storedCartId) {
      return;
    }
    fetchCart({variables: {cartId: storedCartId, country}}).then(result => {
      if (result.data && result.data.cart === null) {
        clearCart();
      } else if (result.data?.cart) {
        setCheckoutUrl(result.data.cart.checkoutUrl);
      }
    });
  }, []);

  const track = useCallback(async (key: string, work: () => Promise<void>) => {
    setPending(prev => new Set(prev).add(key));
    try {
      await work();
    } finally {
      setPending(prev => {
        const next = new Set(prev);
        next.delete(key);
        return next;
      });
    }
  }, []);

  const addToCart = useCallback(
    (variantId: string, quantity = 1) =>
      track(variantId, async () => {
        let id = cartId;

        if (!id) {
          const {data: created} = await createCart({
            variables: {input: {}, country},
          });
          throwOnUserErrors(created?.cartCreate.userErrors);
          id = created?.cartCreate.cart?.id;
          if (!id) {
            throw new Error('Failed to create cart');
          }
          localStorage.setItem(CART_ID_STORAGE_KEY, id);
          setCartId(id);
        }

        const {data: added} = await addLines({
          variables: {
            cartId: id,
            lines: [{quantity, merchandiseId: variantId}],
            country,
          },
        });
        throwOnUserErrors(added?.cartLinesAdd.userErrors);

        if (added?.cartLinesAdd.cart?.checkoutUrl) {
          setCheckoutUrl(added.cartLinesAdd.cart.checkoutUrl);
        }
        await fetchCart({variables: {cartId: id, country}});
      }),
    [cartId, country, createCart, addLines, fetchCart, track],
  );

  const removeFromCart = useCallback(
    (lineId: string) =>
      track(lineId, async () => {
        if (!cartId) {
          return;
        }
        const {data: removed} = await removeLines({
          variables: {cartId, lineIds: [lineId], country},
        });
        throwOnUserErrors(removed?.cartLinesRemove.userErrors);
        if (removed?.cartLinesRemove.cart?.checkoutUrl) {
          setCheckoutUrl(removed.cartLinesRemove.cart.checkoutUrl);
        }
        await fetchCart({variables: {cartId, country}});
      }),
    [cartId, country, removeLines, fetchCart, track],
  );

  // On the web there is no native checkout sheet: hand the buyer off to
  // Shopify's hosted checkout by navigating the browser to `cart.checkoutUrl`.
  const checkout = useCallback(() => {
    if (checkoutUrl) {
      window.location.href = checkoutUrl;
    }
  }, [checkoutUrl]);

  const value = useMemo<CartContextValue>(
    () => ({
      cart,
      cartId,
      checkoutUrl,
      totalQuantity: cart?.totalQuantity ?? 0,
      loading,
      pending,
      addToCart,
      removeFromCart,
      checkout,
      clearCart,
    }),
    [
      cart,
      cartId,
      checkoutUrl,
      loading,
      pending,
      addToCart,
      removeFromCart,
      checkout,
      clearCart,
    ],
  );

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart(): CartContextValue {
  const ctx = useContext(CartContext);
  if (!ctx) {
    throw new Error('useCart must be used within a CartProvider');
  }
  return ctx;
}
