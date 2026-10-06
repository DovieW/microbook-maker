import { test, expect } from '@playwright/test';
import { preview, ready, tab, upload } from './helpers';

test('blurs book content immediately, remembers the mode, and keeps the PDF and controls intact', async ({
  page,
  request,
}) => {
  await page.goto('/');
  await upload(page, 'structured.epub');
  const initial = await ready(page, request);
  const pdfBefore = await (await request.get(`/api/renders/${initial.id}/pdf`)).body();
  const renders: string[] = [];
  page.on('request', (r) => {
    if (r.method() === 'POST' && new URL(r.url()).pathname.endsWith('/renders')) renders.push(r.url());
  });
  const toggle = page.getByRole('button', { name: 'Spoiler-free mode', exact: true });
  await expect(toggle).toHaveAttribute('aria-pressed', 'false');
  await toggle.click();
  await expect(toggle).toHaveAttribute('aria-pressed', 'true');
  await expect(preview(page).locator('.canvasWrapper').first()).toHaveCSS('filter', 'blur(12px)');
  await expect(page.getByRole('button', { name: 'Apply', exact: true })).toBeDisabled();
  await expect(page.getByRole('button', { name: 'Print', exact: true })).toHaveCSS('filter', 'none');
  await tab(page, 'Content');
  const row = page
    .locator('.contents-row')
    .filter({ has: page.getByRole('checkbox', { name: 'Include Home', exact: true }) });
  await expect(row.locator('.contents-jump > span')).toHaveCSS('filter', 'blur(6px)');
  await expect(row.locator('.contents-jump > small')).toHaveCSS('filter', 'none');
  await row.locator('.contents-jump').click();
  await row.getByText('Inspect source content', { exact: true }).click();
  const source = row.locator('.section-source-body > p:not(.section-source-description)').first();
  await expect(source).toHaveCSS('filter', 'blur(6px)');
  await expect(row.getByText('Inspect source content', { exact: true })).toHaveCSS('filter', 'none');
  await expect(row.locator('.section-mini-preview canvas')).toHaveCSS('filter', 'blur(12px)');
  const download = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Download PDF', exact: true }).click();
  expect(await (await download).failure()).toBeNull();
  const pdfAfter = await (await request.get(`/api/renders/${initial.id}/pdf`)).body();
  expect(pdfAfter.equals(pdfBefore)).toBe(true);
  await expect(preview(page)).toHaveAttribute('data-render-id', initial.id);
  await page.reload();
  await ready(page);
  await expect(toggle).toHaveAttribute('aria-pressed', 'true');
  await expect(preview(page).locator('.canvasWrapper').first()).toHaveCSS('filter', 'blur(12px)');
  await page.setViewportSize({ width: 390, height: 844 });
  await page.keyboard.press('Escape');
  await expect(toggle).toBeVisible();
  expect(await page.locator('.header').evaluate((el) => el.scrollWidth <= el.clientWidth)).toBe(true);
  await toggle.click();
  await expect(toggle).toHaveAttribute('aria-pressed', 'false');
  await expect(preview(page).locator('.canvasWrapper').first()).toHaveCSS('filter', 'none');
  expect(renders).toEqual([]);
});
