import { test, expect } from '@playwright/test';
import { preview, ready, upload, tab, applied } from './helpers';
const reports = process.env.MB_REPORT_DIR || 'test-results';
test('image locations, exact overlays and context jumps survive zoom, Apply, exclusion and mobile navigation', async ({
  page,
  request,
}) => {
  let renders = 0;
  page.on('request', (r) => {
    if (r.method() === 'POST' && /\/renders$/.test(r.url())) renders++;
  });
  await page.goto('/');
  await upload(page, 'two-cell-images.epub');
  const initial = await ready(page, request);
  const doc = await (await request.get(`/api/documents/${initial.documentId}`)).json();
  const images = doc.blocks.filter((b: any) => b.kind === 'image' && !b.imageHeading);
  await tab(page, 'Images');
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await page.getByRole('button', { name: /^Show image 18:/ }).click();
  const target = initial.result.cells.find((c: any) => c.blockIds.includes(images[17].id));
  await expect(page.getByLabel('Printed side', { exact: true })).toHaveValue(String(target.page + 1));
  const check = async (job: any) => {
    const r = job.result.imageRegions.find((r: any) => r.blockId === images[17].id);
    const hit = preview(page).locator(`.image-hit[data-image-block="${images[17].id}"]`);
    await expect(hit).toHaveClass(/selected/);
    const box = (await hit.boundingBox())!;
    const paper = (await preview(page)
      .locator(`.page[data-page-number="${r.page + 1}"]`)
      .boundingBox())!;
    expect(Math.abs(box.width - (paper.width * r.width) / 612)).toBeLessThan(1);
    expect(Math.abs(box.x - paper.x - (paper.width * r.x) / 612)).toBeLessThan(1);
    expect(Math.abs(box.y - paper.y - (paper.height * r.y) / 792)).toBeLessThan(1);
  };
  await check(initial);
  await page.getByRole('button', { name: 'Actual size (100%)', exact: true }).click();
  await check(initial);
  expect(renders).toBe(1);
  await page.locator('.image-defaults summary').click();
  await page.getByLabel('Two-cell images', { exact: true }).check();
  await expect(page.getByLabel('Printed side', { exact: true })).toHaveValue(String(target.page + 1));
  await applied(page);
  const wide = await ready(page, request);
  const next = wide.result.cells.find((c: any) => c.blockIds.includes(images[17].id));
  expect(next.page).not.toBe(target.page);
  await expect(page.getByLabel('Printed side', { exact: true })).toHaveValue(String(next.page + 1));
  await check(wide);
  await page.getByLabel('Include image 18', { exact: true }).uncheck();
  await expect(preview(page).locator('.image-hit.selected')).toHaveCount(1);
  await applied(page);
  await ready(page);
  await expect(preview(page).locator('.image-hit.selected')).toHaveCount(0);
  await page.getByRole('button', { name: 'Go to context for image 18', exact: true }).click();
  await page.getByRole('button', { name: /^Show image 17:/ }).click();
  await expect(page.locator('.image-choice.selected')).toHaveAttribute('data-image-id', images[16].id);
  await tab(page, 'Layout');
  const edit = preview(page).locator('.image-hit.selected button');
  await edit.focus();
  await expect(edit).toHaveCSS('opacity', '1');
  await edit.click();
  await expect(page.getByRole('tab', { name: 'Images', exact: true })).toHaveAttribute(
    'aria-selected',
    'true',
  );
  await page.screenshot({ path: `${reports}/images-sidebar-desktop.png` });
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await tab(page, 'Images');
  const sideBefore = await page.getByLabel('Printed side', { exact: true }).inputValue();
  await page.getByRole('button', { name: 'Image 1 details', exact: true }).click();
  await expect(page.getByRole('dialog')).toHaveCount(1);
  await expect(page.getByLabel('Printed side', { exact: true })).toHaveValue(sideBefore);
  const expanded = page.locator('.image-choice.selected');
  await expect(expanded.locator('.image-large-preview')).toBeVisible();
  expect((await expanded.locator('.image-large-preview').boundingBox())!.width).toBeGreaterThan(250);
  expect(
    (await expanded.getByLabel('Include image 1', { exact: true }).boundingBox())!.width,
  ).toBeGreaterThanOrEqual(44);
  await expect(expanded.locator('summary').filter({ hasText: /^Heading$/ })).toHaveCount(0);
  const thumbnail = expanded.getByRole('button', { name: 'Preview image 1', exact: true });
  await thumbnail.click();
  const imageDialog = page.getByRole('dialog', { name: 'Image preview', exact: true });
  await expect(imageDialog).toBeVisible();
  await imageDialog.getByRole('button', { name: 'Zoom image in', exact: true }).click();
  expect(
    await imageDialog.locator('.image-preview-stage').evaluate((el) => el.scrollWidth > el.clientWidth),
  ).toBe(true);
  await expect(page.getByLabel('Printed side', { exact: true })).toHaveValue(sideBefore);
  await page.keyboard.press('Escape');
  await expect(imageDialog).toHaveCount(0);
  await expect(page.getByRole('dialog')).toHaveCount(1);
  await expect(thumbnail).toBeFocused();
  await page.getByRole('button', { name: /^Show image 1:/ }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(page.getByLabel('Printed side', { exact: true })).toHaveValue('1');
  await tab(page, 'Images');
  await expect(page.locator('.image-choice.selected')).toHaveAttribute('data-image-id', images[0].id);
  await expect(page.getByRole('button', { name: 'Previous image', exact: true })).toHaveCount(0);
  await expect(page.locator('.tools-drawer .image-list')).toHaveCSS('max-height', 'none');
  await page.screenshot({ path: `${reports}/images-sidebar-mobile.png` });
  await page.reload();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await tab(page, 'Images');
  await expect(page.locator('.image-choice.selected')).toHaveAttribute('data-image-id', images[0].id);
});

test('legacy Cell preferences and unidentified image regions migrate without rendering again', async ({
  page,
}) => {
  let renders = 0;
  page.on('request', (r) => {
    if (r.method() === 'POST' && /\/renders$/.test(r.url())) renders++;
  });
  await page.goto('/');
  await upload(page, 'two-cell-images.epub');
  const id = await ready(page);
  const legacy = await page.evaluate(() => {
    const p = JSON.parse(localStorage.getItem('microbook-preferences')!);
    p.version = 3;
    p.state.version = 3;
    p.state.view = 'cell';
    p.state.zoom = 1.25;
    p.state.zoomMode = 'custom';
    return p;
  });
  await page.addInitScript(
    (value) => localStorage.setItem('microbook-preferences', JSON.stringify(value)),
    legacy,
  );
  await page.route('**/api/documents/*', async (route) => {
    const response = await route.fetch();
    const doc = await response.json();
    for (const r of doc.renders || [])
      for (const region of r.result?.imageRegions || []) delete region.blockId;
    await route.fulfill({ response, json: doc });
  });
  await page.reload();
  await expect(preview(page)).toHaveAttribute('data-render-id', id);
  await expect(page.getByRole('button', { name: 'Fit to width', exact: true })).toHaveText('125%');
  await tab(page, 'Images');
  await page.getByRole('button', { name: /^Show image 18:/ }).click();
  await expect(page.getByLabel('Printed side', { exact: true })).not.toHaveValue('1');
  await expect(preview(page).locator('.image-hit')).toHaveCount(0);
  expect(renders).toBe(1);
  const p = await page.evaluate(() => JSON.parse(localStorage.getItem('microbook-preferences')!));
  expect(p.version).toBe(5);
  expect(p.state.view).toBeUndefined();
});

test('mobile failure retains displayed image locations and offers Retry in the same drawer', async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  await upload(page, 'two-cell-images.epub');
  const id = await ready(page);
  await tab(page, 'Images');
  await page.getByLabel('Include image 1', { exact: true }).uncheck();
  await page.route('**/api/documents/*/renders', (r) =>
    r.fulfill({ status: 500, json: { error: 'Test render failure' } }),
  );
  await applied(page);
  const drawer = page.getByRole('dialog');
  await expect(drawer.getByRole('alert')).toHaveText('Test render failure');
  await expect(preview(page)).toHaveAttribute('data-render-id', id);
  await page.unroute('**/api/documents/*/renders');
  await page.getByRole('button', { name: 'Retry', exact: true }).click();
  await expect(drawer.getByRole('button', { name: 'Apply', exact: true })).toBeDisabled();
  await expect(preview(page)).not.toHaveAttribute('data-render-id', id);
  await expect(page.getByRole('button', { name: 'Go to context for image 1', exact: true })).toBeEnabled();
});
