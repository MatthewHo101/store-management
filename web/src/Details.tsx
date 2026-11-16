import { ArrowRight, Check, PackageCheck, ShieldCheck, Trash2, Truck } from 'lucide-react';
import { Badge, Dialog, Empty, ErrorNotice, Loading, Section, Table } from './components.js';
import { date, lotState, money, quantity, shortId } from './format.js';
import { useResource } from './hooks.js';
import { operations, type Operation } from './operations.js';
import type { Movement, OrderDetail, Trace, Workspace } from './types.js';

export function LotDetail({
  id,
  data,
  close,
  open,
}: {
  id: string;
  data: Workspace;
  close: () => void;
  open: (o: Operation) => void;
}) {
  const trace = useResource<Trace>(`/lots/${id}/trace`);
  const ledger = useResource<Movement[]>(`/lots/${id}/ledger`);
  const lot = trace.data?.lot;
  const product = data.products.find((p) => p.id === lot?.product_id);
  const ops = operations(data);
  return (
    <Dialog
      title={lot?.code ?? 'Lot details'}
      subtitle={product ? `${product.sku} · ${product.name}` : 'Stock, quality and traceability'}
      close={close}
      wide
    >
      {trace.error ? (
        <ErrorNotice message={trace.error} />
      ) : !lot ? (
        <Loading />
      ) : (
        <>
          <div className="detail-stats">
            <div>
              <span>Physical stock</span>
              <strong>{quantity(lot.quantity, product)}</strong>
            </div>
            <div>
              <span>Reserved</span>
              <strong>{quantity(lot.reserved, product)}</strong>
            </div>
            <div>
              <span>Remaining cost</span>
              <strong>{money(lot.remaining_cost, data.health.currency)}</strong>
            </div>
          </div>
          <div className="detail-meta">
            <Badge value={lotState(lot)} />
            <span>Best before: {date(lot.expires_at)}</span>
            <span>{data.warehouses.find((w) => w.id === lot.warehouse_id)?.name}</span>
          </div>
          <div className="action-row">
            <button className="button secondary" onClick={() => open(ops.inspect(lot))}>
              <ShieldCheck size={16} /> Inspect lot
            </button>
            <button
              className="button secondary"
              disabled={lotState(lot) !== 'available' || lot.quantity <= lot.reserved}
              onClick={() => open(ops.waste(lot))}
            >
              <Trash2 size={16} /> Record waste
            </button>
          </div>
          <Section title="Source history" subtitle="Purchases that contributed to this lot">
            <Table
              rows={trace.data!.purchases}
              columns={[
                { title: 'Reference', render: (p) => p.reference },
                { title: 'Supplier', render: (p) => p.supplier_name },
                { title: 'Origin', render: (p) => p.origin },
              ]}
              empty="This lot has no purchase ancestry recorded."
            />
          </Section>
          <Section
            title="Lot connections"
            subtitle="Ingredients upstream and finished lots downstream"
          >
            <div className="lineage-grid">
              <div>
                <span className="eyebrow">INPUT ANCESTRY</span>
                {trace.data!.ancestors.length ? (
                  trace.data!.ancestors.map((l) => (
                    <div className="lineage-item" key={l.id}>
                      <span>{l.code}</span>
                      <ArrowRight size={14} />
                    </div>
                  ))
                ) : (
                  <p className="muted">Original received lot</p>
                )}
              </div>
              <div>
                <span className="eyebrow">DERIVED LOTS</span>
                {trace.data!.descendants.length ? (
                  trace.data!.descendants.map((l) => (
                    <div className="lineage-item" key={l.id}>
                      <span>{l.code}</span>
                      <Badge value={lotState(l)} />
                    </div>
                  ))
                ) : (
                  <p className="muted">No downstream production</p>
                )}
              </div>
            </div>
          </Section>
          <Section
            title="Customer destinations"
            subtitle="Shipments containing this lot or its descendants"
          >
            <Table
              rows={trace.data!.shipments}
              columns={[
                { title: 'Customer', render: (s) => s.customer_name },
                { title: 'Contact', render: (s) => s.email },
                { title: 'Tracking', render: (s) => s.tracking },
              ]}
              empty="No shipments are linked to this lot yet."
            />
          </Section>
          <Section title="Stock movement ledger">
            {ledger.error ? (
              <ErrorNotice message={ledger.error} />
            ) : !ledger.data ? (
              <Loading />
            ) : (
              <Table
                rows={ledger.data}
                columns={[
                  { title: 'Date', render: (m) => date(m.created_at) },
                  {
                    title: 'Reason',
                    render: (m) => <span className="capitalize">{m.reason}</span>,
                  },
                  {
                    title: 'Change',
                    render: (m) => `${m.quantity > 0 ? '+' : ''}${quantity(m.quantity, product)}`,
                  },
                  { title: 'Cost change', render: (m) => money(m.cost, data.health.currency) },
                ]}
              />
            )}
          </Section>
        </>
      )}
    </Dialog>
  );
}

