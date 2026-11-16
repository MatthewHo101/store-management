import { randomUUID } from 'node:crypto';
import type { Transaction } from '../database.js';
import { DomainError } from '../domain/errors.js';
import type { Product, Purchase } from '../domain/types.js';
import { integer, label, sum } from '../domain/values.js';
import { audit } from './audit.js';

export interface PurchaseInput {
  reference: string;
  supplierId: string;
  productId: string;
  warehouseId: string;
  quantity: number;
  totalCost: number;
  landedCost?: number;
}
export async function createPurchase(tx: Transaction, input: PurchaseInput) {
  const product = await tx.one<Product>('SELECT * FROM products WHERE id=$1', [input.productId]);
  if (!['green', 'material'].includes(product.kind))
    throw new DomainError('purchase green coffee or packaging materials');
  const goods = integer(input.totalCost, 'totalCost', 0);
  const landed = integer(input.landedCost ?? 0, 'landedCost', 0);
  sum([goods, landed]);
  const purchase = await tx.one<Purchase>(
    `INSERT INTO purchases
    (id,reference,supplier_id,product_id,warehouse_id,quantity,total_cost,landed_cost)
    VALUES($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`,
    [
      randomUUID(),
      label(input.reference, 'reference'),
      input.supplierId,
      input.productId,
      input.warehouseId,
      integer(input.quantity),
      goods,
      landed,
    ],
  );
  await audit(tx, 'purchase.created', purchase.id);
  return purchase;
}
export function listPurchases(tx: Transaction) {
  return tx.query<Purchase>('SELECT * FROM purchases ORDER BY reference,id');
}
