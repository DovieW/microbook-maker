import { test, expect } from '@playwright/test';
import { upload, ready } from './helpers';

test('initial rendering uses a compact phase indicator and respects reduced motion', async ({ page }) => {
  let release!: () => void;
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  await page.route('**/api/documents/*/renders', async (route) => {
    await gate;
    await route.continue();
  });
  await page.goto('/');
  await upload(page);
  const loading = page.locator('.preview-loading');
  await expect(loading).toBeVisible();
  await expect(loading).toContainText('Submitting render');
  await expect(page.locator('.preview-empty .spin')).toHaveCount(0);
  await expect(loading.locator('.preview-loading-track')).toHaveCSS('height', '2px');
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await expect(loading.locator('.preview-loading-track > span')).toHaveCSS('animation-name', 'none');
  await page.screenshot({ path: `${process.env.MB_REPORT_DIR}/loading.png` });
  release();
  await ready(page);
  await expect(loading).toHaveCount(0);
});
