import fs from 'node:fs/promises';
import { deflateRawSync } from 'node:zlib';
import { fileURLToPath } from 'node:url';
const crc32 = (bytes) => {
  let crc = -1;
  for (const byte of bytes) {
    crc ^= byte;
    for (let i = 0; i < 8; i++) crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0);
  }
  return (crc ^ -1) >>> 0;
};
export function zip(entries) {
  const files = [],
    directory = [];
  let offset = 0;
  for (const [name, content] of Object.entries(entries)) {
    const data = Buffer.isBuffer(content) ? content : Buffer.from(content);
    const compressed = deflateRawSync(data);
    const filename = Buffer.from(name);
    const crc = crc32(data);
    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50);
    local.writeUInt16LE(20, 4);
    local.writeUInt16LE(8, 8);
    local.writeUInt32LE(crc, 14);
    local.writeUInt32LE(compressed.length, 18);
    local.writeUInt32LE(data.length, 22);
    local.writeUInt16LE(filename.length, 26);
    files.push(local, filename, compressed);
    const central = Buffer.alloc(46);
    central.writeUInt32LE(0x02014b50);
    central.writeUInt16LE(20, 4);
    central.writeUInt16LE(20, 6);
    central.writeUInt16LE(8, 10);
    central.writeUInt32LE(crc, 16);
    central.writeUInt32LE(compressed.length, 20);
    central.writeUInt32LE(data.length, 24);
    central.writeUInt16LE(filename.length, 28);
    central.writeUInt32LE(offset, 42);
    directory.push(central, filename);
    offset += local.length + filename.length + compressed.length;
  }
  const combined = Buffer.concat(directory);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50);
  end.writeUInt16LE(directory.length / 2, 8);
  end.writeUInt16LE(directory.length / 2, 10);
  end.writeUInt32LE(combined.length, 12);
  end.writeUInt32LE(offset, 16);
  return Buffer.concat([...files, combined, end]);
}
export const xhtml = (body) =>
  `<html xmlns="http://www.w3.org/1999/xhtml" xmlns:epub="http://www.idpf.org/2007/ops"><head><title>A Little Journey</title></head><body>${body}</body></html>`;
