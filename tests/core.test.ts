import { afterEach, describe, expect, it } from 'vitest';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { importDocument, resolveArchivePath } from '../packages/core/src/import.ts';
import { imageDimensions } from '../packages/core/src/images.ts';
import {
  defaultSettings,
  documentText,
  effectiveSettings,
  settingsSchema,
  sourceLocation,
  cellAtLocation,
  headingLabel,
  previewRegion,
  selectedDocumentBlocks,
  type CellMap,
} from '@microbook/core';
// @ts-expect-error Small deterministic fixture writer is deliberately usable without TypeScript on a fresh host.
import { zip, syntheticEntries, publisherEntries, xhtml } from '../tools/fixtures.mjs';
const temporary: string[] = [];
async function importEpub(entries = syntheticEntries) {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'mb-import-'));
  temporary.push(directory);
  return importDocument(zip(entries), 'fixture.epub', 'fixture', directory);
}
afterEach(async () => {
  await Promise.all(temporary.splice(0).map((dir) => fs.rm(dir, { recursive: true, force: true })));
});
describe('EPUB import', () => {
  it('excludes individual image occurrences and their captions without deleting source or headings', async () => {
    const doc = await importEpub(publisherEntries);
    const images = doc.blocks.filter((b) => b.kind === 'image' && !b.imageHeading);
    const first = images.at(-2)!;
    const repeated = images.at(-1)!;
    expect(first.assetId).toBe(repeated.assetId);
    const heading = doc.blocks.find((b) => b.imageHeading)!;
    const settings = settingsSchema.parse({ mode: 'book', excludedImageIds: [first.id, heading.id] });
    const selected = selectedDocumentBlocks(doc, settings);
    expect(selected.some((b) => b.id === first.id || b.captionFor === first.id)).toBe(false);
    expect(selected.some((b) => b.id === repeated.id)).toBe(true);
    expect(selected.some((b) => b.id === heading.id)).toBe(true);
    expect(doc.blocks.some((b) => b.id === first.id)).toBe(true);
    expect(selectedDocumentBlocks(doc, { ...settings, mode: 'classic' })).toEqual(doc.blocks);
    expect(selectedDocumentBlocks(doc, { ...settings, excludedImageIds: [] })).toEqual(doc.blocks);
  });

  it('distinguishes semantic parts and chapters without guessing from heading levels or inheriting roles into subsections', async () => {
    const doc = await importEpub({
      ...syntheticEntries,
      'OEBPS/text/one.xhtml': xhtml(
        '<section epub:type="part"><h1>Un comienzo</h1>' +
          '<section epub:type="chapter"><h2>El río</h2><h3>A smaller topic</h3></section>' +
          '<section><h2>An untyped section</h2></section></section>' +
          '<section role="doc-part"><h1>Another division</h1></section>' +
          '<h2>Part II A new journey</h2><h1>Chapter 3 Home</h1><h1>Introduction</h1>' +
          '<p>Part I is mentioned in ordinary prose.</p>',
      ),
    });
    expect(
      doc.blocks
        .filter((b) => b.kind === 'heading')
        .slice(0, 8)
        .map((b) => b.headingKind),
    ).toEqual(['part', 'chapter', undefined, undefined, 'part', 'part', 'chapter', undefined]);
    expect(doc.blocks.find((b) => b.kind === 'paragraph')?.headingKind).toBeUndefined();
    expect(headingLabel('Chapter Twenty: Arrival')?.kind).toBe('chapter');
    expect(headingLabel('Book IV. Returning')?.kind).toBe('part');
    expect(headingLabel('Part of the story')).toBeUndefined();
  });
  it('selects EPUB image alternatives and identifies chapter lettering without removing repeated illustrations', async () => {
    const doc = await importEpub(publisherEntries);
    const images = doc.blocks.filter((block) => block.kind === 'image');
    expect(images).toHaveLength(5);
    expect(images.filter((block) => block.imageHeading).map((block) => block.imageHeading)).toEqual([
      'Chapter 3 Prodigies',
    ]);
    expect(images.at(-1)?.assetId).toBe(images.at(-2)?.assetId);
    expect(images.find((block) => block.imageHeading)?.headingKind).toBe('chapter');
    expect(documentText(doc, defaultSettings('book'))).toContain('Chapter 3 Prodigies');
    // Accessible image lettering belongs to Book; Classic's text extraction is unchanged.
    expect(documentText(doc, defaultSettings('classic'))).not.toContain('Chapter 3 Prodigies');
  });
  it('honors hidden ancestors, inline styles, specificity and media boundaries without losing visible text', async () => {
    const doc = await importEpub({
      ...syntheticEntries,
      'OEBPS/text/one.xhtml': xhtml(
        '<style>.off {display:none} .on {display:block} #show {display:block} div.off > .on {font-weight:bold} @media amzn-kf8 { .on {display:none} } @media screen { .screen-off {display:none} } .important {display:none!important} .important {display:block}</style>' +
          '<div class="off"><p class="on">HIDDEN-ANCESTOR</p></div><p class="on">VISIBLE</p>' +
          '<p><span class="off">HIDDEN-INLINE</span>ADJACENT</p><p hidden="hidden">HIDDEN-ATTR</p>' +
          '<p class="off" id="show">SPECIFIC</p><p class="off" style="display:block">INLINE</p>' +
          '<p class="screen-off">HIDDEN-SCREEN</p><p class="important">HIDDEN-IMPORTANT</p>',
      ),
    });
    const text = documentText(doc);
    expect(text).not.toContain('HIDDEN');
    for (const word of ['VISIBLE', 'ADJACENT', 'SPECIFIC', 'INLINE']) expect(text).toContain(word);
  });
  it('follows spine order, resolves parent resources, retains punctuation and nested marks, and collects an ancillary endnote once', async () => {
    const doc = await importEpub();
    const text = documentText(doc);
    expect(doc.metadata.title).toBe('A Little Journey');
    expect(doc.sections.map((s) => s.title)).toEqual(['The river', 'Home', 'Notes']);
    expect(text).toContain('A bold and nested word, punctuation—intact.');
    expect(doc.blocks.flatMap((b) => b.inlines).find((i) => i.text === 'nested')?.marks).toEqual([
      'strong',
      'em',
    ]);
    expect(text.indexOf('BEGIN-SENTINEL')).toBeLessThan(text.indexOf('END-SENTINEL'));
    expect(text.match(/NOTE-SENTINEL/g)).toHaveLength(1);
    expect(doc.assets).toHaveLength(1);
    expect(doc.blocks.find((b) => b.captionFor)?.inlines[0].text).toBe('A bridge across the river.');
    expect(doc.blocks.find((b) => b.pageLabel)?.pageLabel).toBe('42');
  });
  it('preserves text on both sides of an inline illustration in source order', async () => {
    const doc = await importEpub({
      ...syntheticEntries,
      'OEBPS/text/one.xhtml': xhtml('<p>Before.<img src="../images/landscape.svg"/>After.</p>'),
    });
    expect(doc.blocks.slice(0, 3).map((b) => b.kind)).toEqual(['paragraph', 'image', 'paragraph']);
    expect(doc.blocks[0].inlines[0].text).toBe('Before.');
    expect(doc.blocks[2].inlines[0].text).toBe('After.');
  });
  it('supports EPUB 2 NCX chapter names', async () => {
    const entries = { ...syntheticEntries };
    entries['OEBPS/book.opf'] = entries['OEBPS/book.opf']
      .replace('version="3.0"', 'version="2.0"')
      .replace('properties="nav"', '')
      .replace(
        '</manifest>',
        '<item id="ncx" href="toc.ncx" media-type="application/x-dtbncx+xml"/></manifest>',
      );
    entries['OEBPS/toc.ncx'] =
      '<ncx><navMap><navPoint><navLabel><text>NCX River</text></navLabel><content src="text/one.xhtml"/></navPoint></navMap></ncx>';
    expect((await importEpub(entries)).sections[0].title).toBe('NCX River');
  });
  it('reports missing images and rejects missing spine content', async () => {
    const images = { ...syntheticEntries };
    delete images['OEBPS/images/landscape.svg'];
    expect((await importEpub(images)).diagnostics.some((d) => d.code === 'image-missing')).toBe(true);
    const spine = { ...syntheticEntries };
    delete spine['OEBPS/text/one.xhtml'];
    await expect(importEpub(spine)).rejects.toThrow('reading-order');
  });
  it('rejects traversal, entities, fixed layouts, encrypted content and malformed archives', async () => {
    expect(() => resolveArchivePath('OEBPS/text/a.xhtml', '../../../etc/passwd')).toThrow();
    expect(resolveArchivePath('OEBPS/text/a.xhtml', '../images/a%20b.png#view')).toBe('OEBPS/images/a b.png');
    for (const bad of ['https://example.com/a', 'file:///etc/passwd', '/root/file', '..\\evil'])
      expect(() => resolveArchivePath('book.xhtml', bad)).toThrow();
    await expect(importEpub({ ...syntheticEntries, '../escape': 'bad' })).rejects.toThrow();
    await expect(
      importEpub({
        ...syntheticEntries,
        'OEBPS/text/one.xhtml':
          '<!DOCTYPE html [<!ENTITY x SYSTEM "file:///etc/passwd">]><html><body>&x;</body></html>',
      }),
    ).rejects.toThrow('Entity');
    await expect(
      importEpub({
        ...syntheticEntries,
        'OEBPS/book.opf': syntheticEntries['OEBPS/book.opf'].replace(
          '</metadata>',
          '<meta property="rendition:layout">pre-paginated</meta></metadata>',
        ),
      }),
    ).rejects.toThrow('Fixed-layout');
    await expect(
      importEpub({
        ...syntheticEntries,
        'META-INF/encryption.xml': '<encryption><EncryptionMethod Algorithm="DRM"/></encryption>',
      }),
    ).rejects.toThrow('DRM');
    const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'mb-bad-'));
    temporary.push(directory);
    await expect(importDocument(Buffer.from('not a zip'), 'bad.epub', 'bad', directory)).rejects.toThrow();
  });
  it('rejects oversized image headers before decoding and ignores scripts', async () => {
    const data = Buffer.alloc(24);
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]).copy(data);
    data.writeUInt32BE(100000, 16);
    data.writeUInt32BE(100000, 20);
    expect(() => imageDimensions(data, 'image/png')).toThrow('dimension');
    expect(() =>
      imageDimensions(
        Buffer.from(
          '<svg xmlns="http://www.w3.org/2000/svg" width="10" height="10"><script>alert(1)</script></svg>',
        ),
        'image/svg+xml',
      ),
    ).toThrow('Unsafe');
    const doc = await importEpub({
      ...syntheticEntries,
      'OEBPS/text/one.xhtml': xhtml('<script>DO-NOT-RENDER</script><p>Safe text</p>'),
    });
    expect(documentText(doc)).not.toContain('DO-NOT-RENDER');
  });
  it('bounds archive entry expansion and entry count', async () => {
    const tooLarge = {
      ...syntheticEntries,
      'oversized.txt': Buffer.alloc(33 * 1024 ** 2),
    };
    await expect(importEpub(tooLarge)).rejects.toThrow('limits');
    const many = {
      ...syntheticEntries,
      ...Object.fromEntries(Array.from({ length: 5001 }, (_, i) => [`x${i}`, ''])),
    };
    await expect(importEpub(many)).rejects.toThrow('limits');
  });
});
it('uses explicit CSS pixels and isolates Classic settings', () => {
  expect(defaultSettings().fontSizePx).toBe(6);
  expect(defaultSettings('book').paragraphStyle).toBe('continuous');
  expect(defaultSettings('classic').paragraphStyle).toBe('lines');
  expect(defaultSettings().paragraphGapEm).toBe(0);
  expect(defaultSettings().paragraphIndentEm).toBe(0);
  expect(defaultSettings().sourcePageNumbers).toBe(false);
  expect(defaultSettings().twoCellImages).toBe(false);
  expect(defaultSettings().partHeadingStyle).toBe('upright');
  expect(effectiveSettings({ mode: 'classic', headingScale: 2 }).headingScale).toBe(1.15);
  expect(settingsSchema.safeParse({ mode: 'classic', fontSizePx: 6.5 }).success).toBe(false);
  expect(settingsSchema.safeParse({ mode: 'book', fontSizePx: 6.5 }).success).toBe(true);
  expect(defaultSettings('book').partHeadingScale).toBeGreaterThan(
    defaultSettings('book').chapterHeadingScale,
  );
  expect(
    settingsSchema.safeParse({ chapterHeadingScale: 0.8, partHeadingScale: 1, chapterHeadingGapEm: 0 })
      .success,
  ).toBe(true);
  expect(effectiveSettings({ mode: 'classic', chapterHeadingScale: 2, positionHeaders: false })).toEqual(
    defaultSettings('classic'),
  );
});
it('previews either half of a two-cell image as the full region without changing physical slots', () => {
  const cells: CellMap[] = [
    { index: 0, page: 0, x: 0, y: 0, width: 153, height: 197, blockIds: ['image'], text: '', span: 2 },
    {
      index: 1,
      page: 0,
      x: 153,
      y: 0,
      width: 153,
      height: 197,
      blockIds: ['image'],
      text: '',
      continuationOf: 0,
    },
    { index: 2, page: 0, x: 306, y: 0, width: 153, height: 197, blockIds: ['text'], text: 'Following text' },
  ];
  expect(previewRegion(cells, 0)).toEqual(previewRegion(cells, 1));
  expect(previewRegion(cells, 1)?.width).toBe(306);
  expect(previewRegion(cells, 2)).toEqual(cells[2]);
  expect(cells[0].width).toBe(153);
});
it('preserves inherited alignment, embedded SVG, and chapters within a single spine document', async () => {
  const entries = {
    ...syntheticEntries,
    'OEBPS/nav.xhtml': xhtml(
      '<nav epub:type="toc"><a href="text/one.xhtml#first">First</a><a href="text/one.xhtml#second">Second</a></nav>',
    ),
    'OEBPS/text/one.xhtml': xhtml(
      '<h1 id="first">First</h1><div style="text-align:center"><p>Centered <em>words</em>.</p></div><div><svg xmlns="http://www.w3.org/2000/svg" width="40" height="20" viewBox="0 0 40 20"><rect width="40" height="20"/></svg></div><h2 id="second">Second</h2><p>Final paragraph.</p>',
    ),
  };
  const doc = await importEpub(entries);
  expect(doc.blocks.find((b) => b.inlines.some((i) => i.text.includes('Centered')))?.align).toBe('center');
  expect(doc.assets).toHaveLength(1);
  expect(doc.sections.some((s) => s.title === 'Second')).toBe(true);
  const first = doc.blocks.find((b) => b.inlines.some((i) => i.text === 'First'))!;
  const second = doc.blocks.find((b) => b.inlines.some((i) => i.text === 'Second'))!;
  expect(first.sectionId).not.toBe(second.sectionId);
});

