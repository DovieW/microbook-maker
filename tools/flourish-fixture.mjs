import fs from 'node:fs/promises';
import { zip, syntheticEntries, xhtml } from './fixtures.mjs';
const entries = { ...syntheticEntries };
entries['OEBPS/book.opf'] = entries['OEBPS/book.opf'].replace('A Little Journey', 'Ornament journey');
entries['OEBPS/images/landscape.svg'] =
  '<svg xmlns="http://www.w3.org/2000/svg" width="27" height="14" viewBox="0 0 27 14"><path d="M2 12Q7-1 25 2Q21 15 2 12L24 3" fill="none" stroke="black"/></svg>';
entries['OEBPS/text/one.xhtml'] = xhtml(
  Array.from(
    { length: 20 },
    (_, i) =>
      `<p>BEFORE-${i}. ${'A traveller walks along the river and remembers the quiet garden. '.repeat(12)}</p><img src="../images/landscape.svg" alt=""/><p>AFTER-${i}. The next passage begins here.</p>`,
  ).join(''),
);
entries['OEBPS/text/two.xhtml'] = xhtml('<p>END-OF-ORNAMENT-JOURNEY.</p>');
await fs.writeFile('tests/fixtures/flourishes.epub', zip(entries));
