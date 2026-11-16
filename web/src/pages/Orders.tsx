import { useState } from 'react';
import { Plus } from 'lucide-react';
import { Badge, OpenButton, Section, Table } from '../components.js';
import { date, money, shortId } from '../format.js';
import type { Workspace } from '../types.js';

export function Orders({
  data,
  search,
  create,
  detail,
}: {
  data: Workspace;
  search: string;
  create: () => void;
  detail: (id: string) => void;
}) {
  const [status, setStatus] = useState('all');
  const rows = [...data.orders]
    .reverse()
    .filter(
      (o) =>
        (status === 'all' || o.status === status) &&
        `${o.id} ${data.customers.find((c) => c.id === o.customer_id)?.name}`
          .toLowerCase()
          .includes(search.toLowerCase()),
    );
  return (
    <Section
      title="Sales orders"
      subtitle="From reserved coffee to customer shipment"
      action={
        <button className="button primary" onClick={create}>
          <Plus size={16} /> New order
        </button>
      }
    >
      <div className="table-toolbar">
        <div className="segmented">
          {['all', 'reserved', 'paid', 'shipped', 'cancelled', 'expired'].map((value) => (
            <button
              key={value}
              className={status === value ? 'selected' : ''}
              onClick={() => setStatus(value)}
            >
              {value === 'all' ? 'All orders' : value}
            </button>
          ))}
        </div>
      </div>
      <Table
        rows={rows}
        columns={[
          {
            title: 'Order',
            render: (o) => (
              <button className="record-link" onClick={() => detail(o.id)}>
                #{shortId(o.id)}
              </button>
            ),
          },
          {
            title: 'Customer',
            render: (o) => (
              <div className="cell-stack">
                <strong>{data.customers.find((c) => c.id === o.customer_id)?.name}</strong>
                <span>{data.customers.find((c) => c.id === o.customer_id)?.channel}</span>
              </div>
            ),
          },
          { title: 'Created', render: (o) => date(o.created_at) },
          {
            title: 'Warehouse',
            render: (o) => data.warehouses.find((w) => w.id === o.warehouse_id)?.name,
          },
          {
            title: 'Total',
            render: (o) => <span className="numeric">{money(o.total, data.health.currency)}</span>,
          },
          { title: 'Status', render: (o) => <Badge value={o.status} /> },
          {
            title: 'Details',
            render: (o) => (
              <OpenButton onClick={() => detail(o.id)} label={`View order ${shortId(o.id)}`} />
            ),
          },
        ]}
        empty="No orders match this view. Add a customer and packaged stock, then create your first order."
      />
    </Section>
  );
}
