import type {Price} from './types';

export function getCountry(): string {
  const locale = navigator.language || 'en-CA';
  const [, country] = locale.split('-');
  return country?.toUpperCase() || 'CA';
}

export function formatPrice({amount, currencyCode}: Price): string {
  return new Intl.NumberFormat(navigator.language, {
    style: 'currency',
    currency: currencyCode,
  }).format(Number(amount));
}
