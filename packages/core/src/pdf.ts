import { PDFDocument, StandardFonts, degrees, rgb, type PDFPage, type PDFEmbeddedPage } from 'pdf-lib';
import { bookletGeometry, imposeBooklet } from './booklet';
import type { BookDocument, RenderSettings, RenderResult, CellMap } from './index';

async function loadPdf(input: Uint8Array) {
  try {
    const pdf = await PDFDocument.load(input, { updateMetadata: false });
    if (!pdf.getPageCount()) throw Error('The PDF has no pages.');
    if (pdf.getPageCount() > 10000) throw Error('PDFs can contain up to 10,000 pages.');
    return pdf;
  } catch (error) {
    if (error instanceof Error && /encrypted/i.test(error.message))
      throw Error('This PDF is password-protected. Import an unlocked copy.');
    throw Error(
      error instanceof Error && /no pages|10,000/.test(error.message)
        ? error.message
        : 'Could not read this PDF. Choose a valid PDF file.',
    );
  }
}
export async function inspectPdf(input: Uint8Array) {
  const pdf = await loadPdf(input);
  const pages = pdf.getPages().map((page, index) => {
    const { width, height } = page.getCropBox();
    if (!Number.isFinite(width + height) || width <= 0 || height <= 0)
      throw Error(`PDF page ${index + 1} has invalid dimensions.`);
    return { number: index + 1, width, height, rotation: page.getRotation().angle };
  });
  return { title: pdf.getTitle() || '', author: pdf.getAuthor() || '', pages };
}

