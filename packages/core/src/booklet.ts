import type { RenderSettings } from './index';

export interface BookletPlacement {
  /** One-based logical page; padding pages follow the content pages. */
  pageNumber: number;
  signature: number;
  piece: number;
  sheet: number;
  side: 'front' | 'back';
  printPage: number;
  x: number;
  y: number;
  width: number;
  height: number;
}
export function bookletGeometry(settings: RenderSettings) {
  const width = 153 * settings.booklet.pageWidth;
  const height = 198 * settings.booklet.pageHeight;
  return { width, height, columns: Math.floor(612 / (width * 2)), rows: Math.floor(792 / height) };
}
/** Coordinates are PDF points on portrait Letter; backs mirror across the long edge. */
export function imposeBooklet(contentPages: number, settings: RenderSettings) {
  const { width, height, columns, rows } = bookletGeometry(settings);
  const capacity = columns * rows;
  const placements: BookletPlacement[] = [];
  let start = 0,
    signature = 0,
    pieceIndex = 0;
  while (start < contentPages) {
    signature++;
    const count = Math.ceil(Math.min(settings.booklet.piecesPerSignature * 4, contentPages - start) / 4) * 4;
    for (let i = 0; i < count / 4; i++, pieceIndex++) {
      const sheet = Math.floor(pieceIndex / capacity);
      const slot = pieceIndex % capacity;
      const x = (slot % columns) * width * 2;
      const y = Math.floor(slot / columns) * height;
      for (const [side, pair] of [
        ['front', [count - 2 * i, 1 + 2 * i]],
        ['back', [2 + 2 * i, count - 1 - 2 * i]],
      ] as const) {
        const origin = side === 'front' ? x : 612 - x - width * 2;
        pair.forEach((page, half) =>
          placements.push({
            pageNumber: start + page,
            signature,
            piece: i + 1,
            sheet: sheet + 1,
            side,
            printPage: sheet * 2 + (side === 'back' ? 1 : 0),
            x: origin + half * width,
            y,
            width,
            height,
          }),
        );
      }
    }
    start += count;
  }
  return {
    contentPages,
    pageCount: start,
    signatures: signature,
    sheets: Math.ceil(pieceIndex / capacity),
    placements,
  };
}
