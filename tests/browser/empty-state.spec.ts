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
  await expect(page.getByText('EPUB · TXT · Markdown', { exact: true })).toBeVisible();
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
