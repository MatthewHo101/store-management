import { ArrowRight, Bean, Boxes, PackageCheck, ShoppingBag, TrendingUp } from 'lucide-react';
import { Badge, Empty, OpenButton, Section, Table } from '../components.js';
import { date, money, number, shortId } from '../format.js';
import type { Page, Workspace } from '../types.js';

export function Overview({
  data,
  navigate,
  openOrder,
}: {
  data: Workspace;
  navigate: (page: Page) => void;
  openOrder: (id: string) => void;
}) {
  const pending = data.orders.filter((o) => o.status === 'reserved' || o.status === 'paid');
  const green =
    data.inventory.filter((r) => r.kind === 'green').reduce((n, r) => n + Number(r.sellable), 0) /
    1000;
  const bags = data.inventory
    .filter((r) => r.kind === 'packaged')
    .reduce((n, r) => n + Number(r.sellable), 0);
  const roast = data.operations.production.find((p) => p.kind === 'roast');
  const yieldPercent =
    roast && Number(roast.input_grams) > 0
      ? Math.round((Number(roast.output_grams) / Number(roast.input_grams)) * 100)
      : null;
  const stats = [
    {
      title: 'Green coffee available',
      value: `${number(green)} kg`,
      note: 'Ready for your next roast',
      icon: Bean,
    },
    {
      title: 'Packaged coffee',
      value: number(bags),
      note: 'Sellable bags across your locations',
      icon: Boxes,
    },
    {
      title: 'Open orders',
      value: number(pending.length),
      note: `${pending.filter((o) => o.status === 'paid').length} paid and ready to fulfill`,
      icon: ShoppingBag,
    },
    {
      title: 'Shipped revenue',
      value: money(data.operations.shipped_revenue, data.health.currency),
      note: 'Captured sales before return refunds',
      icon: TrendingUp,
    },
  ];
  return (
    <>
      <div className="stat-grid">
        {stats.map(({ title, value, note, icon: Icon }) => (
          <div className="stat-card" key={title}>
            <div className="stat-label">
              {title}
              <span className="stat-icon">
                <Icon size={18} />
              </span>
            </div>
            <strong>{value}</strong>
            <p>{note}</p>
          </div>
        ))}
      </div>
      <div className="dashboard-columns">
        <Section
          title="Order desk"
          subtitle="Your latest customer orders"
          action={
            <button className="text-button" onClick={() => navigate('orders')}>
              All orders <ArrowRight size={15} />
            </button>
          }
        >
          <Table
            rows={[...data.orders].reverse().slice(0, 6)}
            columns={[
              {
                title: 'Order',
                render: (o) => (
                  <button className="record-link" onClick={() => openOrder(o.id)}>
                    #{shortId(o.id)}
                  </button>
                ),
              },
              {
                title: 'Customer',
                render: (o) =>
                  data.customers.find((c) => c.id === o.customer_id)?.name ?? 'Customer',
              },
              { title: 'Status', render: (o) => <Badge value={o.status} /> },
              {
                title: 'Total',
                render: (o) => (
                  <span className="numeric">{money(o.total, data.health.currency)}</span>
                ),
              },
              { title: 'Details', render: (o) => <OpenButton onClick={() => openOrder(o.id)} /> },
            ]}
            empty="Your first customer order will appear here. Add products, stock and a customer to get started."
          />
        </Section>
        <section className="roast-summary">
          <span className="eyebrow">PRODUCTION SNAPSHOT</span>
          <Bean size={32} strokeWidth={1.3} />
          <h2>
            Good coffee.
            <br />
            Clear operations.
          </h2>
          <p>From every green lot to every finished bag, keep the whole journey connected.</p>
          <div className="roast-numbers">
            <div>
              <strong>{yieldPercent === null ? '—' : `${yieldPercent}%`}</strong>
              <span>Recorded roast yield</span>
            </div>
            <div>
              <strong>{data.recipes.length}</strong>
              <span>Blend recipes</span>
            </div>
          </div>
          <button className="button light" onClick={() => navigate('production')}>
            Go to production <ArrowRight size={16} />
          </button>
        </section>
      </div>
      <div className="dashboard-columns lower">
        <Section title="Freshness watch" subtitle="Coffee and materials expiring within seven days">
          {data.operations.expiringWithinSevenDays.length ? (
            <Table
              rows={data.operations.expiringWithinSevenDays.slice(0, 5)}
              columns={[
                { title: 'Lot', render: (l) => l.code },
                { title: 'Best before', render: (l) => date(l.expires_at) },
                {
                  title: 'Status',
                  render: (l) => (
                    <Badge value={new Date(l.expires_at) <= new Date() ? 'expired' : 'expiring'} />
                  ),
                },
              ]}
            />
          ) : (
            <div className="quiet-state">
              <PackageCheck size={28} />
              <div>
                <h3>Nothing approaching expiry</h3>
                <p>No remaining lots expire in the next seven days.</p>
              </div>
            </div>
          )}
        </Section>
        <Section title="Incoming stock" subtitle="Purchase orders with an outstanding balance">
          {data.operations.openPurchases.length ? (
            <Table
              rows={data.operations.openPurchases.slice(0, 5)}
              columns={[
                { title: 'Reference', render: (p) => p.reference },
                { title: 'Outstanding', render: (p) => number(p.outstanding) },
              ]}
            />
          ) : (
            <Empty
              title="Purchasing is up to date"
              text="No open purchase balances. New purchase orders will appear here."
            />
          )}
        </Section>
      </div>
      <Section
        title="Sales & costs"
        subtitle="Shipped orders · excludes operating costs, tax and return refunds"
      >
        <div className="finance-grid">
          <div>
            <span>Shipped revenue</span>
            <strong>{money(data.operations.shipped_revenue, data.health.currency)}</strong>
          </div>
          <div>
            <span>Shipped stock cost</span>
            <strong>{money(data.operations.shipped_cost, data.health.currency)}</strong>
          </div>
          <div>
            <span>Shipped gross margin</span>
            <strong>{money(data.operations.shipped_gross_margin, data.health.currency)}</strong>
          </div>
        </div>
        <div className="table-footnote">
          Simulated cancellation refunds:{' '}
          {money(data.operations.simulated_cancellation_refunds, data.health.currency)}
        </div>
      </Section>
    </>
  );
}
