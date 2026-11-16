import type { Transaction } from '../database.js';
import type { Allocation, Order } from '../domain/types.js';
import { audit } from './audit.js';
import { emit } from './events.js';

export async function releaseReservations(tx: Transaction, orderId: string) {
  const allocations = await tx.query<Allocation>('SELECT * FROM allocations WHERE order_id=$1', [
    orderId,
  ]);
  for (const allocation of allocations) {
    await tx.query('UPDATE lots SET reserved=reserved-$2 WHERE id=$1', [
      allocation.lot_id,
      allocation.quantity,
    ]);
  }
}
export async function expireReservations(tx: Transaction) {
  const expired = await tx.query<Order>(
    "SELECT * FROM orders WHERE status='reserved' AND expires_at<=$1 ORDER BY id",
    [tx.now],
  );
  for (const order of expired) {
    await releaseReservations(tx, order.id);
    await tx.query("UPDATE orders SET status='expired' WHERE id=$1", [order.id]);
    await audit(tx, 'order.expired', order.id);
    await emit(tx, 'order.expired', { orderId: order.id });
  }
  return expired.length;
}
