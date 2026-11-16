import { randomUUID } from 'node:crypto';
import type { Transaction } from '../database.js';
import { Conflict } from '../domain/errors.js';
import type { Allocation } from '../domain/types.js';
import { integer, label, share, sum } from '../domain/values.js';
import { audit } from './audit.js';
import { getLot } from './inventory.js';
import { movement } from './ledger.js';
import { getOrder } from './orders.js';

export interface ReturnRecord {
  id: string;
  allocation_id: string;
  quantity: number;
  restocked: boolean;
  reference: string;
}
export async function receiveReturn(
  tx: Transaction,
  input: {
    allocationId: string;
    quantity: number;
    restock: boolean;
    reference: string;
  },
) {
  integer(input.quantity);
  label(input.reference, 'reference');
  const existing = (
    await tx.query<ReturnRecord>('SELECT * FROM returns WHERE reference=$1', [input.reference])
  )[0];
  if (existing) {
    if (
      existing.allocation_id !== input.allocationId ||
      existing.quantity !== input.quantity ||
      existing.restocked !== input.restock
    ) {
      throw new Conflict('return reference already used with different content');
    }
    return existing;
  }
  const allocation = await tx.one<Allocation>('SELECT * FROM allocations WHERE id=$1', [
    input.allocationId,
  ]);
  const order = await getOrder(tx, allocation.order_id);
  if (order.status !== 'shipped') throw new Conflict('only shipped goods may be returned');
  if (allocation.returned + input.quantity > allocation.quantity)
    throw new Conflict('return exceeds shipped quantity');
  if (input.restock) {
    const lot = await getLot(tx, allocation.lot_id);
    if (lot.status !== 'approved' || (lot.expires_at && lot.expires_at <= tx.now)) {
      throw new Conflict('expired or quarantined goods cannot be restocked as sellable');
    }
    const cost =
      share(allocation.shipped_cost, allocation.returned + input.quantity, allocation.quantity) -
      share(allocation.shipped_cost, allocation.returned, allocation.quantity);
    sum([lot.quantity, input.quantity]);
    sum([lot.remaining_cost, cost]);
    await tx.query(
      'UPDATE lots SET quantity=quantity+$2,remaining_cost=remaining_cost+$3 WHERE id=$1',
      [lot.id, input.quantity, cost],
    );
    await movement(tx, lot.id, input.quantity, cost, 'return', input.reference);
  }
  await tx.query('UPDATE allocations SET returned=returned+$2 WHERE id=$1', [
    allocation.id,
    input.quantity,
  ]);
  const record = await tx.one<ReturnRecord>(
    'INSERT INTO returns(id,allocation_id,quantity,restocked,reference) VALUES($1,$2,$3,$4,$5) RETURNING *',
    [randomUUID(), allocation.id, input.quantity, input.restock, input.reference],
  );
  await audit(tx, 'return.received', order.id, { returnId: record.id, restocked: input.restock });
  return record;
}
