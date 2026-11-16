import type { Transaction } from '../database.js';
import { Conflict } from '../domain/errors.js';
import type { Lot, OrderItem, Warehouse } from '../domain/types.js';
import { listWarehouses } from './warehouses.js';

export interface PlannedAllocation {
  lotId: string;
  quantity: number;
}
export async function planAllocation(
  tx: Transaction,
  items: OrderItem[],
): Promise<{
  warehouse: Warehouse;
  allocations: PlannedAllocation[];
}> {
  for (const warehouse of await listWarehouses(tx)) {
    const allocations: PlannedAllocation[] = [];
    let complete = true;
    for (const item of items) {
      let remaining = item.quantity;
      const lots = await tx.query<Lot>(
        `SELECT * FROM lots
        WHERE product_id=$1 AND warehouse_id=$2 AND status='approved' AND quantity>reserved
          AND (expires_at IS NULL OR expires_at>$3)
        ORDER BY expires_at ASC NULLS LAST,created_at,id`,
        [item.productId, warehouse.id, tx.now],
      );
      for (const lot of lots) {
        const quantity = Math.min(remaining, lot.quantity - lot.reserved);
        if (quantity > 0) allocations.push({ lotId: lot.id, quantity });
        remaining -= quantity;
        if (remaining === 0) break;
      }
      if (remaining > 0) {
        complete = false;
        break;
      }
    }
    if (complete) return { warehouse, allocations };
  }
  throw new Conflict('no single warehouse can fulfill the complete order');
}
