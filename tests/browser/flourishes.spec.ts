import { test, expect } from '@playwright/test';
import { upload, ready, tab, applied, preview } from './helpers';
test('repeated flourishes preserve source placement, bulk controls, overrides, and cached PDFs', async ({
  page,
  request,
}) => {
  await page.goto('/');
  await upload(page, 'flourishes.epub');
  await ready(page);
  await tab(page, 'Images');
  await page.getByText('Defaults', { exact: true }).click();
  await page.getByRole('checkbox', { name: 'Two-cell images', exact: true }).check();
  await applied(page);
  const original = await ready(page, request);
  await page.getByText('Repeated images', { exact: true }).click();
  await page.getByRole('button', { name: 'Use as flourishes', exact: true }).click();
  await expect(preview(page)).toHaveAttribute('data-render-id', original.id);
  await applied(page);
  const compact = await ready(page, request);
  expect(compact.result.pages).toBeLessThan(original.result.pages);
  expect(compact.result.coverage.complete).toBe(true);
  expect(compact.result.coverage.overflows).toBe(0);
  expect(compact.result.imageRegions).toHaveLength(20);
  const doc = await (await request.get(`/api/documents/${compact.documentId}`)).json();
  const images = doc.blocks.filter((b: any) => b.kind === 'image');
  for (const image of images) {
    const region = compact.result.imageRegions.find((r: any) => r.blockId === image.id);
    expect(region.width).toBeCloseTo(18, 1);
    expect(region.width / region.height).toBeCloseTo(27 / 14, 1);
    const cells = compact.result.cells.filter((c: any) => c.blockIds.includes(image.id));
    expect(cells).toHaveLength(1);
    expect(cells[0].span).toBeUndefined();
    const i = doc.blocks.findIndex((b: any) => b.id === image.id);
    const prev = compact.result.cells.findIndex((c: any) => c.blockIds.includes(doc.blocks[i - 1].id));
    const next = compact.result.cells.findIndex((c: any) => c.blockIds.includes(doc.blocks[i + 1].id));
    expect(cells[0].index).toBeGreaterThanOrEqual(prev);
    expect(cells[0].index).toBeLessThanOrEqual(next);
  }
  await page.getByRole('button', { name: 'Show image 1', exact: true }).click();
  await page.getByLabel('Flourish width', { exact: true }).fill('6');
  await applied(page);
  const changed = await ready(page, request);
  expect(changed.result.imageRegions[0].width).toBeCloseTo(((18 * 27) / 14) * 0.75, 1);
  expect(changed.result.imageRegions[1].width).toBeCloseTo(18, 1);
  await page.getByText('20 matching images', { exact: true }).click();
  await page.getByRole('button', { name: 'Apply treatment to all 20', exact: true }).click();
  await page.getByRole('button', { name: 'Exclude all matching', exact: true }).click();
  await applied(page);
  expect((await ready(page, request)).result.imageRegions).toHaveLength(0);
  await page.getByRole('button', { name: 'Include all matching', exact: true }).click();
  await applied(page);
  const restored = await ready(page, request);
  expect(restored.result.imageRegions).toHaveLength(20);
  await page.reload();
  await ready(page);
  await tab(page, 'Images');
  await expect(page.getByLabel('Flourish width', { exact: true })).toHaveValue('6');
  await page.getByLabel('Include image 1', { exact: true }).uncheck();
  await applied(page);
  const excluded = await ready(page, request);
  expect(excluded.result.imageRegions).toHaveLength(19);
  await page.getByLabel('Include image 1', { exact: true }).check();
  await applied(page);
  expect((await ready(page, request)).id).toBe(restored.id);
});
