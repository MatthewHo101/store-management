import type { Workspace, StockLot, SalesOrder, Purchase, Allocation } from './types.js';
import { lotState, shortId, quantity } from './format.js';

export interface Choice {
  value: string;
  label: string;
}
export interface Field {
  name: string;
  label: string;
  type?: 'text' | 'number' | 'select' | 'datetime-local' | 'repeat';
  options?: Choice[];
  hint?: string;
  value?: string;
  optional?: boolean;
  min?: number;
  step?: string;
  children?: Field[];
  initialRows?: number;
}
export type Row = Record<string, string>;
export type Values = Record<string, string | Row[]>;
export interface Operation {
  title: string;
  description: string;
  endpoint: string;
  fields: Field[];
  body: (values: Values, requestKey: string) => object;
  submit?: string;
}
export const s = (v: Values | Row, key: string) => String(v[key] ?? '');
const n = (v: Values | Row, key: string) => Number(s(v, key));
const list = (v: Values, key: string): Row[] => (Array.isArray(v[key]) ? (v[key] as Row[]) : []);
const iso = (v: Values, key: string) => (s(v, key) ? new Date(s(v, key)).toISOString() : null);
const ref = (prefix: string) => `${prefix}-${Date.now().toString(36).toUpperCase()}`;
const field = (name: string, label: string, extra: Partial<Field> = {}): Field => ({
  name,
  label,
  ...extra,
});
const select = (name: string, label: string, options: Choice[]): Field =>
  field(name, label, { type: 'select', options });
const count = (name: string, label: string, min = 1): Field =>
  field(name, label, { type: 'number', min, step: '1' });
const price = (name: string, label: string): Field =>
  field(name, label, { type: 'number', min: 0, step: '0.01' });
const cents = (value: number) => Math.round(value * 100);

