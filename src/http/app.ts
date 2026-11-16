import Fastify from 'fastify';
import { ZodError } from 'zod';
import type { Database } from '../database.js';
import { DomainError } from '../domain/errors.js';
import { catalogRoutes } from './routes/catalog.js';
import { inventoryRoutes } from './routes/inventory.js';
import { operationsRoutes } from './routes/operations.js';
import { orderRoutes } from './routes/orders.js';
import { productionRoutes } from './routes/production.js';

export function buildApp(
  db: Database,
  settings = { businessName: 'Ember Coffee', currency: 'USD' },
  logging = false,
) {
  const app = Fastify({ logger: logging, bodyLimit: 1_048_576 });
  app.setErrorHandler((error, request, reply) => {
    if (error instanceof DomainError)
      return reply.code(error.status).send({ error: error.message });
    if (error instanceof ZodError)
      return reply.code(422).send({ error: 'invalid request', issues: error.issues });
    const code = (error as { code?: string }).code;
    if (code === '23505')
      return reply.code(409).send({ error: 'a unique identifier is already in use' });
    if (code === '23503')
      return reply.code(422).send({ error: 'referenced resource does not exist' });
    if (code === '23514' || code === '22003')
      return reply.code(422).send({ error: 'value violates a storage constraint' });
    const status = (error as { statusCode?: number }).statusCode;
    if (status && status >= 400 && status < 500)
      return reply.code(status).send({ error: 'invalid HTTP request' });
    request.log.error(error);
    return reply.code(500).send({ error: 'internal server error' });
  });
  catalogRoutes(app, db);
  inventoryRoutes(app, db);
  productionRoutes(app, db);
  orderRoutes(app, db);
  operationsRoutes(app, db, settings.businessName, settings.currency);
  return app;
}
