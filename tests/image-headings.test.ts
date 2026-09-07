import { describe, expect, it } from 'vitest';
import {
  automaticImageHeadings,
  defaultSettings,
  documentText,
  selectedDocumentBlocks,
  settingsSchema,
  type BookDocument,
} from '@microbook/core';
const make = (
  alt = 'Chapter 48 The Hatchet Man in Buffalo',
  title = 'Chapter 48: The Hatchet Man in Buffalo',
  before = false,
) =>
  ({
    sections: [{ id: 's1', title }],
    assets: [{ id: 'a1', alt }],
    blocks: [
      ...(before
        ? [{ id: 'before', kind: 'paragraph', sectionId: 's1', inlines: [{ text: 'Earlier prose.' }] }]
        : []),
      { id: 'page', kind: 'paragraph', sectionId: 's1', inlines: [], pageLabel: '235' },
      { id: 'image', kind: 'image', sectionId: 's1', assetId: 'a1', inlines: [] },
      { id: 'after', kind: 'paragraph', sectionId: 's1', inlines: [{ text: 'Following prose.' }] },
    ],
  }) as unknown as BookDocument;
describe('heading artwork', () => {
  it('recognizes unmarked opening artwork only when its label agrees with the section title', () => {
    expect(automaticImageHeadings(make()).get('image')?.headingKind).toBe('chapter');
    expect(automaticImageHeadings(make('Part II Home', 'Part II: Home')).get('image')?.headingKind).toBe(
      'part',
    );
    for (const doc of [
      make('A chapter illustration'),
      make(undefined, 'Another chapter'),
      make(undefined, undefined, true),
      make('Home', 'Home'),
    ])
      expect(automaticImageHeadings(doc).size).toBe(0);
  });
  it('converts heading text without modifying source or Basic content, and permits image overrides', () => {
    const doc = make(),
      original = JSON.stringify(doc),
      basic = documentText(doc);
    const rich = defaultSettings('book');
    expect(documentText(doc, rich)).toContain('Chapter 48 The Hatchet Man in Buffalo');
    expect(
      selectedDocumentBlocks(doc, { ...rich, includeImages: false, excludedImageIds: ['image'] }).some(
        (b) => b.id === 'image',
      ),
    ).toBe(true);
    const restored = { ...rich, imageTreatments: { image: { kind: 'image' as const } } };
    expect(selectedDocumentBlocks(doc, restored).find((b) => b.id === 'image')?.imageHeading).toBeUndefined();
    expect(JSON.stringify(doc)).toBe(original);
    expect(documentText(doc, defaultSettings('classic'))).toBe(basic);
  });
  it('manual text and chapter/part choice affect coverage, reset, and schema validation', () => {
    const doc = make('Map of a city');
    const settings = settingsSchema.parse({
      imageTreatments: { image: { kind: 'heading', text: 'Part I Arrival', headingKind: 'part' } },
    });
    const b = selectedDocumentBlocks(doc, settings).find((b) => b.id === 'image');
    expect(b?.headingKind).toBe('part');
    expect(b?.imageHeading).toBe('Part I Arrival');
    expect(documentText(doc, settings)).toBe('Part I Arrival\n\nFollowing prose.');
    expect(documentText(doc, { ...settings, imageTreatments: {} })).toBe('Following prose.');
    expect(
      settingsSchema.safeParse({
        imageTreatments: { image: { kind: 'heading', text: ' ', headingKind: 'part' } },
      }).success,
    ).toBe(false);
  });
});
