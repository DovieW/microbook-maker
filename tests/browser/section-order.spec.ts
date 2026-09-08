import { test, expect } from '@playwright/test';
import { ready, tab, upload, applied, preview } from './helpers';
test('Contents numeric, pointer and keyboard order stays a draft until Apply and persists per document', async ({
  page,
  request,
}) => {
  await page.goto('/');
  await upload(page, 'publisher-alternatives.epub');
  const original = await ready(page, request);
  const doc = await (await request.get(`/api/documents/${original.documentId}`)).json();
  const first = doc.sections[0],
    last = doc.sections.at(-1);
  await tab(page, 'Contents');
  const input = page.getByRole('spinbutton', { name: `Position of ${last.title}`, exact: true });
  await input.fill('1');
  await input.press('Enter');
  await expect(page.locator('.contents-row').first()).toHaveAttribute('data-section-id', last.id);
  await expect(preview(page)).toHaveAttribute('data-render-id', original.id);
  await page.getByRole('button', { name: 'Revert changes', exact: true }).click();
  await expect(page.locator('.contents-row').first()).toHaveAttribute('data-section-id', first.id);
  await page.getByRole('spinbutton', { name: `Position of ${last.title}`, exact: true }).fill('1');
  await page.getByRole('spinbutton', { name: `Position of ${last.title}`, exact: true }).press('Enter');
  await applied(page);
  const result = await ready(page, request);
  expect(result.settings.sectionOrder[0]).toBe(last.id);
  expect(result.result.coverage.complete).toBe(true);
  const sourceIds = result.result.cells
    .flatMap((c: any) => c.blockIds)
    .filter((id: string) => doc.blocks.some((b: any) => b.id === id));
  expect(doc.blocks.find((b: any) => b.id === sourceIds[0]).sectionId).toBe(last.id);
  await page.reload();
  await ready(page);
  await tab(page, 'Contents');
  await expect(page.locator('.contents-row').first()).toHaveAttribute('data-section-id', last.id);
  const handle = page.locator('.contents-row').first().locator('.contents-drag');
  await handle.focus();
  await handle.press('ArrowDown');
  await expect(page.locator('.contents-row').nth(1)).toHaveAttribute('data-section-id', last.id);
  const from = await page.locator('.contents-row').nth(1).locator('.contents-drag').boundingBox(),
    to = await page.locator('.contents-row').first().boundingBox();
  await page.mouse.move(from!.x + 15, from!.y + 15);
  await page.mouse.down();
  await page.mouse.move(to!.x + 70, to!.y + 15, { steps: 5 });
  await page.mouse.up();
  await expect(page.locator('.contents-row').first()).toHaveAttribute('data-section-id', last.id);
  await page.getByRole('button', { name: 'Restore order', exact: true }).click();
  await applied(page);
  expect((await ready(page, request)).id).toBe(original.id);
});

test('phone users can reorder by touch and position without closing Contents', async ({
  browser,
  baseURL,
  request,
}) => {
  const context = await browser.newContext({
    baseURL,
    viewport: { width: 390, height: 844 },
    hasTouch: true,
    isMobile: true,
  });
  const page = await context.newPage();
  try {
    await page.goto('/');
    await upload(page, 'publisher-alternatives.epub');
    const original = await ready(page, request);
    await tab(page, 'Contents');
    const ids = await page
      .locator('.contents-row')
      .evaluateAll((rows) => rows.map((row) => (row as HTMLElement).dataset.sectionId));
    const source = await page.locator('.contents-row').first().locator('.contents-drag').boundingBox();
    const destination = await page.locator('.contents-row').nth(1).boundingBox();
    const session = await context.newCDPSession(page);
    await session.send('Input.dispatchTouchEvent', {
      type: 'touchStart',
      touchPoints: [{ x: source!.x + 20, y: source!.y + 15 }],
    });
    await session.send('Input.dispatchTouchEvent', {
      type: 'touchMove',
      touchPoints: [{ x: destination!.x + 65, y: destination!.y + 20 }],
    });
    await session.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    await expect(page.locator('.contents-row').nth(1)).toHaveAttribute('data-section-id', ids[0]!);
    const input = page.locator('.contents-row').nth(1).getByRole('spinbutton');
    await input.fill('1');
    await input.press('Enter');
    await expect(page.locator('.contents-row').first()).toHaveAttribute('data-section-id', ids[0]!);
    await expect(page.getByRole('dialog')).toBeVisible();
    expect(await page.locator('.contents-pane').evaluate((el) => el.scrollWidth <= el.clientWidth)).toBe(
      true,
    );
    await page.screenshot({ path: '/tmp/reorder-mobile.png' });
  } finally {
    await context.close();
  }
});
