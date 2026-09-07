import { test, expect } from '@playwright/test';
import fs from 'node:fs/promises';
import { preview, ready, tab, upload, jump, applied } from './helpers';
const reports = process.env.MB_REPORT_DIR || 'test-results';

test('compact frame, remembered drafts, Revert, exact download without retention, and Books', async ({
  page,
  request,
}) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto('/');
  await expect(page.getByRole('tabpanel', { name: 'History', exact: true })).toBeVisible();
  await upload(page);
  const initial = await ready(page, request);
  await expect(page.getByRole('button', { name: 'Basic', exact: true })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  await expect(page.locator('.header')).toHaveCSS('height', '48px');
  await expect(page.locator('.statusbar')).toHaveCSS('height', '40px');
  await expect(page.getByRole('button', { name: 'Apply', exact: true })).toBeDisabled();
  await expect(page.getByLabel('Document actions', { exact: true })).toHaveCount(0);
  const centers = await page.locator('.statusbar').evaluate((el) => {
    const bar = el.getBoundingClientRect();
    return [...el.children].map((child) => {
      const rect = child.getBoundingClientRect();
      return Math.abs(rect.y + rect.height / 2 - (bar.y + bar.height / 2));
    });
  });
  expect(centers.every((offset) => offset <= 1)).toBe(true);

  await expect(page.getByLabel('Workspace sidebar', { exact: true })).toHaveCSS('width', '280px');
  const first = preview(page).locator('.page').first();
  expect((await first.boundingBox())!.y).toBeGreaterThanOrEqual(56);
  expect((await first.boundingBox())!.y).toBeLessThanOrEqual(60);
  await page.getByLabel('Text size in CSS pixels').fill('8');
  await page.reload();
  await expect(page.getByLabel('Text size in CSS pixels')).toHaveValue('8');
  await expect(preview(page)).toHaveAttribute('data-render-id', initial.id);
  await expect(page.getByRole('button', { name: 'Apply & Print', exact: true })).toBeEnabled();
  await page.getByRole('button', { name: 'Revert changes', exact: true }).click();
  await ready(page);
  await expect(page.getByLabel('Text size in CSS pixels')).toHaveValue('6');
  await page.getByLabel('Text size in CSS pixels').fill('8');
  await applied(page);
  const rendered = await ready(page, request);
  expect(rendered.id).not.toBe(initial.id);
  const event = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Download PDF', exact: true }).click();
  const download = await event;
  expect(
    (await fs.readFile((await download.path())!)).equals(
      await (await request.get(`/api/renders/${rendered.id}/pdf`)).body(),
    ),
  ).toBe(true);
  expect((await (await request.get(`/api/renders/${rendered.id}`)).json()).saved).toBe(false);
  await page.screenshot({ path: `${reports}/workspace-desktop.png` });
  await tab(page, 'Books');
  await page.getByLabel('Find book').fill('classic.txt');
  const row = page
    .locator('.book-row')
    .filter({ has: page.getByRole('button', { name: 'classic.txt TXT', exact: true }) })
    .first();
  await expect(row).toBeVisible();
  await expect(row.locator('.book-layouts')).toContainText('Basic');
  expect(errors).toEqual([]);
});

