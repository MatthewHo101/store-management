import { Plus, Truck } from 'lucide-react';
import { Badge, Section, Table } from '../components.js';
import { money, quantity } from '../format.js';
import { operations, type Operation } from '../operations.js';
import type { Workspace } from '../types.js';

export function Purchasing({
  data,
  search,
  open,
}: {
  data: Workspace;
  search: string;
  open: (o: Operation) => void;
}) {
  const ops = operations(data);
  const rows = data.purchases.filter((p) =>
    `${p.reference} ${data.suppliers.find((s) => s.id === p.supplier_id)?.name}`
      .toLowerCase()
      .includes(search.toLowerCase()),
  );
  return (
    <>
      <div className="info-strip">
        <Truck size={20} />
        <p>
          Order green coffee and packaging materials, then receive the quantity that actually
          arrives. Partial deliveries remain open.
        </p>
      </div>
      <Section
        title="Purchase orders"
        subtitle="Expected deliveries and accepted stock"
        action={
          <button className="button primary" onClick={() => open(ops.purchase)}>
            <Plus size={16} /> New purchase
          </button>
        }
      >
        <Table
          rows={rows}
          columns={[
            {
              title: 'Reference',
              render: (p) => <span className="record-title">{p.reference}</span>,
            },
            {
              title: 'Supplier / product',
              render: (p) => (
                <div className="cell-stack">
                  <strong>{data.suppliers.find((s) => s.id === p.supplier_id)?.name}</strong>
                  <span>{data.products.find((x) => x.id === p.product_id)?.name}</span>
                </div>
              ),
            },
            {
              title: 'Ordered',
              render: (p) =>
                quantity(
                  p.quantity,
                  data.products.find((x) => x.id === p.product_id),
                ),
            },
            {
              title: 'Outstanding',
              render: (p) =>
                quantity(
                  p.quantity - p.received,
                  data.products.find((x) => x.id === p.product_id),
                ),
            },
            {
              title: 'Acquisition cost',
              render: (p) => money(p.total_cost + p.landed_cost, data.health.currency),
            },
            {
              title: 'Status',
              render: (p) => (
                <Badge
                  value={
                    p.received === p.quantity ? 'received' : p.received > 0 ? 'partial' : 'open'
                  }
                />
              ),
            },
            {
              title: 'Action',
              render: (p) =>
                p.received < p.quantity ? (
                  <button className="button small secondary" onClick={() => open(ops.receipt(p))}>
                    Receive
                  </button>
                ) : (
                  <span className="muted">Complete</span>
                ),
            },
          ]}
          empty="Create your first purchase order. You will need a supplier, a warehouse, and a green-coffee or packaging SKU in the directory."
        />
      </Section>
    </>
  );
}
