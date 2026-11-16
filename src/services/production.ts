import { randomUUID } from 'node:crypto';
import type { Transaction } from '../database.js';
import { DomainError } from '../domain/errors.js';
import type { Input, Kind, Lot, Product } from '../domain/types.js';
import { future, integer, label, sum } from '../domain/values.js';
import { audit } from './audit.js';
import { emit } from './events.js';
import { assertUsable, consume, createLot, getLot } from './inventory.js';

export async function validateInputs(tx: Transaction, inputs: Input[], kind: Kind) {
  if (!inputs.length || new Set(inputs.map((i) => i.lotId)).size !== inputs.length) {
    throw new DomainError('provide nonempty, distinct input lots');
  }
  const lots: Lot[] = [];
  for (const input of inputs) {
    const lot = await getLot(tx, input.lotId);
    const product = await tx.one<Product>('SELECT * FROM products WHERE id=$1', [lot.product_id]);
    if (product.kind !== kind) throw new DomainError(`inputs must be ${kind}`);
    assertUsable(lot, tx.now, input.quantity);
    lots.push(lot);
  }
  if (new Set(lots.map((l) => l.warehouse_id)).size !== 1)
    throw new DomainError('production inputs must share a warehouse');
  return lots;
}
export function derivedExpiry(lots: Lot[], requested: Date | null, now: Date): Date | null {
  const dates = lots.flatMap((l) => (l.expires_at ? [l.expires_at] : []));
  if (requested) dates.push(requested);
  const expiry = dates.length ? new Date(Math.min(...dates.map((d) => d.getTime()))) : null;
  future(expiry, now);
  return expiry;
}

export async function convert(
  tx: Transaction,
  input: {
    kind: 'roast' | 'blend' | 'package';
    inputs: Input[];
    lots: Lot[];
    outputProductId: string;
    code: string;
    outputQuantity: number;
    inputGrams: number;
    outputGrams: number;
    profile: string;
    expiresAt: Date | null;
  },
) {
  const runId = randomUUID();
  const costs: number[] = [];
  integer(input.outputQuantity);
  for (const source of input.inputs) {
    costs.push(await consume(tx, source.lotId, source.quantity, input.kind, runId));
  }
  const lot = await createLot(tx, {
    code: input.code,
    productId: input.outputProductId,
    warehouseId: input.lots[0]!.warehouse_id,
    quantity: input.outputQuantity,
    cost: sum(costs),
    expiresAt: input.expiresAt,
    reason: 'production',
    reference: runId,
  });
  await tx.query(
    `INSERT INTO production(id,kind,output_lot_id,input_grams,output_grams,profile)
    VALUES($1,$2,$3,$4,$5,$6)`,
    [
      runId,
      input.kind,
      lot.id,
      input.inputGrams,
      input.outputGrams,
      label(input.profile, 'profile'),
    ],
  );
  for (const source of input.inputs) {
    await tx.query('INSERT INTO lineage(id,parent_id,child_id,quantity) VALUES($1,$2,$3,$4)', [
      randomUUID(),
      source.lotId,
      lot.id,
      source.quantity,
    ]);
  }
  await audit(tx, `production.${input.kind}`, lot.id, {
    runId,
    inputGrams: input.inputGrams,
    outputGrams: input.outputGrams,
  });
  await emit(tx, 'production.completed', { runId, lotId: lot.id });
  return lot;
}
