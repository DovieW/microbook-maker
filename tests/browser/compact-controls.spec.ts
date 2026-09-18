import { test, expect } from '@playwright/test';
import { createRequire } from 'node:module';
import { defaultSettings, newRichFeatures } from '@microbook/core';
import { ready, upload } from './helpers';
// @ts-expect-error shared fixture generator
import { richEntries } from '../../tools/rich-fixture.mjs';
// @ts-expect-error shared fixture generator
import { zip } from '../../tools/fixtures.mjs';
const require = createRequire(import.meta.url);
const paginateClassic = require('../../packages/renderer/classic/paginate.cjs');
const classicPipeline = require('../../packages/renderer/classic/pipeline/documentPipeline.js');

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
  const inspect = async (
    wrap: boolean,
    sheetHeaders: 'every' | 'first' | 'off' = 'every',
    foldGapMm = 2.5,
    foldGapEveryRow = true,
    readingOrder: 'rows' | 'quadrants' = 'rows',
    printDate = true,
  ) =>
    page.evaluate(
      async ({ doc, settings, wrap, sheetHeaders, foldGapMm, foldGapEveryRow, readingOrder, printDate }) => {
        const result = await (window as any).Microbook.renderBook({
          document: doc,
          settings: {
            ...settings,
            foldGapMm,
            foldGapEveryRow,
            readingOrder,
            rich: { ...settings.rich, contentsWrap: wrap, sheetHeaders, printDate },
          },
          fontStack: 'Arial',
          assetBase: `/api/documents/${doc.id}/assets`,
          printedAt: '2026-09-18T12:00:00.000Z',
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
        const cells = Array.from(document.querySelectorAll<HTMLElement>('.cell'));
        const runningHeaders = Array.from(document.querySelectorAll<HTMLElement>('.sheet-header')).map(
          (header) => {
            const count = header.querySelector<HTMLElement>('.sheet-header-count')!;
            const separator = header.querySelector<HTMLElement>('.sheet-header-separator')!;
            const headerTitle = header.querySelector<HTMLElement>('.sheet-header-title')!;
            const countRect = count.getBoundingClientRect();
            const separatorRect = separator.getBoundingClientRect();
            const titleRect = headerTitle.getBoundingClientRect();
            return {
              cell: cells.indexOf(header.closest<HTMLElement>('.cell')!),
              text: header.textContent || '',
              sharesMiniHeader: !!header.parentElement?.querySelector(':scope > .cell-position'),
              elementsInOrder: countRect.left < separatorRect.left && separatorRect.left < titleRect.left,
              separator: separator.textContent,
              countSize: parseFloat(getComputedStyle(count).fontSize),
              titleSize: parseFloat(getComputedStyle(headerTitle).fontSize),
            };
          },
        );
        const openingHeader = document.querySelector<HTMLElement>('.book-header');
        const openingTitle = document.querySelector<HTMLElement>('.book-header .book-title');
        let runningTitle = document.querySelector<HTMLElement>('.sheet-header-title');
        let temporaryRunningTitle = false;
        if (!runningTitle) {
          runningTitle = document.createElement('strong');
          runningTitle.className = 'sheet-header-title';
          document.body.append(runningTitle);
          temporaryRunningTitle = true;
        }
        const runningTitleSize = parseFloat(getComputedStyle(runningTitle).fontSize);
        if (temporaryRunningTitle) runningTitle.remove();
        const paddings = [0, 1, 4, 8, 12].map((index) => {
          const cell = cells[index];
          const cellStyle = getComputedStyle(cell);
          return {
            index,
            top: parseFloat(cellStyle.paddingTop),
            right: parseFloat(cellStyle.paddingRight),
            bottom: parseFloat(cellStyle.paddingBottom),
            left: parseFloat(cellStyle.paddingLeft),
          };
        });
        return {
          coverage: result.coverage,
          markers,
          cells: result.cells.length,
          mappedSheetHeaders: result.cells
            .filter((cell: any) => cell.sheetHeader)
            .map((cell: any) => cell.index),
          openingHeaders: document.querySelectorAll('.book-header').length,
          openingHeaderBorder: openingHeader && getComputedStyle(openingHeader).borderTopStyle,
          openingHeaderRule: openingHeader && getComputedStyle(openingHeader).borderBottomStyle,
          openingStats: document.querySelector<HTMLElement>('.book-stats')?.textContent || '',
          openingTitleSize: openingTitle && parseFloat(getComputedStyle(openingTitle).fontSize),
          runningTitleSize,
          runningHeaders,
          flowSlots: result.cells.slice(0, 16).map((cell: any) => cell.slot),
          firstPagePositionSlots: result.cells
            .filter((cell: any) => cell.page === 0 && cell.positionHeader)
            .map((cell: any) => cell.slot),
          destinationMismatches: Object.entries(result.destinations || {}).filter(([id, location]: any) => {
            const cell = result.cells.find((candidate: any) => candidate.blockIds.includes(id));
            return cell && location.cell !== cell.slot + 1;
          }).length,
          paddings,
          titleHeight: title.getBoundingClientRect().height,
          lineHeight: parseFloat(style.lineHeight),
          overflow: style.textOverflow,
          whiteSpace: style.whiteSpace,
        };
      },
      { doc, settings, wrap, sheetHeaders, foldGapMm, foldGapEveryRow, readingOrder, printDate },
    );
  const compact = await inspect(false);
  expect(compact.coverage.complete).toBe(true);
  expect(compact.markers.length).toBeGreaterThan(0);
  for (const marker of compact.markers) expect(Math.abs(marker.box - marker.text)).toBeLessThan(0.2);
  expect(compact.overflow).toBe('ellipsis');
  expect(compact.titleHeight).toBeLessThanOrEqual(compact.lineHeight + 0.2);
  expect(compact.openingHeaders).toBe(1);
  expect(compact.openingHeaderBorder).toBe('none');
  expect(compact.openingHeaderRule).toBe('solid');
  expect(compact.openingTitleSize).toBeCloseTo(6 * 1.7 * 1.3, 2);
  expect(compact.runningTitleSize).toBeCloseTo(6 * 1.15 * 1.3, 2);
  expect(compact.openingStats).toContain('about');
  expect(compact.openingStats).toContain(' · Printed Sep 18, 2026');
  const defaultHalfGap = (2.5 * 96) / 25.4 / 2;
  expect(compact.paddings[0].bottom).toBeCloseTo(defaultHalfGap, 2);
  expect(compact.paddings[1].right).toBeCloseTo(defaultHalfGap, 2);
  expect(compact.paddings[2].top).toBeCloseTo(defaultHalfGap, 2);
  expect(compact.paddings[2].bottom).toBeCloseTo(defaultHalfGap, 2);
  expect(compact.paddings[3].top).toBeCloseTo(defaultHalfGap, 2);
  expect(compact.paddings[3].bottom).toBeCloseTo(defaultHalfGap, 2);
  expect(compact.paddings[4].top).toBeCloseTo(defaultHalfGap, 2);
  expect(compact.runningHeaders).toHaveLength(Math.floor((compact.cells - 1) / 32));
  expect(compact.mappedSheetHeaders).toEqual(compact.runningHeaders.map((header) => header.cell));
  for (const header of compact.runningHeaders) {
    expect(header.cell).toBeGreaterThan(0);
    expect(header.cell % 32).toBe(0);
    expect(header.sharesMiniHeader).toBe(false);
    expect(header.text).toContain(doc.metadata.title);
    expect(header.text).toMatch(/\d+ \/ \d+/);
    expect(header.text).toMatch(/\d+% complete/);
    expect(header.text).toContain('left');
    expect(header.elementsInOrder).toBe(true);
    expect(header.separator).toBe('·');
    expect(header.countSize).toBeCloseTo(header.titleSize, 2);
  }
  const wrapped = await inspect(true);
  expect(wrapped.coverage.complete).toBe(true);
  expect(wrapped.whiteSpace).toBe('normal');
  expect(wrapped.titleHeight).toBeGreaterThan(compact.titleHeight * 2);
  const firstOnly = await inspect(false, 'first', 2.5, true, 'rows', false);
  expect(firstOnly.openingHeaders).toBe(1);
  expect(firstOnly.runningHeaders).toHaveLength(0);
  expect(firstOnly.openingStats).not.toContain('Printed');
  const off = await inspect(false, 'off');
  expect(off.openingHeaders).toBe(0);
  expect(off.runningHeaders).toHaveLength(0);
  const quadrants = await inspect(false, 'every', 3, false);
  const quadrantHalfGap = (3 * 96) / 25.4 / 2;
  expect(quadrants.paddings[0].bottom).toBe(0);
  expect(quadrants.paddings[1].right).toBeCloseTo(quadrantHalfGap, 2);
  expect(quadrants.paddings[2].top).toBe(0);
  expect(quadrants.paddings[2].bottom).toBeCloseTo(quadrantHalfGap, 2);
  expect(quadrants.paddings[3].top).toBeCloseTo(quadrantHalfGap, 2);
  expect(quadrants.paddings[3].bottom).toBe(0);
  expect(quadrants.paddings[4].top).toBe(0);
  const quadrantFlow = await inspect(false, 'every', 2.5, true, 'quadrants');
  expect(quadrantFlow.flowSlots).toEqual([0, 1, 4, 5, 2, 3, 6, 7, 8, 9, 12, 13, 10, 11, 14, 15]);
  expect(quadrantFlow.firstPagePositionSlots).toEqual([2, 8, 10]);
  expect(quadrantFlow.destinationMismatches).toBe(0);
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
        startsAccordions: el.classList.contains('layout-accordion-start'),
        margin: parseFloat(getComputedStyle(el).marginTop),
        height: r.height,
        paddingTop: parseFloat(getComputedStyle(s).paddingTop),
        paddingBottom: parseFloat(getComputedStyle(s).paddingBottom),
      };
    }),
  );
  for (const s of summaries) {
    expect(s.margin).toBe(s.startsAccordions ? 10 : 0);
    expect(s.paddingTop).toBe(s.paddingBottom);
  }
  const check = page.getByLabel('Space at folds', { exact: true });
  const dimensions = await check.evaluate((el) => {
    const mark = getComputedStyle(el, '::before');
    return { target: el.getBoundingClientRect().width, inset: parseFloat(mark.top) };
  });
  expect(dimensions.target).toBe(44);
  expect(dimensions.target - 2 * dimensions.inset).toBe(18);
  await expect(page.getByLabel('Fold gap size', { exact: true })).toHaveValue('2.5');
  await expect(page.getByLabel('Space every row', { exact: true })).toHaveCount(0);
  await expect(page.getByRole('combobox', { name: 'Reading order', exact: true })).toHaveText('Across rows');
  await page.getByRole('combobox', { name: 'Reading order', exact: true }).click();
  await page.getByRole('option', { name: 'By quadrant', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Apply', exact: true })).toBeEnabled();
  await page.getByText('Advanced', { exact: true }).click();
  await expect(page.getByLabel('Wrap printed contents titles')).not.toBeChecked();
  await page.getByLabel('Wrap printed contents titles').check();
  await expect(page.getByRole('button', { name: 'Apply', exact: true })).toBeEnabled();
  await page.getByText('Navigation & references', { exact: true }).click();
  await expect(page.getByRole('combobox', { name: 'Sheet headers', exact: true })).toHaveText('Every sheet');
  await expect(page.getByLabel('Print date', { exact: true })).toBeChecked();
  await page.getByLabel('Print date', { exact: true }).uncheck();
  await expect(page.getByRole('button', { name: 'Apply', exact: true })).toBeEnabled();
});

