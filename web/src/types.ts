export type Edges<T> = {
  edges: {node: T}[];
};

export interface Price {
  amount: string;
  currencyCode: string;
}

export interface ProductVariant {
  id: string;
  price: Price;
}

export interface ShopifyProduct {
  id: string;
  title: string;
  description: string;
  images: Edges<{
    id: string;
    altText: string | null;
    url: string;
    thumbnailUrl: string;
  }>;
  variants: Edges<ProductVariant>;
}

export interface CartLineItem {
  id: string;
  quantity: number;
  merchandise: {
    id: string;
    price: Price;
    product: {title: string};
    image: {url: string; thumbnailUrl: string; altText: string | null} | null;
  };
  cost: {totalAmount: Price};
}

export interface ShopifyCart {
  id: string;
  checkoutUrl: string;
  totalQuantity: number;
  cost: {
    subtotalAmount: Price;
    totalAmount: Price;
    totalTaxAmount: Price | null;
  };
  lines: Edges<CartLineItem>;
}
