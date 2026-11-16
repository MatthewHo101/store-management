import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import type { Database } from '../../database.js';
import { cancelOrder } from '../../services/cancellation.js';
import { createOrder, listOrders, orderDetails } from '../../services/orders.js';
import { acceptPayment } from '../../services/payments.js';
import { receiveReturn } from '../../services/returns.js';
import { shipOrder } from '../../services/shipping.js';
import { id, items, money, name, paramId, positive } from '../schemas.js';

export function orderRoutes(app: FastifyInstance, db: Database) {
  app.get('/orders', () => db.transaction(listOrders));
  app.get('/orders/:id', (request) => {
    const id = paramId(request.params);
    return db.transaction((tx) => orderDetails(tx, id));
  });
  app.post('/orders', async (request, reply) => {
    const body = z
      .strictObject({
        customerId: id,
        items,
        requestKey: name,
        reservationMinutes: positive.max(1440).default(30),
      })
      .parse(request.body);
    return reply.code(201).send(await db.transaction((tx) => createOrder(tx, body)));
  });
  app.post('/orders/:id/payment', (request) => {
    const id = paramId(request.params);
    const body = z.strictObject({ eventId: name, amount: money }).parse(request.body);
    return db.transaction((tx) => acceptPayment(tx, id, body.eventId, body.amount));
  });
  app.post('/orders/:id/cancel', (request) => {
    const id = paramId(request.params);
    return db.transaction((tx) => cancelOrder(tx, id));
  });
  app.post('/orders/:id/ship', (request) => {
    const id = paramId(request.params);
    const body = z.strictObject({ tracking: name }).parse(request.body);
    return db.transaction((tx) => shipOrder(tx, id, body.tracking));
  });
  app.post('/returns', async (request, reply) => {
    const body = z
      .strictObject({ allocationId: id, quantity: positive, restock: z.boolean(), reference: name })
      .parse(request.body);
    return reply.code(201).send(await db.transaction((tx) => receiveReturn(tx, body)));
  });
}