test('Basic supports quadrant cell flow with configurable fold gaps', async ({ page }) => {
  const document = classicPipeline.normalizeDocument(
    classicPipeline.parseUploadedDocument({
      originalName: 'folds.txt',
      input: Buffer.from(Array.from({ length: 5000 }, (_, index) => `word${index}`).join(' ')),
    }),
  );
  await page.goto('/__renderer/classic');
  const base = new URL(page.url()).origin;
  await page.evaluate(async (base) => {
    const layout = await import(`${base}/__pretext/classic/layout.js`);
    const richInline = await import(`${base}/__pretext/classic/rich-inline.js`);
    (window as any).__microbookPretext = { ...layout, richInline, version: '0.0.6', available: true };
  }, base);
  await page.evaluate(paginateClassic, {
    tokens: classicPipeline.serializeDocumentToTokens(document),
    bookName: 'Fold spacing',
    headerInfo: { fontSize: '6', wordCount: document.wordCount },
    totalWords: document.wordCount,
    foldGaps: true,
    foldGapMm: 3,
    foldGapEveryRow: false,
    readingOrder: 'quadrants',
    batchWords: true,
    justifyAllCells: true,
    optimizationLimits: { maxBlocks: 320, maxDurationMs: 4000 },
  });
  const paddings = await page.locator('.grid-item').evaluateAll((cells) =>
    [0, 1, 4, 8, 12].map((index) => {
      const style = getComputedStyle(cells[index]);
      return {
        top: parseFloat(style.paddingTop),
        right: parseFloat(style.paddingRight),
        bottom: parseFloat(style.paddingBottom),
      };
    }),
  );
  const halfGap = (3 * 96) / 25.4 / 2;
  expect(paddings[0].bottom).toBe(0);
  expect(paddings[1].right).toBeCloseTo(halfGap, 2);
  expect(paddings[2].top).toBe(0);
  expect(paddings[2].bottom).toBeCloseTo(halfGap, 2);
  expect(paddings[3].top).toBeCloseTo(halfGap, 2);
  expect(paddings[3].bottom).toBe(0);
  expect(paddings[4].top).toBe(0);
  const flowSlots = await page.locator('.grid-item').evaluateAll((cells) =>
    cells
      .map((cell) => ({
        slot: Number((cell as HTMLElement).dataset.slot),
        first: Number((cell.textContent || '').match(/word(\d+)/)?.[1]),
      }))
      .filter((item) => Number.isFinite(item.first))
      .sort((a, b) => a.first - b.first)
      .map((item) => item.slot),
  );
  expect(flowSlots.slice(0, 8)).toEqual([0, 1, 4, 5, 2, 3, 6, 7]);
});
