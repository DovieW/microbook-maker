import path from 'node:path';
import fs from 'node:fs/promises';
import { readFileSync, existsSync } from 'node:fs';
import { createRequire } from 'node:module';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import puppeteer, { type Browser, type Page } from 'puppeteer';
import {
  documentText,
  normalizedText,
  wordCount,
  fontStacks,
  type BookDocument,
  type RenderJob,
  type RenderResult,
  type CellMap,
  type RenderProgress,
} from '@microbook/core';

const root = process.env.MICROBOOK_ROOT || process.cwd();
const require = createRequire(path.join(root, 'package.json'));
const classicDir = path.join(root, 'packages/renderer/classic');
const paginateClassic = require(path.join(classicDir, 'paginate.cjs'));
const legacy = require(path.join(classicDir, 'pipeline/documentPipeline.js'));
const { buildTokenStyles } = require(path.join(classicDir, 'pipeline/render/tokenStyles.js'));
const { getFontStack } = require(path.join(classicDir, 'pipeline/render/fontCatalog.js'));
const stats = require(path.join(classicDir, 'utils/outputStats.js'));
let coldBrowserMs = 0;
let browser: Browser | undefined;
let bookPage: Page | undefined;
let activePage: Page | undefined;
const escapeHtml = (value: string) =>
  value.replace(
    /[&<>\"']/g,
    (c) =>
      ({
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '\"': '&quot;',
        "'": '&#39;',
      })[c]!,
  );
const hash = (x: string | Buffer) => createHash('sha256').update(x).digest('hex');
export async function stopRenderer() {
  bookPage = undefined;
  activePage = undefined;
  if (browser) await browser.close().catch(() => {});
  browser = undefined;
}
export async function cancelRender() {
  if (activePage) await activePage.close().catch(() => {});
  activePage = undefined;
  bookPage = undefined;
}
async function getBrowser() {
  if (!browser?.connected) {
    const started = performance.now();
    browser = await puppeteer.launch({
      pipe: true,
      executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || '/usr/bin/chromium',
      headless: true,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-background-timer-throttling',
        '--disable-renderer-backgrounding',
      ],
      protocolTimeout: 600000,
    });
    coldBrowserMs = performance.now() - started;
  }
  return browser;
}
export async function fingerprint(): Promise<Record<string, string>> {
  const fontPaths = [
    ...new Set(execFileSync('fc-list', ['-f', '%{file}\n'], { encoding: 'utf8' }).trim().split('\n')),
  ].sort();
  const fontBytes = await Promise.all(fontPaths.map((p) => fs.readFile(p)));
  const sources = await Promise.all(
    [
      'dist/book.js',
      'packages/renderer/classic/paginate.cjs',
      'packages/renderer/classic/page.html',
      'packages/renderer/classic/pipeline/documentPipeline.js',
      'packages/renderer/classic/pipeline/importers/textImporter.js',
      'packages/renderer/classic/pipeline/importers/markdownImporter.js',
      'packages/renderer/classic/pipeline/render/tokenStyles.js',
      'packages/core/src/import.ts',
      'packages/core/src/images.ts',
      'packages/core/src/epub-styles.ts',
      'packages/core/src/index.ts',
      'packages/renderer/src/index.ts',
      'package-lock.json',
    ].map((p) => fs.readFile(path.join(root, p))),
  );
  return {
    chromium: await (await getBrowser()).version(),
    fonts: hash(Buffer.concat(fontBytes)),
    classic: hash(sources[1]),
    source: hash(Buffer.concat(sources)),
    pretextClassic: '0.0.6',
    pretextBook: '0.0.8',
    renderer: '1.0.0',
  };
}
export async function render(
  job: RenderJob,
  doc: BookDocument,
  documentDir: string,
  outputDir: string,
  baseUrl: string,
  progress: (phase: string, value?: RenderProgress) => void,
): Promise<RenderResult> {
  const start = performance.now();
  const timings: Record<string, number> = {};
  const b = await getBrowser();
  timings.browserStartup = coldBrowserMs;
  coldBrowserMs = 0;
  let peakMemoryMb = 0;
  const sampleMemory = () => {
    try {
      if (existsSync('/.dockerenv') && existsSync('/sys/fs/cgroup/memory.current'))
        peakMemoryMb = Math.max(
          peakMemoryMb,
          Number(readFileSync('/sys/fs/cgroup/memory.current', 'utf8')) / 1024 ** 2,
        );
      else {
        const rows = execFileSync('ps', ['-eo', 'pid=,ppid=,rss='], {
          encoding: 'utf8',
        })
          .trim()
          .split('\n')
          .map((row) => row.trim().split(/\s+/).map(Number));
        const pids = new Set([process.pid, process.ppid]);
        let changed = true;
        while (changed) {
          changed = false;
          for (const [pid, parent] of rows)
            if (pids.has(parent) && !pids.has(pid)) {
              pids.add(pid);
              changed = true;
            }
        }
        peakMemoryMb = Math.max(
          peakMemoryMb,
          rows.filter(([pid]) => pids.has(pid)).reduce((sum, row) => sum + row[2], 0) / 1024,
        );
      }
    } catch {
      peakMemoryMb = Math.max(peakMemoryMb, process.memoryUsage().rss / 1024 ** 2);
    }
  };
  sampleMemory();
  const sampler = setInterval(sampleMemory, 100).unref();
  const classic = job.settings.mode === 'classic';
  const page = classic
    ? await b.newPage()
    : bookPage && !bookPage.isClosed()
      ? bookPage
      : (bookPage = await b.newPage());
  activePage = page;
  let reporting = true;
  await page.removeExposedFunction('__microbookProgress').catch(() => {});
  await page.exposeFunction('__microbookProgress', (phase: string, value?: RenderProgress) => {
    if (reporting) progress(phase, value);
  });
  page.setDefaultTimeout(600000);
  await page.setRequestInterception(true);
  page.removeAllListeners('request');
  page.on('request', (req) => {
    const u = req.url();
    if (u.startsWith(baseUrl + '/') || u.startsWith('data:') || u === 'about:blank') void req.continue();
    else void req.abort();
  });
  await fs.mkdir(outputDir, { recursive: true });
  try {
    progress('Preparing');
    const preparedAt = performance.now();
    if (classic || page.url() !== `${baseUrl}/__renderer/book`)
      await page.goto(`${baseUrl}/__renderer/${classic ? 'classic' : 'book'}`);
    let cells: CellMap[];
    let destinations: RenderResult['destinations'];
    let navigation: RenderResult['navigation'];
    let featureDiagnostics: RenderResult['diagnostics'] = [];
    let coverage: RenderResult['coverage'];
    let measurementCache: RenderResult['measurementCache'];
    let words: number;
    if (classic) {
      const raw =
        doc.format === 'epub'
          ? Buffer.from(documentText(doc))
          : await fs.readFile(path.join(documentDir, doc.sourcePath));
      const parsed = legacy.parseUploadedDocument({
        originalName: doc.format === 'epub' ? 'book.txt' : doc.originalName,
        input: raw,
      });
      const normalized = legacy.normalizeDocument(parsed);
      const tokens = legacy.serializeDocumentToTokens(normalized);
      words = normalized.wordCount;
      await page.addStyleTag({
        content: `body { font-size: ${job.settings.fontSizePx}px; }`,
      });
      await page.addStyleTag({
        content: buildTokenStyles({
          selectedFontStack: getFontStack(job.settings.fontFamily),
          borderStyle: job.settings.borderStyle,
        }),
      });
      await page.evaluate(async (base) => {
        const layout = await import(`${base}/__pretext/classic/layout.js`);
        const richInline = await import(`${base}/__pretext/classic/rich-inline.js`);
        (window as any).__microbookPretext = {
          ...layout,
          richInline,
          version: '0.0.6',
          available: true,
        };
      }, baseUrl);
      timings.prepare = performance.now() - preparedAt;
      progress('Paginating');
      const paginateAt = performance.now();
      await page.evaluate(() => {
        const sample = () => {
          const percentages = Array.from(document.querySelectorAll('.miniSheetNumPrecentage'));
          const completed = Math.max(
            0,
            ...percentages.map((node) => Number.parseInt(node.textContent || '0') || 0),
          );
          void (window as any).__microbookProgress('Laying out text', {
            completed,
            total: 100,
            unit: 'percent',
            sides: document.querySelectorAll('.page').length,
          });
        };
        (window as any).__microbookProgressTimer = setInterval(sample, 500);
        const observer = new MutationObserver(() => {
          if (
            Array.from(document.querySelectorAll('.grid-item > div')).some(
              (node) => node.textContent === 'THE END',
            )
          ) {
            clearInterval((window as any).__microbookProgressTimer);
            void (window as any).__microbookProgress('Justifying text');
            observer.disconnect();
          }
        });
        observer.observe(document.body, { childList: true, subtree: true });
        (window as any).__microbookProgressObserver = observer;
      });
      await page.evaluate(paginateClassic, {
        tokens,
        bookName: escapeHtml(job.metadata.title),
        headerInfo: {
          sheetsCount: stats.calculateSheetsCount(words, String(job.settings.fontSizePx)),
          wordCount: words,
          readTime: stats.calculateReadingTime(words),
          author: escapeHtml(job.metadata.author) || null,
          year: escapeHtml(job.metadata.year) || null,
          ...(job.metadata.series ? { series: escapeHtml(job.metadata.series) } : {}),
          fontSize: String(job.settings.fontSizePx),
        },
        totalWords: words,
        foldGaps: job.settings.foldGaps,
        optimizationLimits: { maxBlocks: 320, maxDurationMs: 4000 },
        batchWords: true,
        justifyAllCells: true,
      });
      await page.evaluate(() => {
        clearInterval((window as any).__microbookProgressTimer);
        (window as any).__microbookProgressObserver?.disconnect();
      });
      timings.justification = await page.evaluate(
        () => (window as any).__microbookLayoutReport?.durationMs || 0,
      );
      timings.paginate = performance.now() - paginateAt - timings.justification;
      cells = await page.evaluate(() =>
        Array.from(document.querySelectorAll('.grid-item')).map((node, index) => {
          const rect = node.getBoundingClientRect();
          const parent = node.closest('.page')!;
          const bounds = parent.getBoundingClientRect();
          const clone = node.cloneNode(true) as HTMLElement;
          clone.querySelectorAll('.main-header,.miniSheetNum').forEach((e) => e.remove());
          return {
            index,
            page: Array.from(document.querySelectorAll('.page')).indexOf(parent),
            x: (rect.left - bounds.left) * 0.75,
            y: (rect.top - bounds.top) * 0.75,
            width: rect.width * 0.75,
            height: rect.height * 0.75,
            blockIds: [],
            text: clone.textContent || '',
          };
        }),
      );
      const actual = normalizedText(cells.map((c) => c.text).join(' '));
      let cursor = 0;
      let found = 0;
      let expected = 0;
      for (const token of tokens) {
        if (token.type === 'break') continue;
        const value = normalizedText(token.text || '');
        expected += value.length;
        const pos = actual.indexOf(value, cursor);
        if (pos !== -1) {
          found += value.length;
          cursor = pos + value.length;
        }
      }
      coverage = {
        expectedCharacters: expected,
        renderedCharacters: found,
        complete: found === expected,
        overflows: 0,
      };
      if (!coverage.complete)
        throw new Error(`Basic content verification failed (${found}/${expected} characters)`);
    } else {
      if (!(await page.evaluate(() => !!(window as any).Microbook)))
        await page.addScriptTag({ url: `${baseUrl}/__renderer/book.js` });
      timings.prepare = performance.now() - preparedAt;
      progress('Paginating');
      const paginateAt = performance.now();
      const layout = await page.evaluate(async (payload) => (window as any).Microbook.renderBook(payload), {
        document: { ...doc, metadata: job.metadata },
        settings: job.settings,
        fontStack: fontStacks[job.settings.fontFamily],
        assetBase: `${baseUrl}/api/documents/${doc.id}/assets`,
      });
      timings.justification = layout.justificationMs || 0;
      timings.paginate = performance.now() - paginateAt - timings.justification;
      words = layout.wordCount;
      destinations = layout.destinations;
      navigation = layout.navigation;
      featureDiagnostics = layout.diagnostics || [];
      cells = layout.cells;
      coverage = layout.coverage;
      measurementCache = layout.measurementCache;
    }
    let readingOffset = 0;
    for (const cell of cells) {
      cell.readingStart = readingOffset;
      readingOffset += normalizedText(cell.text).replace(/\s/g, '').length;
      cell.readingEnd = readingOffset;
    }
    sampleMemory();
    progress('Writing PDF');
    const pdfAt = performance.now();
    // Printing uses pure black vector text, including Basic's inherited Markdown styles.
    // This cosmetic layer is separate from the frozen Basic layout and from image assets.
    await page.evaluate(() => {
      const ink = document.createElement('style');
      ink.id = 'microbook-print-ink';
      ink.textContent =
        '.page,.page *{color:#000!important;-webkit-text-fill-color:#000!important;text-shadow:none!important;border-color:#000!important;outline-color:#000!important}.page *:not(img){background-color:transparent!important;background-image:none!important;box-shadow:none!important}';
      document.head.append(ink);
    });
    await page.evaluate((title) => {
      document.title = title;
    }, job.metadata.title);
    const pdf = await page.pdf({
      outline: !classic && job.settings.rich.bookmarks,
      format: 'Letter',
      printBackground: true,
      preferCSSPageSize: false,
      timeout: 600000,
      omitBackground: false,
    });
    await fs.writeFile(path.join(outputDir, 'output.pdf.tmp'), pdf);
    await fs.rename(path.join(outputDir, 'output.pdf.tmp'), path.join(outputDir, 'output.pdf'));
    timings.pdf = performance.now() - pdfAt;
    progress('Creating preview');
    const previewAt = performance.now();
    await page.screenshot({
      path: path.join(outputDir, 'thumbnail.png') as `${string}.png`,
      clip: { x: 0, y: 0, width: 816, height: 1056 },
      captureBeyondViewport: true,
    });
    await fs.writeFile(path.join(outputDir, 'output.html'), await page.content());
    timings.preview = performance.now() - previewAt;
    const pages = await page.evaluate(() => document.querySelectorAll('.page').length);
    const imageRegions = await page.evaluate(() => {
      const pages = Array.from(document.querySelectorAll('.page'));
      return Array.from(document.images).flatMap((img) => {
        const page = img.closest('.page');
        if (!page) return [];
        const rect = img.getBoundingClientRect(),
          bounds = page.getBoundingClientRect();
        return [
          {
            blockId: img.closest<HTMLElement>('.image-group')?.dataset.block,
            page: pages.indexOf(page),
            x: (rect.x - bounds.x) * 0.75,
            y: (rect.y - bounds.y) * 0.75,
            width: rect.width * 0.75,
            height: rect.height * 0.75,
          },
        ];
      });
    });
    const result: RenderResult = {
      destinations,
      navigation,
      imageRegions,
      pages,
      sheets: Math.ceil(pages / 2),
      cells,
      wordCount: words,
      fingerprint: await fingerprint(),
      timings,
      peakMemoryMb: Math.round(peakMemoryMb),
      measurementCache,
      coverage,
      diagnostics: [
        ...doc.diagnostics,
        ...featureDiagnostics,
        ...(cells.some((cell) => cell.blank)
          ? [
              {
                code: 'image-row-break',
                message: `Two-cell illustrations leave ${cells.filter((cell) => cell.blank).length} row-end cells empty to keep each image together.`,
              },
            ]
          : []),
      ],
    };
    timings.total = performance.now() - start;
    await fs.writeFile(path.join(outputDir, 'result.json'), JSON.stringify(result, null, 2));
    return result;
  } finally {
    reporting = false;
    clearInterval(sampler);
    activePage = undefined;
    if (classic) await page.close().catch(() => {});
  }
}
