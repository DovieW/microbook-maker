import { prepareRichContent } from '../../core/src/rich-content.ts';
import { prepareWithSegments, layoutWithLines } from '@chenglou/pretext';
import type { BookDocument, RenderSettings, Block, Inline, CellMap } from '@microbook/core';
import {
  imageOutputQuery,
  bookBlockText,
  wordCount,
  fontStacks,
  headingLabel,
  normalizedText,
} from '@microbook/core';

let activeDocument = '';
const preparations = new Map<string, ReturnType<typeof prepareWithSegments>>();
export async function renderBook(payload: {
  document: BookDocument;
  settings: RenderSettings;
  assetBase: string;
  fontStack: string;
}) {
  const { document: book, settings: s, assetBase, fontStack } = payload;
  if (activeDocument !== book.id) {
    preparations.clear();
    activeDocument = book.id;
  }
  document.body.replaceChildren();
  document.body.classList.add('measuring');
  const style = document.createElement('style');
  style.textContent = `@page{size:Letter portrait;margin:0}*{box-sizing:border-box}html,body{margin:0;padding:0}body{font-family:${fontStack};font-size:${s.fontSizePx}px;color:#000} .page{width:816px;height:1056px;position:relative;break-after:page;overflow:hidden;background:white}.page:last-child{break-after:auto}.cell{position:absolute;overflow:hidden;padding:0 2px ${s.foldGaps ? 4 : 0}px}.flow{height:100%;overflow:visible;text-align:justify;text-align-last:left;line-height:${s.lineHeight}}p,blockquote,pre,li,h1,h2,h3,h4,h5,h6{margin:0;padding:0;font-size:1em;line-height:${s.lineHeight};overflow-wrap:anywhere}body.measuring p{ text-align:left!important;text-align-last:left!important }p{text-align:justify;text-align-last:left;text-indent:${s.paragraphIndentEm}em;margin-bottom:${s.paragraphStyle === 'spaced' ? s.lineHeight : s.paragraphGapEm}em}h1,h2,h3,h4,h5,h6{text-align:left;text-align-last:left;font-weight:700;font-size:${s.headingScale}em;line-height:1.05;margin:0.2em 0 0.1em}blockquote{font-style:italic}pre{white-space:pre-wrap;font-family:monospace;text-align:left;text-align-last:left}table{width:100%;table-layout:fixed;border-collapse:collapse;font-size:1em;line-height:${s.lineHeight}}td{border:0.4px solid #000;padding:1px;overflow-wrap:anywhere}img{display:block;object-fit:contain;margin:0 auto}hr{border:0;border-top:0.5px solid #000;margin:0.4em 15%}.book-header{overflow-wrap:anywhere;text-align:left;font-size:1.4em;font-weight:700;line-height:1.05;margin-bottom:0.4em}.list-item[data-marker]:before{content:attr(data-marker);}.source-page{font-size:.8em;color:#000;text-align:right;line-height:1}.book-author{font-size:0.7em;font-weight:400;margin-top:0.15em}`;
  document.head.querySelectorAll('style').forEach((e) => e.remove());
  document.head.append(style);
  await document.fonts.ready;
  const margin = (s.marginMm * 96) / 25.4;
  const cellWidth = (816 - margin * 2) / 4;
  const cellHeight = (1056 * 0.997 - margin * 2) / 4;
  const maps: CellMap[] = [];
  const flows: HTMLElement[] = [];
  const positionHeaders: HTMLElement[] = [];
  let spreadFull = false;
  let page: HTMLElement;
  let current = -1;
  let expectedCharacters = 0;
  let renderedCharacters = 0;
  let overflows = 0;
  let cacheHits = 0;
  let cacheMisses = 0;
  const preparedContent = prepareRichContent(book, s);
  const selected = preparedContent.blocks;
  const featureDiagnostics = preparedContent.diagnostics;
  const featureStyle = document.createElement('style');
  featureStyle.textContent = `
    a{color:#000;text-decoration:none}
    [data-generated-inline]{text-indent:0}
    .reference-location{display:inline-block;width:34ch;max-width:100%;height:1.15em;line-height:1.15;font-size:.8em;white-space:nowrap;text-indent:0;vertical-align:middle;overflow:hidden}
    .compact-toc{display:grid;grid-template-columns:minmax(0,1fr) 17ch;gap:4px;text-align:left;line-height:1.1;margin-bottom:.15em}
    .compact-toc-title{overflow-wrap:anywhere}
    .compact-toc-location{font-size:.65em;white-space:nowrap;align-self:end}
    .special-passage{display:block!important;margin:${s.rich.passageGapEm}em 0!important;text-indent:0!important;text-align:left!important;text-align-last:left!important}
    .passage-poetry,.passage-letter{white-space:pre-line}
    .passage-quote,.passage-aside{padding-left:${s.rich.passageIndentEm}em}
    .drop-cap{float:left;font-size:${s.rich.dropCapLines}em;line-height:1;margin-right:.12em}
  `;
  document.head.append(featureStyle);
  const loadedFonts = new Map<string, string>();
  if (s.rich.headingFonts === 'publisher') {
    for (const font of book.publisherFonts || []) {
      try {
        const family = loadedFonts.get(font.family) || 'Publisher' + font.id.replace(/-/g, '');
        const face = new FontFace(family, `url("${assetBase.replace(/assets$/, 'fonts')}/${font.id}")`, {
          weight: font.weight,
          style: font.style,
        });
        await face.load();
        document.fonts.add(face);
        loadedFonts.set(font.family, family);
      } catch {
        featureDiagnostics.push({
          code: 'publisher-font',
          message: 'A publisher heading font could not load; using the print fallback.',
        });
      }
    }
    await document.fonts.ready;
  }
  if (!selected.length) throw new Error('Select at least one section containing content');
  let completedBlocks = 0;
  let lastProgress = 0;
  const reportProgress = () => {
    if (performance.now() - lastProgress < 400) return;
    lastProgress = performance.now();
    void (window as any).__microbookProgress?.('Laying out book', {
      completed: completedBlocks,
      total: selected.length,
      unit: 'blocks',
      sides: Math.ceil(maps.length / 16),
    });
  };
  function nextCell() {
    reportProgress();
    current++;
    if (current % 16 === 0) {
      page = document.createElement('div');
      page.className = 'page';
      document.body.append(page);
    }
    const slot = current % 16;
    const x = margin + (slot % 4) * cellWidth;
    const y = margin + Math.floor(slot / 4) * cellHeight;
    const cell = document.createElement('div');
    cell.className = 'cell';
    Object.assign(cell.style, {
      left: `${x}px`,
      top: `${y}px`,
      width: `${cellWidth}px`,
      height: `${cellHeight}px`,
    });
    if (s.borderStyle !== 'none') {
      if (slot % 4 < 3) cell.style.borderRight = `1px ${s.borderStyle} black`;
      if (slot >= 4) cell.style.borderTop = `1px ${s.borderStyle} black`;
    }
    if (s.foldGaps) {
      cell.style.paddingTop = slot >= 4 ? '4px' : '0';
      cell.style.paddingBottom = slot < 12 ? '4px' : '0';
      if (slot % 4 === 1) cell.style.paddingRight = '4px';
      if (slot % 4 === 2) cell.style.paddingLeft = '4px';
    }
    const flow = document.createElement('div');
    flow.className = 'flow';
    // A first heading's top margin must stay inside the measured cell. Collapsing it
    // through this container moves the whole 100%-height flow below its clipping edge.
    flow.style.display = 'flow-root';
    if (s.positionHeaders && current > 0 && slot % 4 === 0) {
      const position = document.createElement('div');
      position.className = 'cell-position';
      // Reserve a fixed line before pagination; filling in final counts cannot reflow text.
      position.textContent = '0a / 0 · 0%';
      positionHeaders[current] = position;
      cell.append(position);
      flow.style.height = `calc(100% - ${s.fontSizePx}px)`;
    }
    cell.append(flow);
    page.append(cell);
    flows.push(flow);
    maps.push({
      index: current,
      page: Math.floor(current / 16),
      x: x * 0.75,
      y: y * 0.75,
      width: cellWidth * 0.75,
      height: cellHeight * 0.75,
      blockIds: [],
      text: '',
    });
    return flow;
  }
  let flow = nextCell();
  const header = document.createElement('div');
  header.className = 'book-header';
  const title = document.createElement('div');
  title.className = 'book-title';
  title.textContent = book.metadata.title;
  const info = document.createElement('div');
  info.className = 'book-info';
  const words = wordCount(preparedContent.source.map(bookBlockText).join('\n\n'));
  const minutes = Math.ceil(words / 215);
  const readTime = `${Math.floor(minutes / 60)}h ${minutes % 60}m`;
  let sheetsValue: HTMLElement;
  for (const [label, value] of [
    ['Sheets', '0'],
    ['Words', words.toLocaleString('en-US')],
    ['Read time', readTime],
    ['Author', book.metadata.author || '—'],
    ['Year', book.metadata.year || '—'],
    ['Text size', `${s.fontSizePx} px`],
    ...(book.metadata.series ? [['Series', book.metadata.series]] : []),
  ]) {
    const item = document.createElement('div');
    const key = document.createElement('b');
    key.textContent = label + ': ';
    const text = document.createElement('span');
    text.textContent = value;
    if (label === 'Sheets') sheetsValue = text;
    item.append(key, text);
    info.append(item);
  }
  header.append(title, info);
  const headerStyle = document.createElement('style');
  headerStyle.textContent = `.book-header{font-size:1em;font-weight:400;line-height:1.2;border:0.7px solid #000;padding:4px;margin:0 0 3px;display:flow-root}.book-title{font-size:2em;line-height:1.05;font-weight:700;letter-spacing:-.02em;margin-bottom:4px}.book-info{display:grid;grid-template-columns:1fr 1fr;gap:2px 5px;font-variant-numeric:tabular-nums}.book-info>div{min-width:0;text-align:left}.book-info>div:first-child span{display:inline-block;min-width:4ch}.source-page{text-align:left}.image-group{display:flow-root}`;
  document.head.append(headerStyle);
  const headingStyle = document.createElement('style');
  headingStyle.textContent = `
    .literary-heading {
      font-family:${fontStacks['times-new-roman']};
      font-size:${s.headingScale}em;
      font-style:italic;
      font-weight:700;
      line-height:1.05;
      margin:.15em 0;
      padding-bottom:${s.headingRules ? '.12em' : '0'};
      border-bottom:${s.headingRules ? '.5px solid #000' : '0'};
    }
    .heading-chapter {font-size:${s.chapterHeadingScale}em;margin:${s.chapterHeadingGapEm}em 0;font-style:${s.chapterHeadingStyle === 'upright' ? 'normal' : 'italic'}}
    .heading-part {font-size:${s.partHeadingScale}em;margin:${s.partHeadingGapEm}em 0;font-style:${s.partHeadingStyle === 'upright' ? 'normal' : 'italic'}}
    .literary-heading .heading-label {
      display:block;
      font-family:${fontStack};
      font-size:.6em;
      font-style:normal;
      font-weight:400;
      font-variant-caps:small-caps;
      letter-spacing:.12em;
      line-height:1.25;
      margin-bottom:.1em;
    }
    .literary-heading .heading-title {display:block}
    .cell-position {height:${s.fontSizePx}px;font-size:.8em;line-height:${s.fontSizePx}px;text-align:left;text-align-last:left;white-space:nowrap;color:#000;font-variant-numeric:tabular-nums}
  `;
  document.head.append(headingStyle);
  function ensureHeader() {
    if (header.isConnected) return;
    if (spreadFull) {
      flow = nextCell();
      spreadFull = false;
    }
    flow.append(header);
    if (
      header.getBoundingClientRect().bottom + s.fontSizePx * s.lineHeight >
      flow.getBoundingClientRect().bottom
    ) {
      header.remove();
      flow = nextCell();
      flow.append(header);
    }
  }
  function fit(node: HTMLElement) {
    const bounds = node.getBoundingClientRect();
    const target = flow.getBoundingClientRect();
    return (
      bounds.bottom <= target.bottom + 0.1 &&
      bounds.right <= target.right + 0.1 &&
      node.scrollWidth <= Math.ceil(bounds.width) + 1
    );
  }
  function appendInlines(parent: HTMLElement, inlines: Inline[]) {
    for (const inline of inlines) {
      const external = inline.href && /^(https?:|mailto:|tel:|\/\/)/i.test(inline.href);
      const href = inline.targetKey?.startsWith('@')
        ? '#destination-' + inline.targetKey.slice(1)
        : external
          ? inline.href
          : undefined;
      const span = document.createElement(s.rich.clickableLinks && href ? 'a' : 'span');
      if (span instanceof HTMLAnchorElement && href) span.href = href;
      if (inline.generated) span.dataset.generatedInline = 'true';
      if (inline.locationTarget) {
        span.className = 'reference-location';
        span.dataset.location = inline.locationTarget;
      }
      span.textContent = inline.text;
      for (const mark of inline.marks || []) {
        if (mark === 'strong') span.style.fontWeight = '700';
        if (mark === 'em') span.style.fontStyle = 'italic';
        if (mark === 'code') span.style.fontFamily = 'monospace';
        if (mark === 'sup' || mark === 'sub') {
          span.style.verticalAlign = mark;
          span.style.fontSize = '.8em';
        }
        if (mark === 'u') span.style.textDecoration = 'underline';
        if (mark === 's') span.style.textDecoration = 'line-through';
        if (mark === 'break') span.style.whiteSpace = 'pre-line';
      }
      parent.append(span);
    }
  }
  let awaitingDropCap = false;
  const blockTextForToc = (block: Block) => block.inlines.map((i) => i.text).join('');
  function makeBlock(block: Block) {
    const navEntry = preparedContent.navigation.find((n) => n.blockId === block.id);
    const tag =
      block.kind === 'heading'
        ? s.rich.bookmarks
          ? navEntry
            ? `h${Math.min(6, navEntry.depth + 1)}`
            : 'div'
          : `h${block.level || 2}`
        : block.kind === 'pre'
          ? 'pre'
          : block.kind === 'quote'
            ? 'blockquote'
            : block.kind === 'table'
              ? 'table'
              : 'p';
    const node = document.createElement(tag);
    node.dataset.block = block.id;
    if (block.generated) node.dataset.generated = 'true';
    if (block.kind === 'heading' && tag === 'div') {
      node.style.fontWeight = '700';
      node.style.fontSize = s.headingScale + 'em';
      node.style.textAlign = 'left';
      node.style.margin = '.2em 0 .1em';
    }
    if (s.rich.passages && block.passage && s.rich.passageTypes.includes(block.passage))
      node.classList.add('special-passage', 'passage-' + block.passage);
    if (block.destination) {
      node.className = 'compact-toc';
      const link = document.createElement(s.rich.clickableLinks ? 'a' : 'span');
      link.className = 'compact-toc-title';
      if (link instanceof HTMLAnchorElement) link.href = '#destination-' + block.destination;
      link.textContent = blockTextForToc(block);
      link.style.paddingLeft = Math.min(3, block.tocDepth || 0) * 0.5 + 'em';
      const location = document.createElement('span');
      location.className = 'compact-toc-location';
      location.dataset.location = block.destination;
      location.textContent = 'Sheet 0000 · Back · Cell 16';
      node.append(link, location);
      return node;
    }
    if (block.inlines.some((inline) => inline.marks?.includes('break'))) {
      node.style.textAlign = 'left';
      node.style.textAlignLast = 'left';
    }
    if (block.align && block.kind !== 'heading') {
      node.style.textAlign = block.align;
      node.style.textAlignLast = block.align;
    }
    if (block.kind === 'list-item') {
      const markerWidth = Math.max(0.75, (block.listMarker?.length || 0) * 0.65);
      node.style.paddingLeft = `${markerWidth + Math.min(4, block.listDepth || 0) * 0.75}em`;
      node.style.textIndent = block.listMarker ? `-${markerWidth}em` : '0';
      if (block.listMarker) node.dataset.marker = block.listMarker + ' ';
      node.classList.add('list-item');
    }
    if (block.kind === 'table') {
      for (const row of block.rows || []) {
        const tr = document.createElement('tr');
        for (const [i, cell] of row.entries()) {
          const td = document.createElement('td');
          appendInlines(td, cell);
          tr.append(td);
          if (i < row.length - 1) tr.append(document.createTextNode(' '));
        }
        node.append(tr, document.createTextNode('\n'));
      }
    } else appendInlines(node, block.inlines);
    if (block.kind === 'heading' && s.rich.headingFonts === 'publisher' && block.publisherFont) {
      const family = loadedFonts.get(block.publisherFont.toLowerCase());
      if (family) node.style.fontFamily = `"${family}", ${fontStacks['times-new-roman']}`;
    }
    const headingText = node.textContent || '';
    const numericLabel =
      block.headingKind === 'chapter' ? headingText.match(/^\s*\d{1,4}\s*[:.–—-]\s*/u) : undefined;
    const label =
      headingLabel(headingText) ||
      (numericLabel ? { kind: 'chapter' as const, length: numericLabel[0].length } : undefined);
    const kind = block.headingKind || label?.kind;
    if (block.kind === 'heading' && (kind || block.imageHeading || (block.level || 2) <= 2)) {
      node.classList.add('literary-heading');
      if (kind) node.classList.add(`heading-${kind}`);
      const text = node.textContent || '';
      if (label && label.length < text.length) {
        // Split only the presentation. Keep every source character and inline mark so
        // PDF extraction, fragment ranges and chapter navigation retain the original text.
        const prefix = document.createElement('span');
        prefix.className = 'heading-label';
        prefix.append(...fragment(node, 0, label.length).childNodes);
        const title = document.createElement('span');
        title.className = 'heading-title';
        title.append(...fragment(node, label.length, text.length).childNodes);
        node.replaceChildren(prefix, title);
      }
    }
    if (block.headingKind === 'chapter') awaitingDropCap = true;
    if (
      s.rich.dropCaps &&
      awaitingDropCap &&
      block.kind === 'paragraph' &&
      !block.generated &&
      !block.passage &&
      !block.note
    ) {
      awaitingDropCap = false;
      if (
        node.textContent &&
        node.textContent.length > 80 &&
        /^[\s“”‘’"'(]*[A-Za-zÀ-ž]/u.test(node.textContent)
      ) {
        const walker = document.createTreeWalker(node, NodeFilter.SHOW_TEXT);
        const first = walker.nextNode() as Text | null;
        if (first) {
          const match = first.textContent?.match(/^[\s“”‘’"'(]*[A-Za-zÀ-ž]/u);
          if (match) {
            const cap = document.createElement('span');
            cap.className = 'drop-cap';
            cap.textContent = match[0];
            first.deleteData(0, match[0].length);
            first.parentNode!.insertBefore(cap, first);
            node.classList.add('special-passage');
          }
        }
      }
    }
    return node;
  }
  function fragment(original: HTMLElement, start: number, end: number) {
    const walker = document.createTreeWalker(original, NodeFilter.SHOW_TEXT);
    const texts: Text[] = [];
    while (walker.nextNode()) texts.push(walker.currentNode as Text);
    const locate = (offset: number): [Text, number] => {
      let consumed = 0;
      for (const t of texts) {
        if (offset <= consumed + t.length) return [t, offset - consumed];
        consumed += t.length;
      }
      return [texts.at(-1)!, texts.at(-1)!.length];
    };
    const range = document.createRange();
    range.setStart(...locate(start));
    range.setEnd(...locate(end));
    const node = original.cloneNode(false) as HTMLElement;
    node.append(range.cloneContents());
    if (start > 0) {
      node.style.textIndent = '0';
      delete node.dataset.marker;
      node.querySelectorAll('.drop-cap').forEach((cap) => {
        (cap as HTMLElement).style.float = 'none';
        (cap as HTMLElement).style.fontSize = '1em';
      });
    }
    return node;
  }
  const consumed = new Map<string, number>();
  const displayConsumed = new Map<string, number>();
  const renderedSources = new Map<string, string>();
  function sourceFragment(block: Block, start: number, end: number, fallback: string) {
    if (block.generated) return '';
    const inlines: Inline[] =
      block.kind === 'table'
        ? (block.rows || []).flatMap((row) => [
            ...row.flatMap((cell, i) => [...cell, ...(i < row.length - 1 ? [{ text: ' ' }] : [])]),
            { text: '\n' },
          ])
        : block.inlines;
    if (!inlines.some((i) => i.generated)) return fallback;
    let offset = 0,
      text = '';
    for (const inline of inlines) {
      const next = offset + inline.text.length;
      if (!inline.generated)
        text += inline.text.slice(Math.max(0, start - offset), Math.max(0, Math.min(next, end) - offset));
      offset = next;
    }
    return text;
  }
  function register(block: Block, text: string) {
    const displayStart = displayConsumed.get(block.id) || 0;
    displayConsumed.set(block.id, displayStart + text.length);
    renderedCharacters += text.length;
    text = sourceFragment(block, displayStart, displayStart + text.length, text);
    renderedSources.set(block.id, (renderedSources.get(block.id) || '') + text);
    const map = maps[current];
    map.sectionId ||= block.sectionId;
    if (map.text && map.blockIds.at(-1) !== block.id) map.text += '\n';
    if (!map.blockIds.includes(block.id)) map.blockIds.push(block.id);
    map.text += text;
    const start = consumed.get(block.id) || 0;
    (map.ranges ||= []).push({ blockId: block.id, start, end: start + text.length });
    consumed.set(block.id, start + text.length);
  }
  const placedCaptions = new Set<string>();
  let pendingLabels: Block[] = [];
  function labelNodes() {
    return pendingLabels.map((block) => {
      const node = document.createElement('div');
      node.className = 'source-page';
      node.textContent = block.pageLabel!;
      return node;
    });
  }
  function registerLabels() {
    for (const label of pendingLabels) register(label, '');
    pendingLabels = [];
  }
  for (const [blockIndex, block] of selected.entries()) {
    completedBlocks = blockIndex;
    reportProgress();
    if (placedCaptions.has(block.id)) continue;
    if (block.pageLabel) {
      // Page labels travel with the following content; they never consume a cell by themselves.
      if (
        s.rich.pageReferences === 'boundaries' ||
        (s.sourcePageNumbers && s.rich.pageReferences !== 'headers')
      )
        pendingLabels.push(block);
      continue;
    }
    if (spreadFull) {
      flow = nextCell();
      spreadFull = false;
    }
    if (block.kind === 'separator') {
      const line = document.createElement(block.pageLabel ? 'div' : 'hr');
      if (block.pageLabel) {
        line.className = 'source-page';
        line.textContent = block.pageLabel;
      }
      flow.append(line);
      if (!fit(line)) {
        line.remove();
        flow = nextCell();
        flow.append(line);
      }
      register(block, '');
      continue;
    }
    if (block.kind === 'image') {
      if (!s.includeImages) continue;
      const asset = book.assets.find((a) => a.id === block.assetId);
      if (!asset) throw new Error(`Missing image ${block.assetId}`);
      const img = document.createElement('img');
      const output = s.imageOutputOverrides?.[block.id] ??
        s.imageOutput ?? { mode: 'original' as const, strength: 'gentle' as const };
      const imageUrl = `${assetBase}/${encodeURIComponent(asset.id)}${imageOutputQuery(output, s.imageRotations?.[block.id] ?? 0)}`;
      if (output.mode === 'original' && !s.imageRotations?.[block.id]) img.src = imageUrl;
      else {
        // Embed the exact cached output. Reusing an image URL with different output
        // queries can fail decode in the warm Chromium print page.
        const response = await fetch(imageUrl);
        if (!response.ok)
          throw new Error(`Could not prepare image ${asset.id}. Try Original color or retry.`);
        const blob = await response.blob();
        img.src = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(reader.result as string);
          reader.onerror = () => reject(new Error(`Could not read image ${asset.id}`));
          reader.readAsDataURL(blob);
        });
      }
      img.alt = asset.alt;
      try {
        await img.decode();
      } catch {
        throw new Error(
          `Could not decode image ${asset.id} (${block.source}). Try Original color for this image.`,
        );
      }
      if (img.naturalWidth * img.naturalHeight > 40_000_000)
        throw new Error('An image exceeds the 40 megapixel limit');
      const caption =
        selected[blockIndex + 1]?.captionFor === block.id ? selected[blockIndex + 1] : undefined;
      const captionNode = caption ? makeBlock(caption) : undefined;
      const group = document.createElement('div');
      group.className = 'image-group';
      group.dataset.block = block.id;
      const labels = labelNodes();
      group.append(...labels, img);
      if (captionNode) group.append(captionNode);
      const treatment = s.imageTreatments[block.id];
      if (treatment?.kind === 'flourish') {
        group.classList.add('flourish');
        group.style.padding = `${treatment.gapEm * s.fontSizePx}px 0`;
        const sizeFlourish = () => {
          const scale = Math.min(
            (treatment.widthEm * s.fontSizePx) / img.naturalWidth,
            (flow.clientWidth - 2) / img.naturalWidth,
            (s.fontSizePx * 3) / img.naturalHeight,
          );
          img.style.width = `${img.naturalWidth * scale}px`;
          img.style.height = `${img.naturalHeight * scale}px`;
        };
        sizeFlourish();
        flow.append(group);
        // Keep a small amount of following prose with an ornament at cell boundaries.
        const fitsWithFollowing = () =>
          fit(group) &&
          (!selected[blockIndex + 1] ||
            group.getBoundingClientRect().bottom + s.fontSizePx * s.lineHeight <=
              flow.getBoundingClientRect().bottom);
        if (!fitsWithFollowing()) {
          group.remove();
          flow = nextCell();
          flow.append(group);
          sizeFlourish();
        }
        if (!fit(group) && captionNode) captionNode.remove();
        if (!fit(group)) throw new Error(`Flourish cannot fit: ${block.source}`);
        registerLabels();
        register(block, '');
        if (caption && captionNode?.parentElement === group) {
          const captionText = captionNode.textContent || '';
          expectedCharacters += captionText.length;
          register(caption, captionText);
          placedCaptions.add(caption.id);
        }
        continue;
      }
      if ((s.imageCellSpans[block.id] ?? (s.twoCellImages ? 2 : 1)) === 2) {
        // A spread owns two neighboring physical slots on the same printed row.
        // Keep the source map at 16 slots/side; either slot previews the complete image.
        if (flow.childNodes.length) flow = nextCell();
        if (current % 4 === 3) {
          maps[current].blank = true;
          flow = nextCell();
        }
        const first = current;
        const owner = flow;
        const cell = owner.parentElement!;
        const secondFlow = nextCell();
        const second = current;
        const secondCell = secondFlow.parentElement!;
        cell.style.width = `${cellWidth * 2}px`;
        cell.style.paddingRight = getComputedStyle(secondCell).paddingRight;
        cell.style.borderRight = secondCell.style.borderRight;
        secondCell.style.display = 'none';
        secondCell.dataset.continuation = String(first);
        maps[first].span = 2;
        maps[second].continuationOf = first;
        maps[second].blockIds = [block.id];
        maps[second].sectionId = block.sectionId;
        group.classList.add('image-spread');
        // Isolate print fragmentation before rotating: the unrotated box is taller
        // than a cell and would otherwise fragment at the bottom of a PDF page.
        Object.assign(group.style, {
          position: 'relative',
          width: '100%',
          height: '100%',
          contain: 'layout paint',
        });
        const content = document.createElement('div');
        content.className = 'image-spread-content';
        // Keep the container within the physical cell. Rotating this tall
        // container itself makes Chromium fragment it before applying the
        // transform at page boundaries. Rotate only the atomic image and the
        // short caption/label boxes instead.
        Object.assign(content.style, {
          position: 'absolute',
          inset: '0',
        });
        const labelsBox = document.createElement('div');
        labelsBox.append(...labels);
        Object.assign(labelsBox.style, {
          position: 'absolute',
          top: '50%',
          width: `${owner.clientHeight}px`,
          transform: 'translate(-50%, -50%) rotate(-90deg)',
        });
        Object.assign(img.style, {
          position: 'absolute',
          left: '50%',
          top: '50%',
          margin: '0',
          transform: 'translate(-50%, -50%) rotate(-90deg)',
        });
        if (captionNode)
          Object.assign(captionNode.style, {
            position: 'absolute',
            top: '50%',
            width: `${owner.clientHeight}px`,
            transform: 'translate(-50%, -50%) rotate(-90deg)',
            margin: '0',
            textAlign: 'center',
            textAlignLast: 'center',
          });
        content.append(labelsBox, img);
        if (captionNode) content.append(captionNode);
        group.replaceChildren(content);
        owner.append(group);
        const size = () => {
          const captionHeight = captionNode?.parentElement === content ? captionNode.offsetHeight : 0;
          const reserve = 2 * Math.max(captionHeight, labelsBox.offsetHeight) + 2;
          const room = content.clientWidth - reserve;
          if (room < s.fontSizePx) return false;
          const scale =
            Math.min(1, (content.clientHeight - 2) / img.naturalWidth, room / img.naturalHeight) *
            s.imageScale;
          img.style.width = `${img.naturalWidth * scale}px`;
          img.style.height = `${img.naturalHeight * scale}px`;
          labelsBox.style.left = `calc(50% - ${(img.naturalHeight * scale) / 2 + labelsBox.offsetHeight / 2 + 1}px)`;
          if (captionNode)
            captionNode.style.left = `calc(50% + ${(img.naturalHeight * scale) / 2 + captionHeight / 2 + 1}px)`;
          return true;
        };
        if (!size() && captionNode) captionNode.remove();
        if (!size()) throw new Error(`Illustration and page labels cannot fit: ${block.source}`);
        current = first;
        registerLabels();
        register(block, '');
        if (caption && captionNode?.parentElement === content) {
          const captionText = captionNode.textContent || '';
          expectedCharacters += captionText.length;
          register(caption, captionText);
          placedCaptions.add(caption.id);
        }
        current = second;
        flow = secondFlow;
        spreadFull = true;
        continue;
      }
      flow.append(group);
      const sizeImage = () => {
        const captionHeight =
          captionNode?.parentElement === group ? captionNode.getBoundingClientRect().height : 0;
        const labelHeight = labels.reduce(
          (height, label) => height + label.getBoundingClientRect().height,
          0,
        );
        const availableHeight = flow.clientHeight - captionHeight - labelHeight - 2;
        const scale = Math.min(
          s.imageScale,
          ((flow.clientWidth - 2) * s.imageScale) / img.naturalWidth,
          (Math.max(s.fontSizePx, availableHeight) * s.imageScale) / img.naturalHeight,
        );
        img.style.width = `${img.naturalWidth * scale}px`;
        img.style.height = `${img.naturalHeight * scale}px`;
      };
      sizeImage();
      if (!fit(group)) {
        group.remove();
        flow = nextCell();
        flow.append(group);
        // Fold padding differs by row and column. Refit to the destination cell.
        sizeImage();
      }
      if (!fit(group) && captionNode) {
        captionNode.remove();
        sizeImage();
      } // Long captions continue through the normal paragraph compositor.
      if (!fit(group)) throw new Error(`Illustration cannot fit: ${block.source}`);
      registerLabels();
      register(block, '');
      if (caption && captionNode?.parentElement === group) {
        const captionText = captionNode.textContent || '';
        expectedCharacters += captionText.length;
        register(caption, captionText);
        placedCaptions.add(caption.id);
      }
      continue;
    }
    const original = makeBlock(block);
    const justifyContinuation =
      ['paragraph', 'quote', 'list-item'].includes(block.kind) &&
      !block.generated &&
      !(s.rich.passages && block.passage && s.rich.passageTypes.includes(block.passage)) &&
      !original.querySelector('.drop-cap') &&
      !block.align &&
      !block.inlines.some((inline) => inline.marks?.includes('break'));
    const text = original.textContent || '';
    if (!text) continue;
    ensureHeader();
    if (pendingLabels.length) {
      const labels = labelNodes();
      flow.append(...labels, original);
      const room =
        fit(original) ||
        (block.kind !== 'heading' &&
          labels.at(-1)!.getBoundingClientRect().bottom + s.fontSizePx * s.lineHeight <=
            flow.getBoundingClientRect().bottom);
      original.remove();
      if (!room) {
        for (const label of labels) label.remove();
        flow = nextCell();
        flow.append(...labels);
      }
      registerLabels();
    }
    expectedCharacters += text.length;
    if (
      block.kind === 'paragraph' &&
      ['continuous', 'markers'].includes(s.paragraphStyle) &&
      justifyContinuation
    ) {
      original.style.display = 'inline';
      original.style.margin = '0';
      original.style.textIndent = '0';
      // An explicit separator keeps adjacent paragraphs distinct without dropping author text.
      const marker = document.createElement('span');
      marker.textContent = s.paragraphStyle === 'markers' ? ' ¶ ' : ' ';
      marker.dataset.decoration = 'true';
      flow.append(marker);
    }
    flow.append(original);
    if (
      block.kind === 'heading' &&
      original.getBoundingClientRect().bottom +
        (parseFloat(getComputedStyle(original).marginBottom) || 0) +
        s.fontSizePx * s.lineHeight >
        flow.getBoundingClientRect().bottom
    ) {
      original.remove();
      flow = nextCell();
      flow.append(original);
    }
    if (fit(original)) {
      register(block, text);
    } else {
      original.remove();
      let start = 0;
      let boundaries = Array.from(text.matchAll(/\S+\s*/g), (m) => m.index! + m[0].length);
      if (block.kind === 'table') {
        let consumed = 0;
        boundaries = Array.from(original.querySelectorAll('tr')).map((row) => {
          consumed += (row.textContent || '').length + 1;
          return consumed;
        });
      }
      if (boundaries.at(-1) !== text.length) boundaries.push(text.length);
      // Cache Pretext preparation by exact typography/text; Chromium remains the boundary authority.
      const key = `${s.fontSizePx}|${fontStack}|${text}`;
      let prepared = preparations.get(key);
      if (prepared) cacheHits++;
      else cacheMisses++;
      if (!prepared) {
        prepared = prepareWithSegments(text, `${s.fontSizePx}px ${fontStack}`);
        if (preparations.size > 2048) preparations.clear();
        preparations.set(key, prepared);
      }
      const estimated = layoutWithLines(prepared, cellWidth - 6, s.fontSizePx * s.lineHeight);
      const offsets = [0];
      for (const segment of prepared.segments) offsets.push(offsets.at(-1)! + segment.length);
      const predictedEnds = estimated.lines.map(
        (line) => (offsets[line.end.segmentIndex] ?? text.length) + line.end.graphemeIndex,
      );
      while (start < text.length) {
        let options = boundaries.filter((n) => n > start);
        let best = 0;
        let lo = 0;
        let hi = options.length - 1;
        const test = (end: number) => {
          const node = fragment(original, start, end);
          if (end < text.length && justifyContinuation) node.style.textAlignLast = 'justify';
          flow.append(node);
          const ok = fit(node);
          node.remove();
          return ok;
        };
        const remainingHeight =
          flow.getBoundingClientRect().bottom -
          (flow.lastElementChild?.getBoundingClientRect().bottom || flow.getBoundingClientRect().top);
        const linesAvailable = Math.max(1, Math.floor(remainingHeight / (s.fontSizePx * s.lineHeight)));
        const predicted = predictedEnds.filter((end) => end > start)[linesAvailable - 1] ?? text.length;
        let probe = options.findIndex((end) => end >= predicted);
        if (probe < 0) probe = options.length - 1;
        if (test(options[probe])) {
          best = options[probe];
          lo = probe + 1;
        } else hi = probe - 1;
        while (lo <= hi) {
          const mid = (lo + hi) >> 1;
          if (test(options[mid])) {
            best = options[mid];
            lo = mid + 1;
          } else hi = mid - 1;
        }
        if (!best && flow.childNodes.length) {
          flow = nextCell();
          continue;
        }
        if (!best && block.kind === 'table')
          throw new Error(
            `A table row is taller than a cell: ${block.source}. Use a smaller size or Basic mode.`,
          );
        if (!best) {
          options = Array.from(
            new Intl.Segmenter(undefined, { granularity: 'grapheme' }).segment(text.slice(start)),
            (x) => start + x.index + x.segment.length,
          );
          lo = 0;
          hi = options.length - 1;
          while (lo <= hi) {
            const mid = (lo + hi) >> 1;
            if (test(options[mid])) {
              best = options[mid];
              lo = mid + 1;
            } else hi = mid - 1;
          }
        }
        if (!best) throw new Error(`Content cannot fit in a cell: ${block.source}`);
        const part = fragment(original, start, best);
        if (best < text.length && justifyContinuation) part.style.textAlignLast = 'justify';
        flow.append(part);
        register(block, text.slice(start, best));
        start = best;
        if (start < text.length) flow = nextCell();
      }
    }
    if (blockIndex % 24 === 0) {
      await new Promise((r) => setTimeout(r, 0));
    }
  }
  ensureHeader();
  if (pendingLabels.length) {
    if (spreadFull) flow = nextCell();
    flow.append(...labelNodes());
    registerLabels();
  }
  const destinations: Record<string, { page: number; x: number; y: number; cell: number }> = {};
  for (const node of document.querySelectorAll<HTMLElement>('[data-block]')) {
    const id = node.dataset.block!;
    if (destinations[id]) continue;
    const sheet = node.closest<HTMLElement>('.page')!;
    const rect = node.getBoundingClientRect(),
      bounds = sheet.getBoundingClientRect();
    const cell = maps.find((m) => m.blockIds.includes(id));
    if (!cell) continue;
    node.id = 'destination-' + id;
    destinations[id] = {
      page: cell.page,
      cell: (cell.index % 16) + 1,
      x: (rect.left - bounds.left) * 0.75,
      y: (rect.top - bounds.top) * 0.75,
    };
  }
  const printLocation = (id: string) => {
    const d = destinations[id];
    return d
      ? `Sheet ${Math.floor(d.page / 2) + 1} · ${d.page % 2 ? 'Back' : 'Front'} · Cell ${d.cell}`
      : 'Not in preview';
  };
  for (const node of document.querySelectorAll<HTMLElement>('[data-location]'))
    node.textContent = node.classList.contains('reference-location')
      ? ` [${printLocation(node.dataset.location!)}]`
      : printLocation(node.dataset.location!);
  // Raster compatibility is an explicit image-only operation, after physical placement.
  if (s.rich.vectors === 'raster')
    for (const img of document.images) {
      const asset = book.assets.find((a) => img.src.endsWith('/' + encodeURIComponent(a.id)));
      if (asset?.mediaType !== 'image/svg+xml') continue;
      const width = parseFloat(img.style.width) || img.width,
        height = parseFloat(img.style.height) || img.height;
      const scale = Math.min(600 / 96, Math.sqrt(40_000_000 / (width * height)));
      const canvas = document.createElement('canvas');
      canvas.width = Math.max(1, Math.ceil(width * scale));
      canvas.height = Math.max(1, Math.ceil(height * scale));
      canvas.getContext('2d')!.drawImage(img, 0, 0, canvas.width, canvas.height);
      img.src = canvas.toDataURL('image/png');
      await img.decode();
    }
  sheetsValue!.textContent = String(Math.ceil(maps.length / 32));
  let readingOffset = 0;
  const readingLength = (text: string) => normalizedText(text).replace(/\s/g, '').length;
  const totalReadingLength = preparedContent.source.reduce(
    (length, block) => length + readingLength(bookBlockText(block)),
    0,
  );
  for (const map of maps) {
    map.readingStart = readingOffset;
    readingOffset += readingLength(map.text);
    map.readingEnd = readingOffset;
    if (positionHeaders[map.index]) {
      const side = `${Math.floor(map.page / 2) + 1}${map.page % 2 ? 'b' : 'a'}`;
      const percent = totalReadingLength ? Math.floor((map.readingStart / totalReadingLength) * 100) : 0;
      const firstId = map.blockIds.find((id) => !id.startsWith('generated-'));
      const sourceIndex = selected.findIndex((b) => b.id === firstId);
      const before = selected.slice(0, sourceIndex + 1);
      const chapter = before.findLast((b) => b.headingKind === 'chapter');
      const pageLabel = before.findLast((b) => b.pageLabel)?.pageLabel;
      positionHeaders[map.index].textContent =
        `${side} / ${Math.ceil(maps.length / 32)} · ${percent}%` +
        (s.rich.chapterHeaders && chapter ? ' · ' + bookBlockText(chapter) : '') +
        (s.rich.pageReferences === 'headers' && pageLabel ? ' · p. ' + pageLabel : '');
      positionHeaders[map.index].style.overflow = 'hidden';
      positionHeaders[map.index].style.textOverflow = 'ellipsis';
    }
  }
  await (window as any).__microbookProgress?.('Checking layout');
  const justifyStarted = performance.now();
  document.body.classList.remove('measuring');
  void document.body.offsetHeight;
  const justificationMs = performance.now() - justifyStarted;
  for (const f of flows) {
    if (f.parentElement!.dataset.continuation !== undefined) continue;
    const bounds = f.getBoundingClientRect();
    const cell = f.parentElement!;
    const cellBounds = cell.getBoundingClientRect();
    const cellStyle = getComputedStyle(cell);
    const top = cellBounds.top + parseFloat(cellStyle.borderTopWidth) + parseFloat(cellStyle.paddingTop);
    const bottom =
      cellBounds.bottom - parseFloat(cellStyle.borderBottomWidth) - parseFloat(cellStyle.paddingBottom);
    if (bounds.top < top - 0.25 || bounds.bottom > bottom + 0.25) overflows++;
    for (const child of Array.from(f.children)) {
      const rect = child.getBoundingClientRect();
      if (
        rect.bottom > bounds.bottom + 0.25 ||
        rect.right > bounds.right + 0.25 ||
        rect.left < bounds.left - 0.25 ||
        child.scrollWidth > Math.ceil(rect.width) + 1
      )
        overflows++;
    }
    for (const child of f.querySelectorAll(
      '.image-spread img, .image-spread p, .image-spread .source-page',
    )) {
      const rect = child.getBoundingClientRect();
      if (
        rect.top < bounds.top - 0.25 ||
        rect.bottom > bounds.bottom + 0.25 ||
        rect.left < bounds.left - 0.25 ||
        rect.right > bounds.right + 0.25
      )
        overflows++;
    }
  }
  if (expectedCharacters !== renderedCharacters || overflows)
    throw new Error(
      `Layout verification failed: ${overflows} overflows, ${renderedCharacters}/${expectedCharacters} characters`,
    );
  for (const block of selected) {
    if (block.generated || block.kind === 'image' || block.kind === 'separator' || block.kind === 'table')
      continue;
    const expected = normalizedText(
      block.inlines
        .filter((i) => !i.generated)
        .map((i) => i.text)
        .join(''),
    );
    if (normalizedText(renderedSources.get(block.id) || '') !== expected)
      throw new Error('Source coverage failed for ' + block.id);
  }
  return {
    wordCount: words,
    destinations,
    navigation: preparedContent.navigation,
    diagnostics: featureDiagnostics,
    cells: maps,
    justificationMs,
    measurementCache: { hits: cacheHits, misses: cacheMisses, entries: preparations.size },
    coverage: {
      expectedCharacters,
      renderedCharacters,
      complete: true,
      overflows,
    },
  };
}
