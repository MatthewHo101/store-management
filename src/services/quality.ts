import type { Transaction } from '../database.js';
import { Conflict } from '../domain/errors.js';
import { label } from '../domain/values.js';
import { audit } from './audit.js';
import { getLot } from './inventory.js';

export async function inspectLot(tx: Transaction, lotId: string, approved: boolean, notes: string) {
  const lot = await getLot(tx, lotId);
  if (!approved && lot.reserved > 0)
    throw new Conflict('release active reservations before quarantine');
  const status = approved ? 'approved' : 'quarantined';
  await tx.query('UPDATE lots SET status=$2 WHERE id=$1', [lot.id, status]);
  await audit(tx, 'quality.inspected', lot.id, { status, notes: label(notes, 'inspection notes') });
  return { ...lot, status };
}
