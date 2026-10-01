# Web Storefront

A customer-facing web storefront built with Vite, React and TypeScript. It
reuses the Shopify Storefront GraphQL API queries and cart mutations from the
native `sample/` app, but is completely independent of
`@shopify/checkout-sheet-kit` (which is native-only).

On the web there is no native checkout sheet. Instead, checkout is performed by
redirecting the browser to the `cart.checkoutUrl` returned by the Storefront API
(`window.location.href = checkoutUrl`), which replaces the native
`shopify.present(checkoutUrl)` call.

## Setup

1. Install dependencies from the repo root:

   ```sh
   pnpm install
   ```

2. Create `web/.env` from the example and fill in your store details:

   ```sh
   cp web/.env.example web/.env
   ```

   | Variable                       | Description                                                        |
   | ------------------------------ | ------------------------------------------------------------------ |
   | `VITE_STOREFRONT_DOMAIN`       | Your store domain, e.g. `your-store.myshopify.com`                 |
   | `VITE_STOREFRONT_ACCESS_TOKEN` | A public Storefront API access token (Headless / Hydrogen channel) |
   | `VITE_STOREFRONT_VERSION`      | Storefront API version, e.g. `2025-07`                             |

3. Run the dev server:

   ```sh
   pnpm --filter web dev
   ```

   or, from within `web/`:

   ```sh
   pnpm dev
   ```

   Open http://localhost:5173.

## Scripts

| Command          | Description                        |
| ---------------- | ---------------------------------- |
| `pnpm dev`       | Start the Vite dev server          |
| `pnpm build`     | Typecheck and build for production |
| `pnpm preview`   | Serve the production build locally |
| `pnpm typecheck` | Run `tsc --noEmit`                 |

## Structure

- `src/graphql/client.ts` – Apollo Client configured for the Storefront API
- `src/graphql/documents.ts` – product query and cart mutations ported from
  `sample/src/hooks/useShopify.ts`
- `src/context/Cart.tsx` – cart state (`cartCreate`, `cartLinesAdd`,
  `cartLinesRemove`), persisted cart ID, and the `checkout()` redirect
- `src/pages/` – Catalog, Product details and Cart pages (react-router)
