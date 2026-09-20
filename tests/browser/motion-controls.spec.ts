import { expect, test } from '@playwright/test';
import { ready, tab, upload } from './helpers';

test('accordion motion preserves exact geometry and reverses cleanly', async ({ page }) => {
  await page.goto('/');
  await upload(page, 'classic.txt');
  await ready(page);

  const summary = page.getByText('Book details', { exact: true });
  const details = summary.locator('..');
  const closedHeight = await details.evaluate((node) => node.getBoundingClientRect().height);

  await summary.click();
  await expect(details).toHaveAttribute('open', '');
  await expect.poll(() => details.evaluate((node) => node.style.height), { timeout: 1_000 }).toBe('');
  expect(await details.evaluate((node) => node.getBoundingClientRect().height)).toBeGreaterThan(closedHeight);

  await summary.evaluate((node) => {
    (node as HTMLElement).click();
    (node as HTMLElement).click();
    (node as HTMLElement).click();
  });
  await expect(details).not.toHaveAttribute('open', '');
  await expect.poll(() => details.evaluate((node) => node.style.height), { timeout: 1_000 }).toBe('');
  expect(await details.evaluate((node) => node.getBoundingClientRect().height)).toBeCloseTo(closedHeight, 1);

  await page.evaluate(() => {
    const host = document.createElement('div');
    host.className = 'sidebar-body';
    host.dataset.testid = 'motion-menu-fixture';
    host.innerHTML =
      '<div class="kept-row"><details><summary>Version actions</summary><div><button>Rename</button></div></details></div>';
    document.body.append(host);
  });
  const menu = page.getByTestId('motion-menu-fixture').locator('details');
  await menu.locator('summary').click();
  await expect(menu).toHaveAttribute('open', '');
  expect(await menu.evaluate((node) => node.style.height)).toBe('');
});

test('expanded content exits without leaving focusable controls and can reverse', async ({ page }) => {
  await page.goto('/');
  await upload(page, 'two-cell-images.epub');
  await ready(page);
  await tab(page, 'Content');

  const trigger = page.getByRole('button', { name: 'Image 1 details', exact: true });
  const nextTrigger = page.getByRole('button', { name: 'Image 2 details', exact: true });
  const row = page.locator('.image-choice').first();
  await trigger.click();
  await expect(row.locator('.image-large-preview')).toBeVisible();

  await page.evaluate(() => {
    (document.querySelector('[aria-label="Image 2 details"]') as HTMLElement).click();
    (document.querySelector('[aria-label="Image 1 details"]') as HTMLElement).click();
  });
  await expect(row.locator('.image-large-preview')).toBeVisible();

  await nextTrigger.click();
  const disclosure = row.locator('.animated-disclosure');
  await expect(disclosure).toHaveAttribute('inert', '');
  await expect(row.locator('.image-large-preview')).toHaveCount(0, { timeout: 1_000 });
  await expect(nextTrigger).toBeFocused();
});

test('dialogs and controls honor reduced motion', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/');
  await page.getByRole('button', { name: 'Tips', exact: true }).click();

  const dialog = page.getByRole('dialog', { name: 'Print & fold tips', exact: true });
  const overlay = page.locator('.tips-overlay');
  await expect(dialog).toBeVisible();
  await expect(dialog).toHaveCSS('animation-name', 'none');
  await expect(overlay).toHaveCSS('animation-name', 'none');
  await page.getByRole('button', { name: 'Close print tips', exact: true }).click();
  await expect(dialog).toHaveCount(0);
});

test('mobile dialog stays inside its inset layout during motion', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  await upload(page, 'structured.epub');
  await ready(page);
  await tab(page, 'Content');
  await page.addStyleTag({ content: '.content-dialog { animation-duration: 10s !important; }' });
  await page.getByRole('button', { name: 'Add to book', exact: true }).click();

  const dialog = page.getByRole('dialog', { name: 'Add to book', exact: true });
  await expect(dialog).toBeVisible();
  await dialog.evaluate((node) => {
    const animation = node.getAnimations()[0];
    animation.pause();
    animation.currentTime = 5_000;
  });
  const bounds = (await dialog.boundingBox())!;
  expect(bounds.x).toBeGreaterThanOrEqual(0);
  expect(bounds.y).toBeGreaterThanOrEqual(0);
  expect(bounds.x + bounds.width).toBeLessThanOrEqual(390);
  expect(bounds.y + bounds.height).toBeLessThanOrEqual(844);
  await expect(dialog).toHaveCSS('transform', /matrix\(1, 0, 0, 1, 0, [0-6](?:\.\d+)?\)/);
});