test('Contents separates search, jumps and inclusion; mobile drawer closes on navigation', async ({
  page,
  request,
}) => {
  await page.goto('/');
  await upload(page, 'structured.epub');
  const original = await ready(page, request);
  await expect(page.getByRole('checkbox', { name: 'Space at folds', exact: true })).toBeChecked();
  await expect(page.getByRole('combobox', { name: 'Fold lines', exact: true })).toHaveText('Solid');
  await page.getByRole('combobox', { name: 'Print font', exact: true }).click();
  await page.getByRole('option', { name: 'Times New Roman', exact: true }).click();
  await page.getByText('Paragraphs', { exact: true }).click();
  await expect(page.getByRole('combobox', { name: 'Paragraphs', exact: true })).toHaveText('Continuous');
  await page.getByLabel('Indent', { exact: true }).fill('0.5');
  await tab(page, 'Contents');
  await page.getByRole('button', { name: 'Deselect all', exact: true }).click();
  await expect(page.getByRole('checkbox', { name: 'Include Home', exact: true })).not.toBeChecked();
  await page.getByRole('button', { name: 'Select all', exact: true }).click();
  await expect(page.getByRole('checkbox', { name: 'Include Home', exact: true })).toBeChecked();
  expect(await page.locator('.sidebar-body').evaluate((el) => el.scrollWidth <= el.clientWidth)).toBe(true);
  await page.getByLabel('Find section').fill('Home');
  await expect(page.locator('.contents-row')).toHaveCount(1);
  await page.getByRole('checkbox', { name: 'Include Home', exact: true }).uncheck();
  await expect(preview(page)).toHaveAttribute('data-render-id', original.id);
  await page.getByLabel('Find section').fill('');
  await expect(page.getByRole('checkbox', { name: 'Include Home', exact: true })).not.toBeChecked();
  await applied(page);
  await ready(page);
  await expect(
    page
      .locator('.contents-row')
      .filter({ has: page.getByRole('checkbox', { name: 'Include Home', exact: true }) }),
  ).toContainText('Not in preview');
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await tab(page, 'Contents');
  await page.locator('.contents-jump:enabled').first().click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Open tools', exact: true })).toBeFocused();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: `${reports}/workspace-narrow.png` });
  await upload(page, 'structured.epub');
  await ready(page);
  await tab(page, 'Contents');
  await expect(page.getByRole('checkbox', { name: 'Include Home', exact: true })).toBeChecked();
  await tab(page, 'Layout');
  await page.getByRole('button', { name: 'Basic', exact: true }).click();
  await ready(page);
  await expect(page.getByRole('tab', { name: 'Contents', exact: true })).toHaveCount(0);
  await expect(page.getByRole('tab', { name: 'Images', exact: true })).toHaveCount(0);
});

test('cancellation, retry progress and removal remain separate actions', async ({ page }) => {
  await page.goto('/');
  await page.getByLabel('Import book', { exact: true }).setInputFiles({
    name: 'Cancellation.txt',
    mimeType: 'text/plain',
    buffer: Buffer.from((await fs.readFile('tests/fixtures/classic.txt', 'utf8')).repeat(18)),
  });
  await page.getByRole('button', { name: 'Cancel', exact: true }).click();
  await page.getByRole('button', { name: 'Retry', exact: true }).click();
  await expect(page.getByRole('progressbar')).toBeVisible();
  await expect
    .poll(async () => Number(await page.getByRole('progressbar').getAttribute('value')))
    .toBeGreaterThan(0);
  await page.screenshot({ path: `${reports}/processing.png` });
  await ready(page);
  await tab(page, 'Books');
  await page.getByLabel('Find book').fill('Cancellation');
  await page
    .locator('.book-row.current')
    .getByLabel('Book actions for Cancellation', { exact: true })
    .click();
  await page.getByRole('button', { name: 'Remove book', exact: true }).click();
  await expect(page.locator('.books-pane .book-row.current')).toHaveCount(0);
  await expect(preview(page)).toHaveCount(0);
});

test('failed Apply and stale replies preserve the selected PDF; explicit metadata lookup respects manual fields', async ({
  page,
}) => {
  await page.goto('/');
  await upload(page);
  const original = await ready(page);
  await page.route('**/api/documents/*/renders', (r) =>
    r.fulfill({ status: 500, json: { error: 'Deliberate test failure' } }),
  );
  await page.getByLabel('Text size in CSS pixels').fill('7');
  await applied(page);
  await expect(page.getByRole('alert')).toContainText('Deliberate test failure');
  await expect(preview(page)).toHaveAttribute('data-render-id', original);
  await page.unroute('**/api/documents/*/renders');
  let release = () => {},
    held = false;
  const barrier = new Promise<void>((resolve) => {
    release = resolve;
  });
  await page.route('**/api/documents/*/renders', async (route) => {
    const response = await route.fetch();
    if (!held) {
      held = true;
      await barrier;
    }
    await route.fulfill({ response });
  });
  await page.getByRole('button', { name: 'Retry', exact: true }).click();
  await expect.poll(() => held).toBe(true);
  await upload(page, 'structured.epub');
  await ready(page);
  release();
  await expect(page.locator('.book-title')).toHaveText('A Little Journey');
  await page.getByText('Book details', { exact: true }).click();
  await page.getByLabel('Author', { exact: true }).fill('My chosen author');
  await page.route('**/api/metadata/lookup?*', (r) =>
    r.fulfill({ json: [{ title: 'Different title', author: 'Other author', year: '1900' }] }),
  );
  await page.getByRole('button', { name: 'Look up metadata' }).click();
  await page.getByRole('button', { name: 'Use missing fields' }).click();
  await expect(page.getByLabel('Author', { exact: true })).toHaveValue('My chosen author');
  await expect(page.getByLabel('Title', { exact: true })).toHaveValue('A Little Journey');
  await expect(page.getByLabel('Year', { exact: true })).toHaveValue('1900');
  await page.getByLabel('Line height', { exact: true }).fill('0');
  await expect(page.getByLabel('Line height', { exact: true })).toHaveValue('1');
});

