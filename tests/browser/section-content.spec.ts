import { expect, test } from '@playwright/test';
import { applied, preview, ready, tab } from './helpers';
// @ts-expect-error fixture generator
import { syntheticEntries, xhtml, zip } from '../../tools/fixtures.mjs';

test('distinguishes exclusions, empty sections and hidden markers without exposing source text', async ({
  page,
  request,
}) => {
  const fixture = zip({
    ...syntheticEntries,
    'OEBPS/book.opf': syntheticEntries['OEBPS/book.opf']
      .replace(
        '</manifest>',
        '<item id="empty" href="text/empty.xhtml" media-type="application/xhtml+xml"/><item id="marker" href="text/marker.xhtml" media-type="application/xhtml+xml"/></manifest>',
      )
      .replace('</spine>', '<itemref idref="empty"/><itemref idref="marker"/></spine>'),
    'OEBPS/nav.xhtml': xhtml(
      '<nav epub:type="toc"><ol><li><a href="text/one.xhtml">Reading</a></li><li><a href="text/two.xhtml">Remove me</a></li><li><a href="text/empty.xhtml">Empty import</a></li><li><a href="text/marker.xhtml">Source marker</a></li></ol></nav>',
    ),
    'OEBPS/text/one.xhtml': xhtml('<h1>Reading</h1><p>A short harmless reading fixture.</p>'),
    'OEBPS/text/two.xhtml': xhtml('<p>SOURCE-ONLY-SENTINEL. This text can be inspected after exclusion.</p>'),
    'OEBPS/text/empty.xhtml': xhtml('<span id="empty-anchor"></span>'),
    'OEBPS/text/marker.xhtml': xhtml('<span epub:type="pagebreak" title="42" id="page42"/>'),
  });
  await page.goto('/');
  await page
    .getByLabel('Import book', { exact: true })
    .setInputFiles({ name: 'section-status.epub', mimeType: 'application/epub+zip', buffer: fixture });
  const initial = await ready(page, request);
  await tab(page, 'Content');
  const row = (title: string) =>
    page
      .locator('.contents-row')
      .filter({ has: page.getByRole('checkbox', { name: `Include ${title}`, exact: true }) });
  const empty = row('Empty import');
  await expect(empty).toContainText('Empty section');
  await empty.locator('.contents-jump').click();
  await expect(empty.getByText('Inspect source content', { exact: true })).toBeVisible();
  await expect(empty.getByRole('region')).toHaveCount(0);
  await empty.getByText('Inspect source content', { exact: true }).click();
  await expect(empty.getByRole('region')).toContainText('No text, images, or section breaks were imported');
  const marker = row('Source marker');
  await expect(marker).toContainText('No visible content with current settings');
  await marker.locator('.contents-jump').click();
  await marker.getByText('Inspect source content', { exact: true }).click();
  await expect(marker.getByRole('region')).toContainText('Source page marker: 42');
  const removed = row('Remove me');
  await removed.getByRole('checkbox').uncheck();
  await expect(removed.locator('.contents-jump')).toContainText('Excluded');
  await expect(page.getByText('Changes not applied', { exact: false })).toHaveCount(0);
  await expect(preview(page)).toHaveAttribute('data-render-id', initial.id);
  await applied(page);
  const current = await ready(page, request);
  const doc = await (await request.get(`/api/documents/${current.documentId}`)).json();
  const removedId = doc.sections.find((s: any) => s.title === 'Remove me').id;
  const removedBlocks = doc.blocks.filter((b: any) => b.sectionId === removedId).map((b: any) => b.id);
  expect(
    current.result.cells.flatMap((c: any) => c.blockIds).some((id: string) => removedBlocks.includes(id)),
  ).toBe(false);
  await removed.locator('.contents-jump').click();
  await expect(removed.locator('.contents-jump')).toContainText('Excluded');
  await expect(removed.getByRole('region')).toHaveCount(0);
  await removed.getByText('Inspect source content', { exact: true }).click();
  await expect(removed.getByRole('region')).toContainText('SOURCE-ONLY-SENTINEL');
  await expect(removed.locator('.section-mini-preview')).toHaveCount(0);
});
