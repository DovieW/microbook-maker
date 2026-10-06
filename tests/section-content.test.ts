import { expect, it } from 'vitest';
import type { Block } from '@microbook/core';
import { hasSectionContent, sectionStatus } from '../apps/web/src/sectionContent';

const block = (extra: Partial<Block>): Block => ({
  id: 'b1',
  sectionId: 's1',
  source: 'one.xhtml',
  kind: 'paragraph',
  inlines: [],
  ...extra,
});

it('distinguishes empty anchors from meaningful non-prose source content', () => {
  expect(hasSectionContent([])).toBe(false);
  expect(hasSectionContent([block({ anchorKeys: ['#end'], inlines: [{ text: ' \u200b\n' }] })])).toBe(false);
  for (const content of [
    block({ kind: 'image', assetId: 'picture' }),
    block({ kind: 'table', rows: [[[{ text: 'Table content' }]]] }),
    block({ kind: 'separator' }),
    block({ kind: 'separator', pageLabel: '42' }),
    block({ imageHeading: 'A title' }),
  ])
    expect(hasSectionContent([content])).toBe(true);
});

it('does not equate absent or stale print locations with an empty section', () => {
  const input = { included: true, hasContent: true, generated: false, previewReady: true, pending: false };
  expect(sectionStatus(input)).toBe('No visible content with current settings');
  expect(sectionStatus({ ...input, pending: true })).toBe('No location in applied preview');
  expect(sectionStatus({ ...input, pending: true, location: 'Sheet 1 · Front' })).toBe('Sheet 1 · Front');
  expect(sectionStatus({ ...input, included: false, location: 'Sheet 1 · Front' })).toBe('Excluded');
  expect(sectionStatus({ ...input, included: false, pending: true })).toBe('Excluded');
  expect(sectionStatus({ ...input, hasContent: false })).toBe('Empty section');
  expect(sectionStatus({ ...input, hasContent: false, generated: true })).not.toBe('Empty section');
  expect(sectionStatus({ ...input, previewReady: false })).toBe('Preview not generated');
});
