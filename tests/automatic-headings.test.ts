import { expect, it } from 'vitest';
import { automaticTextHeadings, selectedDocumentBlocks, defaultSettings, type BookDocument } from '@microbook/core';
const document = (titles: string[], texts: string[], kind = 'heading') => ({
  sections: titles.map((title, i) => ({ id: String(i), title })),
  blocks: texts.map((text, i) => ({ id: String(i), sectionId: String(i), kind, inlines: [{ text }] })),
  assets: [],
}) as unknown as BookDocument;
it('recognizes numbered contents headings and preserves source text and IDs', () => {
  const doc = document(['002: Adjustments'], ['002: ADJUSTMENTS']);
  expect(automaticTextHeadings(doc).get('0')).toBe('chapter');
  const blocks = selectedDocumentBlocks(doc, defaultSettings());
  expect(blocks[0].headingKind).toBe('chapter');
  expect(blocks[0].inlines).toBe(doc.blocks[0].inlines);
  expect(doc.blocks[0].headingKind).toBeUndefined();
  expect(selectedDocumentBlocks(doc, defaultSettings('classic'))[0].headingKind).toBeUndefined();
});
it('requires a cross-section increasing sequence without contents support', () => {
  expect(automaticTextHeadings(document(['a','b','c'], ['001: First','002: Next','003: Last'])).size).toBe(3);
  expect(automaticTextHeadings(document(['a','b'], ['001: First','002: Next'])).size).toBe(0);
  expect(automaticTextHeadings(document(['a','b','c'], ['003: First','002: Next','001: Last'])).size).toBe(0);
  expect(automaticTextHeadings(document(['a','b','c'], ['001: First','002: Next','003: Last'], 'paragraph')).size).toBe(0);
});
it('excludes inner numbered headings and front matter and preserves custom overrides', () => {
  const doc = document(['Contents'], ['Contents']);
  doc.blocks.push({ ...doc.blocks[0], id: 'inner', inlines: [{ text: '002: Adjustments' }] });
  expect(automaticTextHeadings(doc).size).toBe(0);
  const numbered = document(['002: Adjustments'], ['002: Adjustments']);
  expect(selectedDocumentBlocks(numbered, { ...defaultSettings(), customHeadingRules: [{ pattern: '#: *', headingKind: 'part' }] })[0].headingKind).toBe('part');
});
it('combines split opening labels and titles into canonical headings', () => {
  const doc = {
    sections: [{ id: 'part', title: 'Part I: Range Light' }],
    assets: [],
    blocks: [
      {
        id: 'label', sectionId: 'part', kind: 'paragraph', align: 'center', anchorKeys: ['part'],
        inlines: [{ text: 'PART I', marks: ['strong'] }],
      },
      {
        id: 'title', sectionId: 'part', kind: 'paragraph', anchorKeys: ['title'],
        inlines: [{ text: 'RANGE LIGHT', marks: ['strong', 'em'] }],
      },
      { id: 'body', sectionId: 'part', kind: 'paragraph', inlines: [{ text: 'Opening prose.' }] },
    ],
  } as unknown as BookDocument;
  const blocks = selectedDocumentBlocks(doc, defaultSettings());
  expect(blocks.map((block) => block.id)).toEqual(['label', 'body']);
  expect(blocks[0]).toMatchObject({ kind: 'heading', headingKind: 'part', align: undefined });
  expect(blocks[0].anchorKeys).toEqual(['part', 'title']);
  expect(blocks[0].inlines.map((inline) => inline.text).join('')).toBe('PART I RANGE LIGHT');
  expect(blocks[0].inlines.flatMap((inline) => inline.marks || [])).toEqual([]);
  expect(doc.blocks).toHaveLength(3);
});
it('does not absorb an epigraph after a complete standalone chapter label', () => {
  const doc = {
    sections: [{ id: 'chapter', title: 'Chapter 1' }],
    assets: [],
    blocks: [
      { id: 'label', sectionId: 'chapter', kind: 'heading', inlines: [{ text: 'Chapter 1' }] },
      { id: 'quote', sectionId: 'chapter', kind: 'quote', inlines: [{ text: 'An epigraph.' }] },
    ],
  } as unknown as BookDocument;
  expect(selectedDocumentBlocks(doc, defaultSettings()).map((block) => block.id)).toEqual(['label', 'quote']);
});
