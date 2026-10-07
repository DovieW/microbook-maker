import { describe, expect, it } from 'vitest';
import {
  defaultSettings,
  settingsSchema,
  imposeBooklet,
  bookletGeometry,
  imageLayoutForBlock,
} from '@microbook/core';

describe('bound booklet imposition', () => {
  const settings = { ...defaultSettings(), printFormat: 'booklet' as const };
  it('pairs nested pages and shrinks the final signature', () => {
    const plan = imposeBooklet(21, settings);
    expect(plan.pageCount).toBe(24);
    expect(plan.signatures).toBe(2);
    const pair = (signature: number, piece: number, side: string) =>
      plan.placements
        .filter((p) => p.signature === signature && p.piece === piece && p.side === side)
        .sort((a, b) => a.x - b.x)
        .map((p) => p.pageNumber);
    expect(pair(1, 1, 'front')).toEqual([16, 1]);
    expect(pair(1, 1, 'back')).toEqual([2, 15]);
    expect(pair(1, 4, 'front')).toEqual([10, 7]);
    expect(pair(2, 1, 'front')).toEqual([24, 17]);
    expect(pair(2, 2, 'back')).toEqual([20, 21]);
  });
  for (const width of [1, 2] as const)
    for (const height of [1, 2, 3, 4] as const) {
      it(`packs ${width} × ${height} pages without overlap and mirrors duplex cuts`, () => {
        const s = { ...settings, booklet: { ...settings.booklet, pageWidth: width, pageHeight: height } };
        const g = bookletGeometry(s);
        for (const count of [1, 4, 15, 16, 17, 39, 64]) {
          const plan = imposeBooklet(count, s);
          expect(plan.placements.length).toBe(plan.pageCount);
          expect(new Set(plan.placements.map((p) => p.pageNumber)).size).toBe(plan.pageCount);
          expect(plan.pageCount - count).toBeLessThan(4);
          for (const p of plan.placements) {
            expect(p.x + p.width).toBeLessThanOrEqual(612);
            expect(p.y + p.height).toBeLessThanOrEqual(792);
            const conflicts = plan.placements.filter(
              (q) =>
                p !== q &&
                q.printPage === p.printPage &&
                p.x < q.x + q.width &&
                q.x < p.x + p.width &&
                p.y < q.y + q.height &&
                q.y < p.y + p.height,
            );
            expect(conflicts).toHaveLength(0);
          }
          for (const p of plan.placements.filter((p) => p.side === 'front')) {
            const front = plan.placements.filter(
              (q) => q.signature === p.signature && q.piece === p.piece && q.side === 'front',
            );
            const back = plan.placements.filter(
              (q) => q.signature === p.signature && q.piece === p.piece && q.side === 'back',
            );
            expect(Math.min(...back.map((q) => q.x))).toBe(
              612 - Math.min(...front.map((q) => q.x)) - 2 * g.width,
            );
            expect(back[0].y).toBe(p.y);
          }
        }
      });
    }
  it('preserves legacy defaults and limits full image spans to one booklet page', () => {
    expect(settingsSchema.parse({}).printFormat).toBe('folded-sheet');
    expect(settingsSchema.parse({ ...settings, mode: 'classic' }).printFormat).toBe('folded-sheet');
    expect(imageLayoutForBlock({ ...settings, imageLayout: 'four-cells' }, 'image')).toBe('cell');
    expect(
      imageLayoutForBlock({ ...settings, printFormat: 'folded-sheet', imageLayout: 'four-cells' }, 'image'),
    ).toBe('four-cells');
    expect(
      settingsSchema.safeParse({ ...settings, booklet: { ...settings.booklet, piecesPerSignature: 9 } })
        .success,
    ).toBe(false);
  });
});
