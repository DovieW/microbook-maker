// Explicit, opt-in cloud feasibility check. Only generated test content is uploaded.
// Run with node --import tsx tools/cloudflare-proof.mjs ACCOUNT_ID FONT_DIRECTORY.
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { build } from 'esbuild';
import puppeteer from 'puppeteer';
import { importDocument } from '../packages/core/src/import.ts';
import { defaultSettings, fontStacks, newRichFeatures } from '../packages/core/src/index.ts';
import { publisherEntries, zip } from './fixtures.mjs';

const [account, fontDirectory] = process.argv.slice(2);
assert.match(account || '', /^[a-f0-9]{32}$/, 'Provide a Cloudflare account ID');
assert.ok(fontDirectory, 'Provide the pinned engine croscore font directory');
const output = path.resolve('.artifacts/cloudflare-proof');
await fs.mkdir(output, { recursive: true });
// Let cf refresh OAuth; never print or persist credentials in project artifacts.
execFileSync('cf', ['auth', 'whoami'], { stdio: 'pipe' });
const token =
  process.env.CLOUDFLARE_API_TOKEN ||
  JSON.parse(await fs.readFile(path.join(os.homedir(), '.config/cloudflare/config/default.json'), 'utf8'))
    .oauth_token;
assert.ok(token, 'Authenticate cf first');
const subscriptions = await fetch(`https://api.cloudflare.com/client/v4/accounts/${account}/subscriptions`, {
  headers: { Authorization: `Bearer ${token}` },
}).then(async (r) => {
  assert.ok(r.ok, `Subscription check failed (${r.status})`);
  return r.json();
});
assert.ok(subscriptions.success && Array.isArray(subscriptions.result), 'Cannot verify subscriptions');
assert.ok(
  !subscriptions.result.some((s) => /workers/i.test(`${s.product?.name} ${s.rate_plan?.id}`)),
  'This proof is restricted to an account with no paid Workers subscription',
);

