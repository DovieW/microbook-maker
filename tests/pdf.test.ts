import { describe, it, expect } from 'vitest';
import { getDocument } from 'pdfjs-dist/legacy/build/pdf.mjs';
import { PDFDocument, StandardFonts, degrees } from 'pdf-lib';
import { importDocument } from '../packages/core/src/import';
import { renderPdfPages } from '../packages/core/src/pdf';
import { defaultSettings, previewRegion, sourceLocation, cellAtLocation } from '../packages/core/src/index';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

async function fixture(count = 19) {
  const pdf = await PDFDocument.create();
  pdf.setTitle('PDF calibration');
  pdf.setAuthor('MicroBook test');
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  for (let i = 0; i < count; i++) {
    const page = pdf.addPage(i % 2 ? [360, 240] : [240, 360]);
    page.drawText(`Source page ${i + 1}`, { x: 20, y: 100, font, size: 24 });
    if (i === 2) page.setRotation(degrees(90));
    if (i === 3) page.setCropBox(10, 20, 320, 200);
  }
  return Buffer.from(await pdf.save());
}
async function imported(input: Buffer) {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'microbook-pdf-'));
  try {
    return await importDocument(input, 'pages.pdf', 'pdf-test', directory);
  } finally {
    await fs.rm(directory, { recursive: true, force: true });
  }
}
describe('PDF import and imposition', () => {
  it('uses PDF metadata, page sizes, crop boxes, and rotations', async () => {
    const doc = await imported(await fixture());
    expect(doc.format).toBe('pdf');
    expect(doc.metadata).toMatchObject({ title: 'PDF calibration', author: 'MicroBook test' });
    expect(doc.sections).toHaveLength(19);
    expect(doc.pdfPages?.[2].rotation).toBe(90);
    expect(doc.pdfPages?.[3]).toMatchObject({ width: 320, height: 200 });
  });
  for (const span of [1, 2, 4] as const)
    it(`fits ${span}-cell pages exactly once, respecting selection and order`, async () => {
      const input = await fixture(),
        doc = await imported(input);
      const settings = defaultSettings('book');
      settings.pdf.cellsPerPage = span;
      settings.sectionOrder = ['p19', 'p3'];
      settings.selectedSections = ['p1', 'p3', 'p19'];
      const output = await renderPdfPages(input, doc, settings);
      expect(output.result.cells.map((cell) => cell.sectionId)).toEqual(['p19', 'p3', 'p1']);
      expect(output.result.coverage.complete).toBe(true);
      expect(previewRegion(output.result.cells, 0)?.width).toBe(output.result.cells[0].width);
      const location = sourceLocation(output.result.cells[0]);
      const reordered = await renderPdfPages(input, doc, { ...settings, sectionOrder: ['p1', 'p3', 'p19'] });
      expect(cellAtLocation(reordered.result.cells, location)).toBe(2);
      const pdf = await PDFDocument.load(output.pdf);
      expect(pdf.getPageCount()).toBe(1);
      expect(pdf.getPage(0).getSize()).toEqual({ width: 612, height: 792 });
      expect(output.readingPdf).toBeUndefined();
    });
  it('preserves a completely blank source page', async () => {
    const source = await PDFDocument.create();
    source.addPage([240, 360]);
    const input = Buffer.from(await source.save());
    const output = await renderPdfPages(input, await imported(input), defaultSettings('book'));
    expect(output.result.cells).toHaveLength(1);
  });
  it('imposes multiple signatures without losing or duplicating a source page', async () => {
    const input = await fixture(),
      doc = await imported(input),
      settings = defaultSettings('book');
    settings.printFormat = 'booklet';
    const output = await renderPdfPages(input, doc, settings);
    expect(output.result.booklet).toMatchObject({ contentPages: 19, pageCount: 20, signatures: 2 });
    expect(
      new Set(output.result.cells.filter((cell) => !cell.blank).map((cell) => cell.sectionId)).size,
    ).toBe(19);
    expect(output.result.cells.filter((cell) => !cell.blank)).toHaveLength(19);
    for (const cell of output.result.cells) {
      const placement = output.result.booklet!.placements.find((p) => p.pageNumber === cell.index + 1)!;
      expect(cell.page).toBe(placement.printPage);
      expect(cell.x).toBe(placement.x);
    }
    expect((await PDFDocument.load(output.readingPdf!)).getPageCount()).toBe(20);
    expect((await PDFDocument.load(output.pdf)).getPageCount()).toBe(output.result.pages);
  });
  it('retains selectable source text through both levels of embedding', async () => {
    const input = await fixture(),
      doc = await imported(input);
    const settings = defaultSettings('book');
    for (const format of ['folded-sheet', 'booklet'] as const) {
      settings.printFormat = format;
      const output = await renderPdfPages(input, doc, settings);
      const loading = getDocument({
        data: output.pdf,
        standardFontDataUrl: path.resolve('node_modules/pdfjs-dist/standard_fonts') + '/',
      });
      try {
        const pdf = await loading.promise;
        let text = '';
        for (let n = 1; n <= pdf.numPages; n++)
          text +=
            (await (await pdf.getPage(n)).getTextContent()).items
              .map((item) => ('str' in item ? item.str : ''))
              .join(' ') + ' ';
        const numbers = [...text.matchAll(/Source page (\d+)/g)]
          .map((match) => Number(match[1]))
          .sort((a, b) => a - b);
        expect(numbers).toEqual(Array.from({ length: 19 }, (_, i) => i + 1));
      } finally {
        await loading.destroy();
      }
    }
  });
  it('rejects a malformed PDF', async () => {
    await expect(imported(Buffer.from('%PDF-not valid'))).rejects.toThrow('Could not read this PDF');
  });
});
