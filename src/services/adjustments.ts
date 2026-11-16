import type { Transaction } from '../database.js';
import { integer, label } from '../domain/values.js';
import { audit } from './audit.js';
import { consume } from './inventory.js';

/** Damaged packaging, sampling and production waste consume unreserved sellable stock. */
export async function recordWaste(
  tx: Transaction,
  lotId: string,
  quantity: number,
  reason: string,
) {
  integer(quantity);
  label(reason, 'waste reason');
  const cost = await consume(tx, lotId, quantity, 'waste', reason);
  await audit(tx, 'inventory.wasted', lotId, { quantity, cost, reason });
  return { lotId, quantity, cost };
}
