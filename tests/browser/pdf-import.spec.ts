import { test, expect } from '@playwright/test';
import { PDFDocument, StandardFonts } from 'pdf-lib';
import { tab } from './helpers';
import type { Page, APIRequestContext } from '@playwright/test';
async function ready(page: Page, request?: APIRequestContext) {
  const preview = page.locator(
    '[aria-label="Print preview"]:visible, [aria-label="Reading preview"]:visible',
  );
  await expect(page.locator('.print-action')).toBeEnabled({ timeout: 90000 });
  await expect(preview).toHaveAttribute('aria-busy', 'false');
  const id = (await preview.getAttribute('data-render-id'))!;
  return request ? (await request.get(`/api/renders/${id}`)).json() : id;
}
async function sample() {
  const pdf = await PDFDocument.create();
  pdf.setTitle('PDF import sample');
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  for (let n = 1; n <= 19; n++)
    pdf.addPage([240, 360]).drawText(`SOURCE PAGE ${n}`, { x: 15, y: 180, size: 18, font });
  return Buffer.from(await pdf.save());
}
test('PDF pages retain their layout with disabled text modes, staging, ordering and booklet previews', async ({
  page,
  request,
}) => {
  await page.goto('/');
  await page
    .getByLabel('Import book', { exact: true })
    .setInputFiles({ name: 'sample.pdf', mimeType: 'application/pdf', buffer: await sample() });
  const first = await ready(page, request);
  expect(first.result.cells).toHaveLength(19);
  expect(first.result.pages).toBe(2);
  await expect(page.getByRole('button', { name: 'Basic', exact: true })).toBeDisabled();
  await expect(page.getByRole('button', { name: 'Rich', exact: true })).toBeDisabled();
  await expect(page.locator('.mode-control')).toHaveAttribute('title', /PDF pages keep/);
  await expect(page.getByLabel('Print font', { exact: true })).toHaveCount(0);
  await page.getByRole('combobox', { name: 'Size per PDF page', exact: true }).click();
  await page.getByRole('option', { name: '2 cells', exact: true }).click();
  await tab(page, 'Pages');
  const input = page.getByLabel('Position of Page 19', { exact: true });
  await input.fill('1');
  await input.press('Enter');
  await page.getByLabel('Include Page 2', { exact: true }).uncheck();
  await expect(page.locator('[data-render-id]:visible').first()).toHaveAttribute('data-render-id', first.id);
  await page.getByRole('button', { name: 'Apply', exact: true }).click();
  const second = await ready(page, request);
  expect(second.id).not.toBe(first.id);
  expect(second.result.cells[0].sectionId).toBe('p19');
  expect(second.result.cells).toHaveLength(18);
  expect(second.result.pages).toBe(3);
  await page
    .locator('.contents-row')
    .first()
    .getByRole('button', { name: /^Page 19 / })
    .click();
  await expect(page.getByRole('combobox', { name: 'Rotation of Page 19' })).toBeVisible();
  await expect(page.locator('.section-mini-preview canvas')).toBeVisible();
  await tab(page, 'Layout');
  await page.getByRole('combobox', { name: 'Print format', exact: true }).click();
  await page.getByRole('option', { name: 'Bound booklet', exact: true }).click();
  await page.getByRole('button', { name: 'Apply', exact: true }).click();
  const booklet = await ready(page, request);
  expect(booklet.result.booklet).toMatchObject({ contentPages: 18, pageCount: 20 });
  await expect(page.getByRole('button', { name: 'Reading', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Print sheets', exact: true }).click();
  await page.getByRole('button', { name: 'Reading', exact: true }).click();
  await expect(
    page.locator('[aria-label="Print preview"]:visible, [aria-label="Reading preview"]:visible'),
  ).toHaveAttribute('aria-busy', 'false');
  await tab(page, 'Pages');
  await page.getByRole('button', { name: /^Page 1 / }).click();
  await page.screenshot({ path: '.artifacts/pdf-pages-ui.png' });
  const output = await request.get(`/api/renders/${booklet.id}/pdf`);
  expect(output.ok()).toBe(true);
  expect((await PDFDocument.load(await output.body())).getPageCount()).toBe(booklet.result.pages);
  const reading = await request.get(`/api/renders/${booklet.id}/reading-pdf`);
  expect((await PDFDocument.load(await reading.body())).getPageCount()).toBe(20);
  expect((await request.get(`/api/renders/${booklet.id}/thumbnail`)).ok()).toBe(true);
  await page.reload();
  await ready(page);
  await tab(page, 'Layout');
  await expect(page.getByRole('button', { name: 'Basic', exact: true })).toBeDisabled();
  await expect(page.getByRole('combobox', { name: 'Print format', exact: true })).toHaveText('Bound booklet');
});
