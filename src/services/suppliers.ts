import { randomUUID } from 'node:crypto';
import type { Transaction } from '../database.js';
import type { Supplier } from '../domain/types.js';
import { label } from '../domain/values.js';
import { audit } from './audit.js';

export async function createSupplier(tx: Transaction, name: string, origin: string) {
  const supplier = await tx.one<Supplier>(
    'INSERT INTO suppliers(id,name,origin) VALUES($1,$2,$3) RETURNING *',
    [randomUUID(), label(name), label(origin, 'origin')],
  );
  await audit(tx, 'supplier.created', supplier.id);
  return supplier;
}
export function listSuppliers(tx: Transaction) {
  return tx.query<Supplier>('SELECT * FROM suppliers ORDER BY name,id');
}
