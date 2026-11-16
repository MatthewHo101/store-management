import assert from 'node:assert/strict';
import { after, before, beforeEach, test } from 'node:test';
import type { Allocation, Payment } from '../src/domain/types.js';
import { cancelOrder } from '../src/services/cancellation.js';
import { getLot } from '../src/services/inventory.js';
import { createOrder, getOrder } from '../src/services/orders.js';
import { acceptPayment } from '../src/services/payments.js';
import { expireReservations } from '../src/services/reservations.js';
import { receiveReturn } from '../src/services/returns.js';
import { shipOrder } from '../src/services/shipping.js';
import { traceLot } from '../src/services/traceability.js';
import { LATER, NOW, makeOrder, reset, testDatabase, world } from './helpers.js';

const db = testDatabase();
before(() => db.migrate());
beforeEach(() => reset(db));
after(() => db.close());

test('concurrent orders cannot oversell the last stock', async () => {
  const w = await world(db);
  const attempts = await Promise.allSettled([makeOrder(db, w, 15, 'A'), makeOrder(db, w, 15, 'B')]);
  assert.equal(attempts.filter((a) => a.status === 'fulfilled').length, 1);
  const lot = await db.transaction((tx) => getLot(tx, w.packagedLot.id), NOW);
  assert.equal(lot.reserved, 15);
  assert.equal(lot.quantity, 20);
});

test('concurrent duplicate order requests return one resource', async () => {
  const w = await world(db);
  const results = await Promise.all([makeOrder(db, w), makeOrder(db, w)]);
  assert.equal(results[0].id, results[1].id);
  assert.equal((await db.transaction((tx) => getLot(tx, w.packagedLot.id), NOW)).reserved, 2);
  await assert.rejects(makeOrder(db, w, 3), /different content/);
});

test('unfulfillable order rolls back idempotency and every reservation', async () => {
  const w = await world(db);
  await assert.rejects(makeOrder(db, w, 21), /no single warehouse/);
  const counts = await db.transaction(
    async (tx) => ({
      lot: await getLot(tx, w.packagedLot.id),
      keys: await tx.query('SELECT * FROM idempotency'),
      orders: await tx.query('SELECT * FROM orders'),
    }),
    NOW,
  );
  assert.equal(counts.lot.reserved, 0);
  assert.equal(counts.keys.length, 0);
  assert.equal(counts.orders.length, 0);
});

test('duplicate payment callback produces one payment and event', async () => {
  const w = await world(db);
  const order = await makeOrder(db, w);
  const pay = () =>
    db.transaction((tx) => acceptPayment(tx, order.id, 'provider-event', order.total), NOW);
  const payments = await Promise.all([pay(), pay()]);
  assert.equal(payments[0].id, payments[1].id);
  await assert.rejects(
    db.transaction((tx) => acceptPayment(tx, order.id, 'provider-event', 1), NOW),
    /content changed/,
  );
  const rows = await db.transaction(
    (tx) => tx.query("SELECT * FROM outbox WHERE topic='payment.accepted'"),
    NOW,
  );
  assert.equal(rows.length, 1);
});

test('payment and expiry at the exact deadline cannot both win', async () => {
  const w = await world(db);
  const order = await makeOrder(db, w);
  const results = await Promise.allSettled([
    db.transaction(
      (tx) => acceptPayment(tx, order.id, 'late-event', order.total),
      order.expires_at,
    ),
    db.transaction(expireReservations, order.expires_at),
  ]);
  assert.equal(results[0].status, 'rejected');
  const updated = await db.transaction((tx) => getOrder(tx, order.id), order.expires_at);
  assert.equal(updated.status, 'expired');
  assert.equal(
    (await db.transaction((tx) => getLot(tx, w.packagedLot.id), order.expires_at)).reserved,
    0,
  );
});

test('paid reservations survive expiry job; cancellation releases stock and simulates refund once', async () => {
  const w = await world(db);
  const order = await makeOrder(db, w);
  await db.transaction((tx) => acceptPayment(tx, order.id, 'paid', order.total), NOW);
  assert.equal(await db.transaction(expireReservations, order.expires_at), 0);
  await db.transaction((tx) => cancelOrder(tx, order.id), order.expires_at);
  await db.transaction((tx) => cancelOrder(tx, order.id), order.expires_at);
  const payment = await db.transaction((tx) =>
    tx.one<Payment>('SELECT * FROM payments WHERE order_id=$1', [order.id]),
  );
  assert.equal(payment.refunded, true);
  assert.equal((await db.transaction((tx) => getLot(tx, w.packagedLot.id), NOW)).reserved, 0);
  assert.equal(
    (
      await db.transaction((tx) =>
        tx.query("SELECT * FROM outbox WHERE topic='payment.refund_simulated'"),
      )
    ).length,
    1,
  );
});