test('printed-side input reaches the partial final side and Apply retains source position', async ({
  page,
  request,
}) => {
  await page.goto('/');
  await page.getByLabel('Import book', { exact: true }).setInputFiles({
    name: 'Partial side.txt',
    mimeType: 'text/plain',
    buffer: Buffer.from((await fs.readFile('tests/fixtures/classic.txt', 'utf8')).repeat(3)),
  });
  const original = await ready(page, request);
  await expect(page.getByLabel('Previous', { exact: true })).toBeDisabled();
  await jump(page, 2);
  await expect(page.getByLabel('Next', { exact: true })).toBeDisabled();
  const offset = original.result.cells[16].readingStart;
  await page.getByLabel('Text size in CSS pixels').fill('4');
  await applied(page);
  const rendered = await ready(page, request);
  const side = Number(await page.getByLabel('Printed side', { exact: true }).inputValue()) - 1;
  const selected = rendered.result.cells.filter((c: any) => c.page === side);
  expect(selected[0].readingStart).toBeLessThanOrEqual(offset);
  expect(selected.at(-1).readingEnd).toBeGreaterThan(offset);
  await page.getByLabel('Printed side', { exact: true }).fill('0');
  await page.getByLabel('Printed side', { exact: true }).press('Enter');
  await expect(page.getByLabel('Printed side', { exact: true })).toHaveValue('1');
  await page.getByLabel('Printed side', { exact: true }).fill('999');
  await page.getByLabel('Printed side', { exact: true }).press('Escape');
  await expect(page.getByLabel('Printed side', { exact: true })).toHaveValue('1');
});

test('Books shows connection errors with Retry and searches original filenames', async ({ page }) => {
  await page.route('**/api/documents', async (route) =>
    route.request().method() === 'GET' ? route.abort('connectionreset') : route.continue(),
  );
  await page.goto('/');
  const books = page.getByRole('tabpanel', { name: 'History', exact: true });
  await expect(books.getByRole('alert')).toContainText('Cannot reach the server');
  await expect(books.getByText('No books yet')).toHaveCount(0);
  await page.unroute('**/api/documents');
  await books.getByRole('button', { name: 'Retry', exact: true }).click();
  await expect(books.getByRole('alert')).toHaveCount(0);
  await expect(books.getByRole('status')).toHaveCount(0);
});

test('Rich heading controls persist without affecting Basic defaults', async ({ page, request }) => {
  await page.goto('/');
  await upload(page, 'publisher-alternatives.epub');
  await ready(page);
  await page.getByLabel('Position headers', { exact: true }).uncheck();
  await page.getByText('Headings', { exact: true }).click();
  await page.getByLabel('Chapter size', { exact: true }).fill('0.95');
  await page.getByLabel('Part size', { exact: true }).fill('1.2');
  await page.getByLabel('Chapter spacing', { exact: true }).fill('0');
  await page.getByLabel('Part spacing', { exact: true }).fill('0.05');
  await page.getByLabel('Heading rules', { exact: true }).uncheck();
  await page.reload();
  await expect(page.getByRole('button', { name: 'Apply & Print', exact: true })).toBeEnabled();
  await page.getByText('Headings', { exact: true }).click();
  await expect(page.getByLabel('Chapter size', { exact: true })).toHaveValue('0.95');
  await expect(page.getByLabel('Part size', { exact: true })).toHaveValue('1.2');
  await applied(page);
  const job = await ready(page, request);
  expect(job.settings).toMatchObject({
    mode: 'book',
    chapterHeadingScale: 0.95,
    partHeadingScale: 1.2,
    chapterHeadingGapEm: 0,
    partHeadingGapEm: 0.05,
    headingRules: false,
    positionHeaders: false,
    fontSizePx: 6,
  });
  await page.getByRole('button', { name: 'Basic', exact: true }).click();
  await ready(page);
  await expect(page.getByLabel('Position headers', { exact: true })).toHaveCount(0);
  await expect(page.getByLabel('Chapter size', { exact: true })).toHaveCount(0);
});
