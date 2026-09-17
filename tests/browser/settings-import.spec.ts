import { test, expect } from '@playwright/test';
import { preview, ready, upload } from './helpers';

test('settings JSON imports from the button or drop target and saves portable layout defaults', async ({
  page,
  request,
}) => {
  await page.goto('/');
  await upload(page, 'publisher-alternatives.epub');
  const initial = await ready(page, request);
  await page.getByText('Advanced', { exact: true }).click();
  await expect(page.getByRole('button', { name: 'Export settings', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Import settings', exact: true })).toBeVisible();

  const importedSettings = {
    ...initial.settings,
    fontSizePx: 7.25,
    marginMm: 3.5,
    selectedSections: ['another-book'],
    sectionOrder: ['another-book'],
    excludedImageIds: ['another-image'],
    imageRotations: { 'another-image': 90 },
  };
  await page.getByLabel('Import settings JSON').setInputFiles({
    name: 'settings.json',
    mimeType: 'application/json',
    buffer: Buffer.from(JSON.stringify(importedSettings)),
  });
  await expect(preview(page)).not.toHaveAttribute('data-render-id', initial.id);
  const imported = await ready(page, request);
  expect(imported.settings).toMatchObject({
    mode: 'book',
    fontSizePx: 7.25,
    marginMm: 3.5,
    selectedSections: null,
    sectionOrder: [],
    excludedImageIds: [],
    imageRotations: {},
  });
  const defaults = await page.evaluate(
    () => JSON.parse(localStorage.getItem('microbook-preferences')!).state,
  );
  expect(defaults.settings.book).toMatchObject({
    fontSizePx: 7.25,
    marginMm: 3.5,
    selectedSections: null,
    sectionOrder: [],
    excludedImageIds: [],
    imageRotations: {},
  });

  const droppedSettings = JSON.stringify({ ...imported.settings, fontSizePx: 6.5, marginMm: 2 });
  await page.evaluate((contents) => {
    const transfer = new DataTransfer();
    transfer.items.add(new File([contents], 'settings.json', { type: 'application/json' }));
    const app = document.querySelector('.app')!;
    app.dispatchEvent(new DragEvent('dragover', { bubbles: true, cancelable: true, dataTransfer: transfer }));
    app.dispatchEvent(new DragEvent('drop', { bubbles: true, cancelable: true, dataTransfer: transfer }));
  }, droppedSettings);
  await expect(preview(page)).not.toHaveAttribute('data-render-id', imported.id);
  const dropped = await ready(page, request);
  expect(dropped.settings).toMatchObject({ fontSizePx: 6.5, marginMm: 2 });
});