/** Embed the original vector content, including its crop box and clockwise page rotation. */
function fitPage(
  target: PDFPage,
  embedded: PDFEmbeddedPage,
  rect: { x: number; y: number; width: number; height: number },
  angle: number,
) {
  const rotation = ((angle % 360) + 360) % 360;
  const swap = rotation === 90 || rotation === 270;
  const scale = Math.min(
    rect.width / (swap ? embedded.height : embedded.width),
    rect.height / (swap ? embedded.width : embedded.height),
  );
  const width = embedded.width * scale,
    height = embedded.height * scale;
  const shownWidth = swap ? height : width,
    shownHeight = swap ? width : height;
  let x = rect.x + (rect.width - shownWidth) / 2,
    y = rect.y + (rect.height - shownHeight) / 2;
  if (rotation === 90) y += width;
  if (rotation === 180) {
    x += width;
    y += height;
  }
  if (rotation === 270) x += height;
  target.drawPage(embedded, { x, y, width, height, rotate: degrees(-rotation) });
}
export async function renderPdfPages(
  input: Uint8Array,
  doc: BookDocument,
  settings: RenderSettings,
  fingerprint: Record<string, string> = {},
  checkCancelled = () => {},
) {
  const started = performance.now();
  const source = await loadPdf(input);
  // Print a copy of any existing form appearances; the uploaded source stays untouched.
  const form = source.getForm();
  if (form.getFields().length) form.flatten({ updateFieldAppearances: false });
  const ids = new Set(doc.sections.map((section) => section.id));
  const order = [
    ...settings.sectionOrder.filter((id) => ids.has(id)),
    ...doc.sections.map((section) => section.id).filter((id) => !settings.sectionOrder.includes(id)),
  ];
  const selected = order.filter(
    (id) => settings.selectedSections === null || settings.selectedSections.includes(id),
  );
  if (!selected.length) throw Error('Select at least one PDF page.');
  const booklet = settings.printFormat === 'booklet';
  const geometry = bookletGeometry(settings);
  const span = settings.pdf.cellsPerPage;
  const width = booklet ? geometry.width : 153 * (span === 1 ? 1 : 2);
  const height = booklet ? geometry.height : 198 * (span === 4 ? 2 : 1);
  const logical = await PDFDocument.create();
  logical.setTitle(doc.metadata.title);
  logical.setAuthor(doc.metadata.author);
  logical.setCreator('MicroBook Maker');
  const font = await logical.embedFont(StandardFonts.Helvetica);
  const readingCells: CellMap[] = [];
  const padding = (settings.pdf.paddingMm * 72) / 25.4;
  const footer = booklet || settings.pdf.pageNumbers ? 10 : 0;
  const imposition = booklet ? imposeBooklet(selected.length, settings) : undefined;
  for (const [index, id] of selected.entries()) {
    checkCancelled();
    if (index % 16 === 0) await new Promise((resolve) => setTimeout(resolve, 0));
    const number = doc.pdfPages?.[doc.sections.findIndex((section) => section.id === id)]?.number;
    if (!number || number > source.getPageCount())
      throw Error('PDF page information is missing. Import the PDF again.');
    const page = source.getPage(number - 1);
    const crop = page.getCropBox();
    // A completely blank PDF page is still an intentional page.
    if (!page.node.Contents()) page.drawText('');
    const embedded = await logical.embedPage(page, {
      left: crop.x,
      bottom: crop.y,
      right: crop.x + crop.width,
      top: crop.y + crop.height,
    });
    const target = logical.addPage([width, height]);
    const binding = booklet ? (settings.booklet.bindingMarginMm * 72) / 25.4 : 0;
    const inset = booklet ? Math.max((3 * 72) / 25.4, padding) : padding;
    const rect = {
      x: inset + (booklet && index % 2 === 0 ? binding : 0),
      y: inset + footer,
      width: width - 2 * inset - binding,
      height: height - 2 * inset - footer,
    };
    let angle =
      settings.pdf.pageRotations[id] !== undefined
        ? page.getRotation().angle + settings.pdf.pageRotations[id]
        : settings.pdf.rotation === 'original' || settings.pdf.rotation === 'auto'
          ? page.getRotation().angle
          : page.getRotation().angle + Number(settings.pdf.rotation);
    if (settings.pdf.rotation === 'auto' && settings.pdf.pageRotations[id] === undefined) {
      const swap = Math.abs(angle % 180) === 90;
      const w = swap ? crop.height : crop.width,
        h = swap ? crop.width : crop.height;
      if (Math.min(rect.width / h, rect.height / w) > Math.min(rect.width / w, rect.height / h)) angle += 90;
    }
    fitPage(target, embedded, rect, angle);
    if (booklet || settings.pdf.pageNumbers)
      target.drawText(String(booklet ? index + 1 : number), { font, size: 5, x: inset, y: 3 });
    if (booklet && settings.booklet.assemblyLabels) {
      const placement = imposition!.placements.find((placement) => placement.pageNumber === index + 1)!;
      target.drawText(`S${placement.signature} / P${placement.piece}`, {
        font,
        size: 5,
        x: width - inset - 40,
        y: 3,
      });
    }
    readingCells.push({
      index,
      page: index,
      x: 0,
      y: 0,
      width,
      height,
      sectionId: id,
      blockIds: [`pdf-page:${id}`],
      text: '',
      readingStart: index,
      readingEnd: index + 1,
    });
  }
  if (imposition) {
    for (let index = selected.length; index < imposition.pageCount; index++) {
      const target = logical.addPage([width, height]);
      target.drawText(String(index + 1), { font, size: 5, x: (3 * 72) / 25.4, y: 3 });
      if (settings.booklet.assemblyLabels) {
        const p = imposition.placements.find((p) => p.pageNumber === index + 1)!;
        target.drawText(`S${p.signature} / P${p.piece}`, {
          font,
          size: 5,
          x: width - (3 * 72) / 25.4 - 40,
          y: 3,
        });
      }
      readingCells.push({
        index,
        page: index,
        x: 0,
        y: 0,
        width,
        height,
        blockIds: [],
        text: '',
        blank: true,
      });
    }
  }
  const printed = await PDFDocument.create();
  printed.setTitle(doc.metadata.title);
  printed.setCreator('MicroBook Maker');
  // Materialize embedded source-page streams before copying this document into print sheets.
  await logical.flush();
  const embeddedPages = await printed.embedPages(logical.getPages());
  const cells: CellMap[] = [];
  if (imposition) {
    for (let i = 0; i < imposition.sheets * 2; i++) printed.addPage([612, 792]);
    for (const p of imposition.placements) {
      checkCancelled();
      const target = printed.getPage(p.printPage);
      if (p.pageNumber <= readingCells.length) {
        target.drawPage(embeddedPages[p.pageNumber - 1], {
          x: p.x,
          y: 792 - p.y - p.height,
          width: p.width,
          height: p.height,
        });
        cells.push({
          ...readingCells[p.pageNumber - 1],
          index: p.pageNumber - 1,
          page: p.printPage,
          x: p.x,
          y: p.y,
        });
      }
      if (p.x % (width * 2) === 0) {
        if (settings.booklet.cutGuides)
          target.drawRectangle({
            x: p.x,
            y: 792 - p.y - height,
            width: width * 2,
            height,
            borderWidth: 0.3,
            borderColor: rgb(0, 0, 0),
          });
        if (settings.booklet.foldGuides)
          target.drawLine({
            start: { x: p.x + width, y: 792 - p.y },
            end: { x: p.x + width, y: 792 - p.y - height },
            thickness: 0.3,
            dashArray: [3, 3],
          });
      }
    }
  } else {
    const columns = 612 / width,
      rows = 792 / height,
      capacity = columns * rows;
    for (let i = 0; i < Math.ceil(selected.length / capacity); i++) printed.addPage([612, 792]);
    for (const [index, embedded] of embeddedPages.entries()) {
      checkCancelled();
      const position = index % capacity;
      // Quadrant order visits each 2 x 2 block before moving to the next.
      const slot =
        span === 1 && settings.readingOrder === 'quadrants'
          ? [0, 1, 4, 5, 2, 3, 6, 7, 8, 9, 12, 13, 10, 11, 14, 15][position]
          : position;
      const x = (slot % columns) * width,
        y = Math.floor(slot / columns) * height;
      const target = printed.getPage(Math.floor(index / capacity));
      const gap = settings.foldGaps ? (settings.foldGapMm * 72) / 25.4 / 2 : 0;
      fitPage(
        target,
        embedded,
        { x: x + gap, y: 792 - y - height + gap, width: width - 2 * gap, height: height - 2 * gap },
        0,
      );
      if (settings.borderStyle !== 'none')
        target.drawRectangle({
          x,
          y: 792 - y - height,
          width,
          height,
          borderColor: rgb(0, 0, 0),
          borderWidth: 0.4,
          borderDashArray:
            settings.borderStyle === 'dashed'
              ? [3, 3]
              : settings.borderStyle === 'dotted'
                ? [1, 2]
                : undefined,
        });
      cells.push({
        ...readingCells[index],
        index,
        page: Math.floor(index / capacity),
        x,
        y,
        slot,
      });
    }
  }
  cells.sort((a, b) => a.index - b.index);
  const sectionRegions = (entries: CellMap[]) =>
    entries
      .filter((cell) => cell.sectionId)
      .map((cell) => ({
        sectionId: cell.sectionId!,
        page: cell.page,
        x: cell.x,
        y: cell.y,
        width: cell.width,
        height: cell.height,
      }));
  const result: RenderResult = {
    pages: printed.getPageCount(),
    sheets: booklet ? imposition!.sheets : Math.ceil(printed.getPageCount() / 2),
    cells,
    sectionRegions: sectionRegions(cells),
    wordCount: 0,
    fingerprint,
    timings: { total: performance.now() - started },
    peakMemoryMb: 0,
    coverage: {
      expectedCharacters: 0,
      renderedCharacters: 0,
      complete: cells.filter((cell) => !cell.blank).length === selected.length,
      overflows: 0,
    },
    diagnostics: [],
    ...(imposition
      ? {
          booklet: {
            contentPages: selected.length,
            pageCount: imposition.pageCount,
            signatures: imposition.signatures,
            width,
            height,
            placements: imposition.placements,
            reading: { cells: readingCells, sectionRegions: sectionRegions(readingCells) },
          },
        }
      : {}),
  };
  const pdf = await printed.save();
  const readingPdf = booklet ? await logical.save() : undefined;
  checkCancelled();
  return { pdf, readingPdf, result };
}
