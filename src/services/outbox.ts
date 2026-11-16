import type { Transaction } from '../database.js';
import type { OutboxEvent } from '../domain/types.js';
import { integer } from '../domain/values.js';

export type Publisher = (event: OutboxEvent) => Promise<void>;
export async function deliverOutbox(tx: Transaction, publish: Publisher, batchSize = 100) {
  integer(batchSize, 'batchSize');
  const events = await tx.query<OutboxEvent>(
    'SELECT * FROM outbox WHERE NOT delivered ORDER BY created_at,id LIMIT $1',
    [batchSize],
  );
  let delivered = 0;
  for (const event of events) {
    try {
      await publish(event);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      await tx.query('UPDATE outbox SET attempts=attempts+1,last_error=$2 WHERE id=$1', [
        event.id,
        message.slice(0, 2000),
      ]);
      continue;
    }
    // A crash between publication and commit can cause redelivery. Event IDs are stable.
    await tx.query(
      'UPDATE outbox SET attempts=attempts+1,delivered=true,last_error=NULL WHERE id=$1',
      [event.id],
    );
    delivered++;
  }
  return { attempted: events.length, delivered };
}
