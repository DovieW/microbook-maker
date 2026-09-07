import fs from 'node:fs/promises';
import path from 'node:path';
import { createRequire } from 'node:module';
import { execFileSync } from 'node:child_process';
import puppeteer from 'puppeteer';
const require = createRequire(import.meta.url);
const paginate = require('../packages/renderer/classic/paginate.cjs');
const pipeline = require('../packages/renderer/classic/pipeline/documentPipeline.js');
const { buildTokenStyles } = require('../packages/renderer/classic/pipeline/render/tokenStyles.js');
const { getFontStack } = require('../packages/renderer/classic/pipeline/render/fontCatalog.js');
const [base, directory] = process.argv.slice(2);
if (!base || !directory) throw Error('Pass an isolated application URL and report directory');
const document = pipeline.normalizeDocument(
  pipeline.parseUploadedDocument({
    originalName: 'classic.md',
    input: Buffer.from((await fs.readFile('tests/fixtures/classic.md', 'utf8')).repeat(4)),
  }),
);
const tokens = pipeline.serializeDocumentToTokens(document);
const browser = await puppeteer.launch({
  executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || '/usr/bin/chromium',
  pipe: true,
  headless: true,
  args: ['--no-sandbox', '--disable-dev-shm-usage'],
});
const summary = [];
try {
  for (const [font, size, foldGaps, borderStyle] of [
    ['arial', 6, true, 'solid'],
    ['times-new-roman', 7, false, 'dotted'],
    ['courier-new', 5, true, 'dashed'],
    ['dejavu-serif', 8, true, 'solid'],
  ]) {
    const out = path.join(directory, `${font}-${size}`);
    await fs.mkdir(out, { recursive: true });
    const results = [];
    for (const batchWords of [false, true]) {
      const page = await browser.newPage();
      await page.goto(base + '/__renderer/classic');
      await page.addStyleTag({ content: `body {font-size:${size}px}` });
      await page.addStyleTag({
        content: buildTokenStyles({ selectedFontStack: getFontStack(font), borderStyle }),
      });
      await page.evaluate(async (base) => {
        const layout = await import(`${base}/__pretext/classic/layout.js`);
        const richInline = await import(`${base}/__pretext/classic/rich-inline.js`);
        window.__microbookPretext = { ...layout, richInline, version: '0.0.6', available: true };
      }, base);
      const began = performance.now();
      await page.evaluate(paginate, {
        tokens,
        bookName: 'Classic batching compatibility',
        headerInfo: { fontSize: String(size), wordCount: document.wordCount },
        totalWords: document.wordCount,
        foldGaps,
        batchWords,
        optimizationLimits: { maxBlocks: 320, maxDurationMs: 4000 },
      });
      const milliseconds = performance.now() - began;
      const pdf = path.join(out, batchWords ? 'batched.pdf' : 'reference.pdf');
      await page.pdf({ path: pdf, format: 'Letter', printBackground: true });
      const cells = await page.evaluate(() =>
        Array.from(document.querySelectorAll('.grid-item')).map((cell) => ({
          text: cell.textContent,
          rect: cell.getBoundingClientRect().toJSON(),
        })),
      );
      results.push({ pdf, cells, milliseconds });
      await page.close();
    }
    if (JSON.stringify(results[0].cells) !== JSON.stringify(results[1].cells))
      throw Error(`${font}: cells differ`);
    const text = (pdf) => execFileSync('pdftotext', ['-layout', pdf, '-'], { maxBuffer: 32 * 1024 ** 2 });
    if (!text(results[0].pdf).equals(text(results[1].pdf))) throw Error(`${font}: printed text differs`);
    for (let side = 1; side <= Math.ceil(results[0].cells.length / 16); side++) {
      const pixels = (pdf) =>
        execFileSync('pdftoppm', ['-f', String(side), '-l', String(side), '-scale-to', '1600', pdf], {
          maxBuffer: 32 * 1024 ** 2,
        });
      if (!pixels(results[0].pdf).equals(pixels(results[1].pdf)))
        throw Error(`${font}: printed pixels differ on side ${side}`);
    }
    summary.push({
      font,
      size,
      foldGaps,
      borderStyle,
      cells: results[0].cells.length,
      referenceMs: results[0].milliseconds,
      batchedMs: results[1].milliseconds,
    });
    console.log(
      `Classic batching: ${font}, ${size}px, ${borderStyle}, fold spacing ${foldGaps}: identical cells, text, and pixels`,
    );
  }
  // A single prose run reproduces the low-token-count bug from real TXT books.
  // A zero optimization budget also proves horizontal alignment cannot time out.
  const paragraph =
    'Beyond the village the road curved around a quiet field. Every traveler carried a different story, and the evening brought them together again. ';
  const alignment = [];
  for (const originalName of ['justification.txt', 'justification.md']) {
    const prose = pipeline.normalizeDocument(
      pipeline.parseUploadedDocument({
        originalName,
        input: Buffer.from(
          originalName.endsWith('.txt')
            ? paragraph.repeat(160)
            : `# A quiet start\n\n${paragraph.replace('traveler', '*traveler*').repeat(80)}\n\n## Another quiet heading\n\n${paragraph.replace('different story', '**different story**').repeat(80)}`,
        ),
      }),
    );
    for (const maxBlocks of [320, 0]) {
      for (const justifyAllCells of [false, true]) {
        const page = await browser.newPage();
        await page.goto(base + '/__renderer/classic');
        await page.addStyleTag({ content: 'body { font-size: 6px; }' });
        await page.addStyleTag({
          content: buildTokenStyles({ selectedFontStack: getFontStack('arial'), borderStyle: 'solid' }),
        });
        await page.evaluate(async (base) => {
          const layout = await import(`${base}/__pretext/classic/layout.js`);
          const richInline = await import(`${base}/__pretext/classic/rich-inline.js`);
          window.__microbookPretext = { ...layout, richInline, version: '0.0.6', available: true };
        }, base);
        await page.evaluate(paginate, {
          tokens: pipeline.serializeDocumentToTokens(prose),
          bookName: 'Justification regression',
          headerInfo: { fontSize: '6', wordCount: prose.wordCount },
          totalWords: prose.wordCount,
          foldGaps: true,
          batchWords: true,
          justifyAllCells,
          optimizationLimits: { maxBlocks, maxDurationMs: 4000 },
        });
        const cells = await page.evaluate(() =>
          Array.from(document.querySelectorAll('.grid-item')).map((cell) => {
            const style = getComputedStyle(cell);
            const box = cell.getBoundingClientRect();
            const right = box.right - parseFloat(style.paddingRight) - parseFloat(style.borderRightWidth);
            const rows = new Map();
            const positions = [];
            const walker = document.createTreeWalker(cell, NodeFilter.SHOW_TEXT);
            while (walker.nextNode()) {
              const node = walker.currentNode;
              if (!node.parentElement.closest('.token')) continue;
              const heading = !!node.parentElement.closest('[class*="token-heading-"]');
              for (const match of node.textContent.matchAll(/\S+/g)) {
                const range = document.createRange();
                range.setStart(node, match.index);
                range.setEnd(node, match.index + match[0].length);
                for (const rect of range.getClientRects()) {
                  positions.push({
                    text: match[0],
                    y: rect.top,
                    height: rect.height,
                    ...(heading ? { x: rect.left } : {}),
                  });
                  const key = Math.round(rect.top * 10);
                  const row = rows.get(key) || { words: 0, right: 0, heading };
                  row.words++;
                  row.right = Math.max(row.right, rect.right);
                  rows.set(key, row);
                }
              }
            }
            const lines = [...rows.entries()].sort((a, b) => a[0] - b[0]).map(([, row]) => row);
            return {
              text: cell.textContent,
              rect: box.toJSON(),
              tokens: cell.querySelectorAll('.token').length,
              alignment: style.textAlign,
              continuation: !!cell.querySelector('.microbook-continuation'),
              positions,
              gaps: lines
                .slice(0, -1)
                .filter((line, index) => !line.heading && !lines[index + 1].heading && line.words > 1)
                .map((line) => right - line.right),
              lastGap: lines.length ? right - lines.at(-1).right : 0,
            };
          }),
        );
        alignment.push({ originalName, maxBlocks, justifyAllCells, cells });
        if (justifyAllCells) {
          const previous = alignment.at(-2).cells;
          const unchanged = (cells) => cells.map(({ text, rect, positions }) => ({ text, rect, positions }));
          if (JSON.stringify(unchanged(previous)) !== JSON.stringify(unchanged(cells)))
            throw Error('Alignment changed pagination');
          if (
            originalName.endsWith('.txt') &&
            !previous.some(
              (cell) => cell.alignment === 'left' && cell.tokens < 6 && cell.gaps.some((gap) => gap > 2),
            )
          )
            throw Error('Justification regression did not reproduce the original ragged cell');
          for (const [index, cell] of cells.entries()) {
            if (cell.alignment !== 'justify' || cell.gaps.some((gap) => Math.abs(gap) > 0.6))
              throw Error(`Unjustified line in cell ${index + 1}: ${JSON.stringify(cell.gaps)}`);
            if (cell.continuation && Math.abs(cell.lastGap) > 0.6)
              throw Error(`Unjustified continuation at the bottom of cell ${index + 1}: ${cell.lastGap}`);
          }
          if (originalName.endsWith('.txt') && cells.slice(0, -1).some((cell) => !cell.continuation))
            throw Error('Plain prose must continue at every intermediate cell boundary');
          if (cells.at(-1).lastGap <= 2) throw Error('The book ending should retain natural alignment');
        }
        if (maxBlocks === 320) {
          await page.screenshot({
            path: path.join(directory, `${originalName}-${justifyAllCells ? 'justified' : 'ragged'}.png`),
            fullPage: true,
          });
          await page.pdf({
            path: path.join(directory, `${originalName}-${justifyAllCells ? 'justified' : 'ragged'}.pdf`),
            format: 'Letter',
            printBackground: true,
          });
        }
        await page.close();
      }
    }
  }
  await fs.writeFile(path.join(directory, 'alignment.json'), JSON.stringify(alignment, null, 2));
  console.log(
    'Classic justification: every continuing prose line, including cell bottoms, reaches its cell edge; book ending stays natural; unchanged text, line positions, and geometry',
  );
  await fs.writeFile(path.join(directory, 'summary.json'), JSON.stringify(summary, null, 2));
} finally {
  await browser.close();
}
