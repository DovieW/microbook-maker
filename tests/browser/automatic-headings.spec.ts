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
});
