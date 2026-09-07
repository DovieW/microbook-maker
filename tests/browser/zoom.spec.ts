import { test, expect } from '@playwright/test';
import { preview, ready, upload, jump } from './helpers';

test('zoom, sidebar sizing and reading position persist without changing the PDF', async ({ page }) => {
  let renders = 0;
  page.on('request', (r) => {
    if (r.method() === 'POST' && /\/renders$/.test(r.url())) renders++;
  });
  await page.goto('/');
  await upload(page, 'classic-duplex.txt');
  await ready(page);
  const viewer = preview(page),
    paper = viewer.locator('.page').first();
  const fit = async () => {
    await expect
      .poll(() =>
        viewer.evaluate((node) => {
          const v = node.querySelector('.pdf-viewport')!;
          const p = node.querySelector('.page')!;
          return Math.abs(p.getBoundingClientRect().width - v.clientWidth);
        }),
      )
      .toBeLessThan(3);
  };
  await fit();
  await jump(page, 2);
  await page.getByRole('button', { name: 'Actual size (100%)', exact: true }).click();
  await expect.poll(async () => (await paper.boundingBox())!.width).toBe(816);
  const resizer = page.getByRole('separator', { name: 'Resize sidebar' });
  await resizer.focus();
  await page.keyboard.press('ArrowRight');
  await expect(resizer).toHaveAttribute('aria-valuenow', '290');
  await expect(page.getByLabel('Printed side', { exact: true })).toHaveValue('2');
  await expect.poll(async () => (await paper.boundingBox())!.width).toBe(816);
  await expect(page.getByRole('button', { name: 'Collapse sidebar' })).toHaveCount(0);
  await expect(paper).toHaveCSS('width', '816px');
  await page.reload();
  await ready(page);
  await expect(page.getByRole('button', { name: 'Expand sidebar' })).toHaveCount(0);
  await expect(page.getByLabel('Printed side', { exact: true })).toHaveValue('2');
  await expect(paper).toHaveCSS('width', '816px');
  await expect(resizer).toHaveAttribute('aria-valuenow', '290');
  await resizer.dblclick();
  await expect(resizer).toHaveAttribute('aria-valuenow', '280');
  await page.getByRole('button', { name: 'Fit to width', exact: true }).click();
  await fit();
  await page.getByRole('tab', { name: 'Layout', exact: true }).focus();
  await page.keyboard.press('ArrowRight');
  await expect(page.getByRole('tab', { name: 'Layout', exact: true })).toBeFocused();
  await page.keyboard.press('Home');
  await expect(page.getByRole('tab', { name: 'Layout', exact: true })).toBeFocused();
  const size = page.getByLabel('Text size in CSS pixels');
  await size.focus();
  expect(
    await size.evaluate((node) => ({
      input: getComputedStyle(node).outlineStyle,
      control: getComputedStyle(node.parentElement!).outlineStyle,
      width: getComputedStyle(node.parentElement!).outlineWidth,
    })),
  ).toEqual({ input: 'none', control: 'solid', width: '2px' });
  await page.screenshot({ path: `${process.env.MB_REPORT_DIR || 'test-results'}/zoom-and-focus.png` });
  await page.setViewportSize({ width: 390, height: 844 });
  await fit();
  await page.getByRole('button', { name: 'Actual size (100%)', exact: true }).click();
  await expect(paper).toHaveCSS('width', '816px');
  expect(renders).toBe(1);
});
