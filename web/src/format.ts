import type { Product, StockLot } from './types.js';

export const number = (value: number | string) => Number(value).toLocaleString();
export const money = (value: number | string, currency: string) =>
  new Intl.NumberFormat(undefined, { style: 'currency', currency }).format(Number(value) / 100);
export const date = (value: string | null) =>
  value
    ? new Date(value).toLocaleDateString(undefined, {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
      })
    : 'No expiry';
export function quantity(value: number | string, product?: Product) {
  return product?.kind === 'green' || product?.kind === 'roasted'
    ? `${number(Number(value) / 1000)} kg`
    : `${number(value)} units`;
}
export function lotState(lot: StockLot): string {
  if (lot.status === 'quarantined') return 'quarantined';
  if (lot.expires_at && new Date(lot.expires_at) <= new Date()) return 'expired';
  if (lot.quantity === 0) return 'depleted';
  return 'available';
}
export const shortId = (id: string) => id.slice(0, 8).toUpperCase();
