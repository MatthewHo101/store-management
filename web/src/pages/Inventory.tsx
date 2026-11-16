import { useState } from 'react';
import { Filter } from 'lucide-react';
import { Badge, OpenButton, Section, Table } from '../components.js';
import { date, lotState, money, quantity } from '../format.js';
import type { Workspace } from '../types.js';

export function Inventory({
  data,
  search,
  openLot,
}: {
  data: Workspace;
  search: string;
  openLot: (id: string) => void;
}) {
  const [kind, setKind] = useState('all');
  const [showDepleted, setShowDepleted] = useState(false);
  const rows = data.lots.filter((l) => {
    const p = data.products.find((p) => p.id === l.product_id);
    return (
      (showDepleted || l.quantity > 0) &&
      (kind === 'all' || p?.kind === kind) &&
      `${l.code} ${p?.sku} ${p?.name}`.toLowerCase().includes(search.toLowerCase())
    );
  });
  return (
    <Section
      title="Lot inventory"
      subtitle="Every batch, its available stock and its origin"
      action={<span className="count-label">{rows.length} lots</span>}
    >
      <div className="table-toolbar">
        <div className="segmented" aria-label="Product type">
          {[
            ['all', 'All stock'],
            ['green', 'Green'],
            ['roasted', 'Roasted'],
            ['packaged', 'Packaged'],
            ['material', 'Materials'],
          ].map(([value, label]) => (
            <button
              key={value}
              className={kind === value ? 'selected' : ''}
              onClick={() => setKind(value!)}
            >
              {label}
            </button>
          ))}
        </div>
        <label className="check-label">
          <input
            type="checkbox"
            checked={showDepleted}
            onChange={(e) => setShowDepleted(e.target.checked)}
          />{' '}
          Include depleted lots
        </label>
      </div>
      <Table
        rows={rows}
        columns={[
          {
            title: 'Lot / product',
            render: (l) => {
              const p = data.products.find((p) => p.id === l.product_id);
              return (
                <div className="cell-stack">
                  <button className="record-link" onClick={() => openLot(l.id)}>
                    {l.code}
                  </button>
                  <span>
                    {p?.sku} · {p?.name}
                  </span>
                </div>
              );
            },
          },
          {
            title: 'Location',
            render: (l) => data.warehouses.find((w) => w.id === l.warehouse_id)?.name ?? '—',
          },
          {
            title: 'Available',
            render: (l) => (
              <span className="numeric">
                {quantity(
                  lotState(l) === 'available' ? l.quantity - l.reserved : 0,
                  data.products.find((p) => p.id === l.product_id),
                )}
              </span>
            ),
          },
          {
            title: 'Reserved',
            render: (l) =>
              quantity(
                l.reserved,
                data.products.find((p) => p.id === l.product_id),
              ),
          },
          { title: 'Best before', render: (l) => date(l.expires_at) },
          { title: 'Status', render: (l) => <Badge value={lotState(l)} /> },
          {
            title: 'Details',
            render: (l) => (
              <OpenButton onClick={() => openLot(l.id)} label={`View lot ${l.code}`} />
            ),
          },
        ]}
        empty="No lots match your filters. Receive a purchase or complete a production run to add stock."
      />
      <div className="table-footnote">
        <Filter size={14} /> Available quantities exclude active reservations. Quarantined and
        expired stock cannot be allocated.
      </div>
      <div className="inventory-totals">
        <span>Carrying value of all remaining inventory</span>
        <strong>
          {money(
            data.inventory.reduce((n, r) => n + Number(r.inventory_cost), 0),
            data.health.currency,
          )}
        </strong>
      </div>
    </Section>
  );
}
