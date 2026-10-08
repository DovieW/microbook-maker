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
test('hosted PDF import and booklet generation stay in-browser', async ({ page }) => {
  test.skip(!process.env.MB_HOSTED_TEST, 'Run against the built hosted frontend harness');
  const pdf = await PDFDocument.create();
  pdf.setTitle('Hosted PDF sample');
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  for (let i = 1; i <= 5; i++)
    pdf.addPage([240, 360]).drawText(`PDF SOURCE ${i}`, { x: 20, y: 160, font, size: 20 });
  let cloudRequests = 0;
  page.on('request', (request) => {
    if (request.url().includes('/_cloud/print')) cloudRequests++;
  });
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('/');
  await page
    .getByLabel('Import book', { exact: true })
    .setInputFiles({
      name: 'sample.pdf',
      mimeType: 'application/pdf',
      buffer: Buffer.from(await pdf.save()),
    });
  await ready(page);
  await expect(page.getByRole('button', { name: 'Basic', exact: true })).toBeDisabled();
  await page.getByRole('combobox', { name: 'Print format', exact: true }).click();
  await page.getByRole('option', { name: 'Bound booklet', exact: true }).click();
  await page.getByRole('button', { name: 'Apply', exact: true }).click();
  const id = await ready(page);
  const job = await page.evaluate(async (id) => (await fetch(`/api/renders/${id}`)).json(), id);
  expect(job.result.booklet).toMatchObject({ contentPages: 5, pageCount: 8 });
  await expect(page.getByRole('button', { name: 'Reading', exact: true })).toBeVisible();
  await tab(page, 'Pages');
  await page.getByRole('button', { name: /^Page 3 / }).click();
  await expect(page.locator('.section-mini-preview canvas')).toBeVisible();
  const bytes = await page.evaluate(
    async (id) => Array.from(new Uint8Array(await (await fetch(`/api/renders/${id}/pdf`)).arrayBuffer())),
    id,
  );
  expect((await PDFDocument.load(new Uint8Array(bytes))).getPageCount()).toBe(2);
  const downloadEvent = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Download PDF', exact: true }).click();
  expect((await downloadEvent).suggestedFilename()).toMatch(/\.pdf$/);
  await page.screenshot({ path: '.artifacts/pdf-hosted-ui.png' });
  await page.reload();
  await ready(page);
  await tab(page, 'Layout');
  await expect(page.getByRole('button', { name: 'Rich', exact: true })).toBeDisabled();
  expect(cloudRequests).toBe(0);
  expect(errors).toEqual([]);
});
