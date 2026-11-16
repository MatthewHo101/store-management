import assert from 'node:assert/strict';
import { after, before, beforeEach, test } from 'node:test';
import { seedDemo } from '../src/demo.js';
import { blend } from '../src/services/blending.js';
import { createProduct } from '../src/services/catalog.js';
import { getLot } from '../src/services/inventory.js';
import { deliverOutbox } from '../src/services/outbox.js';
import { createPurchase } from '../src/services/procurement.js';
import { receive } from '../src/services/receiving.js';
import { createRecipe } from '../src/services/recipes.js';
import { inventoryReport, operationsReport } from '../src/services/reporting.js';
import { roast } from '../src/services/roasting.js';
import { LATER, NOW, makeOrder, reset, testDatabase, world } from './helpers.js';

const db = testDatabase();
before(() => db.migrate());
beforeEach(() => reset(db));
after(() => db.close());

test('outbox retries failures using stable event IDs', async () => {
  await world(db);
  const firstIds: string[] = [];
  const initial = await db.transaction((tx) =>
    deliverOutbox(tx, async (e) => {
      firstIds.push(e.id);
      throw new Error('offline');
    }),
  );
  assert.equal(initial.delivered, 0);
  const secondIds: string[] = [];
  const retry = await db.transaction((tx) =>
    deliverOutbox(tx, async (e) => {
      secondIds.push(e.id);
    }),
  );
  assert.equal(retry.delivered, initial.attempted);
  assert.deepEqual(secondIds, firstIds);
  assert.equal((await db.transaction((tx) => deliverOutbox(tx, async () => {}))).attempted, 0);
});

test('inventory report includes zero stock SKUs and excludes quarantine from sellable', async () => {
  const w = await world(db);
  const { inspectLot } = await import('../src/services/quality.js');
  await db.transaction((tx) => inspectLot(tx, w.packagedLot.id, false, 'Hold'), NOW);
  const report = await db.transaction(inventoryReport, NOW);
  assert.equal(report.find((p) => p.id === w.green.id)?.physical, '0');
  const packed = report.find((p) => p.id === w.packaged.id);
  assert.equal(packed?.physical, '20');
  assert.equal(packed?.sellable, '0');
  assert.equal(packed?.unit, 'units');
  assert.equal(report.find((p) => p.id === w.roasted.id)?.unit, 'grams');
});

test('demo runs a complete journey, reports shipped margin and is repeatable', async () => {
  const demo = await db.transaction(seedDemo, NOW);
  assert.equal(demo.alreadySeeded, false);
  assert.equal(demo.trace?.shipments.length, 1);
  const report = await db.transaction(operationsReport, NOW);
  assert.equal(report.shipped_revenue, '3000');
  assert.equal(report.shipped_cost, '635');
  assert.equal(report.shipped_gross_margin, '2365');
  const again = await db.transaction(seedDemo, NOW);
  assert.equal(again.alreadySeeded, true);
  assert.equal((await db.transaction((tx) => tx.query('SELECT * FROM orders'))).length, 1);
});

test('migration runner is repeatable without recreating data', async () => {
  const w = await world(db);
  await db.migrate();
  assert.equal((await db.transaction((tx) => getLot(tx, w.packagedLot.id))).quantity, 20);
});

test('blends enforce proportions, retain multiple inputs and inherit earliest freshness', async () => {
  const w = await world(db);
  const second = await db.transaction(async (tx) => {
    const bulk = await createProduct(tx, { sku: 'SECOND', name: 'Second roast', kind: 'roasted' });
    const output = await createProduct(tx, { sku: 'BLEND', name: 'House blend', kind: 'roasted' });
    const purchase = await createPurchase(tx, {
      reference: 'SECOND-PO',
      supplierId: w.supplier.id,
      productId: w.green.id,
      warehouseId: w.warehouse.id,
      quantity: 1000,
      totalCost: 1000,
    });
    const green = await receive(tx, {
      purchaseId: purchase.id,
      code: 'SECOND-GREEN',
      quantity: 1000,
      expiresAt: LATER,
    });
    const lot = await roast(tx, {
      inputs: [{ lotId: green.id, quantity: 1000 }],
      outputProductId: bulk.id,
      code: 'SECOND-ROAST',
      outputGrams: 800,
      profile: 'Light',
      expiresAt: new Date('2030-01-20'),
    });
    const recipe = await createRecipe(tx, '60-40', output.id, {
      [w.roasted.id]: 6000,
      [bulk.id]: 4000,
    });
    return { lot, recipe };
  }, NOW);
  await assert.rejects(
    db.transaction(
      (tx) =>
        blend(tx, {
          recipeId: second.recipe.id,
          inputs: [
            { lotId: w.roastLot.id, quantity: 500 },
            { lotId: second.lot.id, quantity: 500 },
          ],
          code: 'BAD-BLEND',
          expiresAt: null,
        }),
      NOW,
    ),
    /proportions/,
  );
  const combined = await db.transaction(
    (tx) =>
      blend(tx, {
        recipeId: second.recipe.id,
        inputs: [
          { lotId: w.roastLot.id, quantity: 600 },
          { lotId: second.lot.id, quantity: 400 },
        ],
        code: 'BLEND-LOT',
        expiresAt: LATER,
      }),
    NOW,
  );
  assert.equal(combined.quantity, 1000);
  assert.equal(combined.expires_at?.toISOString(), '2030-01-20T00:00:00.000Z');
  const edges = await db.transaction((tx) =>
    tx.query('SELECT * FROM lineage WHERE child_id=$1', [combined.id]),
  );
  assert.equal(edges.length, 2);
});

test('allocation prefers earliest expiry then undated stock', async () => {
  const w = await world(db);
  const { packageCoffee } = await import('../src/services/packaging.js');
  const { inspectLot } = await import('../src/services/quality.js');
  // Second packaging run is physically produced, not inserted as synthetic stock.
  const later = await db.transaction(
    (tx) =>
      packageCoffee(tx, {
        coffeeLotId: w.roastLot.id,
        materialLotId: w.bagLot.id,
        outputProductId: w.packaged.id,
        units: 2,
        code: 'LATER-PACK',
      }),
    NOW,
  );
  await db.transaction(async (tx) => {
    await tx.query('UPDATE lots SET expires_at=NULL WHERE id=$1', [later.id]);
  });
  const order = await makeOrder(db, w, 21);
  const allocations = await db.transaction((tx) =>
    tx.query<{ lot_id: string; quantity: number }>('SELECT * FROM allocations WHERE order_id=$1', [
      order.id,
    ]),
  );
  assert.equal(allocations.find((a) => a.lot_id === w.packagedLot.id)?.quantity, 20);
  assert.equal(allocations.find((a) => a.lot_id === later.id)?.quantity, 1);
  await assert.rejects(
    db.transaction((tx) => inspectLot(tx, later.id, false, 'Reserved'), NOW),
    /reservations/,
  );
});
