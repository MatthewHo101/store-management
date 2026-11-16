import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import type { Database } from '../../database.js';
import { createProduct, listProducts } from '../../services/catalog.js';
import { createCustomer, listCustomers } from '../../services/customers.js';
import { createSupplier, listSuppliers } from '../../services/suppliers.js';
import { createWarehouse, listWarehouses } from '../../services/warehouses.js';
import { money, name } from '../schemas.js';

export function catalogRoutes(app: FastifyInstance, db: Database) {
  app.get('/products', () => db.transaction(listProducts));
  app.post('/products', async (request, reply) => {
    const body = z
      .strictObject({
        sku: name,
        name,
        kind: z.enum(['green', 'roasted', 'packaged', 'material']),
        price: money.default(0),
        packageGrams: money.default(0),
      })
      .parse(request.body);
    return reply.code(201).send(await db.transaction((tx) => createProduct(tx, body)));
  });
  app.get('/suppliers', () => db.transaction(listSuppliers));
  app.post('/suppliers', async (request, reply) => {
    const body = z.strictObject({ name, origin: name }).parse(request.body);
    return reply
      .code(201)
      .send(await db.transaction((tx) => createSupplier(tx, body.name, body.origin)));
  });
  app.get('/customers', () => db.transaction(listCustomers));
  app.post('/customers', async (request, reply) => {
    const body = z
      .strictObject({
        name,
        email: z.email().max(254),
        channel: z.enum(['retail', 'wholesale', 'cafe']).default('retail'),
      })
      .parse(request.body);
    return reply
      .code(201)
      .send(await db.transaction((tx) => createCustomer(tx, body.name, body.email, body.channel)));
  });
  app.get('/warehouses', () => db.transaction(listWarehouses));
  app.post('/warehouses', async (request, reply) => {
    const body = z.strictObject({ name, priority: money.default(0) }).parse(request.body);
    return reply
      .code(201)
      .send(await db.transaction((tx) => createWarehouse(tx, body.name, body.priority)));
  });
}
