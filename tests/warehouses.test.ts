import assert from 'node:assert/strict';
import { after, before, beforeEach, test } from 'node:test';
import { getLot } from '../src/services/inventory.js';
import { packageCoffee } from '../src/services/packaging.js';
import { createPurchase } from '../src/services/procurement.js';
import { receive } from '../src/services/receiving.js';
import { roast } from '../src/services/roasting.js';
import { createWarehouse } from '../src/services/warehouses.js';
import { LATER, NOW, makeOrder, reset, testDatabase, world } from './helpers.js';

const db = testDatabase();
before(() => db.migrate());
beforeEach(() => reset(db));
after(() => db.close());

async function secondWarehouse(w: Awaited<ReturnType<typeof world>>) {
  return db.transaction(async (tx) => {
    const warehouse = await createWarehouse(tx, 'Second roastery', 1);
    const greenPurchase = await createPurchase(tx, {
      reference: 'SECOND-GREEN',
      supplierId: w.supplier.id,
      productId: w.green.id,
      warehouseId: warehouse.id,
      quantity: 1000,
      totalCost: 1000,
    });
    const green = await receive(tx, {
      purchaseId: greenPurchase.id,
      code: 'SECOND-GREEN',
      quantity: 1000,
      expiresAt: LATER,
    });
    const roastLot = await roast(tx, {
      inputs: [{ lotId: green.id, quantity: 1000 }],
      outputProductId: w.roasted.id,
      code: 'SECOND-ROAST',
      outputGrams: 800,
      profile: 'Medium',
      expiresAt: LATER,
    });
    const bagPurchase = await createPurchase(tx, {
      reference: 'SECOND-BAG',
      supplierId: w.supplier.id,
      productId: w.bags.id,
      warehouseId: warehouse.id,
      quantity: 10,
      totalCost: 100,
    });
    const bags = await receive(tx, {
      purchaseId: bagPurchase.id,
      code: 'SECOND-BAG',
      quantity: 10,
      expiresAt: null,
    });
    const packaged = await packageCoffee(tx, {
      coffeeLotId: roastLot.id,
      materialLotId: bags.id,
      outputProductId: w.packaged.id,
      units: 3,
      code: 'SECOND-PACK',
    });
    return { warehouse, roastLot, bags, packaged };
  }, NOW);
}

test('warehouse priority selects a complete warehouse and skips an insufficient one', async () => {
  const w = await world(db);
  const second = await secondWarehouse(w);
  const firstOrder = await makeOrder(db, w, 19, 'FIRST');
  assert.equal(firstOrder.warehouse_id, w.warehouse.id);
  const secondOrder = await makeOrder(db, w, 2, 'SECOND');
  assert.equal(secondOrder.warehouse_id, second.warehouse.id);
  assert.equal((await db.transaction((tx) => getLot(tx, w.packagedLot.id))).reserved, 19);
  assert.equal((await db.transaction((tx) => getLot(tx, second.packaged.id))).reserved, 2);
});

test('baseline does not split one order across warehouses', async () => {
  const w = await world(db);
  const second = await secondWarehouse(w);
  await assert.rejects(makeOrder(db, w, 21), /no single warehouse/);
  assert.equal((await db.transaction((tx) => getLot(tx, w.packagedLot.id))).reserved, 0);
  assert.equal((await db.transaction((tx) => getLot(tx, second.packaged.id))).reserved, 0);
});

test('production cannot consume inputs from different warehouses', async () => {
  const w = await world(db);
  const second = await secondWarehouse(w);
  await assert.rejects(
    db.transaction(
      (tx) =>
        packageCoffee(tx, {
          coffeeLotId: w.roastLot.id,
          materialLotId: second.bags.id,
          outputProductId: w.packaged.id,
          units: 1,
          code: 'CROSS-WAREHOUSE',
        }),
      NOW,
    ),
    /share a warehouse/,
  );
  assert.equal((await db.transaction((tx) => getLot(tx, second.bags.id))).quantity, 7);
});
