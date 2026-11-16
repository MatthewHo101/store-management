import { useState } from 'react';
import { Plus } from 'lucide-react';
import { Badge, Section, Table } from '../components.js';
import { money } from '../format.js';
import { operations, type Operation } from '../operations.js';
import type { Workspace } from '../types.js';

export function Directory({
  data,
  search,
  open,
}: {
  data: Workspace;
  search: string;
  open: (o: Operation) => void;
}) {
  const [tab, setTab] = useState<'products' | 'suppliers' | 'customers' | 'warehouses'>('products');
  const ops = operations(data);
  const actions = {
    products: ops.createProduct,
    suppliers: ops.createSupplier,
    customers: ops.createCustomer,
    warehouses: ops.createWarehouse,
  };
  const matches = (r: { name: string }) => r.name.toLowerCase().includes(search.toLowerCase());
  return (
    <Section
      title="Business directory"
      subtitle="The records behind your daily operations"
      action={
        <button className="button primary" onClick={() => open(actions[tab])}>
          <Plus size={16} />
          {actions[tab].title}
        </button>
      }
    >
      <div className="table-toolbar">
        <div className="segmented">
          {(['products', 'suppliers', 'customers', 'warehouses'] as const).map((value) => (
            <button
              key={value}
              className={tab === value ? 'selected' : ''}
              onClick={() => setTab(value)}
            >
              {value}
            </button>
          ))}
        </div>
      </div>
      {tab === 'products' && (
        <Table
          rows={data.products.filter((p) =>
            `${p.name} ${p.sku}`.toLowerCase().includes(search.toLowerCase()),
          )}
          columns={[
            { title: 'SKU', render: (p) => <span className="record-title">{p.sku}</span> },
            { title: 'Product', render: (p) => p.name },
            { title: 'Type', render: (p) => <Badge value={p.kind} /> },
            {
              title: 'Package size',
              render: (p) => (p.package_grams ? `${p.package_grams} g` : 'Bulk / material'),
            },
            {
              title: 'Selling price',
              render: (p) => (p.kind === 'packaged' ? money(p.price, data.health.currency) : '—'),
            },
          ]}
        />
      )}
      {tab === 'suppliers' && (
        <Table
          rows={data.suppliers.filter(matches)}
          columns={[
            { title: 'Supplier', render: (r) => r.name },
            { title: 'Origin', render: (r) => r.origin },
          ]}
        />
      )}
      {tab === 'customers' && (
        <Table
          rows={data.customers.filter(matches)}
          columns={[
            { title: 'Customer', render: (r) => r.name },
            { title: 'Email', render: (r) => r.email },
            { title: 'Channel', render: (r) => <Badge value={r.channel} /> },
          ]}
        />
      )}
      {tab === 'warehouses' && (
        <Table
          rows={data.warehouses.filter(matches)}
          columns={[
            { title: 'Warehouse', render: (r) => r.name },
            { title: 'Fulfillment priority', render: (r) => r.priority },
          ]}
        />
      )}
    </Section>
  );
}
