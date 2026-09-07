import { expect, it } from 'vitest';
import {
  settingsSchema,
  repeatedImageGroups,
  matchingImageBlocks,
  selectedDocumentBlocks,
  type BookDocument,
} from '@microbook/core';
const doc = {
  sections: [{ id: 's', title: 'Section' }],
  assets: [{ id: 'a', alt: '' }],
  blocks: Array.from({ length: 3 }, (_, i) => [
    { id: `p${i}`, kind: 'paragraph', sectionId: 's', inlines: [{ text: 'Before' }] },
    { id: `i${i}`, kind: 'image', assetId: 'a', sectionId: 's', inlines: [] },
    { id: `q${i}`, kind: 'paragraph', sectionId: 's', inlines: [{ text: 'After' }] },
  ]).flat(),
} as unknown as BookDocument;
it('suggests exact repeated assets between paragraphs without changing treatment', () => {
  expect(repeatedImageGroups(doc)[0].map((b) => b.id)).toEqual(['i0', 'i1', 'i2']);
  expect(matchingImageBlocks(doc, doc.blocks[1])).toHaveLength(3);
  expect(repeatedImageGroups({ ...doc, blocks: doc.blocks.slice(0, 6) })).toEqual([]);
  expect(
    repeatedImageGroups({
      ...doc,
      blocks: doc.blocks.map((b) => (b.id === 'i1' ? { ...b, assetId: 'other' } : b)),
    }),
  ).toEqual([]);
  expect(doc.blocks[1].imageHeading).toBeUndefined();
});
it('bounds flourish geometry and retains independent exclusion with no invented text', () => {
  const s = settingsSchema.parse({
    mode: 'book',
    imageTreatments: { i0: { kind: 'flourish' } },
    excludedImageIds: ['i1'],
  });
  expect(s.imageTreatments.i0).toEqual({ kind: 'flourish', widthEm: 4, gapEm: 0.25 });
  expect(
    selectedDocumentBlocks(doc, s)
      .filter((b) => b.kind === 'image')
      .map((b) => b.id),
  ).toEqual(['i0', 'i2']);
  for (const widthEm of [0, 13])
    expect(
      settingsSchema.safeParse({ ...s, imageTreatments: { i0: { kind: 'flourish', widthEm } } }).success,
    ).toBe(false);
  expect(
    settingsSchema.safeParse({ ...s, imageTreatments: { i0: { kind: 'flourish', gapEm: 3 } } }).success,
  ).toBe(false);
});
