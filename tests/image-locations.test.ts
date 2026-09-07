import { describe, it, expect } from 'vitest';
import { imageLocations, printedLocation } from '../apps/web/src/imageLocations';
import type { BookDocument, RenderResult } from '@microbook/core';
const doc = {
  blocks: [
    { id: 'before', kind: 'paragraph', inlines: [] },
    { id: 'image', kind: 'image', sectionId: 'chapter', inlines: [] },
    { id: 'heading', kind: 'image', imageHeading: 'Chapter One', inlines: [] },
    { id: 'after', kind: 'paragraph', inlines: [] },
  ],
  sections: [{ id: 'chapter', title: 'Chapter One' }],
  assets: [],
} as unknown as BookDocument;
const result = (ids: string[]) =>
  ({ cells: ids.map((id, i) => ({ index: i, page: i, blockIds: [id] })) }) as RenderResult;
describe('image navigation', () => {
  it('uses exact source IDs and skips headings represented by artwork', () => {
    const r = result(['image']);
    r.imageRegions = [{ blockId: 'image', page: 0, x: 1, y: 2, width: 3, height: 4 }];
    const rows = imageLocations(doc, r);
    expect(rows).toHaveLength(1);
    expect(rows[0].region?.x).toBe(1);
    expect(rows[0].section).toBe('Chapter One');
  });
  it('finds following context, then preceding context, without inventing an image location', () => {
    let row = imageLocations(doc, result(['before', 'after']))[0];
    expect(row.cell).toBeUndefined();
    expect(row.context?.index).toBe(1);
    row = imageLocations(doc, result(['before']))[0];
    expect(row.context?.index).toBe(0);
    expect(imageLocations(doc, result([]))[0].context).toBeUndefined();
  });
  it('supports legacy maps without identified image regions', () => {
    const row = imageLocations(doc, result(['image']))[0];
    expect(row.cell?.index).toBe(0);
    expect(row.region).toBeUndefined();
    expect(printedLocation(5)).toBe('Sheet 3 · Back');
  });
});
