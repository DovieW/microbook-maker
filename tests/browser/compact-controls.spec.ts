import { test, expect } from '@playwright/test';
import { defaultSettings, newRichFeatures } from '@microbook/core';
import { ready, upload } from './helpers';
// @ts-expect-error shared fixture generator
import { richEntries } from '../../tools/rich-fixture.mjs';
// @ts-expect-error shared fixture generator
import { zip } from '../../tools/fixtures.mjs';

test('printed contents ellipsize by default and position headers fit their final text', async ({
  page,
  request,
}) => {
  const fixture = zip({
    ...richEntries,
    'OEBPS/text/two.xhtml': richEntries['OEBPS/text/two.xhtml'].replace(
      '</body>',
      '<p>' +
        'A readable paragraph continues beside its compact position marker. '.repeat(800) +
        '</p></body>',
    ),
  });
  const response = await request.post('/api/documents', {
    multipart: { file: { name: 'markers.epub', mimeType: 'application/epub+zip', buffer: fixture } },
  });
  const doc = await response.json();
  doc.navigation[0].title =
    'A deliberately long printed contents title with many words that should be abbreviated unless wrapping is enabled';
  await page.goto('/__renderer/book');
  await page.addScriptTag({ url: '/__renderer/book.js' });
  const settings = { ...defaultSettings(), positionHeaders: true, rich: newRichFeatures() };
  const inspect = async (wrap: boolean) =>
    page.evaluate(
      async ({ doc, settings, wrap }) => {
        const result = await (window as any).Microbook.renderBook({
          document: doc,
          settings: { ...settings, rich: { ...settings.rich, contentsWrap: wrap } },
          fontStack: 'Arial',
          assetBase: `/api/documents/${doc.id}/assets`,
        });
        const title = document.querySelector<HTMLElement>('.compact-toc-title')!;
        const style = getComputedStyle(title);
        const markers = Array.from(document.querySelectorAll<HTMLElement>('.cell-position'))
          .filter((el) => getComputedStyle(el).cssFloat === 'left')
          .map((el) => {
            const range = document.createRange();
            range.selectNodeContents(el);
            return { box: el.getBoundingClientRect().width, text: range.getBoundingClientRect().width };
          });
        return {
          coverage: result.coverage,
          markers,
          titleHeight: title.getBoundingClientRect().height,
          lineHeight: parseFloat(style.lineHeight),
          overflow: style.textOverflow,
          whiteSpace: style.whiteSpace,
        };
      },
      { doc, settings, wrap },
    );
  const compact = await inspect(false);
  expect(compact.coverage.complete).toBe(true);
  expect(compact.markers.length).toBeGreaterThan(0);
  for (const marker of compact.markers) expect(Math.abs(marker.box - marker.text)).toBeLessThan(0.2);
  expect(compact.overflow).toBe('ellipsis');
  expect(compact.titleHeight).toBeLessThanOrEqual(compact.lineHeight + 0.2);
  const wrapped = await inspect(true);
  expect(wrapped.coverage.complete).toBe(true);
  expect(wrapped.whiteSpace).toBe('normal');
  expect(wrapped.titleHeight).toBeGreaterThan(compact.titleHeight * 2);
});

test('compact sidebar aligns accordions, keeps font on one line and exposes optional contents wrapping', async ({
  page,
  request,
}) => {
  await page.goto('/');
  await upload(page, 'publisher-alternatives.epub');
  await ready(page, request);
  const font = page.locator('.font-field');
  const geometry = await font.evaluate((el) => {
    const label = el.querySelector('span')!.getBoundingClientRect(),
      control = el.querySelector('button')!.getBoundingClientRect();
    return { labelY: (label.top + label.bottom) / 2, controlY: (control.top + control.bottom) / 2 };
  });
  expect(Math.abs(geometry.labelY - geometry.controlY)).toBeLessThan(2);
  const summaries = await page.locator('.layout-controls > fieldset > details').evaluateAll((els) =>
    els.map((el) => {
      const s = el.querySelector('summary')!;
      const r = s.getBoundingClientRect();
      return {
        margin: parseFloat(getComputedStyle(el).marginTop),
        height: r.height,
        paddingTop: parseFloat(getComputedStyle(s).paddingTop),
        paddingBottom: parseFloat(getComputedStyle(s).paddingBottom),
      };
    }),
  );
  for (const s of summaries) {
    expect(s.margin).toBe(0);
    expect(s.paddingTop).toBe(s.paddingBottom);
  }
  const check = page.getByLabel('Space at folds', { exact: true });
  const dimensions = await check.evaluate((el) => {
    const mark = getComputedStyle(el, '::before');
    return { target: el.getBoundingClientRect().width, inset: parseFloat(mark.top) };
  });
  expect(dimensions.target).toBe(44);
  expect(dimensions.target - 2 * dimensions.inset).toBe(18);
  await page.getByText('Advanced', { exact: true }).click();
  await expect(page.getByLabel('Wrap printed contents titles')).not.toBeChecked();
  await page.getByLabel('Wrap printed contents titles').check();
  await expect(page.getByRole('button', { name: 'Apply', exact: true })).toBeEnabled();
});
