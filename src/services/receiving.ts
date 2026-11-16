import type { Transaction } from '../database.js';
import { Conflict } from '../domain/errors.js';
import type { Purchase } from '../domain/types.js';
import { integer, share } from '../domain/values.js';
import { audit } from './audit.js';
import { emit } from './events.js';
import { createLot } from './inventory.js';

export async function receive(
  tx: Transaction,
  input: {
    purchaseId: string;
    code: string;
    quantity: number;
    expiresAt: Date | null;
  },
) {
  const purchase = await tx.one<Purchase>('SELECT * FROM purchases WHERE id=$1', [
    input.purchaseId,
  ]);
  integer(input.quantity);
  if (purchase.received + input.quantity > purchase.quantity)
    throw new Conflict('receipt exceeds purchase balance');
  // Cumulative differences carry rounding cents into the last receipt.
  const cost = purchase.total_cost + purchase.landed_cost;
  const allocated =
    share(cost, purchase.received + input.quantity, purchase.quantity) -
    share(cost, purchase.received, purchase.quantity);
  const lot = await createLot(tx, {
    code: input.code,
    productId: purchase.product_id,
    warehouseId: purchase.warehouse_id,
    quantity: input.quantity,
    cost: allocated,
    purchaseId: purchase.id,
    expiresAt: input.expiresAt,
    reason: 'receipt',
    reference: purchase.reference,
  });
  await tx.query('UPDATE purchases SET received=received+$2 WHERE id=$1', [
    purchase.id,
    input.quantity,
  ]);
  await audit(tx, 'purchase.received', purchase.id, { lotId: lot.id, quantity: input.quantity });
  await emit(tx, 'inventory.received', { lotId: lot.id });
  return lot;
}
