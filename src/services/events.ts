import { randomUUID } from 'node:crypto';
import type { Transaction } from '../database.js';

export async function emit(tx: Transaction, topic: string, payload: object) {
  await tx.query('INSERT INTO outbox(id,topic,payload) VALUES($1,$2,$3)', [
    randomUUID(),
    topic,
    payload,
  ]);
}
