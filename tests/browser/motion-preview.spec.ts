import { test, expect } from '@playwright/test';
import { preview, ready, upload } from './helpers';
// @ts-expect-error fixture generator
import { richFixture } from '../../tools/rich-fixture.mjs';

test('content jumps replay a transient preview cue without reacting to ordinary scrolling', async ({
  page,
}) => {
  await page.goto('/');
  await page.getByLabel('Import book', { exact: true }).setInputFiles({
    name: 'motion.epub',
    mimeType: 'application/epub+zip',
    buffer: richFixture(),
  });
  await ready(page);
  await page.getByRole('tab', { name: 'Content', exact: true }).click();
  const jump = page.locator('.contents-row .contents-jump').first();

  await jump.click();
  const cue = preview(page).locator('.preview-jump-cue');
  await expect(cue).toHaveCount(1);
  const firstSerial = await cue.getAttribute('data-jump-serial');

  await jump.click();
  await expect(cue).toHaveCount(1);
  await expect(cue).not.toHaveAttribute('data-jump-serial', firstSerial!);
  await expect(cue).toHaveCount(0, { timeout: 1500 });

  await preview(page)
    .locator('.pdf-viewport')
    .evaluate((node) => node.scrollBy(0, 40));
  await page.waitForTimeout(150);
  await expect(cue).toHaveCount(0);
});

test('only a successful explicit Apply gets completion feedback, including a cached render', async ({
  page,
}) => {
  await page.goto('/');
  await upload(page);
  await ready(page);
  await expect(page.getByText('Applied', { exact: true })).toHaveCount(0);

  const size = page.getByLabel('Text size in CSS pixels');
  await size.fill('7');
  await page.getByRole('button', { name: 'Apply', exact: true }).click();
  await ready(page);
  await expect(page.locator('.apply-feedback.is-complete')).toHaveCount(1);
  await expect(page.getByText('Applied', { exact: true })).toHaveCount(1);
  await expect(page.locator('.apply-feedback.is-complete')).toHaveCount(0, { timeout: 1600 });

  // Returning to a previously rendered setting exercises the completed/cached response path.
  await size.fill('6');
  await page.getByRole('button', { name: 'Apply', exact: true }).click();
  await ready(page);
  await expect(page.locator('.apply-feedback.is-complete')).toHaveCount(1);
  await expect(page.locator('.apply-feedback.is-complete')).toHaveCount(0, { timeout: 1600 });

  await size.fill('8');
  await page.route('**/api/documents/*/renders', (route) =>
    route.fulfill({ status: 500, contentType: 'application/json', body: '{"error":"Render failed"}' }),
  );
  await page.getByRole('button', { name: 'Apply', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('Render failed');
  await expect(page.locator('.apply-feedback.is-complete')).toHaveCount(0);
  await expect(page.getByText('Applied', { exact: true })).toHaveCount(0);
});