it('preserves ordered, reversed, nested lists and multi-paragraph items without repeating markers', async () => {
  const doc = await importEpub({
    ...syntheticEntries,
    'OEBPS/text/one.xhtml': xhtml(
      '<ol start="3" type="A"><li><p>First paragraph.</p><p>Second paragraph.</p><ul><li>Nested item.</li></ul></li><li value="7">Seventh item.</li></ol><ol reversed="reversed"><li>Two.</li><li>One.</li></ol>',
    ),
  });
  const lists = doc.blocks.filter((block) => block.kind === 'list-item');
  expect(lists.map((block) => block.listMarker)).toEqual(['C.', undefined, '•', 'G.', '2.', '1.']);
  expect(lists[2].listDepth).toBe(1);
});
it('imports Markdown containing only a linked image while retaining the original Classic bytes', async () => {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'mb-markdown-'));
  temporary.push(directory);
  const input = Buffer.from('[![Image 1](https://example.com/image.jpg)](https://example.com/post)');
  const doc = await importDocument(input, 'image.md', 'image', directory);
  expect(documentText(doc)).toBe('Image 1');
  expect(await fs.readFile(path.join(directory, doc.sourcePath))).toEqual(input);
  expect(doc.diagnostics[0].code).toBe('image-missing');
});

it('keeps a position within a split paragraph and across Classic size changes', () => {
  const cell = (index: number, start: number, end: number): CellMap => ({
    index,
    page: 0,
    x: 0,
    y: 0,
    width: 153,
    height: 197,
    blockIds: ['p'],
    ranges: [{ blockId: 'p', start, end }],
    readingStart: start,
    readingEnd: end,
    text: '',
  });
  const position = sourceLocation(cell(2, 400, 600));
  const resized = [cell(0, 0, 300), cell(1, 300, 600), cell(2, 600, 900)];
  expect(cellAtLocation(resized, position)).toBe(1);
  expect(cellAtLocation(resized, sourceLocation(cell(0, 300, 400)))).toBe(1);
  expect(cellAtLocation(resized, sourceLocation(cell(2, 400, 600), 'p'))).toBe(0);
  expect(
    cellAtLocation(
      resized.map((c) => ({ ...c, ranges: undefined, blockIds: [] })),
      { ...position, block: undefined },
    ),
  ).toBe(1);
});
