import { it, expect } from 'vitest';
import {
  defaultSettings,
  orderedSections,
  selectedDocumentBlocks,
  settingsSchema,
  type BookDocument,
} from '@microbook/core';
it('orders whole sections by stable IDs without mutating source or changing order within a section', () => {
  const doc = {
    sections: [
      { id: 'a', title: 'A' },
      { id: 'b', title: 'B' },
      { id: 'c', title: 'C' },
    ],
    blocks: [
      { id: 'a1', sectionId: 'a', kind: 'paragraph', inlines: [{ text: 'A' }] },
      { id: 'a2', sectionId: 'a', kind: 'paragraph', inlines: [{ text: 'A2' }] },
      { id: 'b1', sectionId: 'b', kind: 'paragraph', inlines: [{ text: 'B' }] },
      { id: 'c1', sectionId: 'c', kind: 'paragraph', inlines: [{ text: 'C' }] },
    ],
  } as unknown as BookDocument;
  const before = JSON.stringify(doc),
    settings = { ...defaultSettings(), sectionOrder: ['c', 'a', 'b'] };
  expect(selectedDocumentBlocks(doc, settings).map((b) => b.id)).toEqual(['c1', 'a1', 'a2', 'b1']);
  expect(selectedDocumentBlocks(doc, { ...settings, selectedSections: ['a', 'b'] }).map((b) => b.id)).toEqual(
    ['a1', 'a2', 'b1'],
  );
  expect(orderedSections(doc, ['missing', 'b']).map((s) => s.id)).toEqual(['b', 'a', 'c']);
  expect(JSON.stringify(doc)).toBe(before);
  expect(settingsSchema.parse({}).sectionOrder).toEqual([]);
  expect(settingsSchema.safeParse({ sectionOrder: ['a', 'a'] }).success).toBe(false);
});
