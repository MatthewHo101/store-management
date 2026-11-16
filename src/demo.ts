import type { Transaction } from './database.js';
import type { Product } from './domain/types.js';
import { createProduct } from './services/catalog.js';
import { createCustomer } from './services/customers.js';
import { createOrder } from './services/orders.js';
import { packageCoffee } from './services/packaging.js';
import { acceptPayment } from './services/payments.js';
import { createPurchase } from './services/procurement.js';
import { receive } from './services/receiving.js';
import { roast } from './services/roasting.js';
import { shipOrder } from './services/shipping.js';
import { createSupplier } from './services/suppliers.js';
import { traceLot } from './services/traceability.js';
import { createWarehouse } from './services/warehouses.js';

/** All-or-nothing sample journey. Repeating it returns existing IDs without making more stock. */
export async function seedDemo(tx: Transaction) {
  const existing = (
    await tx.query<Product>("SELECT * FROM products WHERE sku='DEMO-HOUSE-250'")
  )[0];
  if (existing) return { alreadySeeded: true, packagedProductId: existing.id };
  const supplier = await createSupplier(tx, 'Demo Coffee Importer', 'Brazil');
  const warehouse = await createWarehouse(tx, 'Demo Roastery', 0);
  const customer = await createCustomer(
    tx,
    'Demo Neighborhood Cafe',
    'cafe@example.test',
    'wholesale',
  );
  const green = await createProduct(tx, {
    sku: 'DEMO-GREEN',
    name: 'Brazil green coffee',
    kind: 'green',
  });
  const roasted = await createProduct(tx, {
    sku: 'DEMO-ROAST',
    name: 'House roast bulk',
    kind: 'roasted',
  });
  const bags = await createProduct(tx, {
    sku: 'DEMO-BAG',
    name: '250g bag and label kit',
    kind: 'material',
  });
  const packaged = await createProduct(tx, {
    sku: 'DEMO-HOUSE-250',
    name: 'House coffee 250g',
    kind: 'packaged',
    packageGrams: 250,
    price: 1500,
  });
  const purchase = await createPurchase(tx, {
    reference: 'DEMO-COFFEE-PO',
    supplierId: supplier.id,
    productId: green.id,
    warehouseId: warehouse.id,
    quantity: 10000,
    totalCost: 9000,
    landedCost: 1000,
  });
  const greenLot = await receive(tx, {
    purchaseId: purchase.id,
    code: 'DEMO-GREEN-LOT',
    quantity: 10000,
    expiresAt: new Date(tx.now.getTime() + 180 * 86400000),
  });
  const bagPurchase = await createPurchase(tx, {
    reference: 'DEMO-BAG-PO',
    supplierId: supplier.id,
    productId: bags.id,
    warehouseId: warehouse.id,
    quantity: 100,
    totalCost: 2000,
  });
  const bagLot = await receive(tx, {
    purchaseId: bagPurchase.id,
    code: 'DEMO-BAG-LOT',
    quantity: 100,
    expiresAt: null,
  });
  const roastLot = await roast(tx, {
    inputs: [{ lotId: greenLot.id, quantity: 10000 }],
    outputProductId: roasted.id,
    code: 'DEMO-ROAST-LOT',
    outputGrams: 8400,
    profile: 'Medium house roast',
    expiresAt: new Date(tx.now.getTime() + 30 * 86400000),
  });
  const packagedLot = await packageCoffee(tx, {
    coffeeLotId: roastLot.id,
    materialLotId: bagLot.id,
    outputProductId: packaged.id,
    units: 20,
    code: 'DEMO-PACKAGED-LOT',
  });
  const order = await createOrder(tx, {
    customerId: customer.id,
    items: [{ productId: packaged.id, quantity: 2 }],
    requestKey: 'DEMO-ORDER',
  });
  await acceptPayment(tx, order.id, 'DEMO-PAYMENT', order.total);
  await shipOrder(tx, order.id, 'DEMO-TRACKING');
  return {
    alreadySeeded: false,
    warehouseId: warehouse.id,
    customerId: customer.id,
    packagedProductId: packaged.id,
    greenLotId: greenLot.id,
    packagedLotId: packagedLot.id,
    orderId: order.id,
    trace: await traceLot(tx, greenLot.id),
  };
}
