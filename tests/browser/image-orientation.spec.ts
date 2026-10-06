import { expect, test } from '@playwright/test';
import { applied, preview, ready, tab } from './helpers';
// @ts-expect-error fixture writer
import { syntheticEntries, zip, xhtml } from '../../tools/fixtures.mjs';

const fixture = zip({
  ...syntheticEntries,
  'OEBPS/text/one.xhtml': xhtml(
    '<h1>The river</h1><p>Before the illustrations.</p><figure><img src="../images/landscape.svg" alt="First illustration"/></figure><p>Between the illustrations.</p><figure><img src="../images/landscape.svg" alt="Second illustration"/></figure><p>After the second illustration.</p><figure><img src="../images/landscape.svg" alt="Third illustration"/></figure><p>After the illustrations.</p>',
  ),
  'OEBPS/text/two.xhtml': xhtml('<h1>Home</h1><p>A short ending.</p>'),
  'OEBPS/images/landscape.svg':
    '<svg xmlns="http://www.w3.org/2000/svg" width="200" height="300"><rect width="200" height="300" fill="#cf4a34"/><path d="M100 10L180 150H20Z" fill="#000"/><circle cx="100" cy="230" r="30" fill="#217faf"/></svg>',
});

test('book orientation inherits, overrides and resets consistently in previews and two-cell PDFs', async ({
  page,
  request,
}) => {
  await page.goto('/');
  await page
    .getByLabel('Import book', { exact: true })
    .setInputFiles({ name: 'orientation.epub', mimeType: 'application/epub+zip', buffer: fixture });
  const initial = await ready(page, request);
  const doc = await (await request.get(`/api/documents/${initial.documentId}`)).json();
  const images = doc.blocks.filter((b: any) => b.kind === 'image');
  const region = (job: any, id: string) => job.result.imageRegions.find((r: any) => r.blockId === id);
  const ratio = (job: any, id: string) => region(job, id).width / region(job, id).height;
  const choose = async (control: string, option: string) => {
    await page.getByRole('combobox', { name: control, exact: true }).click();
    await page.getByRole('option', { name: option, exact: true }).click();
  };
  await tab(page, 'Content');
  await page.locator('.image-defaults > summary').click();
  await expect(page.getByRole('combobox', { name: 'Default image orientation', exact: true })).toHaveText(
    'Original',
  );
  await choose('Default image layout', 'Full two cells');
  await applied(page);
  const upright = await ready(page, request);
  expect(ratio(upright, images[0].id)).toBeCloseTo(2 / 3, 2);
  await choose('Default image orientation', '90° right');
  await page.getByRole('button', { name: 'Image 1 details', exact: true }).click();
  await expect(page.getByRole('combobox', { name: 'Image orientation', exact: true })).toHaveText(
    'Use book default',
  );
  await expect(page.locator('.image-large-preview')).toHaveAttribute('src', /rotation=90/);
  await expect(preview(page)).toHaveAttribute('data-render-id', upright.id);
  await applied(page);
  const rotated = await ready(page, request);
  expect(rotated.settings.imageRotation).toBe(90);
  expect(rotated.settings.imageRotations).toEqual({});
  for (const image of images) expect(ratio(rotated, image.id)).toBeCloseTo(1.5, 2);
  await choose('Image orientation', 'Original');
  await expect(page.locator('.image-large-preview')).not.toHaveAttribute('src', /rotation=/);
  await applied(page);
  const mixed = await ready(page, request);
  expect(mixed.settings.imageRotations).toEqual({ [images[0].id]: 0 });
  expect(ratio(mixed, images[0].id)).toBeCloseTo(2 / 3, 2);
  expect(ratio(mixed, images[1].id)).toBeCloseTo(1.5, 2);
  await page.reload();
  await ready(page);
  await tab(page, 'Content');
  await expect(page.getByRole('combobox', { name: 'Image orientation', exact: true })).toHaveText('Original');
  await choose('Image orientation', 'Use book default');
  await page.getByRole('button', { name: 'Enlarge image 1', exact: true }).click();
  const modal = page.getByRole('dialog', { name: 'Image preview', exact: true });
  await expect(
    modal.getByRole('region', { name: 'Original color preview', exact: true }).locator('img'),
  ).toHaveAttribute('src', /rotation=90/);
  await modal.getByRole('combobox', { name: 'Image orientation', exact: true }).click();
  await page.getByRole('option', { name: '180°', exact: true }).click();
  await expect(modal.locator('.image-comparison-panel img').first()).toHaveAttribute('src', /rotation=180/);
  await modal.getByRole('button', { name: 'Reset orientation', exact: true }).click();
  await expect(modal.locator('.image-comparison-panel img').first()).toHaveAttribute('src', /rotation=90/);
  await modal.getByRole('button', { name: 'Close image preview', exact: true }).click();
  await applied(page);
  expect((await ready(page, request)).id).toBe(rotated.id);
  await page.getByText('Repeated images', { exact: true }).click();
  await page.locator('.repeated-image > summary').click();
  await expect(page.getByLabel('Repeated images orientation', { exact: true })).toHaveValue('inherit');
  await page.getByLabel('Repeated images orientation', { exact: true }).selectOption('270');
  await applied(page);
  expect(Object.values((await ready(page, request)).settings.imageRotations)).toEqual(images.map(() => 270));
  await page.getByLabel('Repeated images orientation', { exact: true }).selectOption('inherit');
  await applied(page);
  expect((await ready(page, request)).id).toBe(rotated.id);
  await page.setViewportSize({ width: 390, height: 844 });
  await tab(page, 'Content');
  await expect(page.getByRole('combobox', { name: 'Image orientation', exact: true })).toBeVisible();
  const row = page.locator('.image-rotation-controls').first();
  expect(await row.evaluate((el) => el.scrollWidth <= el.clientWidth)).toBe(true);
});
