import fs from 'node:fs/promises';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import puppeteer from 'puppeteer';

// Compare the old physical layout separately from the intentional alignment correction.
// The original PDFs stay immutable; removing ONLY the new alignment must reproduce them.
export async function verifyClassicOutput(html, actualPdf, goldenPdf, directory, sides) {
  const browser = await puppeteer.launch({
    executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || '/usr/bin/chromium',
    pipe: true,
    headless: true,
    args: ['--no-sandbox', '--disable-dev-shm-usage'],
  });
  try {
    const page = await browser.newPage();
    await page.setContent(await fs.readFile(html, 'utf8'));
    await page.evaluate(() => document.fonts.ready);
    const audit = await page.evaluate(() => {
      const cells = Array.from(document.querySelectorAll('.grid-item'));
      return {
        cells: cells.length,
        justified: cells.filter((cell) => getComputedStyle(cell).textAlign === 'justify').length,
        before: cells.map((cell) => ({
          text: cell.textContent,
          rect: cell.getBoundingClientRect().toJSON(),
        })),
      };
    });
    if (audit.justified !== audit.cells) throw Error('Classic contains an unjustified cell');
    await page.evaluate(() => {
      document.getElementById('microbook-print-ink')?.remove();
      document.querySelectorAll('.grid-item').forEach((cell) => {
        cell.style.removeProperty('--microbook-text-align');
        cell
          .querySelectorAll('.microbook-continuation')
          .forEach((flow) => flow.replaceWith(...flow.childNodes));
        cell.querySelectorAll('.main-header').forEach((header) => {
          header.style.removeProperty('text-align');
          header.style.removeProperty('text-align-last');
        });
      });
    });
    const after = await page.evaluate(() =>
      Array.from(document.querySelectorAll('.grid-item')).map((cell) => ({
        text: cell.textContent,
        rect: cell.getBoundingClientRect().toJSON(),
      })),
    );
    if (JSON.stringify(audit.before) !== JSON.stringify(after))
      throw Error('Justification changed cell content or geometry');
    const restoredPdf = path.join(directory, 'legacy-alignment.pdf');
    await page.pdf({ path: restoredPdf, format: 'Letter', printBackground: true });
    const text = (file) => execFileSync('pdftotext', ['-layout', file, '-'], { maxBuffer: 32 * 1024 ** 2 });
    if (!text(restoredPdf).equals(text(goldenPdf))) throw Error('Classic reference text/line layout changed');
    // -layout merges neighboring cells into rows, and its clustering changes when
    // words spread out. -raw follows the PDF's content order inside each cell.
    const normalized = (file) =>
      execFileSync('pdftotext', ['-raw', file, '-'], {
        maxBuffer: 32 * 1024 ** 2,
      })
        .toString()
        .replace(/\s/g, '');
    if (normalized(actualPdf) !== normalized(goldenPdf)) throw Error('Classic printed content changed');
    for (let side = 1; side <= sides; side++) {
      const pixels = (file) =>
        execFileSync('pdftoppm', ['-f', String(side), '-l', String(side), '-scale-to', '1600', file], {
          maxBuffer: 32 * 1024 ** 2,
        });
      if (!pixels(restoredPdf).equals(pixels(goldenPdf)))
        throw Error(`Classic reference pixels changed on side ${side}`);
    }
    await fs.writeFile(
      path.join(directory, 'alignment-audit.json'),
      JSON.stringify(
        {
          cells: audit.cells,
          justified: audit.justified,
          legacyPixelsIdentical: true,
          contentAndGeometryIdentical: true,
        },
        null,
        2,
      ),
    );
  } finally {
    await browser.close();
  }
}
