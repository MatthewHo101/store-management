import { randomUUID } from 'node:crypto';
import type { Transaction } from '../database.js';

export async function movement(
  tx: Transaction,
  lotId: string,
  quantity: number,
  cost: number,
  reason: string,
  reference: string,
) {
  await tx.query(
    'INSERT INTO movements(id,lot_id,quantity,cost,reason,reference) VALUES($1,$2,$3,$4,$5,$6)',
    [randomUUID(), lotId, quantity, cost, reason, reference],
  );
}
export function lotLedger(tx: Transaction, lotId: string) {
  return tx.query('SELECT * FROM movements WHERE lot_id=$1 ORDER BY created_at,id', [lotId]);
}
