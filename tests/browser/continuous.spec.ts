import fs from 'node:fs/promises';
import { test, expect } from '@playwright/test';
import { preview, ready, upload, jump, tab } from './helpers';

test('continuous sheets expose selectable text, full-document search and bounded canvases', async ({
  page,
  request,
}) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  let renders = 0;
  page.on('request', (r) => {
    if (r.method() === 'POST' && /\/renders$/.test(r.url())) renders++;
  });
  await page.goto('/');
  await page.getByLabel('Import book', { exact: true }).setInputFiles({
    name: 'Long viewer.txt',
    mimeType: 'text/plain',
    buffer: Buffer.from((await fs.readFile('tests/fixtures/classic-duplex.txt', 'utf8')).repeat(4)),
  });
  const job = await ready(page, request);
  const view = preview(page),
    viewport = view.locator('.pdf-viewport');
  await expect(view.locator('.page')).toHaveCount(job.result.pages);
  await expect(
    view.locator('.page[data-page-number="1"] .textLayer span:not(.markedContent)').first(),
  ).toBeVisible();
  const copied = await view.locator('.page[data-page-number="1"] .textLayer').evaluate((node) => {
    const r = document.createRange();
    r.selectNodeContents(node);
    const s = getSelection()!;
    s.removeAllRanges();
    s.addRange(r);
    return s.toString();
  });
  expect(copied.length).toBeGreaterThan(100);
  await page.keyboard.press('Control+f');
  await expect(page.getByRole('search', { name: 'Find in PDF', exact: true })).toBeVisible();
  const query = copied.match(/[A-Za-z]{7,}/)![0];
  await page.getByRole('searchbox', { name: 'Find in PDF', exact: true }).fill(query);
  await expect(page.getByRole('button', { name: 'Next match', exact: true })).toBeEnabled();
  await expect(view.locator('.highlight').first()).toBeVisible();
  await page.getByRole('button', { name: 'Next match', exact: true }).click();
  await page.getByRole('button', { name: 'Previous match', exact: true }).click();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('search', { name: 'Find in PDF', exact: true })).toHaveCount(0);
  for (let side = 1; side <= job.result.pages; side++) await jump(page, side);
  await expect.poll(() => view.locator('canvas').count()).toBeLessThanOrEqual(5);
  await jump(page, 2);
  await page.reload();
  await ready(page);
  await expect(page.getByLabel('Printed side', { exact: true })).toHaveValue('2');
  await expect.poll(() => viewport.evaluate((el) => el.scrollTop)).toBeGreaterThan(0);
  await viewport.evaluate((el) => {
    el.scrollTop = 0;
  });
  await expect(page.getByLabel('Printed side', { exact: true })).toHaveValue('1');
  await upload(page, 'two-cell-images.epub');
  const rich = await ready(page, request);
  expect(rich.result.pages).toBeGreaterThan(1);
  for (let i = 1; i <= rich.result.pages; i++) await jump(page, i);
  await expect.poll(() => preview(page).locator('canvas').count()).toBeLessThanOrEqual(5);
  expect(
    await preview(page)
      .locator('canvas')
      .evaluateAll((nodes) =>
        nodes.every((n) => (n as HTMLCanvasElement).width * (n as HTMLCanvasElement).height <= 16_000_000),
      ),
  ).toBe(true);
  await tab(page, 'Layout');
  await page.getByRole('button', { name: 'Basic', exact: true }).click();
  await ready(page);
  await expect.poll(() => page.locator('[aria-label="Print preview"][hidden] canvas').count()).toBe(0);
  expect(renders).toBe(3);
  expect(errors).toEqual([]);
});
