import { describe, expect, it } from 'vitest';
import { operations } from '../src/operations.js';
import { workspace } from './fixtures.js';

describe('request construction', () => {
  it('keeps a supplied idempotency key and converts order quantities to integers', () => {
    const op = operations(workspace()).order;
    expect(
      op.body(
        {
          customerId: 'customer-1',
          items: [{ productId: 'product-1', quantity: '2' }],
          reservationMinutes: '30',
        },
        'stable-key',
      ),
    ).toEqual({
      customerId: 'customer-1',
      items: [{ productId: 'product-1', quantity: 2 }],
      reservationMinutes: 30,
      requestKey: 'stable-key',
    });
  });
  it('converts displayed monetary amounts into minor units', () => {
    const op = operations(workspace()).createProduct;
    expect(
      op.body(
        { sku: 'NEW', name: 'New', kind: 'packaged', packageGrams: '250', price: '12.35' },
        'unused',
      ),
    ).toEqual({ sku: 'NEW', name: 'New', kind: 'packaged', packageGrams: 250, price: 1235 });
  });
  it('rejects repeated products instead of silently overwriting a recipe ingredient', () => {
    const op = operations(workspace()).recipe;
    expect(() =>
      op.body(
        {
          name: 'Blend',
          outputProductId: 'result',
          components: [
            { productId: 'same', percent: '50' },
            { productId: 'same', percent: '50' },
          ],
        },
        'unused',
      ),
    ).toThrow(/different product/);
  });
  it('uses the captured order amount for simulated payment', () => {
    const data = workspace();
    const order = data.orders[0]!;
    expect(operations(data).pay(order).body({}, 'payment-key')).toEqual({
      eventId: 'payment-key',
      amount: 3000,
    });
  });
});
