import { readFile } from 'node:fs/promises';
import { expect, test } from '@playwright/test';
import { fontStacks, settingsSchema, type BookDocument, type RenderResult } from '@microbook/core';

test('tight prose fits inside borderless cells without relying on clipping', async ({ page, request }) => {
  const form = new FormData();
  const paragraph = 'Émily brought her book to the reading room. Her chapter began with a quiet sentence. ';
  form.set('file', new Blob([paragraph.repeat(230)]), 'Cell edges.txt');
  const response = await request.post('/api/documents', { multipart: form });
  expect(response.ok()).toBe(true);
  const doc: BookDocument = await response.json();
  const settings = settingsSchema.parse({
    lineHeight: 0.5,
    fontSizePx: 8,
    borderStyle: 'none',
    foldGaps: false,
    positionHeaders: false,
    rich: { sheetHeaders: 'off' },
  });

  await page.setViewportSize({ width: 816, height: 1056 });
  await page.setContent('<!doctype html><html><body></body></html>');
  await page.addScriptTag({ content: await readFile('dist/book.js', 'utf8') });
  const result = await page.evaluate(
    (payload) =>
      (
        window as unknown as { Microbook: { renderBook(input: typeof payload): Promise<RenderResult> } }
      ).Microbook.renderBook(payload),
    { document: doc, settings, fontStack: fontStacks[settings.fontFamily], assetBase: '' },
  );
  expect(result.coverage.complete).toBe(true);
  expect(result.coverage.overflows).toBe(0);
  expect(result.cells.length).toBeGreaterThan(4);

  await page.emulateMedia({ media: 'print' });
  const sheet = page.locator('.page').first();
  const clipped = await sheet.screenshot();
  await page.addStyleTag({ content: '.cell { overflow: visible !important; }' });
  const unclipped = await sheet.screenshot();
  expect(clipped.equals(unclipped), 'Clipping should make no difference to the printable ink').toBe(true);
});
