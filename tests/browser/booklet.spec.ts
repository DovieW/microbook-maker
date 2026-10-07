import { expect, test, type APIRequestContext } from '@playwright/test';
import { defaultSettings, newRichFeatures } from '@microbook/core';
// @ts-expect-error fixture writer
import { syntheticEntries, zip, xhtml } from '../../tools/fixtures.mjs';

async function upload(request: APIRequestContext) {
  const epub = zip({
    ...syntheticEntries,
    'OEBPS/text/one.xhtml': xhtml(
      '<h1>First chapter</h1><p>' +
        'Complete prose with meaningful lines. '.repeat(140) +
        '</p><img src="../images/landscape.svg"/><p>Source: calibration chart</p><table><tr><td>Example</td><td>42</td></tr></table>',
    ),
    'OEBPS/text/two.xhtml': xhtml(
      '<h1>Second chapter</h1><p>' + 'Remaining story text stays in sequence. '.repeat(100) + '</p>',
    ),
  });
  const response = await request.post('/api/documents', {
    multipart: { file: { name: 'booklet.epub', mimeType: 'application/epub+zip', buffer: epub } },
  });
  expect(response.ok()).toBe(true);
  return response.json();
}
async function render(request: APIRequestContext, id: string, settings: any) {
  const response = await request.post(`/api/documents/${id}/renders`, { data: { settings } });
  expect(response.ok()).toBe(true);
  let job = await response.json();
  await expect
    .poll(
      async () => {
        job = await (await request.get(`/api/renders/${job.id}`)).json();
        if (job.status === 'failed') throw Error(JSON.stringify(job));
        return job.status;
      },
      { timeout: 60000 },
    )
    .toBe('completed');
  return job;
}

test('all booklet sizes preserve content, map both PDFs and stay inside their cut pieces', async ({
  request,
}) => {
  const doc = await upload(request);
  const base = {
    ...defaultSettings(),
    rich: newRichFeatures(),
    printFormat: 'booklet',
    imageLayout: 'four-cells',
  };
  for (const width of [1, 2])
    for (const height of [1, 2, 3, 4]) {
      const job = await render(request, doc.id, {
        ...base,
        booklet: { ...base.booklet, pageWidth: width, pageHeight: height },
      });
      const result = job.result;
      expect(result.coverage.complete).toBe(true);
      expect(result.coverage.overflows).toBe(0);
      expect(result.booklet.reading.cells).toHaveLength(result.cells.length);
      expect(result.booklet.pageCount % 4).toBe(0);
      for (const cell of result.cells) {
        const placement = result.booklet.placements.find((p: any) => p.pageNumber === cell.index + 1);
        expect(cell.page).toBe(placement.printPage);
        expect(cell.x).toBe(placement.x);
        expect(cell.width).toBe(153 * width);
        expect(cell.span).toBeUndefined();
      }
      const printed = await request.get(`/api/renders/${job.id}/pdf`);
      const reading = await request.get(`/api/renders/${job.id}/reading-pdf`);
      expect(printed.ok()).toBe(true);
      expect(reading.ok()).toBe(true);
      expect((await reading.body()).subarray(0, 4).toString()).toBe('%PDF');
      expect((await printed.body()).equals(await reading.body())).toBe(false);
    }
});

