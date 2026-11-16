import { randomUUID } from 'node:crypto';
import type { Transaction } from '../database.js';

export async function audit(
  tx: Transaction,
  action: string,
  resourceId: string,
  details: object = {},
) {
  await tx.query('INSERT INTO audit(id,action,resource_id,details) VALUES($1,$2,$3,$4)', [
    randomUUID(),
    action,
    resourceId,
    details,
  ]);
}
