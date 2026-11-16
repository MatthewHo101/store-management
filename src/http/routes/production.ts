import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import type { Database } from '../../database.js';
import { blend } from '../../services/blending.js';
import { packageCoffee } from '../../services/packaging.js';
import { createRecipe } from '../../services/recipes.js';
import { roast } from '../../services/roasting.js';
import { date, id, inputs, name, positive } from '../schemas.js';

export function productionRoutes(app: FastifyInstance, db: Database) {
  app.post('/roasts', async (request, reply) => {
    const body = z
      .strictObject({
        inputs,
        outputProductId: id,
        code: name,
        outputGrams: positive,
        profile: name,
        expiresAt: date,
      })
      .parse(request.body);
    return reply.code(201).send(await db.transaction((tx) => roast(tx, body)));
  });
  app.post('/recipes', async (request, reply) => {
    const body = z
      .strictObject({ name, outputProductId: id, components: z.record(id, positive) })
      .parse(request.body);
    return reply
      .code(201)
      .send(
        await db.transaction((tx) =>
          createRecipe(tx, body.name, body.outputProductId, body.components),
        ),
      );
  });
  app.get('/recipes', () =>
    db.transaction((tx) => tx.query('SELECT * FROM recipes ORDER BY name,id')),
  );
  app.post('/blends', async (request, reply) => {
    const body = z
      .strictObject({ recipeId: id, inputs, code: name, expiresAt: date.nullable().default(null) })
      .parse(request.body);
    return reply.code(201).send(await db.transaction((tx) => blend(tx, body)));
  });
  app.post('/packaging-runs', async (request, reply) => {
    const body = z
      .strictObject({
        coffeeLotId: id,
        materialLotId: id,
        outputProductId: id,
        units: positive,
        code: name,
      })
      .parse(request.body);
    return reply.code(201).send(await db.transaction((tx) => packageCoffee(tx, body)));
  });
}
