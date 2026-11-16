import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { after, before, beforeEach, test } from 'node:test';
import { buildApp } from '../src/http/app.js';
import { reset, testDatabase } from './helpers.js';

const db = testDatabase();
const app = buildApp(db);
before(async () => {
  await db.migrate();
  await app.ready();
});
beforeEach(() => reset(db));
after(async () => {
  await app.close();
  await db.close();
});

test('HTTP health includes business and currency', async () => {
  const response = await app.inject({ method: 'GET', url: '/health' });
  assert.equal(response.statusCode, 200);
  assert.equal(response.json().businessName, 'Ember Coffee');
  assert.equal(response.json().currency, 'USD');
});

test('HTTP validates types, UUIDs and unknown fields', async () => {
  assert.equal(
    (
      await app.inject({
        method: 'POST',
        url: '/products',
        payload: { sku: 'X', name: 'X', kind: 'packaged', price: 0.5, packageGrams: 250 },
      })
    ).statusCode,
    422,
  );
  assert.equal((await app.inject({ method: 'GET', url: '/lots/not-an-id' })).statusCode, 422);
  assert.equal(
    (
      await app.inject({
        method: 'POST',
        url: '/suppliers',
        payload: { name: 'X', origin: 'Brazil', accountId: 'pretend' },
      })
    ).statusCode,
    422,
  );
});

test('HTTP maps not found and unique conflicts without database detail leakage', async () => {
  assert.equal((await app.inject({ method: 'GET', url: `/lots/${randomUUID()}` })).statusCode, 404);
  const payload = { name: 'Supplier', origin: 'Brazil' };
  assert.equal((await app.inject({ method: 'POST', url: '/suppliers', payload })).statusCode, 201);
  const duplicate = await app.inject({ method: 'POST', url: '/suppliers', payload });
  assert.equal(duplicate.statusCode, 409);
  assert.equal(duplicate.body.includes('suppliers_name_key'), false);
});

test('HTTP can execute receipt, roast, package, order, pay, ship and trace', async () => {
  async function post(url: string, payload: object) {
    const response = await app.inject({ method: 'POST', url, payload });
    assert.ok(response.statusCode < 300, `${url}: ${response.body}`);
    return response.json();
  }
  const supplier = await post('/suppliers', { name: 'Importer', origin: 'Brazil' });
  const warehouse = await post('/warehouses', { name: 'Roastery' });
  const customer = await post('/customers', { name: 'Cafe', email: 'cafe@example.test' });
  const green = await post('/products', { sku: 'GREEN', name: 'Green', kind: 'green' });
  const roastProduct = await post('/products', { sku: 'ROAST', name: 'Bulk', kind: 'roasted' });
  const bags = await post('/products', { sku: 'BAG', name: 'Bag kit', kind: 'material' });
  const packaged = await post('/products', {
    sku: 'COFFEE-250',
    name: 'Coffee',
    kind: 'packaged',
    packageGrams: 250,
    price: 1500,
  });
  async function receipt(
    productId: string,
    reference: string,
    quantity: number,
    totalCost: number,
  ) {
    const purchase = await post('/purchases', {
      supplierId: supplier.id,
      warehouseId: warehouse.id,
      productId,
      reference,
      quantity,
      totalCost,
    });
    return post(`/purchases/${purchase.id}/receipts`, { code: reference, quantity });
  }
  const greenLot = await receipt(green.id, 'GREEN-PO', 1000, 1000);
  const bagLot = await receipt(bags.id, 'BAG-PO', 10, 100);
  const roastLot = await post('/roasts', {
    inputs: [{ lotId: greenLot.id, quantity: 1000 }],
    outputProductId: roastProduct.id,
    code: 'ROASTED',
    outputGrams: 800,
    profile: 'Medium',
    expiresAt: new Date(Date.now() + 86400000).toISOString(),
  });
  await post('/packaging-runs', {
    coffeeLotId: roastLot.id,
    materialLotId: bagLot.id,
    outputProductId: packaged.id,
    units: 3,
    code: 'PACKAGED',
  });
  const order = await post('/orders', {
    customerId: customer.id,
    items: [{ productId: packaged.id, quantity: 1 }],
    requestKey: 'http-order',
  });
  await post(`/orders/${order.id}/payment`, { eventId: 'payment-1', amount: 1500 });
  await post(`/orders/${order.id}/ship`, { tracking: 'SHIP-1' });
  const trace = await app.inject({ method: 'GET', url: `/lots/${greenLot.id}/trace` });
  assert.equal(trace.statusCode, 200);
  assert.equal(trace.json().shipments[0].email, 'cafe@example.test');
});
