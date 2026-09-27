import {useQuery} from '@apollo/client';
import {PRODUCTS_QUERY} from '../graphql/documents';
import type {Edges, ShopifyProduct} from '../types';
import {getCountry} from '../utils';

export function useProducts() {
  const {data, loading, error, refetch} = useQuery<{
    products: Edges<ShopifyProduct>;
  }>(PRODUCTS_QUERY, {variables: {country: getCountry()}});

  return {
    products: data?.products.edges.map(edge => edge.node) ?? [],
    loading,
    error,
    refetch,
  };
}
