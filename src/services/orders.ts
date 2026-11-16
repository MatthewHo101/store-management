import { randomUUID } from 'node:crypto';
import type { Transaction } from '../database.js';
import { DomainError } from '../domain/errors.js';
import type { Order, OrderItem, Product } from '../domain/types.js';
import { integer, multiply, sum } from '../domain/values.js';
import { planAllocation } from './allocation.js';
import { audit } from './audit.js';
import { emit } from './events.js';
import { fingerprint, recall, remember } from './idempotency.js';

export async function createOrder(
  tx: Transaction,
  input: {
    customerId: string;
    items: OrderItem[];
    requestKey: string;
    reservationMinutes?: number;
  },
) {
  if (!input.items.length) throw new DomainError('order must have items');
  const items = [...input.items].sort((a, b) => a.productId.localeCompare(b.productId));
  if (new Set(items.map((i) => i.productId)).size !== items.length)
    throw new DomainError('duplicate order product');
  const minutes = integer(input.reservationMinutes ?? 30, 'reservationMinutes');
  if (minutes > 1440) throw new DomainError('reservation maximum is 1440 minutes');
  items.forEach((i) => integer(i.quantity));
  const hash = fingerprint({ customerId: input.customerId, items, reservationMinutes: minutes });
  const previous = await recall(tx, input.requestKey, hash);
  if (previous) return getOrder(tx, previous);
  const products: Product[] = [];
  for (const item of items) {
    const product = await tx.one<Product>('SELECT * FROM products WHERE id=$1', [item.productId]);
    if (product.kind !== 'packaged') throw new DomainError('only packaged coffee can be sold');
    products.push(product);
  }
  const plan = await planAllocation(tx, items);
  const total = sum(items.map((i, index) => multiply(i.quantity, products[index]!.price)));
  const expires = new Date(tx.now.getTime() + minutes * 60000);
  const order = await tx.one<Order>(
    `INSERT INTO orders(id,customer_id,warehouse_id,total,expires_at,created_at)
    VALUES($1,$2,$3,$4,$5,$6) RETURNING *`,
    [randomUUID(), input.customerId, plan.warehouse.id, total, expires, tx.now],
  );
  for (const [index, item] of items.entries()) {
    await tx.query(
      'INSERT INTO order_lines(id,order_id,product_id,quantity,unit_price) VALUES($1,$2,$3,$4,$5)',
      [randomUUID(), order.id, item.productId, item.quantity, products[index]!.price],
    );
  }
  for (const allocation of plan.allocations) {
    await tx.query('INSERT INTO allocations(id,order_id,lot_id,quantity) VALUES($1,$2,$3,$4)', [
      randomUUID(),
      order.id,
      allocation.lotId,
      allocation.quantity,
    ]);
    await tx.query('UPDATE lots SET reserved=reserved+$2 WHERE id=$1', [
      allocation.lotId,
      allocation.quantity,
    ]);
  }
  await remember(tx, input.requestKey, hash, order.id);
  await audit(tx, 'order.created', order.id, { requestKey: input.requestKey });
  await emit(tx, 'order.reserved', { orderId: order.id });
  return order;
}
export function getOrder(tx: Transaction, id: string) {
  return tx.one<Order>('SELECT * FROM orders WHERE id=$1', [id]);
}
export async function orderDetails(tx: Transaction, id: string) {
  return {
    ...(await getOrder(tx, id)),
    items: await tx.query('SELECT * FROM order_lines WHERE order_id=$1 ORDER BY product_id', [id]),
    allocations: await tx.query('SELECT * FROM allocations WHERE order_id=$1 ORDER BY lot_id', [
      id,
    ]),
  };
}
export function listOrders(tx: Transaction) {
  return tx.query<Order>('SELECT * FROM orders ORDER BY created_at,id');
}
