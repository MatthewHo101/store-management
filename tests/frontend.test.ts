import assert from 'node:assert/strict';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { after, before, beforeEach, test } from 'node:test';
import { buildApp } from '../src/http/app.js';
import { reset, testDatabase } from './helpers.js';

const db = testDatabase();
let root: string;
let app: ReturnType<typeof buildApp>;
before(async () => {
  root = await mkdtemp(join(tmpdir(), 'coffee-static-'));
  await writeFile(
    join(root, 'index.html'),
    '<!doctype html><title>coffee-management</title><div id="root"></div>',
  );
  await mkdir(join(root, 'assets'));
  await writeFile(join(root, 'assets', 'asset.js'), 'console.log("frontend asset")');
  await db.migrate();
  app = buildApp(db, undefined, false, root);
  await app.ready();
});
beforeEach(() => reset(db));
after(async () => {
  await app.close();
  await db.close();
  await rm(root, { recursive: true, force: true });
});

test('serves the frontend and assets without replacing API responses', async () => {
  const index = await app.inject({ method: 'GET', url: '/' });
  assert.equal(index.statusCode, 200);
  assert.match(index.headers['content-type'] ?? '', /text\/html/);
  assert.match(index.body, /coffee-management/);
  const asset = await app.inject({ method: 'GET', url: '/assets/asset.js' });
  assert.equal(asset.statusCode, 200);
  const legacy = await app.inject({ method: 'GET', url: '/products' });
  assert.deepEqual(legacy.json(), []);
  const prefixed = await app.inject({ method: 'GET', url: '/api/products' });
  assert.deepEqual(prefixed.json(), []);
  const missing = await app.inject({ method: 'GET', url: '/api/unknown-route' });
  assert.equal(missing.statusCode, 404);
  const traversal = await app.inject({ method: 'GET', url: '/assets/..%2findex.html' });
  assert.equal(traversal.statusCode, 404);
  assert.doesNotMatch(traversal.body, /<title>/);
});
test('browser API prefix uses the same persisted services and validation', async () => {
  const payload = { sku: 'GREEN', name: 'Green beans', kind: 'green' };
  const created = await app.inject({ method: 'POST', url: '/api/products', payload });
  assert.equal(created.statusCode, 201);
  const legacy = await app.inject({ method: 'GET', url: '/products' });
  assert.equal(legacy.json()[0].id, created.json().id);
  const invalid = await app.inject({
    method: 'POST',
    url: '/api/products',
    payload: { ...payload, kind: 'unknown' },
  });
  assert.equal(invalid.statusCode, 422);
});
