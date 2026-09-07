import { test, expect } from '@playwright/test';
import { ready } from './helpers';
// @ts-expect-error shared fixture writer
import { zip, syntheticEntries, xhtml } from '../../tools/fixtures.mjs';
test('numbered contents chapters render without custom rules', async ({ page, request }) => {
  const fixture = zip({
    ...syntheticEntries,
    'OEBPS/nav.xhtml': xhtml('<nav epub:type="toc"><ol><li><a href="text/one.xhtml">002: Adjustments</a></li></ol></nav>'),
    'OEBPS/text/one.xhtml': xhtml('<h1>002: ADJUSTMENTS</h1><p>The chapter body remains intact.</p>'),
  });
  await page.goto('/');
  await page.getByLabel('Import book', { exact: true }).setInputFiles({ name: 'numbered.epub', mimeType: 'application/epub+zip', buffer: fixture });
  const render = await ready(page, request);
  expect(render.settings.customHeadingRules).toEqual([]);
  await expect(page.locator('.textLayer').filter({ hasText: 'ADJUSTMENTS' }).first()).toBeVisible();
  await page.route('**/test-heading-pdf.mjs', route =>
    route.fulfill({ path: 'node_modules/pdfjs-dist/build/pdf.mjs', contentType: 'text/javascript' }));
  await page.route('**/test-heading-worker.mjs', route =>
    route.fulfill({ path: 'node_modules/pdfjs-dist/build/pdf.worker.min.mjs', contentType: 'text/javascript' }));
  const items = await page.evaluate(async (id) => {
    const moduleUrl = '/test-heading-pdf.mjs';
    const pdfjs = await import(/* @vite-ignore */ moduleUrl);
    pdfjs.GlobalWorkerOptions.workerSrc = '/test-heading-worker.mjs';
    const loading = pdfjs.getDocument({ url: '/api/renders/' + id + '/pdf' });
    const pdf = await loading.promise;
    const items: { text: string; size: number; y: number }[] = [];
    for (let i = 1; i <= pdf.numPages; i++) {
      const content = await (await pdf.getPage(i)).getTextContent();
      for (const item of content.items) if ('str' in item)
        items.push({ text: item.str, size: Math.abs(item.transform[3]), y: item.transform[5] });
    }
    await loading.destroy();
    return items;
  }, render.id);
  const title = items.find(item => item.text === 'ADJUSTMENTS')!;
  const label = items.find(item => item.text.replace(/\s/g, '') === '002:')!;
  expect(title).toBeDefined();
  expect(label).toBeDefined();
  expect(title.size).toBeCloseTo(render.settings.fontSizePx * render.settings.chapterHeadingScale * 0.75, 1);
  expect(label.size).toBeLessThan(title.size);
  expect(label.y).toBeGreaterThan(title.y);
  expect(items.filter(item => item.text === 'ADJUSTMENTS')).toHaveLength(1);
  expect(render.result.coverage.complete).toBe(true);
  expect(render.result.coverage.overflows).toBe(0);
});
