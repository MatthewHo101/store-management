import { randomUUID } from 'node:crypto';
import type { Transaction } from '../database.js';
import { DomainError } from '../domain/errors.js';
import type { Customer } from '../domain/types.js';
import { label } from '../domain/values.js';
import { audit } from './audit.js';

export async function createCustomer(
  tx: Transaction,
  name: string,
  email: string,
  channel = 'retail',
) {
  if (!['retail', 'wholesale', 'cafe'].includes(channel)) throw new DomainError('unknown channel');
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254)
    throw new DomainError('invalid email');
  const customer = await tx.one<Customer>(
    'INSERT INTO customers(id,name,email,channel) VALUES($1,$2,$3,$4) RETURNING *',
    [randomUUID(), label(name), email.trim().toLowerCase(), channel],
  );
  await audit(tx, 'customer.created', customer.id);
  return customer;
}
export function listCustomers(tx: Transaction) {
  return tx.query<Customer>('SELECT * FROM customers ORDER BY name,id');
}
