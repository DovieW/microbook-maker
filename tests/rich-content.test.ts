import { expect, it } from 'vitest';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { importDocument } from '@microbook/core/import';
import { defaultSettings, newRichFeatures, settingsSchema, blockText } from '@microbook/core';
import { prepareRichContent } from '../packages/core/src/rich-content';
// @ts-expect-error original fixture generator
import { richFixture } from '../tools/rich-fixture.mjs';
it('preserves anchors, note groups, hierarchy, source identity, and configurable URLs', async () => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'rich-source-'));
  try {
    const doc = await importDocument(richFixture(), 'rich.epub', 'test', dir);
    expect(doc.navigation?.map((n) => n.depth)).toEqual([0, 1, 0]);
    expect(doc.pageList?.[0].label).toBe('7');
    expect(doc.blocks.some((b) => b.passage === 'poetry')).toBe(true);
    const original = JSON.stringify(doc);
    const settings = { ...defaultSettings(), rich: newRichFeatures() };
    const result = prepareRichContent(doc, settings);
    expect(JSON.stringify(doc)).toBe(original);
    expect(result.blocks.filter((b) => blockText(b).includes('NOTE-BODY'))).toHaveLength(1);
    expect(result.blocks.some((b) => b.tocContent)).toBe(false);
    expect(result.blocks.map(blockText)).not.toContain('First chapter');
    expect(result.blocks.filter((b) => b.destination)).toHaveLength(2);
    expect(result.blocks.map(blockText).join('\n')).toContain(
      '(https://example.com/articles?edition=1#details)',
    );
    for (const mode of ['chapter', 'book', 'paragraph', 'source'] as const) {
      const options = { ...settings, rich: { ...settings.rich, urls: 'book' as const, notes: mode } };
      const prepared = prepareRichContent(doc, options);
      expect(prepared.blocks.filter((b) => blockText(b).includes('NOTE-BODY'))).toHaveLength(1);
      expect(
        prepared.blocks.filter((b) => b.generated && blockText(b).includes('https://example.com/')),
      ).toHaveLength(1);
    }
    expect(settingsSchema.parse({ mode: 'book' }).rich.contents).toBe('publisher');
  } finally {
    await fs.rm(dir, { recursive: true, force: true });
  }
});
it('keeps linked captions, table URLs and excluded-note references in source order', async () => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'rich-edges-'));
  try {
    const doc = await importDocument(richFixture(), 'rich.epub', 'test', dir);
    const image = doc.blocks.find((b) => b.kind === 'image')!;
    image.linkedHref = 'https://example.org/picture';
    const source = doc.blocks.find((b) => b.inlines.some((i) => i.targetKey?.endsWith('#n1')))!;
    doc.blocks.push({
      id: 'table-test',
      kind: 'table',
      sectionId: source.sectionId,
      source: source.source,
      inlines: [],
      rows: [[[{ text: 'Table link', href: 'https://example.org/table' }]]],
    });
    const settings = {
      ...defaultSettings(),
      rich: newRichFeatures(),
      selectedSections: doc.sections.filter((s) => s.id !== 'notes').map((s) => s.id),
    };
    const result = prepareRichContent(doc, settings);
    const index = result.blocks.findIndex((b) => b.id === image.id);
    expect(result.blocks[index + 1].captionFor).toBe(image.id);
    expect(result.blocks[index + 2].inlines.map((i) => i.text).join('')).toContain(
      '(https://example.org/picture)',
    );
    expect(
      result.blocks
        .find((b) => b.id === 'table-test')
        ?.rows?.flat(2)
        .map((i) => i.text)
        .join(''),
    ).toContain('(https://example.org/table)');
    expect(
      result.source
        .find((b) => b.id === 'table-test')
        ?.rows?.flat(2)
        .map((i) => i.text)
        .join(''),
    ).toBe('Table link');
    expect(result.blocks.filter((b) => blockText(b).includes('NOTE-BODY'))).toHaveLength(1);
    expect(result.blocks.some((b) => b.generated && b.pageLabel === '7')).toBe(true);
    expect(result.source.some((b) => b.generated)).toBe(false);
    expect(result.source.map(blockText).join('')).not.toContain('https://example.org/picture');
  } finally {
    await fs.rm(dir, { recursive: true, force: true });
  }
});

it('replaces guide contents and resolves hidden pagebreak link targets', async () => {
  // @ts-expect-error shared original fixture
  const { richEntries } = await import('../tools/rich-fixture.mjs');
  // @ts-expect-error shared original fixture
  const { zip, xhtml } = await import('../tools/fixtures.mjs');
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'rich-guide-'));
  try {
    const doc = await importDocument(
      zip({
        ...richEntries,
        'OEBPS/book.opf': richEntries['OEBPS/book.opf']
          .replace(
            '</manifest>',
            '<item id="guide-toc" href="text/contents.xhtml" media-type="application/xhtml+xml"/></manifest>',
          )
          .replace('<spine>', '<spine><itemref idref="guide-toc"/>')
          .replace(
            '</package>',
            '<guide><reference type="toc" href="text/contents.xhtml"/></guide></package>',
          ),
        'OEBPS/text/contents.xhtml': xhtml(
          '<h1>Contents</h1><p>GUIDE-ONLY <a href="one.xhtml#chapter1">First chapter</a></p>',
        ),
        'OEBPS/text/one.xhtml': richEntries['OEBPS/text/one.xhtml'].replace(
          '<h1 id="chapter1">',
          '<span id="chapter1" epub:type="pagebreak" title="1"/><h1>',
        ),
      }),
      'guide.epub',
      'test',
      dir,
    );
    const result = prepareRichContent(doc, { ...defaultSettings(), rich: newRichFeatures() });
    expect(doc.blocks.some((b) => blockText(b).includes('GUIDE-ONLY'))).toBe(true);
    expect(result.blocks.some((b) => blockText(b).includes('GUIDE-ONLY'))).toBe(false);
    const target = result.anchors.get('OEBPS/text/one.xhtml#chapter1');
    expect(result.blocks.find((b) => b.id === target)?.kind).toBe('heading');
    expect(result.navigation.some((n) => n.blockId === target)).toBe(true);
  } finally {
    await fs.rm(dir, { recursive: true, force: true });
  }
});
