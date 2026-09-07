import { chromium } from '@playwright/test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { zip, publisherEntries } from './fixtures.mjs';
const base = process.env.HOSTED_URL || 'http://127.0.0.1:39101';
const browser = await chromium.connectOverCDP(process.env.LOCAL_BROWSER_URL || 'http://127.0.0.1:39222');
const context = await browser.newContext({ viewport: { width: 1280, height: 800 } }),
  page = await context.newPage();
const errors = [];
page.on('pageerror', (e) => {
  errors.push(e.message);
  console.log('PAGE ERROR', e.message);
});
const api = (url, options) =>
  page.evaluate(
    async ({ url, options }) => {
      const r = await fetch(url, options);
      return { status: r.status, data: r.status === 204 ? null : await r.json() };
    },
    { url, options },
  );
async function completed(mode) {
  let last;
  for (let i = 0; i < 90; i++) {
    const { data } = await api('/api/documents');
    last = data[0]?.renders?.filter((j) => j.settings.mode === mode).at(-1);
    if (last?.status === 'completed') return last;
    if (last?.status === 'failed' || last?.status === 'cancelled') throw Error(JSON.stringify(last));
    if (i % 5 === 0) console.log(mode, last?.phase);
    await page.waitForTimeout(1000);
  }
  throw Error('Timed out: ' + JSON.stringify(last));
}
try {
  await page.goto(base);
  await page.waitForSelector('input[type=file]', { state: 'attached' });
  await page.locator('input[type=file]').setInputFiles({
    name: 'synthetic.epub',
    mimeType: 'application/epub+zip',
    buffer: zip(publisherEntries),
  });
  const rich = await completed('book');
  console.log('Rich completed', rich.result.pages, rich.result.coverage);
  assert.equal(rich.result.coverage.complete, true);
  assert.equal(rich.result.coverage.overflows, 0);
  const bytes = await page.evaluate(
    async (id) => [...new Uint8Array(await fetch(`/api/renders/${id}/pdf`).then((r) => r.arrayBuffer()))],
    rich.id,
  );
  await fs.mkdir('.artifacts/hosted', { recursive: true });
  await fs.writeFile('.artifacts/hosted/rich.pdf', Buffer.from(bytes));
  await page.waitForSelector('.page canvas', { timeout: 15000 });
  await page.screenshot({ path: '.artifacts/hosted/workspace.png' });
  await page.getByRole('button', { name: 'Basic', exact: true }).click();
  const basic = await completed('classic');
  console.log('Basic completed', basic.result.pages, basic.result.coverage);
  await page.getByRole('button', { name: 'Rich', exact: true }).click();
  await page.reload();
  await page.waitForSelector('input[type=file]', { state: 'attached' });
  const library = await api('/api/documents');
  assert.equal(library.data.length, 1);
  assert.equal(library.data[0].renders.filter((j) => j.status === 'completed').length, 2);
  const isolation = await browser.newContext(),
    other = await isolation.newPage();
  await other.goto(base);
  await other.waitForSelector('input[type=file]', { state: 'attached' });
  const otherDocs = await other.evaluate(() => fetch('/api/documents').then((r) => r.json()));
  assert.deepEqual(otherDocs, []);
  await isolation.close();
  // Keep a second workspace open while a job is active; it must not interrupt it.
  let release;
  const gate = new Promise((resolve) => {
    release = resolve;
  });
  await page.route('**/_cloud/print', async (route) => {
    await gate;
    await route.abort().catch(() => {});
  });
  const pending = await api(`/api/documents/${rich.documentId}/renders`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ settings: rich.settings, force: true }),
  });
  const second = await context.newPage();
  await second.goto(base);
  await second.waitForSelector('input[type=file]', { state: 'attached' });
  const stillActive = await api(`/api/renders/${pending.data.id}`);
  assert.ok(['queued', 'running'].includes(stillActive.data.status));
  await api(`/api/renders/${pending.data.id}/cancel`, { method: 'POST' });
  release();
  await second.close();
  assert.equal((await api(`/api/renders/${pending.data.id}`)).data.status, 'cancelled');
  assert.equal((await api(`/api/renders/${rich.id}`)).data.status, 'completed');
  await page.unroute('**/_cloud/print');
  const deleted = await api(`/api/documents/${rich.documentId}`, { method: 'DELETE' }); // 204 handled below
  console.log('Deleted', deleted.status);
  assert.equal((await api('/api/documents')).data.length, 0);
  assert.equal((await api(`/api/renders/${rich.id}/pdf`)).status, 404);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.reload();
  await page.waitForSelector('input[type=file]', { state: 'attached' });
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
  await page.screenshot({ path: '.artifacts/hosted/mobile-empty.png' });
  assert.deepEqual(errors, []);
  console.log('Hosted workflow passed');
} finally {
  await context.close();
  await browser.close();
}
