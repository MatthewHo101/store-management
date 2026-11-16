import { readFile, readdir } from 'node:fs/promises';
import { join, extname } from 'node:path';
import type { FastifyInstance } from 'fastify';

const mime: Record<string, string> = {
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.webp': 'image/webp',
  '.woff2': 'font/woff2',
  '.ico': 'image/x-icon',
};

/** Serve only the index and a startup allowlist of Vite's generated assets.
 * Request parameters are never used to construct filesystem paths.
 */
export async function frontend(app: FastifyInstance, root: string) {
  const index = await readFile(join(root, 'index.html'));
  const assets = new Map<string, { content: Buffer; type: string }>();
  for (const entry of await readdir(join(root, 'assets'), { withFileTypes: true })) {
    const type = mime[extname(entry.name)];
    if (!entry.isFile() || !type) continue;
    assets.set(entry.name, { content: await readFile(join(root, 'assets', entry.name)), type });
  }
  app.get('/', async (_request, reply) =>
    reply
      .header('Cache-Control', 'no-cache')
      .header('X-Content-Type-Options', 'nosniff')
      .type('text/html; charset=utf-8')
      .send(index),
  );
  app.get<{ Params: { file: string } }>('/assets/:file', async (request, reply) => {
    const asset = assets.get(request.params.file);
    if (!asset) return reply.code(404).send({ error: 'asset not found' });
    return reply
      .header('Cache-Control', 'public, max-age=31536000, immutable')
      .header('X-Content-Type-Options', 'nosniff')
      .type(asset.type)
      .send(asset.content);
  });
}
