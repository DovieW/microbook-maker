import { test, expect } from '@playwright/test';
import { applied, preview, ready, tab, upload } from './helpers';

test('five layouts stage until Apply, reserve physical cells and inherit defaults', async ({
  page,
  request,
}) => {
  await page.goto('/');
  await upload(page, 'two-cell-images.epub');
  const initial = await ready(page, request);
  const doc = await (await request.get(`/api/documents/${initial.documentId}`)).json();
  const images = doc.blocks.filter((b: any) => b.kind === 'image' && !b.imageHeading);
  const owner = (job: any, id: string) =>
    job.result.cells.find((c: any) => c.blockIds.includes(id) && c.continuationOf === undefined);
  await tab(page, 'Content');
  await page.locator('.image-defaults > summary').click();
  await expect(page.getByRole('combobox', { name: 'Default image layout', exact: true })).toHaveText(
    'Inline',
  );
  await expect(page.getByLabel('Two-cell images', { exact: true })).toHaveCount(0);
  await page.getByRole('button', { name: 'Image 1 details', exact: true }).click();
  const choose = async (name: string) => {
    await page.getByRole('combobox', { name: 'Image layout', exact: true }).click();
    await page.getByRole('option', { name, exact: true }).click();
  };
  await choose('Full four cells');
  await expect(preview(page)).toHaveAttribute('data-render-id', initial.id);
  await applied(page);
  const four = await ready(page, request);
  const first = owner(four, images[0].id);
  expect(first.span).toBe(4);
  const reserved = four.result.cells.filter((c: any) => c.continuationOf === first.index);
  expect(reserved).toHaveLength(3);
  expect(reserved.map((c: any) => c.slot).sort((a: number, b: number) => a - b)).toEqual([
    first.slot + 1,
    first.slot + 4,
    first.slot + 5,
  ]);
  expect(reserved.every((c: any) => c.page === first.page && c.blockIds.includes(images[0].id))).toBe(true);
  // Row-order cells beside the upper half remain available for content.
  expect(four.result.cells[first.index + 2].continuationOf).toBeUndefined();
  expect(four.result.cells[first.index + 2].blockIds.length).toBeGreaterThan(0);
  expect(four.result.coverage.complete).toBe(true);
  expect(four.result.coverage.overflows).toBe(0);
  await page.reload();
  await ready(page);
  await tab(page, 'Content');
  await expect(page.getByRole('combobox', { name: 'Image layout', exact: true })).toHaveText(
    'Full four cells',
  );
  await choose('Full cell');
  await page.locator('.image-defaults > summary').click();
  await expect(page.getByLabel('Fill unused image space with text', { exact: true })).toBeChecked();
  await page.getByLabel('Fill unused image space with text', { exact: true }).uncheck();
  await page.locator('.image-defaults > summary').click();
  await applied(page);
  const single = await ready(page, request);
  const cell = owner(single, images[0].id);
  expect(cell.span).toBeUndefined();
  const caption = doc.blocks.find((b: any) => b.captionFor === images[0].id);
  expect(cell.blockIds).toEqual([images[0].id, caption.id]);
  expect(single.result.coverage.overflows).toBe(0);
  await choose('Flourish');
  await applied(page);
  const flourish = await ready(page, request);
  expect(
    flourish.result.imageRegions.find((r: any) => r.blockId === images[0].id).height,
  ).toBeLessThanOrEqual(flourish.settings.fontSizePx * 3 * 0.75);
  await choose('Inline');
  await applied(page);
  const inline = await ready(page, request);
  expect(owner(inline, images[0].id).span).toBeUndefined();
  await page.locator('.image-defaults > summary').click();
  await page.getByRole('combobox', { name: 'Default image layout', exact: true }).click();
  await page.getByRole('option', { name: 'Full two cells', exact: true }).click();
  await choose('Use book default');
  await applied(page);
  const two = await ready(page, request);
  expect(owner(two, images[0].id).span).toBe(2);
  expect(two.settings.imageTreatments[images[0].id]).toBeUndefined();
  await page.getByRole('combobox', { name: 'Default image layout', exact: true }).click();
  await page.getByRole('option', { name: 'Full four cells', exact: true }).click();
  await tab(page, 'Layout');
  await page.getByRole('combobox', { name: 'Reading order', exact: true }).click();
  await page.getByRole('option', { name: 'By quadrant', exact: true }).click();
  await applied(page);
  const quadrants = await ready(page, request);
  for (const cell of quadrants.result.cells.filter((c: any) => c.span === 4)) {
    expect(cell.slot % 2).toBe(0);
    expect(Math.floor(cell.slot / 4) % 2).toBe(0);
    expect(quadrants.result.cells.filter((c: any) => c.continuationOf === cell.index)).toHaveLength(3);
  }
  expect(quadrants.result.coverage.complete).toBe(true);
  expect(quadrants.result.coverage.overflows).toBe(0);
  await tab(page, 'Content');
  await page.locator('.image-defaults > summary').click();
  await page.getByRole('combobox', { name: 'Default image layout', exact: true }).click();
  await page.getByRole('option', { name: 'Full cell', exact: true }).click();
  await applied(page);
  const fullCells = await ready(page, request);
  for (const image of images) {
    const cell = owner(fullCells, image.id);
    expect(cell.span).toBeUndefined();
    expect(cell.sheetLabel).toBeUndefined();
    expect(
      cell.blockIds.every(
        (id: string) => id === image.id || doc.blocks.find((b: any) => b.id === id)?.captionFor === image.id,
      ),
    ).toBe(true);
  }
  expect(fullCells.result.coverage.complete).toBe(true);
  expect(fullCells.result.coverage.overflows).toBe(0);
});
