// Build Output API v0, consumed by the new cf CLI (not the Wrangler CLI).
import fs from 'node:fs/promises';
import path from 'node:path';
import { build } from 'esbuild';
import { build as vite } from 'vite';
const app = process.argv.includes('--app');
const root = '.cloudflare/output/v0',
  directory = `${root}/workers/default`;
await fs.rm(directory, { recursive: true, force: true });
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
const env = { BROWSER: { type: 'browser' }, ...(!app ? { RENDER_KEY: { type: 'secret' } } : {}) };
if (app) {
  const assets = `${directory}/assets`;
  await fs.mkdir(assets, { recursive: true });
  process.env.VITE_HOSTED = '1';
  await vite({
    root: path.resolve('apps/web'),
    configFile: path.resolve('apps/web/vite.config.ts'),
    build: { outDir: path.resolve(assets), emptyOutDir: false, sourcemap: false },
  });
  const platformPlugin = {
    name: 'browser-import',
    setup(b) {
      b.onResolve({ filter: /import-platform(?:\.ts)?$/ }, () => ({
        path: path.resolve('apps/web/src/hosted/import-platform.ts'),
      }));
    },
  };
  const common = {
    bundle: true,
    format: 'iife',
    platform: 'browser',
    target: 'es2022',
    minify: true,
    inject: ['apps/web/src/hosted/buffer-shim.ts'],
    alias: { path: 'path-browserify' },
  };
  await build({
    ...common,
    entryPoints: ['apps/web/src/hosted/import-worker.ts'],
    outfile: assets + '/hosted-import.js',
    plugins: [platformPlugin],
  });
  await build({
    ...common,
    entryPoints: ['apps/web/src/hosted/frame.ts'],
    outfile: assets + '/hosted-frame.js',
    globalName: 'HostedRenderer',
  });
  await fs.copyFile('apps/web/src/hosted/service-worker.js', assets + '/hosted-sw.js');
  await fs.copyFile('node_modules/pdfjs-dist/build/pdf.worker.min.mjs', assets + '/pdf.worker.min.mjs');
  await fs.mkdir(assets + '/__renderer', { recursive: true });
  const script = '<script src="/hosted-frame.js"></script>';
  const classic = await fs.readFile('packages/renderer/classic/page.html', 'utf8');
  await fs.writeFile(assets + '/__renderer/classic.html', classic.replace('</head>', script + '</head>'));
  await fs.writeFile(
    assets + '/__renderer/book.html',
    '<!doctype html><html><head><meta charset="utf-8">' + script + '</head><body></body></html>',
  );
  await fs.cp('resources/hosted-fonts', assets + '/hosted-fonts', { recursive: true });
  await fs.cp('resources/print-samples', assets + '/hosted-print-samples', { recursive: true });
  const manifest = [];
  for (const filename of await fs.readdir('resources/hosted-fonts')) {
    if (!filename.endsWith('.ttf')) continue;
    const base = filename.replace(/-(Regular|BoldItalic|Bold|Italic)\.ttf$|\.ttf$/, '');
    const family = {
      Arimo: 'Arial',
      Tinos: 'Times New Roman',
      Cousine: 'Courier New',
      DejaVuSans: 'DejaVu Sans',
      DejaVuSerif: 'DejaVu Serif',
      DejaVuSansMono: 'DejaVu Sans Mono',
    }[base];
    if (!family) continue;
    const face = {
      family,
      file: filename,
      weight: filename.includes('Bold') ? '700' : '400',
      style: filename.includes('Italic') ? 'italic' : 'normal',
    };
    manifest.push(face);
    if (base === 'Tinos') manifest.push({ ...face, family: 'Georgia' });
  }
  await fs.writeFile(assets + '/hosted-fonts/manifest.json', JSON.stringify(manifest));
  env.ASSETS = { type: 'assets' };
  env.PUBLIC_MODE = { type: 'text', value: 'true' };
}
await fs.writeFile(
  `${directory}/config.json`,
  JSON.stringify(
    {
      type: 'worker',
      name: app ? 'microbook' : 'microbook-renderer-preview',
      compatibilityDate: '2026-09-07',
      workersDev: true,
      previewUrls: false,
      observability: { enabled: false },
      env,
      ...(app ? { assets: { runWorkerFirst: true } } : {}),
      manifest: { type: 'complete', mainModule: 'index.js', modules: { 'index.js': { type: 'esm' } } },
    },
    null,
    2,
  ),
);
console.log(app ? 'Built the Cloudflare MicroBook app.' : 'Built the gated Cloudflare renderer preview.');
