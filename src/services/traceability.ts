import type { Transaction } from '../database.js';
import type { Lot } from '../domain/types.js';
import { getLot } from './inventory.js';

export async function traceLot(tx: Transaction, lotId: string) {
  const lot = await getLot(tx, lotId);
  const ancestors = await tx.query<Lot>(
    `WITH RECURSIVE ancestors(id) AS (
    SELECT $1::uuid UNION SELECT l.parent_id FROM lineage l JOIN ancestors a ON l.child_id=a.id
  ) SELECT lots.* FROM lots JOIN ancestors USING(id) WHERE id<>$1 ORDER BY created_at,id`,
    [lotId],
  );
  const descendants = await tx.query<Lot>(
    `WITH RECURSIVE descendants(id) AS (
    SELECT $1::uuid UNION SELECT l.child_id FROM lineage l JOIN descendants d ON l.parent_id=d.id
  ) SELECT lots.* FROM lots JOIN descendants USING(id) WHERE id<>$1 ORDER BY created_at,id`,
    [lotId],
  );
  const ids = [lotId, ...descendants.map((l) => l.id)];
  const shipments = await tx.query(
    `SELECT DISTINCT s.id,s.order_id,s.tracking,c.name AS customer_name,c.email
    FROM shipments s JOIN orders o ON o.id=s.order_id JOIN customers c ON c.id=o.customer_id
    JOIN allocations a ON a.order_id=o.id WHERE a.lot_id=ANY($1::uuid[]) ORDER BY s.id`,
    [ids],
  );
  const purchases = await tx.query(
    `SELECT DISTINCT p.*,s.name AS supplier_name,s.origin
    FROM purchases p JOIN suppliers s ON s.id=p.supplier_id JOIN lots l ON l.purchase_id=p.id
    WHERE l.id=ANY($1::uuid[]) ORDER BY p.id`,
    [[lotId, ...ancestors.map((l) => l.id)]],
  );
  return { lot, ancestors, descendants, purchases, shipments };
}
