import { test, expect } from '@playwright/test';
// @ts-expect-error The fixture writer is also usable from a fresh host without TypeScript.
import { zip, syntheticEntries, xhtml } from '../../tools/fixtures.mjs';
const fixture = zip({
  ...syntheticEntries,
  'OEBPS/nav.xhtml': xhtml(
    '<nav epub:type="toc"><ol><li><a href="text/one.xhtml">Chapter 48: The Hatchet Man in Buffalo</a></li><li><a href="text/two.xhtml">Home</a></li></ol></nav>',
  ),
  'OEBPS/text/one.xhtml': xhtml(
    '<span epub:type="pagebreak" title="235"/><div class="figure_medium"><img src="../images/landscape.svg" alt="Chapter 48 The Hatchet Man in Buffalo"/></div><p>AFTER-HEADING. All source text stays present.</p><figure><img src="../images/landscape.svg" alt="An ordinary landscape"/></figure><p>AFTER-IMAGE. The journey continues.</p>',
  ),
});
test('automatic artwork detection and manual heading corrections apply, reset and persist per book', async ({
  page,
  request,
}) => {
  await page.goto('/');
  const upload = () =>
    page
      .getByLabel('Import book', { exact: true })
      .setInputFiles({ name: 'heading-artwork.epub', mimeType: 'application/epub+zip', buffer: fixture });
  const preview = page.locator('[aria-label="Print preview"]:visible');
  const ready = async () => {
    await expect(page.getByRole('button', { name: 'Print', exact: true })).toBeEnabled();
    await expect(preview).toHaveAttribute('aria-busy', 'false');
    return (await request.get(`/api/renders/${await preview.getAttribute('data-render-id')}`)).json();
  };
  await upload();
  const initial = await ready();
  const doc = await (await request.get(`/api/documents/${initial.documentId}`)).json();
  const images = doc.blocks.filter((b: any) => b.kind === 'image');
  expect(initial.result.imageRegions.map((r: any) => r.blockId)).toEqual([images[1].id]);
  const layout = await (await request.get(`/api/renders/${initial.id}/map`)).json();
  expect(layout).toBeTruthy();
  await page.getByRole('tab', { name: 'Images', exact: true }).click();
  await expect(page.locator('.image-choice')).toHaveCount(1);
  await page.locator('.heading-artwork > summary').click();
  const detected = page.locator('.heading-artwork-row').first();
  await detected.locator('.heading-artwork-select').click();
  await expect(detected.getByLabel('Heading text')).toHaveValue('Chapter 48 The Hatchet Man in Buffalo');
  // Correct a false positive back into an image, then restore the automatic classification.
  // The control moves into the illustration list as soon as classification changes.
  await detected.getByLabel('Treat as heading').click();
  await expect(page.locator('.image-choice')).toHaveCount(2);
  await page.getByRole('button', { name: 'Apply', exact: true }).last().click();
  const restored = await ready();
  expect(restored.result.imageRegions).toHaveLength(2);
  const first = page.locator('.image-choice').first();
  await first
    .locator('summary')
    .filter({ hasText: /^Heading$/ })
    .click();
  await first.getByRole('button', { name: 'Reset to detected heading' }).click();
  await page.getByRole('button', { name: 'Apply', exact: true }).last().click();
  expect((await ready()).id).toBe(initial.id);
  // Convert an uncertain illustration, edit its text and choose Part.
  const row = page.locator('.image-choice').first();
  await row.getByRole('button', { name: 'Show image 1', exact: true }).click();
  await row
    .locator('summary')
    .filter({ hasText: /^Heading$/ })
    .click();
  await row.getByLabel('Treat as heading').check();
  await row.getByLabel('Heading text').fill('Part II A new beginning');
  await row.getByRole('combobox', { name: 'Heading type' }).click();
  await page.getByRole('option', { name: 'Part', exact: true }).click();
  expect(await preview.getAttribute('data-render-id')).toBe(initial.id);
  await page.getByRole('button', { name: 'Apply', exact: true }).last().click();
  const converted = await ready();
  expect(converted.settings.imageTreatments[images[1].id]).toEqual({
    kind: 'heading',
    text: 'Part II A new beginning',
    headingKind: 'part',
  });
  expect(converted.result.imageRegions).toHaveLength(0);
  expect(converted.result.cells.some((c: any) => c.blockIds.includes(images[1].id))).toBe(true);
  await page.reload();
  await ready();
  await page.getByRole('tab', { name: 'Images', exact: true }).click();
  await page.locator('.image-choice summary').filter({ hasText: /^Heading$/ }).click();
  await expect(page.getByLabel('Heading text').first()).toHaveValue('Part II A new beginning');
  await page.getByRole('button', { name: 'Reset to image', exact: true }).click();
  await page.getByRole('button', { name: 'Apply', exact: true }).last().click();
  expect((await ready()).id).toBe(initial.id);
  await upload();
  const another = await ready();
  expect(another.settings.imageTreatments).toEqual({});
});
