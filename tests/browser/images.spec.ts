import { test, expect } from '@playwright/test';
import { preview, ready, upload, tab, applied } from './helpers';

test('image inclusion applies, persists, restores cached bytes and stays with its document', async ({
  page,
  request,
}) => {
  await page.goto('/');
  await upload(page, 'two-cell-images.epub');
  const original = await ready(page, request);
  const doc = await (await request.get(`/api/documents/${original.documentId}`)).json();
  const images = doc.blocks.filter((b: any) => b.kind === 'image' && !b.imageHeading);
  await tab(page, 'Images');
  await expect(page.locator('.image-choice')).toHaveCount(images.length);
  await expect
    .poll(() =>
      page
        .locator('.image-choice img')
        .first()
        .evaluate((img: HTMLImageElement) => img.naturalWidth),
    )
    .toBeGreaterThan(0);
  await page.getByLabel('Include image 1', { exact: true }).uncheck();
  await expect(preview(page)).toHaveAttribute('data-render-id', original.id);
  await page.reload();
  await expect(page.getByRole('button', { name: 'Apply & Print', exact: true })).toBeEnabled();
  await tab(page, 'Images');
  await expect(page.getByLabel('Include image 1', { exact: true })).not.toBeChecked();
  await applied(page);
  const next = await ready(page, request);
  expect(next.settings.excludedImageIds).toEqual([images[0].id]);
  expect(next.result.cells.some((c: any) => c.blockIds.includes(images[0].id))).toBe(false);
  expect(next.result.cells.some((c: any) => c.blockIds.includes(images[1].id))).toBe(true);
  await page.getByLabel('Include image 1', { exact: true }).check();
  await applied(page);
  expect((await ready(page, request)).id).toBe(original.id);
  await page.getByLabel('Include image 1', { exact: true }).uncheck();
  await upload(page, 'publisher-alternatives.epub');
  await ready(page);
  await tab(page, 'Images');
  await expect(page.getByLabel('Include image 1', { exact: true })).toBeChecked();
  await expect(page.locator('.image-choice')).toHaveCount(4);
});

test('selected image controls override and reset the global one/two-cell layout', async ({
  page,
  request,
}) => {
  await page.goto('/');
  await upload(page, 'two-cell-images.epub');
  const original = await ready(page, request);
  const doc = await (await request.get(`/api/documents/${original.documentId}`)).json();
  const images = doc.blocks.filter((b: any) => b.kind === 'image' && !b.imageHeading);
  const span = (j: any, id: string) =>
    j.result.cells.find((c: any) => c.blockIds.includes(id) && c.continuationOf === undefined)?.span || 1;
  await tab(page, 'Images');
  await page.getByRole('button', { name: 'Image 1 details', exact: true }).click();
  await page.getByLabel('Two cells for image 1', { exact: true }).check();
  await expect(page.getByLabel('Two cells for image 2', { exact: true })).toHaveCount(0);
  await applied(page);
  const mixed = await ready(page, request);
  expect(span(mixed, images[0].id)).toBe(2);
  expect(span(mixed, images[1].id)).toBe(1);
  await page.reload();
  await ready(page);
  await tab(page, 'Images');
  await expect(page.getByLabel('Two cells for image 1', { exact: true })).toBeChecked();
  await page.locator('.image-defaults summary').click();
  await page.getByLabel('Two-cell images', { exact: true }).check();
  await page.getByRole('button', { name: 'Image 2 details', exact: true }).click();
  await page.getByLabel('Two cells for image 2', { exact: true }).uncheck();
  await applied(page);
  const wide = await ready(page, request);
  expect(span(wide, images[0].id)).toBe(2);
  expect(span(wide, images[1].id)).toBe(1);
  expect(span(wide, images[2].id)).toBe(2);
  await page.getByLabel('Include image 2', { exact: true }).uncheck();
  await expect(page.getByLabel('Two cells for image 2', { exact: true })).toBeDisabled();
  await page.getByLabel('Include image 2', { exact: true }).check();
  await expect(page.getByLabel('Two cells for image 2', { exact: true })).not.toBeChecked();
  await page.getByRole('button', { name: 'Use book setting for image 2', exact: true }).click();
  await applied(page);
  expect(span(await ready(page, request), images[1].id)).toBe(2);
  await page.screenshot({
    path: `${process.env.MB_REPORT_DIR || 'test-results'}/individual-image-layout.png`,
  });
  await upload(page, 'publisher-alternatives.epub');
  expect((await ready(page, request)).settings.imageCellSpans).toEqual({});
});

