import { readFile, readdir } from 'node:fs/promises';
import { Pool, type PoolClient, type QueryResultRow } from 'pg';
import { NotFound } from './domain/errors.js';

export class Transaction {
  constructor(
    private client: PoolClient,
    public readonly now: Date,
  ) {}
  async query<T extends QueryResultRow>(sql: string, values: unknown[] = []): Promise<T[]> {
    return (await this.client.query<T>(sql, values)).rows;
  }
  async one<T extends QueryResultRow>(sql: string, values: unknown[] = []): Promise<T> {
    const row = (await this.query<T>(sql, values))[0];
    if (!row) throw new NotFound('record');
    return row;
  }
}

export class Database {
  private pool: Pool;
  constructor(url: string) {
    this.pool = new Pool({ connectionString: url, max: 10 });
  }
  async transaction<T>(work: (tx: Transaction) => Promise<T>, clock?: Date): Promise<T> {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      // Single-business baseline: all cooperating writers serialize at this boundary.
      // Locks are released by PostgreSQL on commit/rollback, including process failure.
      await client.query('SELECT pg_advisory_xact_lock(814101)');
      // Capture time AFTER waiting for the lock, so deadline decisions cannot use stale time.
      const tx = new Transaction(client, clock ?? new Date());
      const result = await work(tx);
      await client.query('COMMIT');
      return result;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }
  async migrate(): Promise<void> {
    const directory = new URL('../migrations/', import.meta.url);
    const files = (await readdir(directory)).filter((f) => /^\d+.*\.sql$/.test(f)).sort();
    await this.transaction(async (tx) => {
      await tx.query('CREATE TABLE IF NOT EXISTS schema_migrations (name text PRIMARY KEY)');
      const applied = new Set(
        (await tx.query<{ name: string }>('SELECT name FROM schema_migrations')).map((r) => r.name),
      );
      for (const file of files) {
        if (applied.has(file)) continue;
        await tx.query(await readFile(new URL(file, directory), 'utf8'));
        await tx.query('INSERT INTO schema_migrations(name) VALUES($1)', [file]);
      }
    });
  }
  async close() {
    await this.pool.end();
  }
}
