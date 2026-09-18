import { it, expect } from 'vitest';
import {
  defaultSettings,
  imageOrderToken,
  orderedContent,
  orderedSections,
  selectedDocumentBlocks,
  settingsSchema,
  type BookDocument,
} from '@microbook/core';
it('orders whole sections by stable IDs without mutating source or changing order within a section', () => {
  const doc = {
    assets: [{ id: 'asset', path: 'image.png', mediaType: 'image/png', alt: '' }],
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

it('moves an image and its caption between sections only when it has an explicit content position', () => {
  const doc = {
    assets: [{ id: 'asset', path: 'image.png', mediaType: 'image/png', alt: '' }],
    sections: [
      { id: 'a', title: 'A' },
      { id: 'b', title: 'B' },
    ],
    blocks: [
      { id: 'a1', sectionId: 'a', kind: 'paragraph', inlines: [{ text: 'A' }] },
      { id: 'picture', sectionId: 'a', kind: 'image', inlines: [], assetId: 'asset' },
      {
        id: 'caption',
        sectionId: 'a',
        kind: 'paragraph',
        inlines: [{ text: 'Caption' }],
        captionFor: 'picture',
      },
      { id: 'a2', sectionId: 'a', kind: 'paragraph', inlines: [{ text: 'A2' }] },
      { id: 'b1', sectionId: 'b', kind: 'paragraph', inlines: [{ text: 'B' }] },
    ],
  } as unknown as BookDocument;
  const token = imageOrderToken('picture');
  expect(orderedContent(doc, ['b', token, 'a'])).toEqual([
    { kind: 'section', id: 'b' },
    { kind: 'image', id: 'picture', sectionId: 'a' },
    { kind: 'section', id: 'a' },
  ]);
  expect(
    selectedDocumentBlocks(doc, { ...defaultSettings(), sectionOrder: ['b', token, 'a'] }).map(
      (block) => block.id,
    ),
  ).toEqual(['b1', 'picture', 'caption', 'a1', 'a2']);
  expect(selectedDocumentBlocks(doc, defaultSettings()).map((block) => block.id)).toEqual([
    'a1',
    'picture',
    'caption',
    'a2',
    'b1',
  ]);
});
