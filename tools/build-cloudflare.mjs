// Build Output API v0, consumed by the new cf CLI (not the Wrangler CLI).
import fs from 'node:fs/promises';
import { build } from 'esbuild';
const root = '.cloudflare/output/v0';
const directory = `${root}/workers/default`;
await fs.mkdir(`${directory}/bundle`, { recursive: true });
await build({
  entryPoints: ['apps/cloudflare/src/worker.ts'],
  outfile: `${directory}/bundle/index.js`,
  bundle: true,
  format: 'esm',
  platform: 'browser',
  target: 'es2022',
  minify: true,
});
await fs.writeFile(
  `${directory}/config.json`,
  JSON.stringify(
    {
      type: 'worker',
      name: 'microbook-renderer-preview',
      compatibilityDate: '2026-09-07',
      workersDev: true,
      previewUrls: false,
      observability: { enabled: false },
      env: { BROWSER: { type: 'browser' }, RENDER_KEY: { type: 'secret' } },
      manifest: { type: 'complete', mainModule: 'index.js', modules: { 'index.js': { type: 'esm' } } },
    },
    null,
    2,
  ),
);
console.log('Built the gated Cloudflare renderer preview. No frontend or storage is deployed.');
