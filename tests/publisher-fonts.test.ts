import { expect, it } from 'vitest';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { importDocument } from '@microbook/core/import';
// @ts-expect-error shared original EPUB fixture
import { richEntries } from '../tools/rich-fixture.mjs';
// @ts-expect-error shared ZIP fixture writer
import { zip } from '../tools/fixtures.mjs';
it('loads publisher WOFF2 headings and reverses standard font obfuscation', async () => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'publisher-font-'));
  try {
    const plain = await fs.readFile(
      'node_modules/@fontsource-variable/inter/files/inter-latin-standard-normal.woff2',
    );
    for (const algorithm of ['', 'http://www.idpf.org/2008/embedding', 'http://ns.adobe.com/pdf/enc#RC']) {
      const adobe = algorithm.includes('adobe'),
        identifier = adobe ? 'urn:uuid:12345678-1234-1234-1234-123456789abc' : 'microbook-fixture';
      const bytes = Buffer.from(plain);
      if (algorithm) {
        const key = adobe
          ? Buffer.from(identifier.replace('urn:uuid:', '').replace(/-/g, ''), 'hex')
          : createHash('sha1').update(identifier).digest();
        for (let i = 0; i < Math.min(bytes.length, adobe ? 1024 : 1040); i++) bytes[i] ^= key[i % key.length];
      }
      const entries = {
        ...richEntries,
        'OEBPS/book.opf': richEntries['OEBPS/book.opf'].replace('microbook-fixture', identifier),
        'OEBPS/text/one.xhtml': richEntries['OEBPS/text/one.xhtml'].replace(
          '</head>',
          '<style>@font-face {font-family: Publisher;src:url(../font.woff2)}h1{font-family:Publisher}</style></head>',
        ),
        'OEBPS/font.woff2': bytes,
        ...(algorithm
          ? {
              'META-INF/encryption.xml': `<encryption><EncryptedData><EncryptionMethod Algorithm="${algorithm}"/><CipherData><CipherReference URI="OEBPS/font.woff2"/></CipherData></EncryptedData></encryption>`,
            }
          : {}),
      };
      const doc = await importDocument(zip(entries), 'font.epub', 'test', dir);
      expect(doc.publisherFonts).toHaveLength(1);
      expect(doc.blocks.find((b) => b.headingKind === 'chapter')?.publisherFont).toBe('publisher');
      expect(await fs.readFile(path.join(dir, doc.publisherFonts![0].path))).toEqual(plain);
    }
    const damaged = await importDocument(
      zip({
        ...richEntries,
        'OEBPS/bad.css': '@font-face{font-family:Bad;src:url(bad.woff2)}',
        'OEBPS/bad.woff2': 'invalid font',
      }),
      'bad.epub',
      'bad',
      dir,
    );
    expect(damaged.publisherFonts).toHaveLength(0);
    expect(damaged.diagnostics.some((d) => d.code === 'publisher-font')).toBe(true);
  } finally {
    await fs.rm(dir, { recursive: true, force: true });
  }
});
