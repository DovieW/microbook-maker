import { test, expect } from '@playwright/test';

test('each mode renders once and survives toggles, pending edits, and reload', async ({ page, request }) => {
  const renders: string[] = [];
  const pdfs: string[] = [];
  page.on('request', (req) => {
    if (req.method() === 'POST' && /\/api\/documents\/[^/]+\/renders$/.test(req.url()))
      renders.push(req.url());
    if (/\/api\/renders\/[^/]+\/pdf$/.test(req.url())) pdfs.push(req.url());
  });
  const preview = page.locator('[aria-label="Print preview"]:visible');
  const ready = async () => {
    await expect(page.getByRole('button', { name: 'Print', exact: true })).toBeEnabled();
    await expect(preview).toHaveAttribute('aria-busy', 'false');
    return (await preview.getAttribute('data-render-id'))!;
  };
  const switchTo = (mode: string) => page.getByRole('button', { name: mode, exact: true }).click();
  await page.goto('/');
  await page.getByLabel('Import book', { exact: true }).setInputFiles('tests/fixtures/classic-duplex.txt');
  const classic = await ready();
  await page.getByLabel('Printed side', { exact: true }).fill('2');
  await page.getByLabel('Printed side', { exact: true }).press('Enter');
  await switchTo('Rich');
  const book = await ready();
  expect(book).not.toBe(classic);
  for (let i = 0; i < 3; i++) {
    await switchTo('Basic');
    expect(await ready()).toBe(classic);
    await expect(page.getByLabel('Printed side', { exact: true })).toHaveValue('2');
    await switchTo('Rich');
    expect(await ready()).toBe(book);
  }
  expect(renders).toHaveLength(2);
  expect(new Set(pdfs).size).toBe(2);
  const pdfCount = pdfs.length;
  await switchTo('Basic');
  await page.getByLabel('Text size in CSS pixels').fill('7');
  await switchTo('Rich');
  expect(await ready()).toBe(book);
  await switchTo('Basic');
  await expect(preview).toHaveAttribute('data-render-id', classic);
  await expect(page.getByRole('button', { name: 'Revert changes', exact: true })).toBeVisible();
  expect(pdfs).toHaveLength(pdfCount);
  await page.reload();
  await expect(preview).toHaveAttribute('data-render-id', classic);
  await expect(page.getByLabel('Text size in CSS pixels')).toHaveValue('7');
  await switchTo('Rich');
  expect(await ready()).toBe(book);
  await switchTo('Basic');
  await page.getByRole('button', { name: 'Apply', exact: true }).click();
  const updated = await ready();
  expect(updated).not.toBe(classic);
  await switchTo('Rich');
  expect(await ready()).toBe(book);
  expect(renders).toHaveLength(3);
  const downloadEvent = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Download PDF', exact: true }).click();
  const download = await downloadEvent;
  const fs = await import('node:fs/promises');
  expect(
    (await fs.readFile((await download.path())!)).equals(
      await (await request.get(`/api/renders/${book}/pdf`)).body(),
    ),
  ).toBe(true);
});

test('a background mode completion cannot replace the selected cached preview', async ({ page }) => {
  await page.goto('/');
  await page.getByLabel('Import book', { exact: true }).setInputFiles('tests/fixtures/classic.txt');
  const preview = page.locator('[aria-label="Print preview"]:visible');
  await expect(page.getByRole('button', { name: 'Print', exact: true })).toBeEnabled();
  await expect(preview).toHaveAttribute('aria-busy', 'false');
  const classic = await preview.getAttribute('data-render-id');
  let finish: () => void = () => {};
  const barrier = new Promise<void>((resolve) => {
    finish = resolve;
  });
  let held = false;
  await page.route('**/api/renders/*', async (route) => {
    if (route.request().method() !== 'GET') return route.continue();
    const response = await route.fetch();
    const job = await response.json();
    if (job.settings.mode === 'book' && job.status === 'completed') {
      held = true;
      await barrier;
    }
    await route.fulfill({ response });
  });
  await page.getByRole('button', { name: 'Rich', exact: true }).click();
  await expect.poll(() => held).toBe(true);
  await page.getByRole('button', { name: 'Basic', exact: true }).click();
  await expect(preview).toHaveAttribute('data-render-id', classic!);
  finish();
  await expect(page.getByRole('button', { name: 'Print', exact: true })).toBeEnabled();
  await expect(preview).toHaveAttribute('data-render-id', classic!);
  await page.getByRole('button', { name: 'Rich', exact: true }).click();
  await expect(preview).not.toHaveAttribute('data-render-id', classic!);
  await expect(page.getByRole('button', { name: 'Print', exact: true })).toBeEnabled();
});

test('an older renderer fingerprint does not force regeneration to Print or Revert a completed layout', async ({
  page,
  request,
}) => {
  let renders = 0;
  page.on('request', (r) => {
    if (r.method() === 'POST' && /\/renders$/.test(r.url())) renders++;
  });
  await page.goto('/');
  await page.getByLabel('Import book', { exact: true }).setInputFiles('tests/fixtures/classic.txt');
  await expect(page.getByRole('button', { name: 'Print', exact: true })).toBeEnabled();
  const preview = page.locator('[aria-label="Print preview"]:visible');
  const id = (await preview.getAttribute('data-render-id'))!;
  await page.route('**/api/documents/*', async (route) => {
    const response = await route.fetch();
    const doc = await response.json();
    for (const r of doc.renders || []) if (r.result) r.result.fingerprint.source = 'an-earlier-build';
    await route.fulfill({ response, json: doc });
  });
  await page.reload();
  await expect(page.getByRole('button', { name: 'Print', exact: true })).toBeEnabled();
  await expect(preview).toHaveAttribute('data-render-id', id);
  await page.getByLabel('Text size in CSS pixels').fill('7');
  await page.getByRole('button', { name: 'Revert changes', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Print', exact: true })).toBeEnabled();
  await expect(preview).toHaveAttribute('data-render-id', id);
  expect(renders).toBe(1);
  expect((await request.get(`/api/renders/${id}/download`)).ok()).toBe(true);
});