test('shipment is idempotent, deducts physical stock and preserves recall destination', async () => {
  const w = await world(db);
  const order = await makeOrder(db, w);
  await db.transaction((tx) => acceptPayment(tx, order.id, 'paid', order.total), NOW);
  const first = await db.transaction((tx) => shipOrder(tx, order.id, 'TRACK-1'), NOW);
  const repeated = await db.transaction((tx) => shipOrder(tx, order.id, 'TRACK-1'), NOW);
  assert.equal(first.id, repeated.id);
  const lot = await db.transaction((tx) => getLot(tx, w.packagedLot.id), NOW);
  assert.equal(lot.quantity, 18);
  assert.equal(lot.reserved, 0);
  const trace = await db.transaction((tx) => traceLot(tx, w.greenLot.id), NOW);
  assert.equal(trace.shipments[0]?.email, w.customer.email);
  await assert.rejects(
    db.transaction((tx) => cancelOrder(tx, order.id), NOW),
    /returns/,
  );
  await assert.rejects(
    db.transaction((tx) => shipOrder(tx, order.id, 'TRACK-2'), NOW),
    /different tracking/,
  );
});

test('shipment failure after stock mutation rolls back all allocations', async () => {
  const w = await world(db);
  const first = await makeOrder(db, w, 1, 'first');
  const second = await makeOrder(db, w, 1, 'second');
  await db.transaction((tx) => acceptPayment(tx, first.id, 'p1', first.total), NOW);
  await db.transaction((tx) => acceptPayment(tx, second.id, 'p2', second.total), NOW);
  await db.transaction((tx) => shipOrder(tx, first.id, 'SAME-TRACKING'), NOW);
  const before = await db.transaction((tx) => getLot(tx, w.packagedLot.id), NOW);
  await assert.rejects(
    db.transaction((tx) => shipOrder(tx, second.id, 'SAME-TRACKING'), NOW),
    /duplicate key/,
  );
  assert.deepEqual(await db.transaction((tx) => getLot(tx, w.packagedLot.id), NOW), before);
  assert.equal((await db.transaction((tx) => getOrder(tx, second.id), NOW)).status, 'paid');
});

test('inspected returns restore stock and cost once; overreturn is rejected', async () => {
  const w = await world(db);
  const order = await makeOrder(db, w);
  await db.transaction((tx) => acceptPayment(tx, order.id, 'paid', order.total), NOW);
  await db.transaction((tx) => shipOrder(tx, order.id, 'TRACK'), NOW);
  const allocation = await db.transaction(
    (tx) => tx.one<Allocation>('SELECT * FROM allocations WHERE order_id=$1', [order.id]),
    NOW,
  );
  const input = { allocationId: allocation.id, quantity: 2, restock: true, reference: 'RETURN' };
  const first = await db.transaction((tx) => receiveReturn(tx, input), NOW);
  const repeated = await db.transaction((tx) => receiveReturn(tx, input), NOW);
  assert.equal(first.id, repeated.id);
  const lot = await db.transaction((tx) => getLot(tx, w.packagedLot.id), NOW);
  assert.equal(lot.quantity, 20);
  assert.equal(lot.remaining_cost, w.packagedLot.remaining_cost);
  await assert.rejects(
    db.transaction((tx) => receiveReturn(tx, { ...input, quantity: 1, reference: 'EXCESS' }), NOW),
    /exceeds/,
  );
});

test('expired goods cannot ship or return into sellable stock', async () => {
  const w = await world(db);
  const order = await makeOrder(db, w);
  await db.transaction((tx) => acceptPayment(tx, order.id, 'paid', order.total), NOW);
  await assert.rejects(
    db.transaction((tx) => shipOrder(tx, order.id, 'TRACK'), LATER),
    /expired/,
  );
  await db.transaction((tx) => shipOrder(tx, order.id, 'TRACK'), NOW);
  const allocation = await db.transaction((tx) =>
    tx.one<Allocation>('SELECT * FROM allocations WHERE order_id=$1', [order.id]),
  );
  await assert.rejects(
    db.transaction(
      (tx) =>
        receiveReturn(tx, {
          allocationId: allocation.id,
          quantity: 1,
          restock: true,
          reference: 'EXPIRED',
        }),
      LATER,
    ),
    /expired/,
  );
});

test('non-packaged products, duplicate products and fractional quantities are rejected', async () => {
  const w = await world(db);
  const attempt = (items: { productId: string; quantity: number }[]) =>
    db.transaction(
      (tx) => createOrder(tx, { customerId: w.customer.id, items, requestKey: 'invalid' }),
      NOW,
    );
  await assert.rejects(attempt([{ productId: w.roasted.id, quantity: 1 }]), /packaged/);
  await assert.rejects(
    attempt([
      { productId: w.packaged.id, quantity: 1 },
      { productId: w.packaged.id, quantity: 1 },
    ]),
    /duplicate/,
  );
  await assert.rejects(attempt([{ productId: w.packaged.id, quantity: 0.5 }]), /integer/);
});
