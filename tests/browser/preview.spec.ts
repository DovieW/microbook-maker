import { test, expect } from '@playwright/test';
import fs from 'node:fs/promises';
import path from 'node:path';

test('sheet preview faithfully reproduces the exported PDF', async ({ page, request }) => {
  let pdfUrl = '';
  page.on('request', (req) => {
    if (/\/api\/renders\/[^/]+\/pdf$/.test(req.url())) pdfUrl = req.url();
  });
  await page.goto('/');
  await page.getByLabel('Import book', { exact: true }).setInputFiles('tests/fixtures/structured.epub');
  await expect(page.getByRole('button', { name: 'Print', exact: true })).toBeEnabled();
  await page.setViewportSize({ width: 390, height: 844 });
  // Use an exact scale: fit-to-width rounds canvas pixels independently of the PDF viewport.
  await page.getByRole('button', { name: 'Actual size (100%)', exact: true }).click();
  await expect
    .poll(() =>
      page
        .locator('[aria-label="Print preview"]:visible .page canvas')
        .first()
        .evaluate((el: HTMLCanvasElement) => el.width),
    )
    .toBe(816);
  await expect(page.locator('[aria-label="Print preview"]:visible')).toHaveAttribute('aria-busy', 'false');
  await expect(page.locator('[aria-label="Print preview"]:visible .page canvas').first()).toBeVisible();
  const rect = {
    page: 0,
    x: 0,
    y: 0,
    width: 612,
    height: 792,
  };
  await page.route('**/test-pdf.mjs', (route) =>
    route.fulfill({ path: 'node_modules/pdfjs-dist/build/pdf.mjs', contentType: 'text/javascript' }),
  );
  await page.route('**/test-pdf-worker.mjs', (route) =>
    route.fulfill({
      path: 'node_modules/pdfjs-dist/build/pdf.worker.min.mjs',
      contentType: 'text/javascript',
    }),
  );
  const check = await page.evaluate(
    async ({ url, rect }) => {
      // An independent, uncropped PDF.js render is the pixel reference.
      const moduleUrl = '/test-pdf.mjs';
      const pdfjs = await import(/* @vite-ignore */ moduleUrl);
      pdfjs.GlobalWorkerOptions.workerSrc = '/test-pdf-worker.mjs';
      const loading = pdfjs.getDocument({ url });
      const pdf = await loading.promise;
      const source = await pdf.getPage(rect.page + 1);
      const actual = document.querySelector(
        '[aria-label="Print preview"]:not([hidden]) .page canvas',
      ) as HTMLCanvasElement;
      const scale = actual.width / rect.width;
      const full = document.createElement('canvas');
      const viewport = source.getViewport({ scale });
      full.width = Math.ceil(viewport.width);
      full.height = Math.ceil(viewport.height);
      await source.render({ canvas: full, viewport }).promise;
      const expected = document.createElement('canvas');
      expected.width = actual.width;
      expected.height = actual.height;
      expected
        .getContext('2d')!
        .drawImage(
          full,
          rect.x * scale,
          rect.y * scale,
          rect.width * scale,
          rect.height * scale,
          0,
          0,
          expected.width,
          expected.height,
        );
      const a = actual.getContext('2d')!.getImageData(0, 0, actual.width, actual.height).data;
      const b = expected.getContext('2d')!.getImageData(0, 0, expected.width, expected.height).data;
      let pixelDifference = 0;
      let actualInk = 0,
        expectedInk = 0;
      for (let i = 0; i < a.length; i += 4) {
        pixelDifference += Math.abs(a[i] - b[i]);
        actualInk += 255 - a[i];
        expectedInk += 255 - b[i];
      }
      const result = {
        ratio: actualInk / expectedInk,
        meanPixelDifference: pixelDifference / (a.length / 4),
        actual: actual.toDataURL(),
        expected: expected.toDataURL(),
      };
      await loading.destroy();
      return result;
    },
    { url: pdfUrl, rect },
  );
  const out = process.env.MB_REPORT_DIR || 'test-results';
  await fs.mkdir(out, { recursive: true });
  for (const kind of ['actual', 'expected'] as const)
    await fs.writeFile(
      path.join(out, `sheet-reference-${kind}.png`),
      Buffer.from(check[kind].split(',')[1], 'base64'),
    );
  expect(check.meanPixelDifference).toBeLessThan(1);
  expect(check.ratio).toBeGreaterThan(0.98);
  expect(check.ratio).toBeLessThan(1.02);
});
