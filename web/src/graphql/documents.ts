import {gql} from '@apollo/client';

const moneyFragment = gql`
  fragment Price on MoneyV2 {
    currencyCode
    amount
  }
`;

const productFragment = gql`
  fragment Product on ProductVariant {
    id
    price {
      ...Price
    }
    product {
      title
    }
    image {
      id
      width
      height
      url
      altText
      thumbnailUrl: url(transform: {maxWidth: 80, maxHeight: 80})
    }
  }

  ${moneyFragment}
`;

const cartCostFragment = gql`
  fragment Cost on CartCost {
    subtotalAmount {
      ...Price
    }
    totalAmount {
      ...Price
    }
    totalTaxAmount {
      ...Price
    }
  }
`;

export const PRODUCTS_QUERY = gql`
  query FetchProducts($country: CountryCode = CA)
  @inContext(country: $country) {
    products(first: 10) {
      edges {
        node {
          id
          title
          description
          variants(first: 1) {
            edges {
              node {
                id
                price {
                  ...Price
                }
              }
            }
          }
          images(first: 1) {
            edges {
              node {
                id
                width
                height
                url
                altText
                thumbnailUrl: url(transform: {maxWidth: 400, maxHeight: 400})
              }
            }
          }
        }
      }
    }
  }

  ${moneyFragment}
`;

export const CART_QUERY = gql`
  query FetchCart($cartId: ID!, $country: CountryCode = CA)
  @inContext(country: $country) {
    cart(id: $cartId) {
      id
      checkoutUrl
      totalQuantity
      cost {
        ...Cost
      }
      lines(first: 100) {
        edges {
          node {
            id
            quantity
            merchandise {
              ...Product
            }
            cost {
              totalAmount {
                ...Price
              }
            }
          }
        }
      }
    }
  }

  ${productFragment}
  ${moneyFragment}
  ${cartCostFragment}
`;

export const CREATE_CART_MUTATION = gql`
  mutation CreateCart($input: CartInput, $country: CountryCode = CA)
  @inContext(country: $country) {
    cartCreate(input: $input) {
      cart {
        id
        checkoutUrl
      }
      userErrors {
        code
        field
        message
      }
    }
  }
`;

export const ADD_TO_CART_MUTATION = gql`
  mutation AddToCart(
    $cartId: ID!
    $lines: [CartLineInput!]!
    $country: CountryCode = CA
  ) @inContext(country: $country) {
    cartLinesAdd(cartId: $cartId, lines: $lines) {
      cart {
        id
        checkoutUrl
        totalQuantity
      }
      userErrors {
        code
        field
        message
      }
    }
  }
`;

export const REMOVE_FROM_CART_MUTATION = gql`
  mutation RemoveFromCart(
    $cartId: ID!
    $lineIds: [ID!]!
    $country: CountryCode = CA
  ) @inContext(country: $country) {
    cartLinesRemove(cartId: $cartId, lineIds: $lineIds) {
      cart {
        id
        checkoutUrl
        totalQuantity
      }
      userErrors {
        code
        field
        message
      }
    }
  }
`;
