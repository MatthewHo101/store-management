import assert from 'node:assert/strict';
import { after, before, beforeEach, test } from 'node:test';
import { share } from '../src/domain/values.js';
import { recordWaste } from '../src/services/adjustments.js';
import { getLot } from '../src/services/inventory.js';
import { lotLedger } from '../src/services/ledger.js';
import { packageCoffee } from '../src/services/packaging.js';
import { createPurchase } from '../src/services/procurement.js';
import { inspectLot } from '../src/services/quality.js';
import { receive } from '../src/services/receiving.js';
import { roast } from '../src/services/roasting.js';
import { traceLot } from '../src/services/traceability.js';
import { NOW, LATER, makeOrder, reset, testDatabase, world } from './helpers.js';

const db = testDatabase();
before(() => db.migrate());
beforeEach(() => reset(db));
after(() => db.close());

test('roast loss is measured and all input costs move to the output', async () => {
  const w = await world(db);
  await db.transaction(async (tx) => {
    const green = await getLot(tx, w.greenLot.id);
    const roastLot = await getLot(tx, w.roastLot.id);
    assert.equal(green.quantity, 0);
    assert.equal(green.remaining_cost, 0);
    assert.equal(roastLot.quantity, 3400);
    assert.equal(roastLot.remaining_cost + w.packagedLot.remaining_cost, 10400);
    const run = await tx.one('SELECT * FROM production WHERE output_lot_id=$1', [roastLot.id]);
    assert.equal(run.input_grams, 10000);
    assert.equal(run.output_grams, 8400);
  }, NOW);
});

test('packaging consumes grams and bag units and preserves freshness', async () => {
  const w = await world(db);
  const bagLot = await db.transaction((tx) => getLot(tx, w.bagLot.id), NOW);
  assert.equal(bagLot.quantity, 80);
  assert.equal(w.packagedLot.quantity, 20);
  assert.equal(w.packagedLot.expires_at?.toISOString(), LATER.toISOString());
});

test('production failure rolls back stock, ledger, audit and events together', async () => {
  const w = await world(db);
  const count = () =>
    db.transaction(
      async (tx) => ({
        lot: await getLot(tx, w.roastLot.id),
        movements: await tx.one('SELECT count(*) AS n FROM movements'),
        audit: await tx.one('SELECT count(*) AS n FROM audit'),
        events: await tx.one('SELECT count(*) AS n FROM outbox'),
      }),
      NOW,
    );
  const initial = await count();
  await assert.rejects(
    db.transaction(
      (tx) =>
        packageCoffee(tx, {
          coffeeLotId: w.roastLot.id,
          materialLotId: w.bagLot.id,
          outputProductId: w.packaged.id,
          units: 1,
          code: w.packagedLot.code, // unique failure occurs AFTER input consumption
        }),
      NOW,
    ),
    /duplicate key/,
  );
  assert.deepEqual(await count(), initial);
});

test('quarantined stock cannot be consumed; active reservations block quarantine', async () => {
  const w = await world(db);
  await db.transaction((tx) => inspectLot(tx, w.roastLot.id, false, 'Failed cupping'), NOW);
  await assert.rejects(
    db.transaction(
      (tx) =>
        packageCoffee(tx, {
          coffeeLotId: w.roastLot.id,
          materialLotId: w.bagLot.id,
          outputProductId: w.packaged.id,
          units: 1,
          code: 'BAD',
        }),
      NOW,
    ),
    /quarantined/,
  );
  await makeOrder(db, w);
  await assert.rejects(
    db.transaction((tx) => inspectLot(tx, w.packagedLot.id, false, 'Recall'), NOW),
    /reservations/,
  );
});

test('overreceipt is rejected and partial receipt cents sum to purchase cost', async () => {
  const w = await world(db);
  const purchase = await db.transaction(
    (tx) =>
      createPurchase(tx, {
        reference: 'ROUNDING',
        supplierId: w.supplier.id,
        productId: w.bags.id,
        warehouseId: w.warehouse.id,
        quantity: 3,
        totalCost: 10,
      }),
    NOW,
  );
  const costs: number[] = [];
  for (let i = 0; i < 3; i++) {
    const lot = await db.transaction(
      (tx) =>
        receive(tx, { purchaseId: purchase.id, code: `PART-${i}`, quantity: 1, expiresAt: null }),
      NOW,
    );
    costs.push(lot.remaining_cost);
  }
  assert.deepEqual(costs, [3, 3, 4]);
  await assert.rejects(
    db.transaction(
      (tx) =>
        receive(tx, { purchaseId: purchase.id, code: 'EXCESS', quantity: 1, expiresAt: null }),
      NOW,
    ),
    /exceeds/,
  );
});

test('inventory movements reconcile every lot balance and cost', async () => {
  const w = await world(db);
  await db.transaction((tx) => recordWaste(tx, w.bagLot.id, 3, 'Damaged bags'), NOW);
  await db.transaction(async (tx) => {
    const lots = await tx.query<{ id: string; quantity: number; remaining_cost: number }>(
      'SELECT * FROM lots',
    );
    for (const lot of lots) {
      const entries = await lotLedger(tx, lot.id);
      assert.equal(
        entries.reduce((n, e) => n + e.quantity, 0),
        lot.quantity,
      );
      assert.equal(
        entries.reduce((n, e) => n + e.cost, 0),
        lot.remaining_cost,
      );
    }
  }, NOW);
});

test('trace traverses supplier receipts through roasting and packaging', async () => {
  const w = await world(db);
  const trace = await db.transaction((tx) => traceLot(tx, w.packagedLot.id), NOW);
  assert.deepEqual(
    new Set(trace.ancestors.map((l) => l.id)),
    new Set([w.greenLot.id, w.roastLot.id, w.bagLot.id]),
  );
  assert.equal(trace.purchases.length, 2);
});

test('invalid roast yield and duplicate input lots do not change stock', async () => {
  const w = await world(db);
  const green = await db.transaction(async (tx) => {
    const purchase = await createPurchase(tx, {
      reference: 'YIELD-PO',
      supplierId: w.supplier.id,
      productId: w.green.id,
      warehouseId: w.warehouse.id,
      quantity: 1000,
      totalCost: 1000,
    });
    return receive(tx, {
      purchaseId: purchase.id,
      code: 'YIELD-GREEN',
      quantity: 1000,
      expiresAt: LATER,
    });
  }, NOW);
  await assert.rejects(
    db.transaction(
      (tx) =>
        roast(tx, {
          inputs: [{ lotId: green.id, quantity: 100 }],
          outputProductId: w.roasted.id,
          code: 'INVALID',
          outputGrams: 101,
          profile: 'Test',
          expiresAt: LATER,
        }),
      NOW,
    ),
    /cannot exceed input mass/,
  );
  await assert.rejects(
    db.transaction(
      (tx) =>
        roast(tx, {
          inputs: [
            { lotId: green.id, quantity: 100 },
            { lotId: green.id, quantity: 100 },
          ],
          outputProductId: w.roasted.id,
          code: 'INVALID',
          outputGrams: 100,
          profile: 'Test',
          expiresAt: LATER,
        }),
      NOW,
    ),
    /distinct/,
  );
  assert.equal((await db.transaction((tx) => getLot(tx, green.id), NOW)).quantity, 1000);
});

test('cost allocation uses exact arithmetic at large supported values', () => {
  const cost = 2147483647;
  const qty = 2147483646;
  assert.equal(share(cost, qty, cost), qty);
  assert.equal(share(cost, cost, cost), cost);
});
