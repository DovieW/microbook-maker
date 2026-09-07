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