export function operations(data: Workspace) {
  const products = (kinds: string[]) =>
    data.products
      .filter((p) => kinds.includes(p.kind))
      .map((p) => ({ value: p.id, label: `${p.sku} · ${p.name}` }));
  const choices = (rows: { id: string; name: string }[]) =>
    rows.map((r) => ({ value: r.id, label: r.name }));
  const lots = (kinds: string[]) =>
    data.lots
      .filter(
        (l) =>
          lotState(l) === 'available' &&
          l.quantity > l.reserved &&
          kinds.includes(data.products.find((p) => p.id === l.product_id)?.kind ?? ''),
      )
      .map((l) => ({
        value: l.id,
        label: `${l.code} · ${quantity(
          l.quantity - l.reserved,
          data.products.find((p) => p.id === l.product_id),
        )} available`,
      }));
  const code = () => field('code', 'Batch code', { value: ref('LOT') });
  const expiry = (optional = false) =>
    field('expiresAt', 'Best before', { type: 'datetime-local', optional });
  const inputs = (kinds: string[]) =>
    field('inputs', 'Ingredients', {
      type: 'repeat',
      children: [select('lotId', 'Input lot', lots(kinds)), count('quantity', 'Weight (g)')],
    });
  const currency = data.health.currency;
  const createProduct: Operation = {
    title: 'New product',
    description: 'Create a coffee SKU or a packaging material.',
    endpoint: '/products',
    fields: [
      field('sku', 'SKU'),
      field('name', 'Product name'),
      select(
        'kind',
        'Product type',
        ['green', 'roasted', 'packaged', 'material'].map((value) => ({
          value,
          label: {
            green: 'Green coffee',
            roasted: 'Bulk roasted coffee',
            packaged: 'Packaged coffee',
            material: 'Packaging kit',
          }[value]!,
        })),
      ),
      {
        ...count('packageGrams', 'Package weight (g)', 0),
        optional: true,
        value: '0',
        hint: 'Required for packaged coffee. Use 0 for other product types.',
      },
      price('price', `Selling price (${currency})`),
    ],
    body: (v) => ({
      sku: s(v, 'sku'),
      name: s(v, 'name'),
      kind: s(v, 'kind'),
      packageGrams: n(v, 'packageGrams'),
      price: cents(n(v, 'price')),
    }),
  };
  const createSupplier: Operation = {
    title: 'New supplier',
    description: 'Keep a record of who supplies your coffee and materials.',
    endpoint: '/suppliers',
    fields: [field('name', 'Supplier name'), field('origin', 'Origin / country')],
    body: (v) => ({ name: s(v, 'name'), origin: s(v, 'origin') }),
  };
  const createCustomer: Operation = {
    title: 'New customer',
    description: 'Add a retail, wholesale or café customer.',
    endpoint: '/customers',
    fields: [
      field('name', 'Customer name'),
      field('email', 'Email'),
      select(
        'channel',
        'Sales channel',
        ['retail', 'wholesale', 'cafe'].map((value) => ({ value, label: value })),
      ),
    ],
    body: (v) => ({ name: s(v, 'name'), email: s(v, 'email'), channel: s(v, 'channel') }),
  };
  const createWarehouse: Operation = {
    title: 'New warehouse',
    description: 'Lower priority numbers are considered first when fulfilling an order.',
    endpoint: '/warehouses',
    fields: [
      field('name', 'Location name'),
      { ...count('priority', 'Fulfillment priority', 0), value: '0' },
    ],
    body: (v) => ({ name: s(v, 'name'), priority: n(v, 'priority') }),
  };
  const purchase: Operation = {
    title: 'New purchase order',
    description: 'Order green coffee or packaging kits from a supplier.',
    endpoint: '/purchases',
    fields: [
      field('reference', 'Purchase reference', { value: ref('PO') }),
      select('supplierId', 'Supplier', choices(data.suppliers)),
      select('warehouseId', 'Receiving warehouse', choices(data.warehouses)),
      select('productId', 'Product', products(['green', 'material'])),
      {
        ...count('quantity', 'Quantity'),
        hint: 'Whole grams for green coffee; whole units for packaging kits.',
      },
      price('totalCost', `Goods cost (${currency})`),
      { ...price('landedCost', `Freight and landed cost (${currency})`), value: '0' },
    ],
    body: (v) => ({
      reference: s(v, 'reference'),
      supplierId: s(v, 'supplierId'),
      warehouseId: s(v, 'warehouseId'),
      productId: s(v, 'productId'),
      quantity: n(v, 'quantity'),
      totalCost: cents(n(v, 'totalCost')),
      landedCost: cents(n(v, 'landedCost')),
    }),
  };
  const receipt = (p: Purchase): Operation => ({
    title: 'Receive delivery',
    description: `Record accepted stock against ${p.reference}. Outstanding: ${p.quantity - p.received}.`,
    endpoint: `/purchases/${p.id}/receipts`,
    fields: [
      code(),
      { ...count('quantity', 'Accepted quantity'), value: String(p.quantity - p.received) },
      expiry(true),
    ],
    body: (v) => ({
      code: s(v, 'code'),
      quantity: n(v, 'quantity'),
      expiresAt: iso(v, 'expiresAt'),
    }),
  });
  const roast: Operation = {
    title: 'Record a roast',
    description:
      'Consume green beans and record the measured roasted output. All inputs must be at one warehouse.',
    endpoint: '/roasts',
    fields: [
      inputs(['green']),
      select('outputProductId', 'Roasted product', products(['roasted'])),
      code(),
      count('outputGrams', 'Roasted output (g)'),
      field('profile', 'Roast profile'),
      expiry(),
    ],
    body: (v) => ({
      inputs: list(v, 'inputs').map((r) => ({ lotId: r.lotId, quantity: Number(r.quantity) })),
      outputProductId: s(v, 'outputProductId'),
      code: s(v, 'code'),
      outputGrams: n(v, 'outputGrams'),
      profile: s(v, 'profile'),
      expiresAt: iso(v, 'expiresAt'),
    }),
  };
  const recipe: Operation = {
    title: 'New blend recipe',
    description: 'Define ingredient proportions totaling 100%. Recipes are preserved as created.',
    endpoint: '/recipes',
    fields: [
      field('name', 'Recipe name'),
      select('outputProductId', 'Blended product', products(['roasted'])),
      field('components', 'Composition', {
        type: 'repeat',
        initialRows: 2,
        children: [
          select('productId', 'Roasted product', products(['roasted'])),
          { ...price('percent', 'Percentage'), min: 0.01 },
        ],
      }),
    ],
    body: (v) => {
      const rows = list(v, 'components');
      if (new Set(rows.map((r) => r.productId)).size !== rows.length)
        throw new Error('Choose a different product for each recipe ingredient.');
      return {
        name: s(v, 'name'),
        outputProductId: s(v, 'outputProductId'),
        components: Object.fromEntries(
          rows.map((r) => [r.productId, Math.round(Number(r.percent) * 100)]),
        ),
      };
    },
  };
  const blend: Operation = {
    title: 'Record a blend',
    description: 'Choose lots and weights that match the selected recipe proportions exactly.',
    endpoint: '/blends',
    fields: [
      select('recipeId', 'Recipe', choices(data.recipes)),
      inputs(['roasted']),
      code(),
      expiry(true),
    ],
    body: (v) => ({
      recipeId: s(v, 'recipeId'),
      inputs: list(v, 'inputs').map((r) => ({ lotId: r.lotId, quantity: Number(r.quantity) })),
      code: s(v, 'code'),
      expiresAt: iso(v, 'expiresAt'),
    }),
  };
  const pack: Operation = {
    title: 'Package coffee',
    description:
      'Each finished unit consumes its SKU’s package weight and one complete bag-and-label kit.',
    endpoint: '/packaging-runs',
    fields: [
      select('coffeeLotId', 'Bulk roasted lot', lots(['roasted'])),
      select('materialLotId', 'Packaging kit lot', lots(['material'])),
      select('outputProductId', 'Packaged product', products(['packaged'])),
      count('units', 'Finished bags'),
      code(),
    ],
    body: (v) => ({
      coffeeLotId: s(v, 'coffeeLotId'),
      materialLotId: s(v, 'materialLotId'),
      outputProductId: s(v, 'outputProductId'),
      units: n(v, 'units'),
      code: s(v, 'code'),
    }),
  };
  const order: Operation = {
    title: 'New sales order',
    description:
      'Reserve all items from one warehouse. Prices are captured from the product catalog.',
    endpoint: '/orders',
    fields: [
      select('customerId', 'Customer', choices(data.customers)),
      field('items', 'Order items', {
        type: 'repeat',
        children: [
          select('productId', 'Packaged product', products(['packaged'])),
          count('quantity', 'Bags'),
        ],
      }),
      {
        ...count('reservationMinutes', 'Payment deadline (minutes)'),
        value: '30',
        hint: 'Unpaid reservations expire automatically. Maximum 1440 minutes.',
      },
    ],
    body: (v, key) => ({
      customerId: s(v, 'customerId'),
      items: list(v, 'items').map((r) => ({
        productId: r.productId,
        quantity: Number(r.quantity),
      })),
      reservationMinutes: n(v, 'reservationMinutes'),
      requestKey: key,
    }),
  };
  const pay = (o: SalesOrder): Operation => ({
    title: 'Record simulated payment',
    description: `Accept the full captured amount for order ${shortId(o.id)}. This does not charge a real payment method.`,
    endpoint: `/orders/${o.id}/payment`,
    fields: [],
    submit: 'Record payment',
    body: (_v, key) => ({ eventId: key, amount: o.total }),
  });
  const ship = (o: SalesOrder): Operation => ({
    title: 'Ship order',
    description: `Deduct the reserved stock and record a shipment for order ${shortId(o.id)}.`,
    endpoint: `/orders/${o.id}/ship`,
    fields: [field('tracking', 'Tracking reference')],
    submit: 'Confirm shipment',
    body: (v) => ({ tracking: s(v, 'tracking') }),
  });
  const cancel = (o: SalesOrder): Operation => ({
    title: 'Cancel order',
    description:
      o.status === 'paid'
        ? 'Release the reserved coffee and record a simulated full refund.'
        : 'Release any active reservations for this order.',
    endpoint: `/orders/${o.id}/cancel`,
    fields: [],
    submit: 'Cancel order',
    body: () => ({}),
  });
  const inspect = (l: StockLot): Operation => ({
    title: 'Inspect lot',
    description: `Record a quality decision for ${l.code}. Active reservations must be released before quarantine.`,
    endpoint: `/lots/${l.id}/inspection`,
    fields: [
      select('approved', 'Quality decision', [
        { value: 'true', label: 'Approve for use' },
        { value: 'false', label: 'Quarantine' },
      ]),
      field('notes', 'Inspection notes'),
    ],
    body: (v) => ({ approved: s(v, 'approved') === 'true', notes: s(v, 'notes') }),
  });
  const waste = (l: StockLot): Operation => ({
    title: 'Record waste',
    description: `Remove unreserved stock from ${l.code} and retain the reason in its ledger.`,
    endpoint: `/lots/${l.id}/waste`,
    fields: [count('quantity', 'Quantity (in the lot’s stock unit)'), field('reason', 'Reason')],
    body: (v) => ({ quantity: n(v, 'quantity'), reason: s(v, 'reason') }),
  });
  const returned = (a: Allocation): Operation => ({
    title: 'Receive return',
    description: `Inspect returned goods. ${a.quantity - a.returned} units remain eligible for return. Financial refunds for returns are outside this workflow.`,
    endpoint: '/returns',
    fields: [
      count('quantity', 'Returned units'),
      select('restock', 'Inspection result', [
        { value: 'true', label: 'Sellable — return to stock' },
        { value: 'false', label: 'Not sellable — do not restock' },
      ]),
      field('reference', 'Return reference', { value: ref('RETURN') }),
    ],
    body: (v) => ({
      allocationId: a.id,
      quantity: n(v, 'quantity'),
      restock: s(v, 'restock') === 'true',
      reference: s(v, 'reference'),
    }),
  });
  return {
    createProduct,
    createSupplier,
    createCustomer,
    createWarehouse,
    purchase,
    receipt,
    roast,
    recipe,
    blend,
    pack,
    order,
    pay,
    ship,
    cancel,
    inspect,
    waste,
    returned,
  };
}