export function OrderDetails({
  id,
  data,
  close,
  open,
}: {
  id: string;
  data: Workspace;
  close: () => void;
  open: (o: Operation) => void;
}) {
  const { data: order, error } = useResource<OrderDetail>(`/orders/${id}`);
  const ops = operations(data);
  const customer = data.customers.find((c) => c.id === order?.customer_id);
  return (
    <Dialog
      title={`Order #${shortId(id)}`}
      subtitle={customer ? `${customer.name} · ${customer.email}` : 'Order and allocation details'}
      close={close}
      wide
    >
      {error ? (
        <ErrorNotice message={error} />
      ) : !order ? (
        <Loading />
      ) : (
        <>
          <div className="detail-stats">
            <div>
              <span>Order total</span>
              <strong>{money(order.total, data.health.currency)}</strong>
            </div>
            <div>
              <span>Captured stock cost</span>
              <strong>
                {order.status === 'shipped'
                  ? money(order.cost, data.health.currency)
                  : 'At shipment'}
              </strong>
            </div>
            <div>
              <span>Status</span>
              <strong>
                <Badge value={order.status} />
              </strong>
            </div>
          </div>
          <div className="detail-meta">
            <span>Created {date(order.created_at)}</span>
            <span>{data.warehouses.find((w) => w.id === order.warehouse_id)?.name}</span>
            {order.status === 'reserved' && (
              <span>Pay before {new Date(order.expires_at).toLocaleString()}</span>
            )}
          </div>
          <div className="action-row">
            {order.status === 'reserved' && (
              <button
                className="button primary"
                disabled={new Date(order.expires_at) <= new Date()}
                onClick={() => open(ops.pay(order))}
              >
                <Check size={16} /> Record simulated payment
              </button>
            )}
            {order.status === 'paid' && (
              <button className="button primary" onClick={() => open(ops.ship(order))}>
                <Truck size={16} /> Ship order
              </button>
            )}
            {['reserved', 'paid', 'expired'].includes(order.status) && (
              <button className="button secondary" onClick={() => open(ops.cancel(order))}>
                Cancel order
              </button>
            )}
          </div>
          <Section title="Order items" subtitle="Prices captured when the order was created">
            <Table
              rows={order.items}
              columns={[
                {
                  title: 'Product',
                  render: (i) => data.products.find((p) => p.id === i.product_id)?.name,
                },
                { title: 'Bags', render: (i) => i.quantity },
                { title: 'Unit price', render: (i) => money(i.unit_price, data.health.currency) },
                {
                  title: 'Line total',
                  render: (i) => money(i.quantity * i.unit_price, data.health.currency),
                },
              ]}
            />
          </Section>
          <Section
            title="Lot allocations"
            subtitle={
              order.status === 'shipped'
                ? 'Shipped stock and received returns'
                : 'The specific stock assigned to this order'
            }
          >
            <Table
              rows={order.allocations}
              columns={[
                {
                  title: 'Lot',
                  render: (a) => data.lots.find((l) => l.id === a.lot_id)?.code ?? a.lot_id,
                },
                { title: 'Allocated', render: (a) => a.quantity },
                { title: 'Returned', render: (a) => a.returned },
                {
                  title: 'Action',
                  render: (a) =>
                    order.status === 'shipped' && a.returned < a.quantity ? (
                      <button
                        className="button small secondary"
                        onClick={() => open(ops.returned(a))}
                      >
                        Receive return
                      </button>
                    ) : (
                      <span className="muted">—</span>
                    ),
                },
              ]}
            />
          </Section>
          {order.status === 'shipped' && (
            <div className="info-strip">
              <PackageCheck size={20} />
              <p>
                Stock was deducted at shipment. Only inspected, sellable returns may be put back
                into inventory.
              </p>
            </div>
          )}
          {order.status === 'expired' && (
            <Empty
              title="Reservation expired"
              text="The payment deadline passed and reserved stock was released."
            />
          )}
        </>
      )}
    </Dialog>
  );
}
