import {
  bookBlockText,
  normalizedText,
  selectedDocumentBlocks,
  type Block,
  type BookDocument,
  type Inline,
  type RenderSettings,
} from './index.ts';

export type RichNavigation = { title: string; blockId: string; depth: number };
export function prepareRichContent(doc: BookDocument, settings: RenderSettings) {
  const options = settings.rich;
  const source = selectedDocumentBlocks(doc, settings).map((b): Block =>
    b.imageHeading ? { ...b, kind: 'heading', align: 'left', inlines: [{ text: b.imageHeading }] } : b,
  );
  // Globally hidden illustrations cannot be PDF link destinations. Their captions remain text.
  if (!settings.includeImages)
    for (let i = source.length - 1; i >= 0; i--) if (source[i].kind === 'image') source.splice(i, 1);
  const sourceById = new Map(source.map((b, i) => [b.id, { block: b, index: i }]));
  const anchors = new Map<string, string>();
  for (const b of source)
    for (const key of [...(b.anchorKeys || []), b.source]) if (!anchors.has(key)) anchors.set(key, b.id);
  // Hidden page markers and rules still identify the following visible source content.
  for (const [key, id] of anchors) {
    const index = sourceById.get(id)?.index ?? -1,
      target = source[index];
    if (target?.kind === 'separator') {
      const visible = (b: Block) => b.kind !== 'separator';
      const next = source.slice(index + 1).find(visible) || source.slice(0, index).findLast(visible);
      if (next) anchors.set(key, next.id);
      else anchors.delete(key);
    }
  }
  const diagnostics: { code: string; message: string; source?: string }[] = [];
  const warn = (code: string, message: string, source?: string) => {
    if (!diagnostics.some((d) => d.code === code && d.source === source))
      diagnostics.push({ code, message, source });
  };
  const nav: RichNavigation[] = [];
  for (const entry of doc.navigation || []) {
    const blockId = anchors.get(entry.targetKey);
    if (blockId && !nav.some((n) => n.blockId === blockId))
      nav.push({ title: entry.title, blockId, depth: entry.depth });
  }
  for (const b of source)
    if (b.kind === 'heading' && b.headingKind && !nav.some((n) => n.blockId === b.id))
      nav.push({ title: bookBlockText(b), blockId: b.id, depth: b.headingKind === 'part' ? 0 : 1 });
  nav.sort(
    (a, b) => source.findIndex((s) => s.id === a.blockId) - source.findIndex((s) => s.id === b.blockId),
  );
  if (options.contents !== 'publisher') {
    for (let i = nav.length - 1; i >= 0; i--)
      if (sourceById.get(nav[i].blockId)?.block.tocContent) nav.splice(i, 1);
    for (const [key, id] of anchors)
      if (sourceById.get(id)?.block.tocContent) {
        if (
          options.contents === 'compact' &&
          (options.contentsDepth === 'all'
            ? nav.length
            : nav.some((n) => sourceById.get(n.blockId)?.block.headingKind))
        )
          anchors.set(key, 'generated-toc-title');
        else anchors.delete(key);
      }
  }
  const chapterNav = nav.filter((n) => source.find((b) => b.id === n.blockId)?.headingKind);
  const navigation = (depth: string) => (depth === 'all' ? nav : chapterNav);
  const generated = (id: string, text: string, sectionId: string): Block => ({
    id: 'generated-' + id,
    kind: 'paragraph',
    sectionId,
    source: '',
    generated: true,
    inlines: [{ text }],
  });

  // Resolve note groups before section exclusion, so included references retain their notes.
  const notes = new Map<string, Block[]>();
  for (const b of doc.blocks)
    if (b.note && b.noteKey) {
      const group = notes.get(b.noteKey) || [];
      group.push(b);
      notes.set(b.noteKey, group);
    }
  for (const [key, group] of notes) if (group.length) anchors.set(key, group[0].id);
  const firstReference = new Map<string, string>();
  for (const b of source)
    if (!b.note)
      for (const inline of [...b.inlines, ...(b.rows?.flat(2) || [])])
        if (inline.targetKey && notes.has(inline.targetKey) && !firstReference.has(inline.targetKey))
          firstReference.set(inline.targetKey, b.id);
  const chapterByBlock = new Map<string, string>();
  let chapter = '';
  for (const b of source) {
    if (b.headingKind === 'chapter') chapter = b.id;
    chapterByBlock.set(b.id, chapter || b.originSectionId || b.sectionId);
  }

  let blocks = source.filter((b) => options.contents === 'publisher' || !b.tocContent);
  if (options.notes !== 'legacy') {
    blocks = blocks.filter((b) => !b.note && b.sectionId !== 'notes');
    const after = new Map<string, Block[]>(),
      tail: Block[] = [];
    for (const [key, group] of notes) {
      const ref = firstReference.get(key);
      const included = group.some((b) => source.some((s) => s.id === b.id));
      if (!ref && !included) continue;
      let target: string | undefined;
      if (options.notes === 'paragraph') target = ref;
      if (options.notes === 'chapter' && ref)
        target = blocks.filter((b) => chapterByBlock.get(b.id) === chapterByBlock.get(ref)).at(-1)?.id;
      if (options.notes === 'source') {
        const ordered = blocks.filter(
          (b) => (sourceById.get(b.id)?.index ?? Infinity) < (sourceById.get(group[0].id)?.index ?? 0),
        );
        target = ordered.at(-1)?.id;
      }
      const content = group.map((b) => ({
        ...b,
        sectionId: ref ? source.find((s) => s.id === ref)!.sectionId : b.sectionId,
      }));
      if (options.clickableLinks && ref)
        content.push({
          ...generated('back-' + group[0].id, 'Return to reference', content[0].sectionId),
          inlines: [{ text: 'Return to reference', targetKey: '@' + ref, generated: true }],
        });
      if (target) after.set(target, [...(after.get(target) || []), ...content]);
      else tail.push(...content);
    }
    // Unmarked notes are never discarded.
    tail.push(...source.filter((b) => b.note && !b.noteKey));
    blocks = blocks.flatMap((b) => [b, ...(after.get(b.id) || [])]);
    if (tail.length)
      blocks.push({ ...generated('notes', 'Notes', 'notes'), kind: 'heading', level: 2 }, ...tail);
  }

  const references = new Map<string, { url: string; href: string; id: string; number: number }[]>();
  const externalUrl = (href: string) => {
    try {
      const url = new URL(href.startsWith('//') ? 'https:' + href : href);
      return ['http:', 'https:'].includes(url.protocol)
        ? href.startsWith('//')
          ? 'https:' + href
          : href
        : ['mailto:', 'tel:'].includes(url.protocol)
          ? href.slice(href.indexOf(':') + 1)
          : undefined;
    } catch {
      return;
    }
  };
  blocks = blocks.flatMap((b, index, all) => {
    const image = b.captionFor
      ? all[index - 1]
      : b.kind === 'image' && all[index + 1]?.captionFor !== b.id
        ? b
        : undefined;
    if (!image || image.kind !== 'image' || !image.linkedHref || !settings.includeImages) return [b];
    const alt = doc.assets.find((a) => a.id === image.assetId)?.alt || 'Image link';
    return [
      b,
      {
        ...generated('image-link-' + image.id, alt, b.sectionId),
        inlines: [{ text: alt, href: image.linkedHref, targetKey: image.linkedTargetKey, generated: true }],
      },
    ];
  });
  const enrichBlock = (b: Block): Block => {
    if (b.kind === 'image') return b;
    const next: Inline[] = [];
    // Join adjacent fragments of one link so styling does not repeat its destination.
    for (let i = 0; i < b.inlines.length;) {
      const first = b.inlines[i],
        group: Inline[] = [{ ...first }];
      let j = i + 1;
      if (first.href || first.targetKey)
        while (
          j < b.inlines.length &&
          b.inlines[j].href === first.href &&
          b.inlines[j].targetKey === first.targetKey
        )
          group.push({ ...b.inlines[j++] });
      next.push(...group);
      const visible = normalizedText(group.map((x) => x.text).join(''));
      if (first.targetKey) {
        const target = first.targetKey.startsWith('@')
          ? first.targetKey.slice(1)
          : anchors.get(first.targetKey);
        for (const inline of next.slice(-group.length)) inline.targetKey = target ? '@' + target : undefined;
        if (!target)
          warn('link-target', 'A linked section is missing or excluded; its label was retained.', b.source);
        if (target && options.internalReferences && !notes.has(first.targetKey) && !b.generated)
          next.push({ text: ' [location]', generated: true, locationTarget: target });
      } else if (first.href) {
        const url = externalUrl(first.href);
        if (!url) warn('link-scheme', 'An unsupported link was retained as plain text.', b.source);
        if (url && options.urls !== 'hidden' && visible !== url && visible !== first.href) {
          if (options.urls === 'inline')
            next.push({ text: ' (' + url + ')', href: first.href, generated: true });
          else {
            const key = options.urls === 'book' ? 'book' : chapterByBlock.get(b.id) || b.sectionId;
            const list = references.get(key) || [];
            let item = list.find((r) => r.url === url);
            if (!item) {
              item = {
                url,
                href: first.href!,
                number: list.length + 1,
                id: 'generated-url-' + references.size + '-' + list.length,
              };
              list.push(item);
            }
            references.set(key, list);
            next.push({ text: ' [URL ' + item.number + ']', targetKey: '@' + item.id, generated: true });
          }
        }
      }
      i = j;
    }
    return { ...b, inlines: next };
  };
  blocks = blocks.map((b) =>
    b.kind === 'table'
      ? {
          ...b,
          rows: b.rows?.map((row) =>
            row.map((cell) => enrichBlock({ ...b, kind: 'paragraph', inlines: cell }).inlines),
          ),
        }
      : enrichBlock(b),
  );
  for (const [key, refs] of references) {
    const list = refs.map((r) => ({
      ...generated(r.id.replace('generated-', ''), '[URL ' + r.number + '] ' + r.url, key),
      inlines: [{ text: '[URL ' + r.number + '] ' + r.url, href: r.href, generated: true }],
    }));
    const at =
      options.urls === 'book'
        ? blocks.length - 1
        : blocks.findLastIndex((b) => (chapterByBlock.get(b.id) || b.sectionId) === key);
    blocks.splice(
      at + 1,
      0,
      { ...generated('urls-' + key, 'Link references', key), kind: 'heading', level: 3 },
      ...list,
    );
  }
  if (options.contents === 'compact' && navigation(options.contentsDepth).length) {
    const section = blocks.find((b) => b.kind !== 'image')?.sectionId || 'contents';
    const tocBlocks = [
      { ...generated('toc-title', 'Contents', section), kind: 'heading' as const, level: 2 },
      generated(
        'toc-help',
        'Cells are numbered 1–16, left to right, top to bottom on each printed side.',
        section,
      ),
      ...navigation(options.contentsDepth).map((n, i) => ({
        ...generated('toc-' + i, n.title, section),
        destination: n.blockId,
        tocDepth: n.depth,
      })),
    ];
    const first = blocks.findIndex((b) => b.kind !== 'image');
    blocks.splice(Math.max(0, first), 0, ...tocBlocks);
  }
  // Page-list-only EPUBs do not always provide explicit pagebreak elements.
  // Generated markers preserve all existing source block IDs and use the same compositor.
  const pageLabels = new Map<string, string>();
  for (const entry of doc.pageList || []) {
    const id = anchors.get(entry.targetKey);
    if (id && !source.some((b) => b.pageLabel && b.anchorKeys?.includes(entry.targetKey)))
      pageLabels.set(id, entry.label);
  }
  blocks = blocks.flatMap((b) =>
    pageLabels.has(b.id)
      ? [
          {
            ...generated('page-' + b.id, '', b.sectionId),
            kind: 'separator' as const,
            pageLabel: pageLabels.get(b.id),
          },
          b,
        ]
      : [b],
  );
  const renderedSource = blocks
    .filter((b) => !b.generated)
    .map((b) => ({
      ...b,
      inlines: b.inlines.filter((i) => !i.generated),
      ...(b.rows ? { rows: b.rows.map((row) => row.map((cell) => cell.filter((i) => !i.generated))) } : {}),
    }));
  return {
    blocks,
    source: renderedSource,
    navigation: navigation(options.bookmarkDepth),
    diagnostics,
    anchors,
  };
}
