import { setTimeout } from 'node:timers/promises';
import { config } from './config.js';
import { Database } from './database.js';
import { runJobs } from './services/jobs.js';

const db = new Database(config().DATABASE_URL);
let stopping = false;
const abort = new AbortController();
for (const signal of ['SIGINT', 'SIGTERM'] as const)
  process.once(signal, () => {
    stopping = true;
    abort.abort();
  });
try {
  while (!stopping) {
    try {
      const result = await runJobs(db, async (event) => {
        console.log(JSON.stringify({ event }));
      });
      console.log(JSON.stringify({ cycle: result }));
    } catch (error) {
      console.error(error);
    }
    try {
      await setTimeout(5000, undefined, { signal: abort.signal });
    } catch (error) {
      if (!stopping) throw error;
    }
  }
} finally {
  await db.close();
}
