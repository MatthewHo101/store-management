import { randomUUID } from 'node:crypto';
import type { Transaction } from '../database.js';
import { DomainError } from '../domain/errors.js';
import type { Kind, Product } from '../domain/types.js';
import { integer, label } from '../domain/values.js';
import { audit } from './audit.js';

export async function createProduct(
  tx: Transaction,
  input: {
    sku: string;
    name: string;
    kind: Kind;
    price?: number;
    packageGrams?: number;
  },
) {
  const grams = input.packageGrams ?? 0;
  if (!['green', 'roasted', 'packaged', 'material'].includes(input.kind))
    throw new DomainError('unknown kind');
  if (input.kind === 'packaged') integer(grams, 'packageGrams');
  else if (grams !== 0) throw new DomainError('only packaged SKUs have package weights');
  const product = await tx.one<Product>(
    'INSERT INTO products(id,sku,name,kind,price,package_grams) VALUES($1,$2,$3,$4,$5,$6) RETURNING *',
    [
      randomUUID(),
      label(input.sku, 'SKU'),
      label(input.name),
      input.kind,
      integer(input.price ?? 0, 'price', 0),
      grams,
    ],
  );
  await audit(tx, 'product.created', product.id);
  return product;
}
export function listProducts(tx: Transaction) {
  return tx.query<Product>('SELECT * FROM products ORDER BY sku,id');
}
