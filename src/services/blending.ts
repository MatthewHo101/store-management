import type { Transaction } from '../database.js';
import { DomainError } from '../domain/errors.js';
import type { Input, Recipe } from '../domain/types.js';
import { sum } from '../domain/values.js';
import { convert, derivedExpiry, validateInputs } from './production.js';

export async function blend(
  tx: Transaction,
  input: { recipeId: string; inputs: Input[]; code: string; expiresAt: Date | null },
) {
  const recipe = await tx.one<Recipe>('SELECT * FROM recipes WHERE id=$1', [input.recipeId]);
  const lots = await validateInputs(tx, input.inputs, 'roasted');
  const mass = sum(input.inputs.map((i) => i.quantity));
  const byProduct: Record<string, number> = {};
  lots.forEach((lot, i) => {
    byProduct[lot.product_id] = sum([byProduct[lot.product_id] ?? 0, input.inputs[i]!.quantity]);
  });
  if (Object.keys(byProduct).length !== Object.keys(recipe.components).length)
    throw new DomainError('blend differs from recipe');
  for (const [product, grams] of Object.entries(byProduct)) {
    const points = recipe.components[product];
    if (!points || BigInt(grams) * 10000n !== BigInt(mass) * BigInt(points)) {
      throw new DomainError('blend quantities must match recipe proportions exactly');
    }
  }
  return convert(tx, {
    kind: 'blend',
    inputs: input.inputs,
    lots,
    outputProductId: recipe.output_product_id,
    code: input.code,
    outputQuantity: mass,
    inputGrams: mass,
    outputGrams: mass,
    profile: recipe.name,
    expiresAt: derivedExpiry(lots, input.expiresAt, tx.now),
  });
}
