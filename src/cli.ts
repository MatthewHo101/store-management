import { config } from './config.js';
import { Database } from './database.js';
import { seedDemo } from './demo.js';
import { runJobs } from './services/jobs.js';
import { inventoryReport, operationsReport } from './services/reporting.js';
import { traceLot } from './services/traceability.js';

const db = new Database(config().DATABASE_URL);
try {
  const command = process.argv[2];
  switch (command) {
    case 'migrate':
      await db.migrate();
      console.log('Migrations applied');
      break;
    case 'demo':
      console.log(JSON.stringify(await db.transaction(seedDemo), null, 2));
      break;
    case 'report':
      console.log(
        JSON.stringify(
          await db.transaction(async (tx) => ({
            inventory: await inventoryReport(tx),
            operations: await operationsReport(tx),
          })),
          null,
          2,
        ),
      );
      break;
    case 'trace': {
      const id = process.argv[3];
      if (!id || !/^[0-9a-f-]{36}$/i.test(id))
        throw new Error('usage: npm run cli -- trace <lot UUID>');
      console.log(JSON.stringify(await db.transaction((tx) => traceLot(tx, id)), null, 2));
      break;
    }
    case 'jobs':
      console.log(
        await runJobs(db, async (event) => {
          console.log(JSON.stringify({ event }));
        }),
      );
      break;
    default:
      throw new Error('usage: npm run cli -- migrate|demo|report|trace <lot UUID>|jobs');
  }
} catch (error) {
  console.error(error);
  process.exitCode = 1;
} finally {
  await db.close();
}
