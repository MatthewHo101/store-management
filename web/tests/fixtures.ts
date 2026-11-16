import type { Workspace } from '../src/types.js';

export function workspace(): Workspace {
  return {
    health: { status: 'ok', businessName: 'coffee-management', currency: 'USD', version: '0.1.0' },
    products: [
      {
        id: 'product-1',
        sku: 'HOUSE-250',
        name: 'House 250g',
        kind: 'packaged',
        price: 1500,
        package_grams: 250,
      },
    ],
    customers: [
      {
        id: 'customer-1',
        name: 'Neighborhood Cafe',
        email: 'cafe@example.test',
        channel: 'wholesale',
      },
    ],
    warehouses: [{ id: 'warehouse-1', name: 'Roastery', priority: 0 }],
    suppliers: [],
    purchases: [],
    recipes: [],
    lots: [
      {
        id: 'lot-1',
        code: 'HOUSE-BATCH',
        product_id: 'product-1',
        warehouse_id: 'warehouse-1',
        purchase_id: null,
        quantity: 20,
        reserved: 2,
        remaining_cost: 6000,
        status: 'approved',
        created_at: '2026-01-01T00:00:00Z',
        expires_at: '2099-01-01T00:00:00Z',
      },
    ],
    orders: [
      {
        id: 'order-1',
        customer_id: 'customer-1',
        warehouse_id: 'warehouse-1',
        status: 'reserved',
        total: 3000,
        cost: 0,
        created_at: '2026-01-01T00:00:00Z',
        expires_at: '2099-01-01T00:00:00Z',
      },
    ],
    inventory: [
      {
        id: 'product-1',
        sku: 'HOUSE-250',
        kind: 'packaged',
        unit: 'units',
        physical: '20',
        reserved: '2',
        sellable: '18',
        inventory_cost: '6000',
      },
    ],
    operations: {
      shipped_revenue: '3000',
      shipped_cost: '600',
      shipped_gross_margin: '2400',
      simulated_cancellation_refunds: '0',
      production: [],
      openPurchases: [],
      expiringWithinSevenDays: [],
    },
  };
}
