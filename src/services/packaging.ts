import type { Transaction } from '../database.js';
import { DomainError } from '../domain/errors.js';
import type { Product } from '../domain/types.js';
import { integer, multiply } from '../domain/values.js';
import { convert, derivedExpiry, validateInputs } from './production.js';

export async function packageCoffee(
  tx: Transaction,
  input: {
    coffeeLotId: string;
    materialLotId: string;
    outputProductId: string;
    units: number;
    code: string;
  },
) {
  const product = await tx.one<Product>('SELECT * FROM products WHERE id=$1', [
    input.outputProductId,
  ]);
  if (product.kind !== 'packaged') throw new DomainError('packaging output must be a packaged SKU');
  const units = integer(input.units);
  const grams = multiply(units, product.package_grams);
  const coffeeInputs = [{ lotId: input.coffeeLotId, quantity: grams }];
  const materialInputs = [{ lotId: input.materialLotId, quantity: units }];
  const coffee = await validateInputs(tx, coffeeInputs, 'roasted');
  const materials = await validateInputs(tx, materialInputs, 'material');
  if (coffee[0]!.warehouse_id !== materials[0]!.warehouse_id)
    throw new DomainError('packaging inputs must share a warehouse');
  return convert(tx, {
    kind: 'package',
    inputs: [...coffeeInputs, ...materialInputs],
    lots: [...coffee, ...materials],
    outputProductId: product.id,
    code: input.code,
    outputQuantity: units,
    inputGrams: grams,
    outputGrams: grams,
    profile: product.sku,
    expiresAt: derivedExpiry([...coffee, ...materials], null, tx.now),
  });
}
