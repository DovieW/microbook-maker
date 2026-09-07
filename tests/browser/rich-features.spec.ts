import { test, expect } from '@playwright/test';
import { ready } from './helpers';
// @ts-expect-error fixture generator
import { richFixture } from '../../tools/rich-fixture.mjs';
test('Rich defaults produce contents, bookmarks, full URLs, linked notes and exact destinations', async ({
  page,
  request,
}) => {
  await page.goto('/');
  await page
    .getByLabel('Import book', { exact: true })
    .setInputFiles({ name: 'rich.epub', mimeType: 'application/epub+zip', buffer: richFixture() });
  const render = await ready(page, request);
  expect(render.settings.rich.contents).toBe('compact');
  expect(render.result.destinations).toBeDefined();
  expect(render.result.coverage.complete).toBe(true);
  await page.route('**/rich-test-pdf.mjs', (r) =>
    r.fulfill({ path: 'node_modules/pdfjs-dist/build/pdf.mjs', contentType: 'text/javascript' }),
  );
  await page.route('**/rich-test-worker.mjs', (r) =>
    r.fulfill({ path: 'node_modules/pdfjs-dist/build/pdf.worker.min.mjs', contentType: 'text/javascript' }),
  );
  const result = await page.evaluate(async (id) => {
    const url = '/rich-test-pdf.mjs';
    const pdfjs = await import(/* @vite-ignore */ url);
    pdfjs.GlobalWorkerOptions.workerSrc = '/rich-test-worker.mjs';
    const task = pdfjs.getDocument({ url: '/api/renders/' + id + '/pdf' }),
      pdf = await task.promise;
    const outline = await pdf.getOutline();
    let text = '',
      links = 0,
      internal = 0;
    for (let i = 1; i <= pdf.numPages; i++) {
      const page = await pdf.getPage(i);
      text +=
        (await page.getTextContent()).items
          .filter((x: any) => 'str' in x)
          .map((x: any) => x.str)
          .join(' ') + '\n';
      for (const a of await page.getAnnotations()) {
        if (a.url) links++;
        if (a.dest) internal++;
      }
    }
    await task.destroy();
    return { outline, text, links, internal };
  }, render.id);
  expect(result.outline?.length).toBeGreaterThan(0);
  expect(result.links).toBeGreaterThan(0);
  expect(result.internal).toBeGreaterThan(0);
  expect(result.text).toContain('NOTE-BODY');
  expect(result.text.match(/NOTE-BODY/g)).toHaveLength(1);
  expect(result.text).toContain('example.com/articles?edition=1#details');
  expect(result.text).toContain('Cell');
});

test('optional Rich formatting renders, reverts, and preserves PDF text', async ({ page, request }) => {
  await page.goto('/');
  await page
    .getByLabel('Import book', { exact: true })
    .setInputFiles({ name: 'features.epub', mimeType: 'application/epub+zip', buffer: richFixture() });
  const original = await ready(page, request);
  await page.getByText('Navigation & references', { exact: true }).click();
  await page.getByLabel('Chapter names in mini headers', { exact: true }).check();
  await expect(page.getByRole('button', { name: 'Revert changes', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Revert changes', exact: true }).click();
  await expect(page.getByLabel('Chapter names in mini headers', { exact: true })).not.toBeChecked();
  for (const notes of ['paragraph', 'book', 'source']) {
    const response = await request.post('/api/documents/' + original.documentId + '/renders', {
      data: {
        settings: {
          ...original.settings,
          rich: {
            ...original.settings.rich,
            notes,
            urls: 'book',
            pageReferences: 'boundaries',
            contentsDepth: 'all',
            bookmarkDepth: 'all',
            dropCaps: true,
            dropCapLines: 3,
            vectors: 'raster',
          },
        },
      },
    });
    expect(response.ok()).toBe(true);
    const job = await response.json();
    let completed: any;
    await expect
      .poll(
        async () => {
          completed = await (await request.get('/api/renders/' + job.id)).json();
          return completed.status;
        },
        { timeout: 60000 },
      )
      .toBe('completed');
    expect(completed.result.coverage.complete).toBe(true);
    expect(completed.result.coverage.overflows).toBe(0);
    expect(completed.result.navigation).toHaveLength(3);
  }
});

test('dense linked indexes fit after final printed destinations are filled', async ({ page, request }) => {
  // @ts-expect-error shared original fixture
  const { richEntries } = await import('../../tools/rich-fixture.mjs');
  // @ts-expect-error shared original fixture
  const { zip, xhtml } = await import('../../tools/fixtures.mjs');
  const fixture = zip({
    ...richEntries,
    'OEBPS/text/two.xhtml': xhtml(
      '<h1 id="chapter2">Chapter 2 Second</h1><ul>' +
        Array.from(
          { length: 700 },
          (_, i) =>
            `<li>Index entry ${i}: instruction-following criteria, <a href="one.xhtml#chapter1">Instruction-following criteria</a> and <a href="one.xhtml#sub">A subsection</a></li>`,
        ).join('') +
        '</ul><p>INDEX-END.</p>',
    ),
  });
  await page.goto('/');
  await page
    .getByLabel('Import book', { exact: true })
    .setInputFiles({ name: 'index.epub', mimeType: 'application/epub+zip', buffer: fixture });
  const render = await ready(page, request);
  expect(render.result.coverage.complete).toBe(true);
  expect(render.result.coverage.overflows).toBe(0);
  expect(render.result.cells.map((c: any) => c.text).join('')).toContain('INDEX-END.');
});
