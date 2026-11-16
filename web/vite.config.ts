import react from '@vitejs/plugin-react';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  root: fileURLToPath(new URL('.', import.meta.url)),
  plugins: [react()],
  server: {
    host: '0.0.0.0',
    port: 5173,
    proxy: { '/api': { target: process.env.API_PROXY_TARGET ?? 'http://127.0.0.1:3000' } },
  },
  build: { outDir: '../public', emptyOutDir: true },
  test: {
    environment: 'jsdom',
    setupFiles: ['./tests/setup.ts'],
    include: ['tests/**/*.test.tsx', 'tests/**/*.test.ts'],
  },
});
