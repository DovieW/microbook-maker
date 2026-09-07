import { createHash } from 'node:crypto';
import { isUtf8 } from 'node:buffer';
import path from 'node:path';
import fs from 'node:fs/promises';
import yauzl from 'yauzl';
import { DOMParser, XMLSerializer } from '@xmldom/xmldom';
import MarkdownIt from 'markdown-it';
import { imageDimensions } from './images.ts';
import { epubStyles } from './epub-styles.ts';
import {
  blockText,
  headingLabel,
  wordCount,
  type BookDocument,
  type Block,
  type Inline,
  type Diagnostic,
  type HeadingKind,
} from './index.ts';

export const IMPORT_LIMITS = {
  upload: 50 * 1024 ** 2,
  expanded: 250 * 1024 ** 2,
  entry: 32 * 1024 ** 2,
  entries: 5000,
};
export const IMPORT_REVISION = 3;
const md = new MarkdownIt({ html: false, linkify: false, xhtmlOut: true });
type XmlNode = any;
const name = (n: XmlNode): string => (n.localName || n.nodeName || '').toLowerCase();
const children = (n: XmlNode): XmlNode[] => Array.from(n.childNodes ?? []);
const elements = (n: XmlNode, tag: string): XmlNode[] =>
  Array.from(n.getElementsByTagName('*')).filter((e: any) => name(e) === tag);
