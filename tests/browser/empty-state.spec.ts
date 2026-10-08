import { test, expect } from '@playwright/test';
import { ready, tab, upload } from './helpers';

test('opening a book remains discoverable after deletion and reload', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('button', { name: 'Open a book', exact: true })).toBeVisible();
  await expect(page.locator('.statusbar')).toHaveCount(0);
  const chooser = page.waitForEvent('filechooser');
  await page.getByRole('button', { name: 'Open a book', exact: true }).click();
  await (await chooser).setFiles('tests/fixtures/classic.txt');
  await ready(page);
  await tab(page, 'History');
  await page.locator('.book-row.current summary').first().click();
  await page.locator('.book-row.current').getByRole('button', { name: 'Remove book', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Open a book', exact: true })).toBeVisible();
  await page.reload();
  await expect(page.getByRole('button', { name: 'Open a book', exact: true })).toBeVisible();
  await expect(page.locator('.statusbar')).toHaveCount(0);
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(page.getByRole('button', { name: 'Open a book', exact: true })).toBeVisible();
  await expect(page.getByText('EPUB · PDF · TXT · Markdown', { exact: true })).toBeVisible();
});

test('empty History offers a clear import action without unused search tools', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 500 });
  await page.route('**/api/documents', (route) => route.fulfill({ json: [] }));
  await page.goto('/');
  await page.getByRole('button', { name: 'History', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Back', exact: true })).toBeDisabled();
  const history = page.getByRole('tabpanel', { name: 'History', exact: true });
  await expect(history.getByText('No books yet', { exact: true })).toBeVisible();
  await expect(history.getByLabel('Find book')).toHaveCount(0);
  const chooser = page.waitForEvent('filechooser');
  await history.getByRole('button', { name: 'Import book', exact: true }).click();
  await await chooser;
  await page.screenshot({ path: '.artifacts/history-empty-mobile.png' });
  await page.getByRole('button', { name: 'Close tools', exact: true }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Open tools', exact: true })).toBeFocused();
});

test('Back is disabled in desktop History when no book is open', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 700 });
  await page.goto('/');
  await expect(page.getByRole('tabpanel', { name: 'History', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Back', exact: true })).toBeDisabled();
  await expect(page.getByRole('tabpanel', { name: 'History', exact: true })).toBeVisible();
  await expect(page.getByLabel('Workspace sidebar', { exact: true })).toBeVisible();
});

test('open another book directly from the loaded workspace', async ({ page }) => {
  await page.goto('/');
  await upload(page);
  await ready(page);
  for (const width of [1280, 390]) {
    await page.setViewportSize({ width, height: 844 });
    await expect(page.getByRole('button', { name: 'Open book', exact: true })).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  }
  const chooser = page.waitForEvent('filechooser');
  await page.getByRole('button', { name: 'Open book', exact: true }).click();
  await (await chooser).setFiles('tests/fixtures/classic.md');
  await ready(page);
  await tab(page, 'History');
  await expect(page.locator('.book-row').filter({ hasText: 'classic.txt' }).first()).toBeVisible();
  await expect(page.locator('.book-row.current')).toContainText('classic.md');
  const alignment = await page.locator('.book-row.current').evaluate((row) => {
    const button = row.querySelector('.book-open')!;
    const layouts = row.querySelector('.book-layouts')!;
    return {
      justify: getComputedStyle(button).justifyContent,
      indent: getComputedStyle(layouts).marginLeft,
    };
  });
  expect(alignment).toEqual({ justify: 'flex-start', indent: '0px' });
});

test('History selections open Layout while reload preserves the current tools', async ({ page, request }) => {
  await page.goto('/');
  await upload(page, 'structured.epub');
  const original = await ready(page, request);
  await tab(page, 'Content');
  await page.reload();
  await ready(page);
  await expect(page.getByRole('tab', { name: 'Content', exact: true })).toHaveAttribute(
    'aria-selected',
    'true',
  );
  await tab(page, 'History');
  const row = page.locator('.book-row.current');
  await page.route(`**/api/documents/${original.documentId}`, (route) =>
    route.fulfill({ status: 500, json: { error: 'Opening failed' } }),
  );
  await row.locator('.book-open').click();
  await expect(page.getByRole('alert')).toContainText('Opening failed');
  await expect(page.getByRole('tabpanel', { name: 'History', exact: true })).toBeVisible();
  await page.unroute(`**/api/documents/${original.documentId}`);
  await row.locator('.book-open').click();
  await ready(page);
  await expect(page.getByRole('tab', { name: 'Layout', exact: true })).toHaveAttribute(
    'aria-selected',
    'true',
  );
  await tab(page, 'History');
  await row.locator('.book-layouts').getByRole('button', { name: /Rich/ }).click();
  await ready(page);
  await expect(page.getByRole('tab', { name: 'Layout', exact: true })).toHaveAttribute(
    'aria-selected',
    'true',
  );
  await tab(page, 'History');
  await page.getByRole('button', { name: 'Keep version', exact: true }).click();
  await expect(row.getByText('Kept versions', { exact: true })).toBeVisible();
  await row.getByText('Kept versions', { exact: true }).click();
  await row.locator('.kept-row > button').first().click();
  await ready(page);
  await expect(page.getByRole('tab', { name: 'Layout', exact: true })).toHaveAttribute(
    'aria-selected',
    'true',
  );
  await expect(page.getByLabel('Text size in CSS pixels')).toBeDisabled();
});
