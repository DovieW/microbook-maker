import { test, expect } from '@playwright/test';
import { ready, tab, upload } from './helpers';

const svg = (color: string) => ({
  name: `${color}.svg`,
  mimeType: 'image/svg+xml',
  buffer: Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" width="300" height="450"><rect width="300" height="450" fill="${color}"/></svg>`,
  ),
});

test('custom text and image content render, reorder, replace, and restore', async ({ page, request }) => {
  await page.goto('/');
  await upload(page, 'structured.epub');
  const initial = await ready(page, request);
  const documentId = initial.documentId;
  try {
    await tab(page, 'Content');
    await page.getByRole('button', { name: 'Add to book', exact: true }).click();
    const text = page.getByRole('dialog', { name: 'Add to book', exact: true });
    await expect(text.getByLabel('Initial position', { exact: true })).toHaveValue('1');
    await expect(text.getByRole('combobox', { name: 'Title in book', exact: true })).toHaveText(
      'Do not show',
    );
    await text.getByRole('combobox', { name: 'Title in book', exact: true }).click();
    await expect(page.getByRole('option', { name: 'Compact heading', exact: true })).toBeVisible();
    await page.getByRole('option', { name: 'Compact heading', exact: true }).click();
    await expect(text.getByRole('combobox', { name: 'Title in book', exact: true })).toHaveText(
      'Compact heading',
    );
    await text.getByLabel('Section title').fill('A note from the editor');
    await text
      .getByRole('textbox', { name: 'Text', exact: true })
      .fill('This has **bold text**.\n\n- First point\n- Second point');
    await text.getByRole('button', { name: 'Add to book', exact: true }).click();
    await expect(page.locator('[aria-label="Print preview"]:visible')).toHaveAttribute(
      'data-render-id',
      initial.id,
    );
    await expect(page.getByRole('button', { name: 'Apply', exact: true })).toBeEnabled();
    await expect(page.getByLabel('Include A note from the editor', { exact: true })).toBeChecked();
    await expect(page.getByLabel('Position of A note from the editor', { exact: true })).toHaveValue('1');

    await tab(page, 'Content');
    await page.getByRole('button', { name: 'Add to book', exact: true }).click();
    const add = page.getByRole('dialog', { name: 'Add to book', exact: true });
    await add.getByRole('button', { name: 'Image', exact: true }).click();
    await expect(add.getByLabel('Initial position', { exact: true })).toHaveValue('1');
    await add.getByLabel('Image file').setInputFiles(svg('#224466'));
    await add.getByLabel('Image title').fill('Custom cover');
    await add.getByLabel('Initial position', { exact: true }).fill('2');
    await add.getByLabel(/Image description/).fill('Blue custom artwork');
    await add.getByRole('button', { name: 'Add to book', exact: true }).click();
    await expect(page.locator('[aria-label="Print preview"]:visible')).toHaveAttribute(
      'data-render-id',
      initial.id,
    );
    await expect(page.getByRole('button', { name: 'Apply', exact: true })).toBeEnabled();
    await page.getByRole('button', { name: 'Apply', exact: true }).click();
    const withCustomContent = await ready(page, request);
    expect(withCustomContent.id).not.toBe(initial.id);
    const customDocument = await (await request.get(`/api/documents/${documentId}`)).json();
    const coverSection = customDocument.sections.find((section: any) => section.title === 'Custom cover');
    const coverRow = page.locator(`.contents-list [data-section-id="${coverSection.id}"]`);
    await expect(coverRow).toHaveCount(1);
    await expect(coverRow).toHaveClass(/content-image-row/);
    const coverCheckbox = coverRow.getByRole('checkbox', { name: /^Include image/ });
    await coverCheckbox.uncheck();
    await expect(coverCheckbox).not.toBeChecked();
    await expect(page.locator('[aria-label="Print preview"]:visible')).toHaveAttribute(
      'data-render-id',
      withCustomContent.id,
    );
    await page.getByRole('button', { name: 'Revert changes', exact: true }).click();
    await expect(coverCheckbox).toBeChecked();
    await page.locator('.content-image-row .contents-jump').filter({ hasText: 'Custom cover' }).click();
    await expect(page.getByRole('button', { name: 'Replace image', exact: true })).toBeVisible();

    const sourceDetails = page.getByRole('button', { name: 'Image 1 details', exact: true });
    await sourceDetails.click();
    await page.getByRole('button', { name: 'Replace image', exact: true }).click();
    const replace = page.getByRole('dialog', { name: 'Replace image', exact: true });
    await replace.getByLabel('Image file').setInputFiles(svg('#882244'));
    await replace.getByRole('button', { name: 'Replace image', exact: true }).click();
    await ready(page);
    await tab(page, 'Content');
    await sourceDetails.click();
    await expect(page.getByRole('button', { name: 'Restore original', exact: true })).toBeVisible();
    await page.getByRole('button', { name: 'Restore original', exact: true }).click();
    await ready(page);

    const doc = await (await request.get(`/api/documents/${documentId}`)).json();
    expect(doc.contentRevision).toBe(4);
    expect(
      doc.sections.some((section: any) => section.custom && section.title === 'A note from the editor'),
    ).toBe(true);
    expect(doc.sections.some((section: any) => section.custom && section.title === 'Custom cover')).toBe(
      true,
    );
    expect(
      doc.blocks.find((block: any) => block.id === initial.result.imageRegions[0].blockId)?.originalAssetId,
    ).toBeUndefined();
  } finally {
    await request.delete(`/api/documents/${documentId}`);
  }
});
