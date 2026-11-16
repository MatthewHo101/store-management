import type { Transaction } from '../database.js';
import { DomainError } from '../domain/errors.js';
import type { Input, Product } from '../domain/types.js';
import { integer, sum } from '../domain/values.js';
import { convert, derivedExpiry, validateInputs } from './production.js';

export async function roast(
  tx: Transaction,
  input: {
    inputs: Input[];
    outputProductId: string;
    code: string;
    outputGrams: number;
    profile: string;
    expiresAt: Date;
  },
) {
  const lots = await validateInputs(tx, input.inputs, 'green');
  const product = await tx.one<Product>('SELECT * FROM products WHERE id=$1', [
    input.outputProductId,
  ]);
  const mass = sum(input.inputs.map((i) => i.quantity));
  if (product.kind !== 'roasted') throw new DomainError('roast output must be bulk roasted coffee');
  if (integer(input.outputGrams) > mass)
    throw new DomainError('roast output cannot exceed input mass');
  return convert(tx, {
    ...input,
    kind: 'roast',
    lots,
    outputQuantity: input.outputGrams,
    inputGrams: mass,
    expiresAt: derivedExpiry(lots, input.expiresAt, tx.now),
  });
}
