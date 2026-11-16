import { DomainError } from './errors.js';

export const MAX_INTEGER = 2_147_483_647;
export function integer(value: number, name = 'quantity', minimum = 1): number {
  if (!Number.isSafeInteger(value) || value < minimum || value > MAX_INTEGER) {
    throw new DomainError(`${name} must be an integer between ${minimum} and ${MAX_INTEGER}`);
  }
  return value;
}
export function label(value: string, name = 'name'): string {
  const result = value.trim();
  if (!result || result.length > 120) throw new DomainError(`${name} requires 1–120 characters`);
  return result;
}
export function sum(values: number[]): number {
  return integer(
    values.reduce((a, b) => a + b, 0),
    'total',
    0,
  );
}
export function multiply(a: number, b: number): number {
  return integer(a * b, 'product', 0);
}
/** BigInt intermediates preserve cents even when quantity × value exceeds Number precision. */
export function share(cost: number, quantity: number, total: number): number {
  return Number((BigInt(cost) * BigInt(quantity)) / BigInt(total));
}
export function future(value: Date | null, now: Date): void {
  if (value && (!Number.isFinite(value.getTime()) || value <= now)) {
    throw new DomainError('expiry must be in the future');
  }
}