test('booklet controls stage changes and both previews restore from history', async ({ request, page }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto('/');
  await page.getByLabel('Import book', { exact: true }).setInputFiles('tests/fixtures/classic.txt');
  await expect(page.locator('.print-action')).toHaveAttribute('aria-label', 'Print', { timeout: 60000 });
  await page.getByRole('tab', { name: 'Layout', exact: true }).click();
  await page.getByRole('button', { name: 'Rich', exact: true }).click();
  await expect(page.locator('.print-action')).toHaveAttribute('aria-label', 'Print', { timeout: 60000 });
  const original = await page.locator('[aria-label="Print preview"]:visible').getAttribute('data-render-id');
  await page.getByRole('combobox', { name: 'Print format', exact: true }).click();
  await page.getByRole('option', { name: 'Bound booklet', exact: true }).click();
  await expect(page.getByRole('combobox', { name: 'Booklet page height' })).toBeVisible();
  await expect(page.getByRole('combobox', { name: 'Reading order' })).toHaveCount(0);
  await expect(page.locator('[aria-label="Print preview"]:visible')).toHaveAttribute(
    'data-render-id',
    original!,
  );
  await page.getByRole('button', { name: 'Apply', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Print sheets', exact: true })).toBeVisible({
    timeout: 60000,
  });
  await expect(page.getByLabel('Reading preview')).toHaveAttribute('aria-busy', 'false');
  await expect(page.getByLabel('Reading preview').locator('.spread')).not.toHaveCount(0);
  await page.screenshot({ path: '.artifacts/booklet-reading.png' });
  await page.getByRole('button', { name: 'Next', exact: true }).click();
  await expect(page.getByLabel('Booklet page', { exact: true })).toHaveValue('2');
  await page.getByRole('button', { name: 'Next', exact: true }).click();
  await expect(page.getByLabel('Booklet page', { exact: true })).toHaveValue('4');
  await page.getByRole('button', { name: 'Print sheets', exact: true }).click();
  await expect(page.locator('[aria-label="Print preview"]:visible')).toBeVisible();
  await expect(page.locator('[aria-label="Print preview"]:visible')).toHaveAttribute('aria-busy', 'false');
  await page.screenshot({ path: '.artifacts/booklet-print.png' });
  await page.getByRole('button', { name: 'Reading', exact: true }).click();
  await expect(page.getByLabel('Reading preview')).toHaveAttribute('aria-busy', 'false');
  await expect(page.getByLabel('Booklet page', { exact: true })).toHaveValue('4');
  await page.getByRole('button', { name: 'Basic', exact: true }).click();
  await expect(page.getByRole('combobox', { name: 'Print format' })).toHaveCount(0);
  await page.getByRole('button', { name: 'Rich', exact: true }).click();
  await expect(page.getByRole('combobox', { name: 'Print format' })).toHaveText('Bound booklet');
  await page.reload();
  await expect(page.getByRole('button', { name: 'Reading', exact: true })).toBeVisible({ timeout: 60000 });
  expect(errors).toEqual([]);
});

test('booklet PDFs retain linked notes and bookmarks with page-based references', async ({
  request,
  page,
}) => {
  // @ts-expect-error fixture writer
  const { richFixture } = await import('../../tools/rich-fixture.mjs');
  const uploaded = await request.post('/api/documents', {
    multipart: {
      file: { name: 'bound-notes.epub', mimeType: 'application/epub+zip', buffer: richFixture() },
    },
  });
  const doc = await uploaded.json();
  const base = { ...defaultSettings(), rich: newRichFeatures() };
  const job = await render(request, doc.id, {
    ...base,
    printFormat: 'booklet',
    booklet: { ...base.booklet, piecesPerSignature: 1 },
  });
  expect(job.result.coverage.complete).toBe(true);
  await page.goto('/');
  await page.route('**/booklet-pdf.mjs', (r) =>
    r.fulfill({ path: 'node_modules/pdfjs-dist/build/pdf.mjs', contentType: 'text/javascript' }),
  );
  await page.route('**/booklet-worker.mjs', (r) =>
    r.fulfill({ path: 'node_modules/pdfjs-dist/build/pdf.worker.min.mjs', contentType: 'text/javascript' }),
  );
  const documents = await page.evaluate(async (id) => {
    const moduleUrl = '/booklet-pdf.mjs';
    const pdfjs = await import(/* @vite-ignore */ moduleUrl);
    pdfjs.GlobalWorkerOptions.workerSrc = '/booklet-worker.mjs';
    const documents = [];
    for (const artifact of ['pdf', 'reading-pdf']) {
      const task = pdfjs.getDocument({ url: `/api/renders/${id}/${artifact}` });
      const pdf = await task.promise;
      const outline = await pdf.getOutline();
      let text = '',
        internal = 0;
      for (let index = 1; index <= pdf.numPages; index++) {
        const leaf = await pdf.getPage(index);
        text += (await leaf.getTextContent()).items.map((item: any) => item.str || '').join(' ') + '\n';
        for (const annotation of await leaf.getAnnotations()) {
          if (annotation.dest) {
            const destination =
              typeof annotation.dest === 'string'
                ? await pdf.getDestination(annotation.dest)
                : annotation.dest;
            const target =
              typeof destination[0] === 'number' ? destination[0] : await pdf.getPageIndex(destination[0]);
            if (target < 0 || target >= pdf.numPages) throw Error('Invalid internal link');
            internal++;
          }
        }
      }
      documents.push({ pages: pdf.numPages, outline, text, internal });
      await task.destroy();
    }
    return documents;
  }, job.id);
  expect(documents[0].pages).toBe(job.result.pages);
  expect(documents[1].pages).toBe(job.result.booklet.pageCount);
  for (const doc of documents) {
    expect(doc.internal).toBeGreaterThan(0);
    expect(doc.outline?.length).toBeGreaterThan(0);
    expect(doc.text.match(/NOTE-BODY/g)).toHaveLength(1);
    expect(doc.text).toMatch(/Page \d+/);
    expect(doc.text).not.toMatch(/Sheet \d+.*Cell \d+/);
  }
});
