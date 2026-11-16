import { randomUUID } from 'node:crypto';
import type { Transaction } from '../database.js';
import type { Warehouse } from '../domain/types.js';
import { integer, label } from '../domain/values.js';
import { audit } from './audit.js';

export async function createWarehouse(tx: Transaction, name: string, priority = 0) {
  const warehouse = await tx.one<Warehouse>(
    'INSERT INTO warehouses(id,name,priority) VALUES($1,$2,$3) RETURNING *',
    [randomUUID(), label(name), integer(priority, 'priority', 0)],
  );
  await audit(tx, 'warehouse.created', warehouse.id);
  return warehouse;
}
export function listWarehouses(tx: Transaction) {
  return tx.query<Warehouse>('SELECT * FROM warehouses ORDER BY priority,id');
}