const bundled = await build({
  entryPoints: ['packages/renderer/src/book-browser.ts'],
  bundle: true,
  format: 'iife',
  globalName: 'Microbook',
  target: 'chrome148',
  write: false,
});
const book = await importDocument(
  zip(publisherEntries),
  'cloudflare-synthetic.epub',
  'cloudflare-proof',
  path.join(output, 'source'),
);
const settings = { ...defaultSettings(), rich: newRichFeatures(), twoCellImages: true };
const assets = new Map(
  await Promise.all(
    book.assets.map(async (a) => [
      a.id,
      {
        bytes: await fs.readFile(path.join(output, 'source', a.path)),
        type: a.mediaType,
      },
    ]),
  ),
);
const faces = [];
for (const [fileFamily, family] of [
  ['Arimo', 'Arial'],
  ['Tinos', 'Times New Roman'],
  ['Cousine', 'Courier New'],
]) {
  for (const variant of ['Regular', 'Bold', 'Italic', 'BoldItalic']) {
    faces.push({
      family,
      weight: variant.includes('Bold') ? '700' : '400',
      style: variant.includes('Italic') ? 'italic' : 'normal',
      data: (await fs.readFile(path.join(fontDirectory, `${fileFamily}-${variant}.ttf`))).toString('base64'),
    });
  }
}
const reports = {};
for (const remote of [false, true]) {
  const label = remote ? 'cloudflare' : 'local';
  const start = performance.now();
  let browser;
  try {
    browser = remote
      ? await puppeteer.connect({
          browserWSEndpoint: `wss://api.cloudflare.com/client/v4/accounts/${account}/browser-rendering/devtools/browser?keep_alive=60000`,
          headers: { Authorization: `Bearer ${token}` },
          protocolTimeout: 90000,
        })
      : process.env.LOCAL_BROWSER_URL
        ? await puppeteer.connect({ browserURL: process.env.LOCAL_BROWSER_URL })
        : await puppeteer.launch({
            executablePath: process.env.CHROMIUM_PATH || '/usr/bin/chromium',
            headless: true,
            args: ['--no-sandbox'],
            protocolTimeout: 90000,
          });
    const page = await browser.newPage();
    page.setDefaultTimeout(60000);
    await page.setViewport({ width: 816, height: 1056, deviceScaleFactor: 1 });
    // All source assets are served from memory. No source links may reach the network.
    await page.setRequestInterception(true);
    page.on('request', (request) => {
      const url = new URL(request.url());
      const asset = url.origin === 'https://microbook.invalid' && assets.get(url.pathname.split('/').pop());
      void (asset
        ? request.respond({ status: 200, contentType: asset.type, body: asset.bytes })
        : url.protocol === 'data:' || url.protocol === 'about:'
          ? request.continue()
          : request.abort());
    });
    await page.setContent('<!doctype html><html><head><meta charset="utf-8"></head><body></body></html>');
    await page.evaluate(async (faces) => {
      for (const f of faces) {
        const face = new FontFace(f.family, `url(data:font/ttf;base64,${f.data})`, {
          weight: f.weight,
          style: f.style,
        });
        document.fonts.add(await face.load());
      }
      await document.fonts.ready;
    }, faces);
    await page.addScriptTag({ content: bundled.outputFiles[0].text });
    const layout = await page.evaluate((payload) => window.Microbook.renderBook(payload), {
      document: book,
      settings,
      fontStack: fontStacks[settings.fontFamily],
      assetBase: 'https://microbook.invalid/assets',
    });
    assert.equal(layout.coverage.overflows, 0);
    assert.equal(layout.coverage.expectedCharacters, layout.coverage.renderedCharacters);
    const pages = await page.$$eval('.page', (nodes) => nodes.length);
    await page.pdf({
      path: path.join(output, `${label}.pdf`),
      format: 'Letter',
      printBackground: true,
      preferCSSPageSize: false,
      outline: settings.rich.bookmarks,
      timeout: 90000,
    });
    await page.screenshot({
      path: path.join(output, `${label}.png`),
      clip: { x: 0, y: 0, width: 816, height: 1056 },
    });
    if (!remote) {
      const prepared = await page.evaluate(
        ({ faces, assets }) => {
          const clone = document.documentElement.cloneNode(true);
          clone.querySelectorAll('script').forEach((node) => node.remove());
          const style = document.createElement('style');
          style.textContent = faces
            .map(
              (f) =>
                `@font-face{font-family:"${f.family}";font-weight:${f.weight};font-style:${f.style};src:url(data:font/ttf;base64,${f.data})}`,
            )
            .join('\n');
          clone.querySelector('head').append(style);
          for (const img of clone.querySelectorAll('img')) {
            const id = new URL(img.src).pathname.split('/').pop();
            const asset = assets[id];
            if (asset) img.src = asset;
          }
          return clone.outerHTML;
        },
        {
          faces,
          assets: Object.fromEntries(
            [...assets].map(([id, a]) => [id, `data:${a.type};base64,${a.bytes.toString('base64')}`]),
          ),
        },
      );
      await fs.writeFile(path.join(output, 'prepared.html'), prepared);
    }
    reports[label] = {
      browser: await browser.version(),
      pages,
      cells: layout.cells.length,
      coverage: layout.coverage,
      elapsedMs: Math.round(performance.now() - start),
    };
    await fs.writeFile(path.join(output, `${label}-layout.json`), JSON.stringify(layout, null, 2));
    console.log(JSON.stringify({ [label]: reports[label] }));
  } finally {
    if (browser) await browser.close();
  }
}
assert.equal(reports.cloudflare.pages, reports.local.pages);
assert.equal(reports.cloudflare.cells, reports.local.cells);
await fs.writeFile(path.join(output, 'report.json'), JSON.stringify(reports, null, 2));
console.log('Cloudflare synthetic rendering proof passed. This does not deploy the application.');
