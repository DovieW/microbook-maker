import { test, expect } from '@playwright/test';
import fs from 'node:fs/promises';
import { ready, preview, upload, tab, applied } from './helpers';

test('kept versions are named, opened inline, immutable and separate from working drafts', async ({
  page,
  request,
  context,
}) => {
  await page.goto('/');
  await upload(page);
  const first = await ready(page, request);
  const bytes = await (await request.get(`/api/renders/${first.id}/pdf`)).body();
  let downloads = 0;
  page.on('download', () => downloads++);
  await tab(page, 'History');
  await page.getByRole('button', { name: 'Keep version', exact: true }).click();
  await expect
    .poll(async () => (await (await request.get(`/api/renders/${first.id}`)).json()).saved)
    .toBe(true);
  const kept = await (await request.get(`/api/renders/${first.id}`)).json();
  expect(kept.savedAt).toBeTruthy();
  expect(kept.savedLabel).toContain('Basic · 6 px');
  expect((await request.patch(`/api/renders/${first.id}`, { data: { label: '  ' } })).status()).toBe(422);
  expect((await request.patch(`/api/renders/${first.id}`, { data: { saved: 'yes' } })).status()).toBe(422);
  expect(downloads).toBe(0);
  await tab(page, 'Layout');
  await page.getByLabel('Text size in CSS pixels').fill('8');
  await applied(page);
  const current = await ready(page, request);
  await page.getByLabel('Text size in CSS pixels').fill('9');
  await tab(page, 'Books');
  await page.getByLabel('Find book').fill('classic.txt');
  const row = page.locator('.book-row.current');
  await row.getByText('Kept versions', { exact: true }).click();
  const keptRow = row.locator('.kept-row').first();
  await keptRow.locator('summary').click();
  await keptRow.getByLabel('Version name', { exact: true }).fill('Pocket original');
  await keptRow.getByLabel('Version name', { exact: true }).press('Enter');
  await expect(keptRow.getByRole('button', { name: 'Pocket original', exact: true })).toBeVisible();
  await keptRow.getByRole('button', { name: 'Pocket original', exact: true }).click();
  await ready(page);
  await expect(preview(page)).toHaveAttribute('data-render-id', first.id);
  expect(context.pages()).toHaveLength(1);
  await tab(page, 'Layout');
  await expect(page.getByLabel('Text size in CSS pixels')).toBeDisabled();
  await expect(page.getByLabel('Text size in CSS pixels')).toHaveValue('6');
  await page.reload();
  await ready(page);
  await expect(preview(page)).toHaveAttribute('data-render-id', first.id);
  await page.getByRole('button', { name: 'Return to current', exact: true }).click();
  await expect(preview(page)).toHaveAttribute('data-render-id', current.id);
  await expect(page.getByLabel('Text size in CSS pixels')).toHaveValue('9');
  await tab(page, 'Books');
  await page.getByLabel('Find book').fill('classic.txt');
  await page.locator('.book-row.current').getByText('Kept versions', { exact: true }).click();
  await page.getByRole('button', { name: 'Pocket original', exact: true }).click();
  await ready(page);
  await page.getByRole('button', { name: 'Use these settings', exact: true }).click();
  await expect(page.getByLabel('Text size in CSS pixels')).toHaveValue('6');
  await expect(preview(page)).toHaveAttribute('data-render-id', current.id);
  expect((await (await request.get(`/api/renders/${first.id}/pdf`)).body()).equals(bytes)).toBe(true);
  await tab(page, 'Books');
  await page.getByLabel('Find book').fill('classic.txt');
  await page.locator('.book-row.current').getByText('Kept versions', { exact: true }).click();
  await page.getByLabel('Version actions for Pocket original').click();
  await page.getByRole('button', { name: 'Stop keeping version', exact: true }).click();
  await expect
    .poll(async () => (await (await request.get(`/api/renders/${first.id}`)).json()).saved)
    .toBe(false);
  expect((await request.get(`/api/renders/${first.id}/download`)).ok()).toBe(true);
});

test('Apply & Download returns the newly displayed bytes without retaining a version', async ({
  page,
  request,
  context,
}) => {
  await page.goto('/');
  await upload(page);
  const initial = await ready(page);
  await page.getByLabel('Text size in CSS pixels').fill('8');
  const event = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Apply & Download', exact: true }).click();
  const download = await event;
  const rendered = await ready(page, request);
  expect(rendered.id).not.toBe(initial);
  expect(rendered.saved).toBe(false);
  expect(context.pages()).toHaveLength(1);
  expect(
    (await fs.readFile((await download.path())!)).equals(
      await (await request.get(`/api/renders/${rendered.id}/pdf`)).body(),
    ),
  ).toBe(true);
});

test('native PDF fallback stays inline and uses the matching Apply & Print result', async ({
  page,
  request,
  context,
}) => {
  await page.addInitScript(() => Object.defineProperty(navigator, 'pdfViewerEnabled', { get: () => false }));
  await page.goto('/');
  await upload(page);
  const initial = await ready(page);
  await page.getByLabel('Text size in CSS pixels').fill('7');
  await page.getByRole('button', { name: 'Apply & Print', exact: true }).click();
  const frame = page.getByTitle('Native PDF print controls');
  await expect(frame).toBeVisible();
  const url = (await frame.getAttribute('src'))!;
  expect(url).not.toContain(initial);
  const job = await (await request.get(url.replace(/\/pdf$/, ''))).json();
  expect(job.settings.fontSizePx).toBe(7);
  expect(job.saved).toBe(false);
  expect(context.pages()).toHaveLength(1);
  await page.getByRole('button', { name: 'Return to preview', exact: true }).click();
  await expect(frame).toHaveCount(0);
  await ready(page);
  await expect(preview(page)).toHaveAttribute('data-render-id', job.id);
});

test('failed and cancelled queued output never fires after Retry or changing documents', async ({
  page,
  context,
}) => {
  await page.addInitScript(() => Object.defineProperty(navigator, 'pdfViewerEnabled', { get: () => false }));
  await page.goto('/');
  await upload(page);
  await ready(page);
  let downloads = 0;
  page.on('download', () => downloads++);
  await page.route('**/api/documents/*/renders', (r) =>
    r.fulfill({ status: 500, json: { error: 'Output test failure' } }),
  );
  await page.getByLabel('Text size in CSS pixels').fill('8');
  await page.getByRole('button', { name: 'Apply & Download', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('Output test failure');
  await page.unroute('**/api/documents/*/renders');
  await page.getByRole('button', { name: 'Retry', exact: true }).click();
  await ready(page);
  expect(downloads).toBe(0);
  let held = false,
    release = () => {};
  const barrier = new Promise<void>((r) => {
    release = r;
  });
  await page.route('**/api/renders/*', async (route) => {
    if (route.request().method() !== 'GET') return route.continue();
    const response = await route.fetch();
    const job = await response.json();
    if (job.settings.fontSizePx === 9 && job.status === 'completed') {
      held = true;
      await barrier;
    }
    await route.fulfill({ response });
  });
  await page.getByLabel('Text size in CSS pixels').fill('9');
  await page.getByRole('button', { name: 'Apply & Print', exact: true }).click();
  await expect.poll(() => held).toBe(true);
  await upload(page, 'structured.epub');
  await ready(page);
  release();
  await expect(page.locator('.book-title')).toHaveText('A Little Journey');
  await expect(page.getByTitle('Native PDF print controls')).toHaveCount(0);
  expect(context.pages()).toHaveLength(1);
});
