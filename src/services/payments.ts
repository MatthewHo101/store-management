import { randomUUID } from 'node:crypto';
import type { Transaction } from '../database.js';
import { Conflict } from '../domain/errors.js';
import type { Lot, Payment } from '../domain/types.js';
import { integer, label } from '../domain/values.js';
import { audit } from './audit.js';
import { emit } from './events.js';
import { getOrder } from './orders.js';

/** Simulated provider callback. A real provider must verify signatures BEFORE invoking this. */
export async function acceptPayment(
  tx: Transaction,
  orderId: string,
  eventId: string,
  amount: number,
) {
  integer(amount, 'amount', 0);
  label(eventId, 'eventId');
  const existing = (
    await tx.query<Payment>('SELECT * FROM payments WHERE event_id=$1', [eventId])
  )[0];
  if (existing) {
    if (existing.order_id !== orderId || existing.amount !== amount)
      throw new Conflict('payment event content changed');
    return existing;
  }
  const order = await getOrder(tx, orderId);
  if (order.status !== 'reserved') throw new Conflict('order does not accept payment');
  if (order.expires_at <= tx.now) throw new Conflict('reservation deadline has passed');
  if (order.total !== amount) throw new Conflict('payment must match the captured order total');
  const lots = await tx.query<Lot>(
    'SELECT l.* FROM lots l JOIN allocations a ON a.lot_id=l.id WHERE a.order_id=$1',
    [order.id],
  );
  if (lots.some((l) => l.status !== 'approved' || (l.expires_at && l.expires_at <= tx.now))) {
    throw new Conflict('reserved stock is no longer sellable; cancel this order');
  }
  const payment = await tx.one<Payment>(
    'INSERT INTO payments(id,order_id,event_id,amount) VALUES($1,$2,$3,$4) RETURNING *',
    [randomUUID(), order.id, eventId, amount],
  );
  await tx.query("UPDATE orders SET status='paid' WHERE id=$1", [order.id]);
  await audit(tx, 'payment.accepted', order.id, { eventId });
  await emit(tx, 'payment.accepted', { orderId: order.id });
  return payment;
}
