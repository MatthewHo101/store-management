import { randomUUID } from 'node:crypto';
import type { Transaction } from '../database.js';
import { Conflict } from '../domain/errors.js';
import type { Lot } from '../domain/types.js';
import { future, integer, label, share } from '../domain/values.js';
import { movement } from './ledger.js';

export async function createLot(
  tx: Transaction,
  input: {
    code: string;
    productId: string;
    warehouseId: string;
    quantity: number;
    cost: number;
    purchaseId?: string;
    expiresAt: Date | null;
    reason: string;
    reference: string;
  },
) {
  future(input.expiresAt, tx.now);
  const lot = await tx.one<Lot>(
    `INSERT INTO lots
    (id,code,product_id,warehouse_id,quantity,remaining_cost,purchase_id,expires_at,created_at)
    VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *`,
    [
      randomUUID(),
      label(input.code, 'lot code'),
      input.productId,
      input.warehouseId,
      integer(input.quantity),
      integer(input.cost, 'cost', 0),
      input.purchaseId ?? null,
      input.expiresAt,
      tx.now,
    ],
  );
  await movement(tx, lot.id, lot.quantity, lot.remaining_cost, input.reason, input.reference);
  return lot;
}
export async function getLot(tx: Transaction, id: string) {
  return tx.one<Lot>('SELECT * FROM lots WHERE id=$1', [id]);
}
export function assertUsable(lot: Lot, now: Date, quantity: number) {
  integer(quantity);
  if (lot.status !== 'approved') throw new Conflict(`lot ${lot.code} is quarantined`);
  if (lot.expires_at && lot.expires_at <= now) throw new Conflict(`lot ${lot.code} is expired`);
  if (lot.quantity - lot.reserved < quantity)
    throw new Conflict(`insufficient available stock in ${lot.code}`);
}
/** Consumes only unreserved stock. Shipment releases its own reservation before calling this. */
export async function consume(
  tx: Transaction,
  lotId: string,
  quantity: number,
  reason: string,
  reference: string,
) {
  const lot = await getLot(tx, lotId);
  assertUsable(lot, tx.now, quantity);
  const cost = share(lot.remaining_cost, quantity, lot.quantity);
  await tx.query(
    'UPDATE lots SET quantity=quantity-$2,remaining_cost=remaining_cost-$3 WHERE id=$1',
    [lot.id, quantity, cost],
  );
  await movement(tx, lot.id, -quantity, -cost, reason, reference);
  return cost;
}
export function listLots(tx: Transaction) {
  return tx.query<Lot>('SELECT * FROM lots ORDER BY created_at,id');
}