const attr = (n: XmlNode, key: string): string => n?.getAttribute?.(key) || '';
function xml(text: string, source: string) {
  if (/<!ENTITY/i.test(text)) throw new Error(`Entity declarations are unsupported: ${source}`);
  let invalid = false;
  const doc = new DOMParser({
    onError: (level: string) => {
      if (level !== 'warning') invalid = true;
    },
  }).parseFromString(text, 'application/xhtml+xml');
  if (invalid || !doc.documentElement) throw new Error(`Invalid XML/XHTML: ${source}`);
  return doc;
}
export function resolveArchivePath(from: string, href: string): string {
  const decoded = decodeURIComponent(href.split('#')[0].split('?')[0]);
  if (
    /^[a-z][a-z0-9+.-]*:/i.test(decoded) ||
    decoded.startsWith('/') ||
    decoded.includes('\\') ||
    decoded.includes('\0')
  )
    throw new Error(`Unsupported resource path: ${href}`);
  const result = path.posix.normalize(path.posix.join(path.posix.dirname(from), decoded));
  if (result.startsWith('../') || result === '..') throw new Error(`Resource escapes EPUB archive: ${href}`);
  return result;
}
async function readArchive(input: Buffer): Promise<Map<string, Buffer>> {
  return new Promise((resolve, reject) => {
    yauzl.fromBuffer(
      input,
      { lazyEntries: true, validateEntrySizes: true, strictFileNames: true },
      (err, zip) => {
        if (err || !zip) return reject(err || new Error('Invalid EPUB archive'));
        const files = new Map<string, Buffer>();
        let count = 0;
        let total = 0;
        let failed = false;
        const fail = (error: unknown) => {
          if (!failed) {
            failed = true;
            zip.close();
            reject(error);
          }
        };
        zip.on('error', fail);
        zip.on('end', () => {
          if (!failed) resolve(files);
        });
        zip.on('entry', (entry) => {
          if (
            ++count > IMPORT_LIMITS.entries ||
            entry.uncompressedSize > IMPORT_LIMITS.entry ||
            (total += entry.uncompressedSize) > IMPORT_LIMITS.expanded
          )
            return fail(new Error('EPUB exceeds archive limits'));
          if (entry.generalPurposeBitFlag & 1) return fail(new Error('Encrypted EPUBs are unsupported'));
          if (entry.fileName.endsWith('/')) return zip.readEntry();
          const fileName = path.posix.normalize(entry.fileName);
          if (fileName.startsWith('../') || fileName.startsWith('/') || files.has(fileName))
            return fail(new Error('Invalid or duplicate EPUB entry'));
          zip.openReadStream(entry, (error, stream) => {
            if (error || !stream) return fail(error || new Error('Cannot open EPUB entry'));
            const chunks: Buffer[] = [];
            let size = 0;
            stream.on('data', (chunk) => {
              size += chunk.length;
              if (size > IMPORT_LIMITS.entry || size > entry.uncompressedSize) {
                stream.destroy();
                fail(new Error('EPUB entry exceeds declared size'));
              } else chunks.push(chunk);
            });
            stream.on('error', fail);
            stream.on('end', () => {
              if (!failed) {
                files.set(fileName, Buffer.concat(chunks));
                zip.readEntry();
              }
            });
          });
        });
        zip.readEntry();
      },
    );
  });
}
export async function importDocument(
  input: Buffer,
  originalName: string,
  id: string,
  directory: string,
): Promise<BookDocument> {
  if (!input.length || input.length > IMPORT_LIMITS.upload)
    throw new Error('Provide a nonempty file smaller than 50 MB');
  const extension = path.extname(originalName).toLowerCase();
  if (!['.txt', '.md', '.markdown', '.epub'].includes(extension))
    throw new Error('Supported formats: EPUB, TXT, Markdown');
  const doc: BookDocument = {
    version: 1,
    importRevision: IMPORT_REVISION,
    id,
    originalName: path.basename(originalName),
    format: extension === '.epub' ? 'epub' : extension === '.txt' ? 'txt' : 'markdown',
    sourceHash: createHash('sha256').update(input).digest('hex'),
    sourcePath: `source${extension}`,
    metadata: {
      title: path.basename(originalName, extension),
      author: '',
      year: '',
      series: '',
      language: 'en',
    },
    sections: [],
    blocks: [],
    assets: [],
    diagnostics: [],
    wordCount: 0,
    createdAt: new Date().toISOString(),
  };
  const diagnostics = doc.diagnostics;
  const warn = (code: string, message: string, source?: string) => {
    if (!diagnostics.some((d) => d.code === code && d.source === source))
      diagnostics.push({ code, message, source });
  };
  const addBlock = (block: Omit<Block, 'id'>) =>
    doc.blocks.push({ ...block, id: `b${doc.blocks.length + 1}` });
  await fs.mkdir(directory, { recursive: true });
  await fs.writeFile(path.join(directory, doc.sourcePath), input);
  if (doc.format !== 'epub' && !isUtf8(input))
    warn(
      'text-encoding',
      'Invalid UTF-8 sequences are represented with replacement characters, as in Basic.',
    );
  if (doc.format === 'txt') {
    const text = input.toString('utf8').replace(/^\uFEFF/, '');
    doc.sections.push({
      id: 's1',
      title: doc.metadata.title,
      source: originalName,
    });
    for (const p of text.split(/\n\s*\n/)) {
      const text = p.replace(/\s+/g, ' ').trim();
      if (text)
        addBlock({
          kind: 'paragraph',
          sectionId: 's1',
          source: originalName,
          inlines: [{ text }],
        });
    }
  } else {
    const files = doc.format === 'epub' ? await readArchive(input) : new Map<string, Buffer>();
    let spine: { path: string; title: string; targets?: Set<string> }[] = [];
    const media = new Map<string, string>();
    const toc = new Map<string, string>();
    const sourceKey = (from: string, href: string) =>
      (href.startsWith('#') ? from : resolveArchivePath(from, href)) +
      (href.includes('#') ? '#' + decodeURIComponent(href.split('#')[1]) : '');
    if (doc.format === 'epub') {
      if (!files.has('META-INF/container.xml')) throw new Error('EPUB container.xml is missing');
      const container = xml(files.get('META-INF/container.xml')!.toString('utf8'), 'container.xml');
      const rootfile = elements(container, 'rootfile')[0];
      const packagePath = resolveArchivePath('root', attr(rootfile, 'full-path'));
      if (!files.has(packagePath)) throw new Error('EPUB package document is missing');
      const pkg = xml(files.get(packagePath)!.toString('utf8'), packagePath);
      const textOf = (tag: string) => elements(pkg, tag)[0]?.textContent?.trim() || '';
      doc.metadata = {
        ...doc.metadata,
        title: textOf('title') || doc.metadata.title,
        author: elements(pkg, 'creator')
          .map((e) => e.textContent.trim())
          .join(', '),
        language: textOf('language') || 'en',
        year: textOf('date').match(/\d{4}/)?.[0] || '',
      };
      if (
        elements(pkg, 'meta').some(
          (m) => attr(m, 'property') === 'rendition:layout' && m.textContent.trim() === 'pre-paginated',
        )
      )
        throw new Error('Fixed-layout EPUBs are unsupported; use a reflowable edition');
      const manifest = new Map<string, { path: string; type: string; properties: string }>();
      for (const item of elements(pkg, 'item')) {
        const href = attr(item, 'href');
        if (/^[a-z]+:/i.test(href)) {
          warn('remote-resource', 'Remote resources are not fetched', href);
          continue;
        }
        const resource = {
          path: resolveArchivePath(packagePath, href),
          type: attr(item, 'media-type'),
          properties: attr(item, 'properties'),
        };
        manifest.set(attr(item, 'id'), resource);
        media.set(resource.path, resource.type);
      }
      const encryption = files.get('META-INF/encryption.xml');
      if (encryption) {
        const encrypted = xml(encryption.toString('utf8'), 'encryption.xml');
        if (
          elements(encrypted, 'encryptionmethod').some(
            (e) => !/idpf.org\/2008\/embedding|ns.adobe.com\/pdf\/enc#RC/.test(attr(e, 'Algorithm')),
          )
        )
          throw new Error('DRM-encrypted EPUBs are unsupported');
        warn('publisher-fonts', 'Publisher fonts are replaced by the selected print font');
      }
      for (const item of manifest.values()) {
        if (item.properties.includes('nav') && files.has(item.path)) {
          const nav = xml(files.get(item.path)!.toString('utf8'), item.path);
          const tocNav = elements(nav, 'nav').find((n) => attr(n, 'epub:type').split(/\s+/).includes('toc'));
          for (const a of elements(tocNav || nav, 'a')) {
            try {
              toc.set(sourceKey(item.path, attr(a, 'href')), a.textContent.trim());
            } catch {}
          }
        }
        if (item.type === 'application/x-dtbncx+xml' && files.has(item.path)) {
          const nav = xml(files.get(item.path)!.toString('utf8'), item.path);
          for (const point of elements(nav, 'navpoint')) {
            const content = elements(point, 'content')[0];
            if (content)
              toc.set(
                sourceKey(item.path, attr(content, 'src')),
                elements(point, 'text')[0]?.textContent?.trim() || 'Chapter',
              );
          }
        }
      }
      for (const ref of elements(pkg, 'itemref')) {
        const item = manifest.get(attr(ref, 'idref'));
        if (!item || !files.has(item.path)) throw new Error('An EPUB reading-order document is missing');
        if (!/xhtml|html/.test(item.type)) throw new Error(`Unsupported reading-order content: ${item.type}`);
        spine.push({
          path: item.path,
          title: toc.get(item.path) || [...toc].find(([key]) => key.startsWith(item.path + '#'))?.[1] || '',
        });
      }
    } else {
      const text = input.toString('utf8');
      files.set(
        'document.xhtml',
        Buffer.from(`<html xmlns="http://www.w3.org/1999/xhtml"><body>${md.render(text)}</body></html>`),
      );
      spine = [{ path: 'document.xhtml', title: doc.metadata.title }];
    }
    // Notes can live outside the spine. Read only referenced targets from those files.
    const ancillary = new Map<string, Set<string>>();
    for (const item of spine) {
      const source = xml(files.get(item.path)!.toString('utf8'), item.path);
      for (const link of elements(source, 'a')) {
        if (!/(^|\s)noteref(\s|$)/.test(attr(link, 'epub:type')) && attr(link, 'role') !== 'doc-noteref')
          continue;
        const href = attr(link, 'href');
        try {
          const targetPath = href.startsWith('#') ? item.path : resolveArchivePath(item.path, href);
          const targetId = decodeURIComponent(href.split('#')[1] || '');
          if (!targetId || !files.has(targetPath)) {
            warn('note-missing', `Note target is missing: ${href}`, item.path);
            continue;
          }
          if (!spine.some((s) => s.path === targetPath)) {
            const targets = ancillary.get(targetPath) || new Set<string>();
            targets.add(targetId);
            ancillary.set(targetPath, targets);
          }
        } catch {
          warn('note-missing', `Note target is unsupported: ${href}`, item.path);
        }
      }
    }
    for (const [resource, targets] of ancillary) spine.push({ path: resource, title: 'Notes', targets });
    const assetByPath = new Map<string, string>();
    const notes: Block[] = [];
    for (const [index, item] of spine.entries()) {
      const source = xml(files.get(item.path)!.toString('utf8'), item.path);
      const body = elements(source, 'body')[0] || source.documentElement;
      let sectionId = `s${index + 1}`;
      let subsection = 0;
      if (!item.targets)
        doc.sections.push({
          id: sectionId,
          title:
            item.title ||
            elements(source, 'h1')[0]?.textContent?.trim() ||
            elements(source, 'h2')[0]?.textContent?.trim() ||
            `Section ${index + 1}`,
          source: item.path,
        });
      let css = elements(source, 'style')
        .map((e) => e.textContent)
        .join('\n');
      for (const link of elements(source, 'link')) {
        if (attr(link, 'rel') === 'stylesheet') {
          try {
            css +=
              '\n' + (files.get(resolveArchivePath(item.path, attr(link, 'href')))?.toString('utf8') || '');
          } catch {
            warn('remote-style', 'Remote styles are not loaded', item.path);
          }
        }
      }
      const { style, hidden } = epubStyles(css);
      const isHeading = (node: XmlNode) =>
        /^h[1-6]$/.test(name(node)) ||
        attr(node, 'role').split(/\s+/).includes('heading') ||
        /(?:^|\s)(?:figure_heading|(?:chapter|part)[-_](?:heading|title))(?:\s|$)/i.test(attr(node, 'class'));
      function headingKind(node: XmlNode, text: string): HeadingKind | undefined {
        for (let ancestor = node; ancestor?.nodeType === 1; ancestor = ancestor.parentNode) {
          const semantics = [
            ...attr(ancestor, 'epub:type').split(/\s+/),
            ...attr(ancestor, 'role')
              .split(/\s+/)
              .map((role) => role.replace(/^doc-/, '')),
          ];
          const kind = semantics.includes('chapter')
            ? 'chapter'
            : semantics.includes('part')
              ? 'part'
              : undefined;
          if (kind) {
            // A chapter container can also hold subsection headings. Only its opening
            // heading inherits its role; an inner untyped section stops inheritance.
            const first = isHeading(ancestor)
              ? ancestor
              : Array.from(ancestor.getElementsByTagName('*')).find((n) => isHeading(n) && !hidden(n));
            for (let candidate = node; candidate?.nodeType === 1; candidate = candidate.parentNode)
              if (candidate === first || ancestor === node) return kind;
            break;
          }
          if (ancestor !== node && ['section', 'article'].includes(name(ancestor))) break;
        }
        return headingLabel(text)?.kind;
      }
      function inlines(
        node: XmlNode,
        marks: string[] = [],
        href?: string,
      ): (Inline & { imageNode?: XmlNode })[] {
        if (hidden(node)) return [];
        if (node.nodeType === 3 || node.nodeType === 4) return [{ text: node.nodeValue || '', marks, href }];
        const tag = name(node);
        if (tag === 'img' && doc.format === 'markdown') {
          warn(
            'image-missing',
            'Markdown images use their alternative text; remote resources are not fetched',
            item.path,
          );
          return [{ text: attr(node, 'alt'), marks, href }];
        }
        if (tag === 'img' || tag === 'image') return [{ text: '', imageNode: node }];
        if (tag === 'svg')
          return elements(node, 'image').length
            ? elements(node, 'image').flatMap((child) => inlines(child, marks, href))
            : [{ text: '', imageNode: node }];
        if (['script', 'style', 'noscript'].includes(tag)) return [];
        if (tag === 'br') return [{ text: '\n', marks: [...marks, 'break'], href }];
        const next = [...marks];
        const styles = style(node);
        if (['b', 'strong'].includes(tag) || /font-weight\s*:\s*(bold|[7-9]00)/i.test(styles))
          next.push('strong');
        if (['i', 'em', 'cite'].includes(tag) || /font-style\s*:\s*italic/i.test(styles)) next.push('em');
        if (['code', 'kbd', 'samp'].includes(tag)) next.push('code');
        if (['sup', 'sub', 's', 'u'].includes(tag)) next.push(tag);
        const link = tag === 'a' ? attr(node, 'href') : href;
        return children(node).flatMap((c) => inlines(c, next, link));
      }
      async function image(node: XmlNode) {
        if (hidden(node)) return;
        let heading = false;
        for (let ancestor = node; ancestor?.nodeType === 1; ancestor = ancestor.parentNode) {
          if (isHeading(ancestor)) heading = true;
        }
        const imageHeading = heading ? attr(node, 'alt').replace(/\s+/g, ' ').trim() : '';
        const inlineSvg = name(node) === 'svg';
        const raw = inlineSvg
          ? `inline-svg-${doc.assets.length + 1}.svg`
          : attr(node, 'src') || attr(node, 'href') || attr(node, 'xlink:href');
        let resource: string;
        try {
          resource = resolveArchivePath(item.path, raw);
        } catch {
          warn('image-missing', `Image not loaded: ${raw}`, item.path);
          return;
        }
        const bytes = inlineSvg
          ? Buffer.from(new XMLSerializer().serializeToString(node))
          : files.get(resource);
        if (!bytes) {
          warn('image-missing', `Image is missing: ${raw}`, item.path);
          return;
        }
        const type =
          (inlineSvg ? 'image/svg+xml' : media.get(resource)) ||
          {
            '.png': 'image/png',
            '.jpg': 'image/jpeg',
            '.jpeg': 'image/jpeg',
            '.gif': 'image/gif',
            '.svg': 'image/svg+xml',
          }[path.extname(resource).toLowerCase()];
        if (
          !type ||
          !['image/png', 'image/jpeg', 'image/gif', 'image/svg+xml', 'image/webp'].includes(type)
        ) {
          warn('image-format', `Unsupported image: ${raw}`, item.path);
          return;
        }
        if (
          type === 'image/svg+xml' &&
          /<script|<foreignObject|<!ENTITY|(?:href|src)\s*=\s*["'](?:https?:|file:|\/\/)/i.test(
            bytes.toString('utf8'),
          )
        )
          throw new Error(`Unsafe SVG image: ${raw}`);
        try {
          imageDimensions(bytes, type);
        } catch (error) {
          throw new Error(`${(error as Error).message}: ${raw}`);
        }
        let assetId = assetByPath.get(resource);
        if (!assetId) {
          assetId = `a${doc.assets.length + 1}`;
          const filename = assetId + path.extname(resource).toLowerCase();
          await fs.mkdir(path.join(directory, 'assets'), { recursive: true });
          await fs.writeFile(path.join(directory, 'assets', filename), bytes);
          doc.assets.push({
            id: assetId,
            path: `assets/${filename}`,
            mediaType: type,
            alt: attr(node, 'alt'),
          });
          assetByPath.set(resource, assetId);
        }
        addBlock({
          kind: 'image',
          sectionId,
          assetId,
          source: item.path,
          inlines: [],
          ...(imageHeading ? { imageHeading, level: 2, headingKind: headingKind(node, imageHeading) } : {}),
        });
        if (imageHeading)
          warn('image-heading', 'Chapter artwork is typeset using its supplied alternative text.', item.path);
      }
      const markedItems = new Set<XmlNode>();
      function listProperties(node: XmlNode): Partial<Block> {
        let item: XmlNode | undefined;
        let depth = 0;
        for (let ancestor = node; ancestor; ancestor = ancestor.parentNode) {
          if (name(ancestor) === 'li') item ||= ancestor;
          if (['ol', 'ul'].includes(name(ancestor))) depth++;
        }
        if (!item) return {};
        const result: Partial<Block> = { kind: 'list-item', listDepth: Math.max(0, depth - 1) };
        if (markedItems.has(item)) return result;
        markedItems.add(item);
        const list = item.parentNode;
        let marker = '•';
        if (name(list) === 'ol') {
          const siblings = children(list).filter((child) => name(child) === 'li');
          const reversed = list.hasAttribute('reversed');
          let value = Number(attr(list, 'start') || (reversed ? siblings.length : 1));
          for (const sibling of siblings) {
            if (attr(sibling, 'value')) value = Number(attr(sibling, 'value'));
            if (sibling === item) break;
            value += reversed ? -1 : 1;
          }
          value = Number.isFinite(value) ? Math.trunc(value) : 1;
          const type = attr(item, 'type') || attr(list, 'type');
          let label = String(value);
          if (/^[aA]$/.test(type) && value > 0 && value < 1_000_000) {
            label = '';
            for (let n = value; n > 0; n = Math.floor((n - 1) / 26))
              label = String.fromCharCode(97 + ((n - 1) % 26)) + label;
          } else if (/^[iI]$/.test(type) && value > 0 && value < 4000) {
            label = '';
            let n = value;
            for (const [amount, letters] of [
              [1000, 'm'],
              [900, 'cm'],
              [500, 'd'],
              [400, 'cd'],
              [100, 'c'],
              [90, 'xc'],
              [50, 'l'],
              [40, 'xl'],
              [10, 'x'],
              [9, 'ix'],
              [5, 'v'],
              [4, 'iv'],
              [1, 'i'],
            ] as const)
              while (n >= amount) {
                label += letters;
                n -= amount;
              }
          }
          if (type === 'A' || type === 'I') label = label.toUpperCase();
          marker = label + '.';
        }
        return { ...result, listMarker: marker };
      }
      async function walk(node: XmlNode, note = false): Promise<void> {
        if (hidden(node)) return;
        const tag = name(node);
        if (!item.targets && !note && node.nodeType === 1) {
          const anchor =
            attr(node, 'id') ||
            (/^h[1-6]$/.test(tag)
              ? Array.from(node.getElementsByTagName('*'))
                  .map((n) => attr(n, 'id'))
                  .find((id) => toc.has(item.path + '#' + id))
              : '');
          const key = item.path + '#' + anchor;
          if (anchor && toc.has(key)) {
            const section = doc.sections.find((s) => s.id === sectionId)!;
            if (!doc.blocks.some((b) => b.sectionId === sectionId)) {
              section.title = toc.get(key)!;
              section.source = key;
            } else if (section.source !== key) {
              sectionId = `s${index + 1}-${++subsection}`;
              doc.sections.push({
                id: sectionId,
                title: toc.get(key)!,
                source: key,
              });
            }
          }
        }
        if (['script', 'style', 'head', 'noscript'].includes(tag)) return;
        const isNote =
          note ||
          /(^|\s)(footnote|endnote)(\s|$)/.test(attr(node, 'epub:type')) ||
          attr(node, 'role') === 'doc-footnote';
        const before = doc.blocks.length;
        if (attr(node, 'epub:type').split(/\s+/).includes('pagebreak')) {
          const label = attr(node, 'title') || attr(node, 'aria-label') || node.textContent?.trim();
          if (label)
            addBlock({
              kind: 'separator',
              sectionId,
              source: item.path + '#' + attr(node, 'id'),
              pageLabel: label,
              inlines: [],
            });
        } else if (tag === 'svg' && !elements(node, 'image').length) await image(node);
        else if (tag === 'img' || tag === 'image') await image(node);
        else if (tag === 'hr')
          addBlock({
            kind: 'separator',
            sectionId,
            source: item.path,
            inlines: [],
          });
        else if (
          tag === 'table' &&
          (elements(node, 'img').length || elements(node, 'image').length || elements(node, 'svg').length)
        ) {
          warn('illustrated-table', 'An illustrated table is reflowed in reading order', item.path);
          for (const child of children(node)) await walk(child, isNote);
        } else if (tag === 'table') {
          const rows = elements(node, 'tr').map((tr) =>
            children(tr)
              .filter((c) => ['td', 'th'].includes(name(c)))
              .map((c) => inlines(c)),
          );
          if (
            elements(node, 'td').some(
              (c) => Number(attr(c, 'colspan') || 1) > 1 || Number(attr(c, 'rowspan') || 1) > 1,
            )
          )
            warn('table-layout', 'Table spans are simplified to rows and columns', item.path);
          addBlock({
            kind: 'table',
            sectionId,
            source: item.path,
            inlines: [],
            rows,
          });
        } else if (
          /^h[1-6]$/.test(tag) ||
          ['p', 'pre', 'blockquote', 'li', 'figcaption', 'dt', 'dd', 'td', 'th'].includes(tag) ||
          (['div', 'section', 'article', 'span'].includes(tag) &&
            !children(node).some((c) =>
              /^(p|div|section|article|h[1-6]|table|figure|blockquote|ul|ol|li)$/.test(name(c)),
            ))
        ) {
          // Containers with nested blocks must not duplicate descendant text.
          if (children(node).some((c) => ['p', 'div', 'ul', 'ol', 'li', 'blockquote'].includes(name(c)))) {
            for (const child of children(node)) await walk(child, isNote);
          } else {
            const inline = inlines(node);
            const level = /^h/.test(tag) ? Number(tag[1]) : undefined;
            const isPre = tag === 'pre' || /white-space\s*:\s*pre/.test(style(node));
            const kind = level
              ? 'heading'
              : isPre
                ? 'pre'
                : tag === 'blockquote' || name(node.parentNode || {}) === 'blockquote'
                  ? 'quote'
                  : ['li', 'dt', 'dd'].includes(tag)
                    ? 'list-item'
                    : 'paragraph';
            let segment: Inline[] = [];
            const flush = () => {
              if (segment.some((i) => i.text.trim()))
                addBlock({
                  kind,
                  sectionId,
                  source: item.path + (attr(node, 'id') ? '#' + attr(node, 'id') : ''),
                  inlines: segment,
                  level,
                  ...(kind === 'heading'
                    ? { headingKind: headingKind(node, segment.map((i) => i.text).join('')) }
                    : {}),
                  ...(kind === 'paragraph' || kind === 'list-item' ? listProperties(node) : {}),
                  ...(tag === 'figcaption' && doc.blocks.at(-1)?.kind === 'image'
                    ? { captionFor: doc.blocks.at(-1)!.id }
                    : {}),
                  align: /text-align\s*:\s*center/.test(style(node))
                    ? 'center'
                    : /text-align\s*:\s*right/.test(style(node))
                      ? 'right'
                      : undefined,
                });
              segment = [];
            };
            for (const inlinePart of inline) {
              if (inlinePart.imageNode) {
                flush();
                await image(inlinePart.imageNode);
              } else segment.push(inlinePart);
            }
            flush();
          }
        } else if (node.nodeType === 3) {
          if (node.nodeValue?.trim())
            addBlock({
              kind: 'paragraph',
              sectionId,
              source: item.path,
              inlines: [{ text: node.nodeValue }],
              ...listProperties(node),
            });
        } else {
          if (['audio', 'video', 'math', 'iframe', 'object'].includes(tag)) {
            warn('unsupported-content', `Unsupported ${tag} content`, item.path);
            return;
          }
          for (const child of children(node)) await walk(child, isNote);
        }
        if (isNote && !note) notes.push(...doc.blocks.splice(before).map((b) => ({ ...b, note: true })));
      }
      if (item.targets) {
        for (const target of item.targets) {
          const node =
            elements(source, '*').find((n) => attr(n, 'id') === target) ||
            Array.from(source.getElementsByTagName('*')).find((n) => attr(n, 'id') === target);
          if (!node) {
            warn('note-missing', `Note target is missing: ${target}`, item.path);
            continue;
          }
          const before = doc.blocks.length;
          await walk(node, true);
          notes.push(...doc.blocks.splice(before).map((b) => ({ ...b, note: true })));
        }
      } else await walk(body);
    }
    if (notes.length) {
      doc.sections.push({ id: 'notes', title: 'Notes', source: 'notes' });
      addBlock({
        kind: 'heading',
        level: 2,
        sectionId: 'notes',
        source: 'notes',
        inlines: [{ text: 'Notes' }],
      });
      for (const note of notes) addBlock({ ...note, sectionId: 'notes' });
    }
  }
  // Whitespace collapses across inline boundaries, never independently per styled segment.
  for (const block of doc.blocks) {
    if (block.kind === 'pre') continue;
    let previousSpace = true;
    for (const inline of block.inlines) {
      if (inline.marks?.includes('break')) {
        previousSpace = true;
        continue;
      }
      inline.text = inline.text.replace(/\s+/g, ' ');
      if (previousSpace) inline.text = inline.text.replace(/^ /, '');
      if (inline.text) previousSpace = inline.text.endsWith(' ');
    }
    const last = block.inlines.findLast((i) => i.text.length > 0);
    if (last) last.text = last.text.replace(/ $/, '');
  }
  doc.wordCount = wordCount(doc.blocks.map(blockText).join('\n'));
  if (!doc.blocks.length) throw new Error('No readable content was found');
  await fs.writeFile(path.join(directory, 'document.json'), JSON.stringify(doc, null, 2));
  return doc;
}
