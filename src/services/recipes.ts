import { randomUUID } from 'node:crypto';
import type { Transaction } from '../database.js';
import { DomainError } from '../domain/errors.js';
import type { Product, Recipe } from '../domain/types.js';
import { integer, label, sum } from '../domain/values.js';
import { audit } from './audit.js';

export async function createRecipe(
  tx: Transaction,
  name: string,
  outputProductId: string,
  components: Record<string, number>,
) {
  if (Object.keys(components).length < 2)
    throw new DomainError('a blend needs at least two coffee products');
  if (sum(Object.values(components).map((v) => integer(v, 'basis points'))) !== 10000) {
    throw new DomainError('recipe components must total 10000 basis points');
  }
  for (const id of [outputProductId, ...Object.keys(components)]) {
    const product = await tx.one<Product>('SELECT * FROM products WHERE id=$1', [id]);
    if (product.kind !== 'roasted') throw new DomainError('recipes use roasted coffee products');
  }
  const recipe = await tx.one<Recipe>(
    'INSERT INTO recipes(id,name,output_product_id,components) VALUES($1,$2,$3,$4) RETURNING *',
    [randomUUID(), label(name), outputProductId, components],
  );
  await audit(tx, 'recipe.created', recipe.id);
  return recipe;
}
