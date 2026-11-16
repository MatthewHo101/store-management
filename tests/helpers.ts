import { Database } from '../src/database.js';
import { createProduct } from '../src/services/catalog.js';
import { createCustomer } from '../src/services/customers.js';
import { packageCoffee } from '../src/services/packaging.js';
import { createPurchase } from '../src/services/procurement.js';
import { receive } from '../src/services/receiving.js';
import { roast } from '../src/services/roasting.js';
import { createSupplier } from '../src/services/suppliers.js';
import { createWarehouse } from '../src/services/warehouses.js';

// Integration tests TRUNCATE their database. Never accept the application DATABASE_URL.
export function testDatabase() {
  const url = process.env.TEST_DATABASE_URL;
  if (!url || !new URL(url).pathname.endsWith('_test')) {
    throw new Error('TEST_DATABASE_URL must point to a disposable database ending in _test');
  }
  return new Database(url);
}
export const NOW = new Date('2030-01-01T00:00:00Z');
export const LATER = new Date('2030-02-01T00:00:00Z');
export async function reset(db: Database) {
  await db.transaction(async (tx) => {
    await tx.query(`TRUNCATE suppliers,customers,warehouses,products,purchases,lots,movements,
      production,lineage,recipes,orders,order_lines,allocations,payments,shipments,returns,
      idempotency,audit,outbox CASCADE`);
  });
}
export async function world(db: Database) {
  return db.transaction(async (tx) => {
    const supplier = await createSupplier(tx, 'Importer', 'Brazil');
    const warehouse = await createWarehouse(tx, 'Roastery');
    const customer = await createCustomer(tx, 'Cafe', 'cafe@example.test', 'wholesale');
    const green = await createProduct(tx, { sku: 'GREEN', name: 'Green beans', kind: 'green' });
    const roasted = await createProduct(tx, { sku: 'ROAST', name: 'Roast bulk', kind: 'roasted' });
    const bags = await createProduct(tx, { sku: 'BAG', name: 'Bag kit', kind: 'material' });
    const packaged = await createProduct(tx, {
      sku: 'HOUSE-250',
      name: 'House 250g',
      kind: 'packaged',
      packageGrams: 250,
      price: 1500,
    });
    const purchase = await createPurchase(tx, {
      reference: 'COFFEE-PO',
      supplierId: supplier.id,
      productId: green.id,
      warehouseId: warehouse.id,
      quantity: 10000,
      totalCost: 9000,
      landedCost: 1000,
    });
    const greenLot = await receive(tx, {
      purchaseId: purchase.id,
      code: 'GREEN-LOT',
      quantity: 10000,
      expiresAt: new Date('2031-01-01'),
    });
    const bagPurchase = await createPurchase(tx, {
      reference: 'BAG-PO',
      supplierId: supplier.id,
      productId: bags.id,
      warehouseId: warehouse.id,
      quantity: 100,
      totalCost: 2000,
    });
    const bagLot = await receive(tx, {
      purchaseId: bagPurchase.id,
      code: 'BAG-LOT',
      quantity: 100,
      expiresAt: null,
    });
    const roastLot = await roast(tx, {
      inputs: [{ lotId: greenLot.id, quantity: 10000 }],
      outputProductId: roasted.id,
      code: 'ROAST-LOT',
      outputGrams: 8400,
      profile: 'Medium',
      expiresAt: LATER,
    });
    const packagedLot = await packageCoffee(tx, {
      coffeeLotId: roastLot.id,
      materialLotId: bagLot.id,
      outputProductId: packaged.id,
      units: 20,
      code: 'PACKAGED-LOT',
    });
    return {
      supplier,
      warehouse,
      customer,
      green,
      roasted,
      bags,
      packaged,
      purchase,
      greenLot,
      bagLot,
      roastLot,
      packagedLot,
    };
  }, NOW);
}
export async function makeOrder(
  db: Database,
  w: Awaited<ReturnType<typeof world>>,
  quantity = 2,
  key = 'order-key',
) {
  const { createOrder } = await import('../src/services/orders.js');
  return db.transaction(
    (tx) =>
      createOrder(tx, {
        customerId: w.customer.id,
        items: [{ productId: w.packaged.id, quantity }],
        requestKey: key,
      }),
    NOW,
  );
}
