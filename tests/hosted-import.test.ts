import { it, expect } from 'vitest';
import { zipSync, strToU8 } from 'fflate';
import { readArchive } from '../apps/web/src/hosted/import-platform';
import { readArchive as nodeArchive } from '../packages/core/src/import-platform';
it('browser EPUB archive extraction matches the personal importer', async () => {
  const input = zipSync({
    mimetype: strToU8('application/epub+zip'),
    'OEBPS/chapter.xhtml': strToU8('<p>Unicode café 🌿</p>'.repeat(1000)),
  });
  const browser = await readArchive(input),
    node = await nodeArchive(Buffer.from(input));
  expect([...browser.keys()]).toEqual([...node.keys()]);
  for (const [name, bytes] of browser) expect(bytes).toEqual(node.get(name));
});
it('rejects traversal, corrupt data, and dishonest expansion sizes', async () => {
  await expect(readArchive(zipSync({ '../escape': strToU8('bad') }))).rejects.toThrow();
  const input = Buffer.from(zipSync({ chapter: strToU8('text'.repeat(1000)) }, { level: 0 }));
  const corrupt = Buffer.from(input);
  corrupt[40] ^= 1;
  await expect(readArchive(corrupt)).rejects.toThrow();
  const tiny = Buffer.from(input),
    central = tiny.indexOf(Buffer.from([0x50, 0x4b, 0x01, 0x02]));
  tiny.writeUInt32LE(1, central + 24);
  await expect(readArchive(tiny)).rejects.toThrow(/declared size/);
});
