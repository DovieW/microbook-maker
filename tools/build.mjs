import { build as bundle } from 'esbuild';
import { build as vite } from 'vite';
import fs from 'node:fs/promises';
import path from 'node:path';
const root = process.cwd();
await fs.mkdir('dist', { recursive: true });
await bundle({
  entryPoints: ['packages/renderer/src/book-browser.ts'],
  outfile: 'dist/book.js',
  bundle: true,
  format: 'iife',
  globalName: 'Microbook',
  target: 'chrome148',
  sourcemap: true,
});
await bundle({
  entryPoints: ['apps/server/src/index.ts', 'apps/server/src/worker.ts'],
  outdir: 'dist',
  entryNames: '[name]',
  outExtension: { '.js': '.js' },
  bundle: true,
  platform: 'node',
  format: 'esm',
  target: 'node24',
  packages: 'external',
  alias: {
    '@microbook/core/import': path.join(root, 'packages/core/src/import.ts'),
    '@microbook/core': path.join(root, 'packages/core/src/index.ts'),
    '@microbook/renderer': path.join(root, 'packages/renderer/src/index.ts'),
  },
  sourcemap: true,
});
await fs.rename('dist/index.js', 'dist/server.js');
await vite({
  root: path.join(root, 'apps/web'),
  configFile: path.join(root, 'apps/web/vite.config.ts'),
});