export const syntheticEntries = {
  mimetype: 'application/epub+zip',
  'META-INF/container.xml':
    '<container xmlns="urn:oasis:names:tc:opendocument:xmlns:container" version="1.0"><rootfiles><rootfile full-path="OEBPS/book.opf" media-type="application/oebps-package+xml"/></rootfiles></container>',
  'OEBPS/book.opf':
    '<package xmlns="http://www.idpf.org/2007/opf" version="3.0" unique-identifier="id"><metadata xmlns:dc="http://purl.org/dc/elements/1.1/"><dc:identifier id="id">microbook-fixture</dc:identifier><dc:title>A Little Journey</dc:title><dc:creator>MicroBook contributors</dc:creator><dc:language>en</dc:language></metadata><manifest><item id="c1" href="text/one.xhtml" media-type="application/xhtml+xml"/><item id="c2" href="text/two.xhtml" media-type="application/xhtml+xml"/><item id="notes" href="text/notes.xhtml" media-type="application/xhtml+xml"/><item id="nav" href="nav.xhtml" media-type="application/xhtml+xml" properties="nav"/><item id="image" href="images/landscape.svg" media-type="image/svg+xml"/></manifest><spine><itemref idref="c1"/><itemref idref="c2"/></spine></package>',
  'OEBPS/nav.xhtml': xhtml(
    '<nav epub:type="toc"><ol><li><a href="text/one.xhtml">The river</a></li><li><a href="text/two.xhtml">Home</a></li></ol></nav>',
  ),
  'OEBPS/text/one.xhtml': xhtml(
    '<h1 id="river">The river</h1><p>BEGIN-SENTINEL. A <strong>bold and <em>nested</em></strong> word, punctuation—intact.</p><p>Before the picture.</p><figure><img src="../images/landscape.svg" alt="A wide landscape"/><figcaption>A bridge across the river.</figcaption></figure><p>After the picture. A note<a epub:type="noteref" href="notes.xhtml#n1"><sup>1</sup></a> and the same note<a epub:type="noteref" href="notes.xhtml#n1"><sup>1</sup></a>.</p><blockquote>A quiet quotation.</blockquote><p style="text-align:center">Centered words.</p><pre>First verse\n  Second verse\nThird verse</pre><hr/><ul><li>First item</li><li>Second item</li></ul><table><tr><th>Name</th><th>Count</th></tr><tr><td>Lanterns</td><td>Three</td></tr></table>' +
      Array.from(
        { length: 70 },
        (_, i) =>
          `<p>Paragraph ${i + 1}. The travellers followed the river through the city, carrying a small book and a map. Each paragraph begins on a new line, with no extra gap.</p>`,
      ).join(''),
  ),
  'OEBPS/text/two.xhtml': xhtml(
    '<h2 id="home">Home</h2><span epub:type="pagebreak" title="42" id="page42"/><p>The final chapter preserves its own beginning.</p><p>END-SENTINEL. Every last word arrives safely.</p>',
  ),
  'OEBPS/text/notes.xhtml': xhtml(
    '<aside epub:type="footnote" id="n1"><p>1. NOTE-SENTINEL. A single compact endnote.</p></aside>',
  ),
  'OEBPS/images/landscape.svg':
    '<svg xmlns="http://www.w3.org/2000/svg" width="400" height="120" viewBox="0 0 400 120"><rect width="400" height="120" fill="#e4edf4"/><path d="M0 90 Q150 0 400 80 L400 120 H0Z" fill="#789c84"/><path d="M0 100 Q210 40 400 105" fill="none" stroke="#537f9c" stroke-width="22"/><path d="M150 110 V55 Q190 10 230 55 V110" fill="none" stroke="#4c5260" stroke-width="12"/></svg>',
};
export const publisherEntries = {
  ...syntheticEntries,
  'OEBPS/text/one.xhtml': xhtml(
    '<style>.squeeze-amzn { display:none } .figure_heading { text-align:right } @media amzn-mobi { .squeeze-epub {display:none} .squeeze-amzn {display:inline} }</style>' +
      '<div><img class="squeeze-epub" src="../images/cover.svg" alt="Color cover"/><img class="squeeze-amzn" src="../images/cover.svg" alt="Color cover"/></div>' +
      '<span epub:type="pagebreak" title="v"/>' +
      '<div><img class="squeeze-epub" src="../images/title.svg" alt="Title artwork"/><img class="squeeze-amzn" src="../images/title.svg" alt="Title artwork"/></div>' +
      '<span epub:type="pagebreak" title="vi"/><p>Copyright and front matter remain in reading order.</p>' +
      '<section epub:type="part"><h1>Part I The journey</h1><p>A new part opens here.</p></section>' +
      '<div class="figure_heading"><img class="squeeze-epub" src="../images/heading.svg" alt="Chapter 3 Prodigies"/><img class="squeeze-amzn" src="../images/heading.svg" alt="Chapter 3 Prodigies"/></div>' +
      '<p>FIRST-PARAGRAPH. The words continue.</p><p>SECOND-PARAGRAPH. Without an extra paragraph line.</p>' +
      '<p style="text-align:center">Intentional centered text.</p>' +
      '<figure><img src="../images/landscape.svg" alt="A wide landscape"/><figcaption>First occurrence.</figcaption></figure>' +
      '<figure><img src="../images/landscape.svg" alt="A wide landscape"/><figcaption>Intentional second occurrence.</figcaption></figure>' +
      Array.from(
        { length: 300 },
        (_, i) =>
          `<p>Passage ${i + 1}. A small public fixture exercises compact continuous typography and the actual sheet count across many cells without losing or repeating any selected words.</p>`,
      ).join(''),
  ),
  'OEBPS/images/cover.svg':
    '<svg xmlns="http://www.w3.org/2000/svg" width="200" height="300"><rect width="200" height="300" fill="#b02e38"/><circle cx="100" cy="150" r="60" fill="#367ac5"/></svg>',
  'OEBPS/images/title.svg':
    '<svg xmlns="http://www.w3.org/2000/svg" width="200" height="300"><rect width="200" height="300" fill="#fff"/><path d="M15 20H185V280H15Z" fill="none" stroke="#272727" stroke-width="2"/></svg>',
  'OEBPS/images/heading.svg':
    '<svg xmlns="http://www.w3.org/2000/svg" width="400" height="80"><path d="M180 20H390M200 35H390M100 50H390" stroke="#222" stroke-width="8"/></svg>',
};
export async function writeFixtures() {
  await fs.mkdir('tests/fixtures', { recursive: true });
  await fs.writeFile('tests/fixtures/structured.epub', zip(syntheticEntries));
  await fs.writeFile('tests/fixtures/publisher-alternatives.epub', zip(publisherEntries));
  await fs.writeFile(
    'tests/fixtures/two-cell-images.epub',
    zip({
      ...syntheticEntries,
      'OEBPS/text/one.xhtml': xhtml(
        Array.from(
          { length: 18 },
          (_, i) =>
            `<span epub:type="pagebreak" title="${i + 1001}"/><figure><img src="../images/landscape.svg" alt="Upright illustration ${i}"/><figcaption>CAPTION-${i}. The pointed end belongs at the top.</figcaption></figure><p>AFTER-${i}. Reading resumes after the illustration.</p>`,
        ).join(''),
      ),
      'OEBPS/images/landscape.svg':
        '<svg xmlns="http://www.w3.org/2000/svg" width="600" height="900"><rect width="600" height="900" fill="#b33444"/><path d="M300 40L520 320H80Z" fill="#000"/><circle cx="300" cy="650" r="150" fill="#217faf"/></svg>',
    }),
  );
}
if (process.argv[1] === fileURLToPath(import.meta.url)) await writeFixtures();
