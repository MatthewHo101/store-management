import { Bean, Blend, Package, Plus } from 'lucide-react';
import { Section, Table } from '../components.js';
import { number, quantity } from '../format.js';
import { operations, type Operation } from '../operations.js';
import type { Workspace } from '../types.js';

export function Production({ data, open }: { data: Workspace; open: (o: Operation) => void }) {
  const ops = operations(data);
  const stages = [
    {
      title: 'Roast',
      icon: Bean,
      copy: 'Turn green beans into a measured roasted batch. Record the profile, output and freshness.',
      operation: ops.roast,
      button: 'Record roast',
    },
    {
      title: 'Blend',
      icon: Blend,
      copy: 'Combine roasted lots to a defined recipe, preserving every ingredient’s source.',
      operation: ops.blend,
      button: 'Record blend',
    },
    {
      title: 'Package',
      icon: Package,
      copy: 'Convert bulk coffee and bag kits into finished products ready for customer orders.',
      operation: ops.pack,
      button: 'Package coffee',
    },
  ];
  return (
    <>
      <div className="production-grid">
        {stages.map(({ title, icon: Icon, copy, operation, button }, i) => (
          <section className="production-card" key={title}>
            <div className="production-card-top">
              <span className="stage-icon">
                <Icon size={23} />
              </span>
              <span className="step-number">0{i + 1}</span>
            </div>
            <h2>{title}</h2>
            <p>{copy}</p>
            <button className="button secondary" onClick={() => open(operation)}>
              <Plus size={16} />
              {button}
            </button>
          </section>
        ))}
      </div>
      <div className="dashboard-columns lower">
        <Section
          title="Recorded production"
          subtitle="Coffee mass across completed production runs"
        >
          <Table
            rows={data.operations.production.map((r) => ({ ...r, id: r.kind }))}
            columns={[
              { title: 'Process', render: (r) => <span className="capitalize">{r.kind}</span> },
              { title: 'Input', render: (r) => `${number(Number(r.input_grams) / 1000)} kg` },
              { title: 'Output', render: (r) => `${number(Number(r.output_grams) / 1000)} kg` },
              {
                title: 'Yield',
                render: (r) =>
                  `${Math.round((Number(r.output_grams) / Number(r.input_grams)) * 100)}%`,
              },
            ]}
            empty="Record a roast, blend or packaging run to see production totals."
          />
        </Section>
        <Section
          title="Blend recipes"
          subtitle="Defined ingredient proportions"
          action={
            <button className="text-button" onClick={() => open(ops.recipe)}>
              <Plus size={15} /> New recipe
            </button>
          }
        >
          <Table
            rows={data.recipes}
            columns={[
              { title: 'Recipe', render: (r) => <span className="record-title">{r.name}</span> },
              {
                title: 'Composition',
                render: (r) => (
                  <div className="cell-stack">
                    {Object.entries(r.components).map(([id, points]) => (
                      <span key={id}>
                        {data.products.find((p) => p.id === id)?.sku ?? 'Product'} · {points / 100}%
                      </span>
                    ))}
                  </div>
                ),
              },
            ]}
            empty="Create a blend recipe to combine two or more roasted products."
          />
        </Section>
      </div>
      <Section
        title="Available bulk coffee"
        subtitle="Roasted lots available for blending or packaging"
      >
        <Table
          rows={data.lots.filter(
            (l) =>
              data.products.find((p) => p.id === l.product_id)?.kind === 'roasted' &&
              l.quantity > l.reserved &&
              l.status === 'approved' &&
              (!l.expires_at || new Date(l.expires_at) > new Date()),
          )}
          columns={[
            { title: 'Lot', render: (l) => l.code },
            {
              title: 'Product',
              render: (l) => data.products.find((p) => p.id === l.product_id)?.name,
            },
            {
              title: 'Available',
              render: (l) =>
                quantity(
                  l.quantity - l.reserved,
                  data.products.find((p) => p.id === l.product_id),
                ),
            },
          ]}
          empty="No roasted coffee is available. Receive green beans and record a roast first."
        />
      </Section>
    </>
  );
}
