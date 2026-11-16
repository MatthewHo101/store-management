import { createHash } from 'node:crypto';
import type { Transaction } from '../database.js';
import { Conflict } from '../domain/errors.js';
import { label } from '../domain/values.js';

export function fingerprint(payload: unknown) {
  return createHash('sha256').update(JSON.stringify(payload)).digest('hex');
}
export async function recall(tx: Transaction, key: string, hash: string): Promise<string | null> {
  label(key, 'request key');
  const row = (
    await tx.query<{ resource_id: string; fingerprint: string }>(
      'SELECT * FROM idempotency WHERE key=$1',
      [key],
    )
  )[0];
  if (!row) return null;
  if (row.fingerprint !== hash)
    throw new Conflict('request key already used for different content');
  return row.resource_id;
}
export async function remember(tx: Transaction, key: string, hash: string, resourceId: string) {
  await tx.query('INSERT INTO idempotency(key,fingerprint,resource_id) VALUES($1,$2,$3)', [
    key,
    hash,
    resourceId,
  ]);
}
