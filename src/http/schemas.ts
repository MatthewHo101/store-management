import { z } from 'zod';
import { MAX_INTEGER } from '../domain/values.js';

export const id = z.uuid();
export const name = z.string().trim().min(1).max(120);
export const positive = z.number().int().min(1).max(MAX_INTEGER);
export const money = z.number().int().min(0).max(MAX_INTEGER);
export const date = z.iso.datetime({ offset: true }).transform((v) => new Date(v));
export const inputs = z
  .array(z.strictObject({ lotId: id, quantity: positive }))
  .min(1)
  .max(100);
export const items = z
  .array(z.strictObject({ productId: id, quantity: positive }))
  .min(1)
  .max(100);
export function paramId(params: unknown): string {
  return z.object({ id }).parse(params).id;
}
