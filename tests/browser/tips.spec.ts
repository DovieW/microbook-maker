import { test, expect } from '@playwright/test';

test('print tips are readable on mobile and link to folding and printer guidance', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');

  const trigger = page.getByRole('button', { name: 'Tips', exact: true });
  await trigger.click();
  const dialog = page.getByRole('dialog', { name: 'Print & fold tips', exact: true });
  await expect(dialog).toBeVisible();
  await expect(dialog.getByRole('heading', { name: 'Paper', exact: true })).toBeVisible();
  await expect(dialog.getByRole('heading', { name: 'Printer settings', exact: true })).toBeVisible();
  await expect(dialog.getByRole('heading', { name: 'Folding', exact: true })).toBeVisible();
  await expect(dialog.getByRole('heading', { name: 'What printer works best?', exact: true })).toBeVisible();
  await expect(dialog.getByText('100% or Actual size', { exact: false })).toBeVisible();
  await expect(dialog.getByText('Brother HL-L2460DW', { exact: false })).toBeVisible();
  await expect(dialog.getByText('genuine toner', { exact: false })).toBeVisible();
  await expect(dialog.getByRole('link', { name: /map-fold demonstration/ })).toHaveAttribute(
    'href',
    'https://www.youtube.com/watch?v=Q3jTZT2e8os',
  );

  const bounds = await dialog.boundingBox();
  expect(bounds?.x).toBeGreaterThanOrEqual(0);
  expect(bounds?.y).toBeGreaterThanOrEqual(0);
  expect((bounds?.x || 0) + (bounds?.width || 0)).toBeLessThanOrEqual(390);
  expect((bounds?.y || 0) + (bounds?.height || 0)).toBeLessThanOrEqual(844);

  await page.getByRole('button', { name: 'Close print tips', exact: true }).click();
  await expect(dialog).toHaveCount(0);
  await expect(trigger).toBeFocused();
});
