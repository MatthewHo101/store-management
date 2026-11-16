import type { Transaction } from '../database.js';

export async function inventoryReport(tx: Transaction) {
  // Every SKU appears, including those without stock. Never mix grams with unit counts.
  return tx.query(
    `SELECT p.id,p.sku,p.kind,
    CASE WHEN p.kind IN ('green','roasted') THEN 'grams' ELSE 'units' END AS unit,
    COALESCE(sum(l.quantity),0)::text AS physical,
    COALESCE(sum(l.reserved),0)::text AS reserved,
    COALESCE(sum(CASE WHEN l.status='approved' AND (l.expires_at IS NULL OR l.expires_at>$1)
      THEN l.quantity-l.reserved ELSE 0 END),0)::text AS sellable,
    COALESCE(sum(l.remaining_cost),0)::text AS inventory_cost
    FROM products p LEFT JOIN lots l ON l.product_id=p.id
    GROUP BY p.id ORDER BY p.sku,p.id`,
    [tx.now],
  );
}
export async function operationsReport(tx: Transaction) {
  const financials = await tx.one<{
    shipped_revenue: string;
    shipped_cost: string;
    shipped_gross_margin: string;
  }>(`SELECT
    COALESCE(sum(total) FILTER(WHERE status='shipped'),0)::text AS shipped_revenue,
    COALESCE(sum(cost) FILTER(WHERE status='shipped'),0)::text AS shipped_cost,
    COALESCE(sum(total-cost) FILTER(WHERE status='shipped'),0)::text AS shipped_gross_margin
    FROM orders`);
  const refunds = await tx.one<{ simulated_cancellation_refunds: string }>(
    'SELECT COALESCE(sum(amount) FILTER(WHERE refunded),0)::text AS simulated_cancellation_refunds FROM payments',
  );
  const production = await tx.query(`SELECT kind,sum(input_grams)::text AS input_grams,
    sum(output_grams)::text AS output_grams FROM production GROUP BY kind ORDER BY kind`);
  const shortages = await tx.query(
    'SELECT id,reference,quantity-received AS outstanding FROM purchases WHERE received<quantity ORDER BY reference',
  );
  const aging = await tx.query(
    `SELECT id,code,quantity,expires_at FROM lots WHERE quantity>0
    AND expires_at<=$1 ORDER BY expires_at,id`,
    [new Date(tx.now.getTime() + 7 * 86400000)],
  );
  return {
    ...financials,
    ...refunds,
    production,
    openPurchases: shortages,
    expiringWithinSevenDays: aging,
  };
}
