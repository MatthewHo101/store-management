import { config } from './config.js';
import { Database } from './database.js';
import { buildApp } from './http/app.js';

const settings = config();
const db = new Database(settings.DATABASE_URL);
const app = buildApp(
  db,
  { businessName: settings.BUSINESS_NAME, currency: settings.CURRENCY },
  true,
);
app.addHook('onClose', () => db.close());
for (const signal of ['SIGINT', 'SIGTERM'] as const) {
  process.once(signal, () => {
    void app.close();
  });
}
try {
  await app.listen({ host: settings.HOST, port: settings.PORT });
} catch (error) {
  app.log.error(error);
  await app.close();
  process.exitCode = 1;
}
