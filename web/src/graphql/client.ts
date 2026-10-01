import {ApolloClient, InMemoryCache} from '@apollo/client';

const {
  VITE_STOREFRONT_DOMAIN: domain,
  VITE_STOREFRONT_VERSION: version,
  VITE_STOREFRONT_ACCESS_TOKEN: token,
} = import.meta.env;

if (!domain || !version || !token) {
  throw new Error(
    'Missing Storefront credentials. Copy web/.env.example to web/.env and fill in VITE_STOREFRONT_DOMAIN, VITE_STOREFRONT_VERSION and VITE_STOREFRONT_ACCESS_TOKEN.',
  );
}

export const client = new ApolloClient({
  uri: `https://${domain}/api/${version}/graphql.json`,
  cache: new InMemoryCache(),
  headers: {
    'Content-Type': 'application/json',
    'X-Shopify-Storefront-Access-Token': token,
  },
});
