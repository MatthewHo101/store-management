import { randomUUID } from 'node:crypto';
import type { Transaction } from '../database.js';
import { Conflict } from '../domain/errors.js';
import type { Allocation, Shipment } from '../domain/types.js';
import { label, sum } from '../domain/values.js';
import { audit } from './audit.js';
import { emit } from './events.js';
import { consume } from './inventory.js';
import { getOrder } from './orders.js';

export async function shipOrder(tx: Transaction, orderId: string, tracking: string) {
  label(tracking, 'tracking');
  const order = await getOrder(tx, orderId);
  if (order.status === 'shipped') {
    const existing = await tx.one<Shipment>('SELECT * FROM shipments WHERE order_id=$1', [
      order.id,
    ]);
    if (existing.tracking !== tracking)
      throw new Conflict('order already shipped with different tracking');
    return existing;
  }
  if (order.status !== 'paid') throw new Conflict('only paid orders can ship');
  const allocations = await tx.query<Allocation>(
    'SELECT * FROM allocations WHERE order_id=$1 ORDER BY lot_id',
    [order.id],
  );
  const costs: number[] = [];
  for (const allocation of allocations) {
    await tx.query('UPDATE lots SET reserved=reserved-$2 WHERE id=$1', [
      allocation.lot_id,
      allocation.quantity,
    ]);
    const cost = await consume(tx, allocation.lot_id, allocation.quantity, 'shipment', order.id);
    await tx.query('UPDATE allocations SET shipped_cost=$2 WHERE id=$1', [allocation.id, cost]);
    costs.push(cost);
  }
  await tx.query("UPDATE orders SET status='shipped',cost=$2 WHERE id=$1", [order.id, sum(costs)]);
  const shipment = await tx.one<Shipment>(
    'INSERT INTO shipments(id,order_id,tracking) VALUES($1,$2,$3) RETURNING *',
    [randomUUID(), order.id, tracking],
  );
  await audit(tx, 'order.shipped', order.id, { tracking });
  await emit(tx, 'order.shipped', { orderId: order.id, tracking });
  return shipment;
}
