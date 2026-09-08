import { Buffer } from 'buffer';
import { renderBook } from '../../../../packages/renderer/src/book-browser';
import {
  fontStacks,
  documentText,
  normalizedText,
  type BookDocument,
  type RenderSettings,
  type RenderResult,
  type CellMap,
} from '@microbook/core';
// Frozen Basic modules are bundled unchanged for the hosted browser adapter.
// @ts-expect-error frozen CommonJS module
import paginate from '../../../../packages/renderer/classic/paginate.cjs';
// @ts-expect-error frozen CommonJS module
import legacy from '../../../../packages/renderer/classic/pipeline/documentPipeline.js';
// @ts-expect-error frozen CommonJS module
import styles from '../../../../packages/renderer/classic/pipeline/render/tokenStyles.js';
// @ts-expect-error frozen CommonJS module
import stats from '../../../../packages/renderer/classic/utils/outputStats.js';
import * as layout from 'pretext-classic';
import * as richInline from 'pretext-classic/rich-inline';
const escape = (s: string) =>
  s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);
const dataUrl = (blob: Blob) =>
  new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
export async function render(
  documentData: BookDocument,
  settings: RenderSettings,
  progress: (phase: string, details?: any) => void,
) {
  const started = performance.now();
  (window as any).__microbookProgress = progress;
  const manifest: { family: string; file: string; weight: string; style: string }[] = await fetch(
    '/hosted-fonts/manifest.json',
  ).then((r) => r.json());
  const family = (
    {
      arial: 'Arial',
      'times-new-roman': 'Times New Roman',
      'courier-new': 'Courier New',
      'dejavu-sans': 'DejaVu Sans',
      'dejavu-serif': 'DejaVu Serif',
      'dejavu-sans-mono': 'DejaVu Sans Mono',
    } as Record<string, string>
  )[settings.fontFamily];
  const faceCss: string[] = [];
  for (const f of manifest.filter((f) =>
    [family, 'Times New Roman', 'Georgia', 'Arial', 'Courier New'].includes(f.family),
  )) {
    const url = await dataUrl(await fetch('/hosted-fonts/' + f.file).then((r) => r.blob()));
    document.fonts.add(
      await new FontFace(f.family, `url(${url})`, { weight: f.weight, style: f.style }).load(),
    );
    faceCss.push(
      `@font-face{font-family:"${f.family}";font-weight:${f.weight};font-style:${f.style};src:url(${url})}`,
    );
  }
  await document.fonts.ready;
  let content: any;
  if (settings.mode === 'book') {
    content = await renderBook({
      document: documentData,
      settings,
      fontStack: fontStacks[settings.fontFamily],
      assetBase: `/api/documents/${documentData.id}/assets`,
    });
  } else {
    const raw =
      documentData.format === 'epub'
        ? documentText(documentData)
        : await fetch(`/api/documents/${documentData.id}/source`).then((r) => r.text());
    const normalized = legacy.normalizeDocument(
      legacy.parseUploadedDocument({
        originalName: documentData.format === 'epub' ? 'book.txt' : documentData.originalName,
        input: Buffer.from(raw),
      }),
    );
    const tokens = legacy.serializeDocumentToTokens(normalized);
    const style = document.createElement('style');
    style.textContent =
      `body{font-size:${settings.fontSizePx}px}` +
      styles.buildTokenStyles({
        selectedFontStack: fontStacks[settings.fontFamily],
        borderStyle: settings.borderStyle,
      });
    document.head.append(style);
    (window as any).__microbookPretext = { ...layout, richInline, version: '0.0.6', available: true };
    await paginate({
      tokens,
      bookName: escape(documentData.metadata.title),
      headerInfo: {
        sheetsCount: stats.calculateSheetsCount(normalized.wordCount, String(settings.fontSizePx)),
        wordCount: normalized.wordCount,
        readTime: stats.calculateReadingTime(normalized.wordCount),
        author: escape(documentData.metadata.author) || null,
        year: escape(documentData.metadata.year) || null,
        ...(documentData.metadata.series ? { series: escape(documentData.metadata.series) } : {}),
        fontSize: String(settings.fontSizePx),
      },
      totalWords: normalized.wordCount,
      foldGaps: settings.foldGaps,
      optimizationLimits: { maxBlocks: 320, maxDurationMs: 4000 },
      batchWords: true,
      justifyAllCells: true,
    });
    const pages = Array.from(document.querySelectorAll('.page'));
    const cells: CellMap[] = Array.from(document.querySelectorAll('.grid-item')).map((node, index) => {
      const rect = node.getBoundingClientRect(),
        page = node.closest('.page')!,
        bounds = page.getBoundingClientRect();
      const clone = node.cloneNode(true) as HTMLElement;
      clone.querySelectorAll('.main-header,.miniSheetNum').forEach((e) => e.remove());
      return {
        index,
        page: pages.indexOf(page),
        x: (rect.x - bounds.x) * 0.75,
        y: (rect.y - bounds.y) * 0.75,
        width: rect.width * 0.75,
        height: rect.height * 0.75,
        blockIds: [],
        text: clone.textContent || '',
      };
    });
    const actual = normalizedText(cells.map((c) => c.text).join(' '));
    let cursor = 0,
      found = 0,
      expected = 0;
    for (const token of tokens) {
      if (token.type === 'break') continue;
      const text = normalizedText(token.text || '');
      expected += text.length;
      const pos = actual.indexOf(text, cursor);
      if (pos !== -1) {
        found += text.length;
        cursor = pos + text.length;
      }
    }
    if (found !== expected)
      throw Error(`Basic content verification failed (${found}/${expected} characters)`);
    content = {
      cells,
      wordCount: normalized.wordCount,
      coverage: { expectedCharacters: expected, renderedCharacters: found, complete: true, overflows: 0 },
      diagnostics: [],
    };
  }
  if (content.coverage.overflows || !content.coverage.complete)
    throw Error('Content verification failed. The previous PDF has been preserved.');
  let offset = 0;
  for (const cell of content.cells) {
    cell.readingStart = offset;
    offset += normalizedText(cell.text).replace(/\s/g, '').length;
    cell.readingEnd = offset;
  }
  const pages = Array.from(document.querySelectorAll('.page'));
  const imageRegions = Array.from(document.images).flatMap((img) => {
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
  // Embed every used resource. Cloudflare's print document has no external URLs or scripts.
  progress('Preparing PDF');
  const clone = document.documentElement.cloneNode(true) as HTMLElement;
  clone.querySelectorAll('script,link').forEach((n) => n.remove());
  const css = document.createElement('style');
  css.textContent =
    faceCss.join('\n') +
    '.page,.page *{color:#000!important;-webkit-text-fill-color:#000!important;text-shadow:none!important;border-color:#000!important;outline-color:#000!important}.page *:not(img){background-color:transparent!important;background-image:none!important;box-shadow:none!important}';
  clone.querySelector('head')!.append(css);
  for (const img of Array.from(clone.querySelectorAll('img')))
    img.src = await dataUrl(
      await fetch(img.src).then((r) => {
        if (!r.ok) throw Error('Could not embed an image');
        return r.blob();
      }),
    );
  // Publisher FontFaces are JS-owned, so they need a CSS representation in the snapshot too.
  if (settings.rich.headingFonts === 'publisher')
    for (const font of documentData.publisherFonts || []) {
      try {
        const url = await dataUrl(
          await fetch(`/api/documents/${documentData.id}/fonts/${font.id}`).then((r) => r.blob()),
        );
        css.textContent += `@font-face{font-family:Publisher${font.id.replace(/-/g, '')};font-weight:${font.weight};font-style:${font.style};src:url(${url})}`;
      } catch {}
    }
  const title = clone.querySelector('title') || document.createElement('title');
  title.textContent = documentData.metadata.title;
  clone.querySelector('head')!.append(title);
  const result: RenderResult = {
    ...content,
    imageRegions,
    pages: pages.length,
    sheets: Math.ceil(pages.length / 2),
    fingerprint: { renderer: 'hosted-browser-2' },
    timings: { layout: performance.now() - started },
    peakMemoryMb: 0,
    diagnostics: [...documentData.diagnostics, ...(content.diagnostics || [])],
  };
  return { html: clone.outerHTML, result };
}
