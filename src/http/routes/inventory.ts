import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import type { Database } from '../../database.js';
import { recordWaste } from '../../services/adjustments.js';
import { getLot, listLots } from '../../services/inventory.js';
import { lotLedger } from '../../services/ledger.js';
import { createPurchase, listPurchases } from '../../services/procurement.js';
import { inspectLot } from '../../services/quality.js';
import { receive } from '../../services/receiving.js';
import { traceLot } from '../../services/traceability.js';
import { date, id, money, name, paramId, positive } from '../schemas.js';

export function inventoryRoutes(app: FastifyInstance, db: Database) {
  app.get('/purchases', () => db.transaction(listPurchases));
  app.post('/purchases', async (request, reply) => {
    const body = z
      .strictObject({
        reference: name,
        supplierId: id,
        productId: id,
        warehouseId: id,
        quantity: positive,
        totalCost: money,
        landedCost: money.default(0),
      })
      .parse(request.body);
    return reply.code(201).send(await db.transaction((tx) => createPurchase(tx, body)));
  });
  app.post('/purchases/:id/receipts', async (request, reply) => {
    const purchaseId = paramId(request.params);
    const body = z
      .strictObject({ code: name, quantity: positive, expiresAt: date.nullable().default(null) })
      .parse(request.body);
    return reply.code(201).send(await db.transaction((tx) => receive(tx, { ...body, purchaseId })));
  });
  app.get('/lots', () => db.transaction(listLots));
  app.get('/lots/:id', (request) => {
    const id = paramId(request.params);
    return db.transaction((tx) => getLot(tx, id));
  });
  app.get('/lots/:id/ledger', (request) => {
    const id = paramId(request.params);
    return db.transaction((tx) => lotLedger(tx, id));
  });
  app.get('/lots/:id/trace', (request) => {
    const id = paramId(request.params);
    return db.transaction((tx) => traceLot(tx, id));
  });
  app.post('/lots/:id/inspection', (request) => {
    const id = paramId(request.params);
    const body = z.strictObject({ approved: z.boolean(), notes: name }).parse(request.body);
    return db.transaction((tx) => inspectLot(tx, id, body.approved, body.notes));
  });
  app.post('/lots/:id/waste', (request) => {
    const id = paramId(request.params);
    const body = z.strictObject({ quantity: positive, reason: name }).parse(request.body);
    return db.transaction((tx) => recordWaste(tx, id, body.quantity, body.reason));
  });
}
