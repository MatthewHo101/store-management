import type { Transaction } from '../database.js';
import { Conflict } from '../domain/errors.js';
import { audit } from './audit.js';
import { emit } from './events.js';
import { getOrder } from './orders.js';
import { releaseReservations } from './reservations.js';

export async function cancelOrder(tx: Transaction, orderId: string) {
  const order = await getOrder(tx, orderId);
  if (order.status === 'cancelled') return order;
  if (order.status === 'shipped') throw new Conflict('shipped orders must use returns');
  if (order.status !== 'expired') await releaseReservations(tx, order.id);
  if (order.status === 'paid') {
    await tx.query('UPDATE payments SET refunded=true WHERE order_id=$1', [order.id]);
    await emit(tx, 'payment.refund_simulated', { orderId: order.id, amount: order.total });
  }
  await tx.query("UPDATE orders SET status='cancelled' WHERE id=$1", [order.id]);
  await audit(tx, 'order.cancelled', order.id, { refundSimulated: order.status === 'paid' });
  await emit(tx, 'order.cancelled', { orderId: order.id });
  return getOrder(tx, order.id);
}