test('image output previews draft pixels without navigation and applies per-image overrides', async ({
  page,
  request,
}) => {
  await page.goto('/');
  await upload(page, 'two-cell-images.epub');
  const original = await ready(page, request);
  expect(original.settings.imageOutput).toEqual({ mode: 'laser', strength: 'gentle' });
  await tab(page, 'Images');
  await page.getByRole('button', { name: 'Image 1 details', exact: true }).click();
  await page.getByLabel('Output for this image', { exact: true }).selectOption('grayscale');
  await expect(preview(page)).toHaveAttribute('data-render-id', original.id);
  await page.getByRole('button', { name: 'Enlarge image 1', exact: true }).click();
  const modal = page.getByRole('dialog', { name: 'Image preview', exact: true });
  await expect(modal.locator('img')).toHaveAttribute('src', /output=grayscale/);
  await expect(modal.getByRole('status')).toHaveText('Processed');
  await modal.getByRole('button', { name: 'Show original', exact: true }).click();
  await expect(modal.locator('img')).not.toHaveAttribute('src', /output=/);
  await modal.getByRole('button', { name: 'Close image preview', exact: true }).click();
  await applied(page);
  const changed = await ready(page, request);
  expect(Object.values(changed.settings.imageOutputOverrides)).toEqual([
    { mode: 'grayscale', strength: 'gentle' },
  ]);
  await page.reload();
  await ready(page);
  await tab(page, 'Images');
  await expect(page.getByLabel('Output for this image', { exact: true })).toHaveValue('grayscale');
  await page.getByLabel('Output for this image', { exact: true }).selectOption('inherit');
  await applied(page);
  expect((await ready(page, request)).id).toBe(original.id);
  await page.locator('.image-defaults summary').click();
  await page.getByLabel('Default image output', { exact: true }).selectOption('original');
  await upload(page, 'publisher-alternatives.epub');
  const next = await ready(page, request);
  expect(next.settings.imageOutput.mode).toBe('original');
  expect(next.settings.imageOutputOverrides).toEqual({});
});

test('image output explains laser contrast and only offers SVG rendering when applicable', async ({
  page,
}) => {
  await page.goto('/');
  await upload(page, 'two-cell-images.epub');
  await ready(page);
  await tab(page, 'Images');
  await page.locator('.image-defaults summary').first().click();
  const defaults = page.locator('.image-defaults');
  await expect(page.getByLabel('Default laser contrast', { exact: true })).toHaveValue('gentle');
  await expect(
    defaults.getByText('Small contrast increase. Recommended starting point.', { exact: true }),
  ).toBeVisible();
  await expect(defaults.locator('summary').filter({ hasText: 'SVG rendering' })).toHaveCount(0);
  await page.getByLabel('Default laser contrast', { exact: true }).selectOption('strong');
  await expect(
    defaults.getByText('Most contrast. May lose pale lines or shadow detail.', { exact: true }),
  ).toBeVisible();
  await page.getByLabel('Default image output', { exact: true }).selectOption('original');
  await expect(page.getByLabel('Default laser contrast', { exact: true })).toHaveCount(0);
  await expect(defaults.locator('summary').filter({ hasText: 'SVG rendering' })).toBeVisible();
  await page.getByLabel('Default image output', { exact: true }).selectOption('grayscale');
  await expect(defaults.locator('summary').filter({ hasText: 'SVG rendering' })).toHaveCount(0);
});
