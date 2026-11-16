import type { FastifyInstance } from 'fastify';
import type { Database } from '../../database.js';
import { inventoryReport, operationsReport } from '../../services/reporting.js';
import { expireReservations } from '../../services/reservations.js';
import { paramId } from '../schemas.js';

export function operationsRoutes(
  app: FastifyInstance,
  db: Database,
  businessName: string,
  currency: string,
) {
  app.get('/health', () =>
    db.transaction(async (tx) => {
      await tx.query('SELECT 1');
      return { status: 'ok', businessName, currency, version: '0.1.0' };
    }),
  );
  app.get('/reports/inventory', () => db.transaction(inventoryReport));
  app.get('/reports/operations', () => db.transaction(operationsReport));
  app.get('/audit/:id', (request) => {
    const id = paramId(request.params);
    return db.transaction((tx) =>
      tx.query('SELECT * FROM audit WHERE resource_id=$1 ORDER BY created_at,id', [id]),
    );
  });
  app.post('/jobs/expire-reservations', () =>
    db.transaction(async (tx) => ({ expired: await expireReservations(tx) })),
  );
}
