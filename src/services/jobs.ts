import type { Database } from '../database.js';
import { deliverOutbox, type Publisher } from './outbox.js';
import { expireReservations } from './reservations.js';

export async function runJobs(database: Database, publish: Publisher) {
  const expired = await database.transaction(expireReservations);
  const outbox = await database.transaction((tx) => deliverOutbox(tx, publish));
  return { expired, outbox };
}
