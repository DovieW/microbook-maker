import { expect, test } from '@playwright/test';
import { defaultSettings, newRichFeatures } from '@microbook/core';
// @ts-expect-error fixture writer
import { syntheticEntries, zip, xhtml } from '../../tools/fixtures.mjs';

test('full-cell charts keep plain source credits and fill preceding space with prose', async ({
  request,
}) => {
  const fixture = zip({
    ...syntheticEntries,
    'OEBPS/text/one.xhtml': xhtml(
      '<p>Opening paragraph.</p><img src="../images/landscape.svg"/><p>Principal sources: Example research institute</p><p>Literacy Rates by Country[56]</p><img src="../images/landscape.svg"/><p>Source: Example census</p>',
    ),
    'OEBPS/text/two.xhtml': xhtml(
      '<p>' +
        'Following prose remains readable and complete. '.repeat(120) +
        '</p><h1>Next chapter</h1><p>Ending.</p>',
    ),
  });
  const uploaded = await request.post('/api/documents', {
    multipart: { file: { name: 'chart-credits.epub', mimeType: 'application/epub+zip', buffer: fixture } },
  });
  expect(uploaded.ok()).toBe(true);
  const doc = await uploaded.json();
  const detail = await (await request.get(`/api/documents/${doc.id}`)).json();
  const images = detail.blocks.filter((b: any) => b.kind === 'image');
  const credits = detail.blocks.filter((b: any) =>
    b.inlines.some((i: any) => /Principal sources:|Literacy Rates|Source: Example/.test(i.text)),
  );
  const prose = detail.blocks.find((b: any) =>
    b.inlines.some((i: any) => i.text.startsWith('Following prose')),
  );
  const settings = {
    ...defaultSettings(),
    imageLayout: 'cell',
    rich: { ...newRichFeatures(), contents: 'none', openingImageOrder: 'text-first' },
  };
  const render = async (order: string, fillImageSpace?: boolean) => {
    const response = await request.post(`/api/documents/${doc.id}/renders`, {
      data: {
        settings: { ...settings, fillImageSpace, rich: { ...settings.rich, openingImageOrder: order } },
      },
    });
    expect(response.ok()).toBe(true);
    let job = await response.json();
    await expect
      .poll(
        async () => {
          job = await (await request.get(`/api/renders/${job.id}`)).json();
          return job.status;
        },
        { timeout: 60000 },
      )
      .toBe('completed');
    return job;
  };
  const first = await render('text-first');
  const owner = (job: any, id: string) => job.result.cells.find((c: any) => c.blockIds.includes(id));
  expect(owner(first, prose.id).index).toBeLessThan(owner(first, images[0].id).index);
  for (let i = 0; i < credits.length; i++)
    expect(owner(first, credits[i].id).index).toBe(owner(first, images[i < 2 ? 0 : 1].id).index);
  expect(first.result.coverage.complete).toBe(true);
  expect(first.result.coverage.overflows).toBe(0);
  const heading = detail.blocks.find((b: any) => b.kind === 'heading');
  expect(owner(first, heading.id).index).toBeGreaterThan(owner(first, images[1].id).index);
  const source = await render('source');
  expect(owner(source, prose.id).index).toBeGreaterThan(owner(source, images[0].id).index);
  expect(source.result.coverage.complete).toBe(true);
  expect(owner(source, prose.id).index).toBe(owner(source, images[1].id).index);
  expect(source.result.coverage.overflows).toBe(0);
  const unfilled = await render('source', false);
  expect(owner(unfilled, prose.id).index).toBeGreaterThan(owner(unfilled, images[1].id).index);
  expect(unfilled.result.coverage.complete).toBe(true);
});
