import { z } from 'zod';
import { imageOutputSchema } from './image-output.ts';
export {
  imageOutputModes,
  laserContrastLevels,
  imageOutputSchema,
  imageOutputQuery,
  IMAGE_OUTPUT_VERSION,
  type ImageOutput,
} from './image-output.ts';
import { richFeaturesSchema } from './rich-settings.ts';
export { richFeaturesSchema, newRichFeatures, type RichFeatures } from './rich-settings.ts';
export {
  customTextSchema,
  addCustomText,
  addCustomImage,
  replaceImage,
  restoreImage,
  type CustomTextInput,
  type CustomImageInput,
} from './custom-content.ts';
export { imageDimensions } from './images.ts';

export const fonts = [
  ['arial', 'Arial'],
  ['times-new-roman', 'Times New Roman'],
  ['courier-new', 'Courier New'],
  ['dejavu-sans', 'DejaVu Sans'],
  ['dejavu-serif', 'DejaVu Serif'],
  ['dejavu-sans-mono', 'DejaVu Sans Mono'],
] as const;
export const fontStacks: Record<string, string> = {
  arial: 'Arial, Arimo, sans-serif',
  'times-new-roman': '"Times New Roman", Tinos, serif',
  'courier-new': '"Courier New", Cousine, monospace',
  'dejavu-sans': '"DejaVu Sans", sans-serif',
  'dejavu-serif': '"DejaVu Serif", serif',
  'dejavu-sans-mono': '"DejaVu Sans Mono", monospace',
};
export const settingsSchema = z
  .object({
    version: z.literal(1).default(1),
    rich: richFeaturesSchema.default(() => richFeaturesSchema.parse({})),
    mode: z.enum(['classic', 'book']).default('book'),
    fontFamily: z.enum(fonts.map((f) => f[0]) as [string, ...string[]]).default('arial'),
    fontSizePx: z.number().min(4).max(12).default(6),
    borderStyle: z.enum(['dashed', 'solid', 'dotted', 'none']).default('solid'),
    foldGaps: z.boolean().default(true),
    foldGapMm: z.number().min(0.5).max(6).default(2.5),
    foldGapEveryRow: z.boolean().default(true),
    readingOrder: z.enum(['rows', 'quadrants']).default('rows'),
    lineHeight: z.number().min(0.5).max(1.6).default(1),
    paragraphStyle: z.enum(['lines', 'markers', 'continuous', 'spaced']).default('continuous'),
    paragraphIndentEm: z.number().min(0).max(3).default(0),
    paragraphGapEm: z.number().min(0).max(2).default(0),
    headingScale: z.number().min(0.65).max(2.5).default(1.15),
    chapterHeadingScale: z.number().min(0.65).max(2.5).default(1.35),
    partHeadingScale: z.number().min(0.65).max(3).default(1.65),
    chapterHeadingStyle: z.enum(['italic', 'upright']).default('italic'),
    partHeadingStyle: z.enum(['italic', 'upright']).default('upright'),
    chapterHeadingGapEm: z.number().min(0).max(2).default(0.15),
    partHeadingGapEm: z.number().min(0).max(2).default(0.25),
    headingRules: z.boolean().default(true),
    customHeadingRules: z
      .array(
        z.object({
          pattern: z.string().max(200),
          headingKind: z.enum(['chapter', 'part']),
        }),
      )
      .max(30)
      .default([]),
    positionHeaders: z.boolean().default(true),
    sourcePageNumbers: z.boolean().default(false),
    twoCellImages: z.boolean().default(false),
    imageCellSpans: z.record(z.string().max(200), z.union([z.literal(1), z.literal(2)])).default({}),
    imageTreatments: z
      .record(
        z.string().max(200),
        z.discriminatedUnion('kind', [
          z.object({ kind: z.literal('image') }),
          z.object({
            kind: z.literal('flourish'),
            widthEm: z.number().min(1).max(12).default(4),
            gapEm: z.number().min(0).max(2).default(0.25),
          }),
          z.object({
            kind: z.literal('heading'),
            text: z.string().trim().min(1).max(500),
            headingKind: z.enum(['chapter', 'part']),
          }),
        ]),
      )
      .default({}),
    imageOutput: imageOutputSchema.default(() => imageOutputSchema.parse({})),
    imageRotations: z
      .record(z.string().max(200), z.union([z.literal(0), z.literal(90), z.literal(180), z.literal(270)]))
      .default({}),
    imageOutputOverrides: z.record(z.string().max(200), imageOutputSchema).default({}),
    imageScale: z.number().min(0.2).max(1).default(1),
    includeImages: z.boolean().default(true),
    excludedImageIds: z.array(z.string().max(200)).max(10000).default([]),
    marginMm: z.number().min(0).max(12).default(0),
    selectedSections: z.array(z.string()).nullable().default(null),
    sectionOrder: z
      .array(z.string())
      .max(10000)
      .refine((ids) => new Set(ids).size === ids.length, 'Section order contains duplicates')
      .default([]),
  })
  .superRefine((s, ctx) => {
    if (
      s.mode === 'classic' &&
      (!Number.isInteger(s.fontSizePx) || s.fontSizePx > 10 || s.borderStyle === 'none')
    ) {
      ctx.addIssue({
        code: 'custom',
        message: 'Basic supports sizes 4–10 and dashed, solid, or dotted borders.',
      });
    }
  });
export type RenderSettings = z.infer<typeof settingsSchema>;
export type Mode = RenderSettings['mode'];
// Retain stored/API identifiers so existing books, exports and preferences still open.
export const modeLabels: Record<Mode, string> = { classic: 'Basic', book: 'Rich' };
export type HeadingKind = 'part' | 'chapter';
export function headingLabel(text: string): { kind: HeadingKind; length: number } | undefined {
  const match = text.match(
    /^\s*(chapter|part|book)\s+(?:\p{Nd}+|[ivxlcdm]+|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|thirteen|fourteen|fifteen|sixteen|seventeen|eighteen|nineteen|twenty)(?=[\s:.–—-]|$)[\s:.–—-]*/iu,
  );
  return match
    ? { kind: match[1].toLowerCase() === 'chapter' ? 'chapter' : 'part', length: match[0].length }
    : undefined;
}
export const defaultSettings = (mode: Mode = 'book'): RenderSettings =>
  settingsSchema.parse({ mode, ...(mode === 'classic' ? { paragraphStyle: 'lines' } : {}) });
export const metadataSchema = z.object({
  title: z.string().trim().min(1).max(500),
  author: z.string().max(500).default(''),
  year: z.string().max(30).default(''),
  series: z.string().max(500).default(''),
  language: z.string().max(40).default('en'),
});
export type Metadata = z.infer<typeof metadataSchema>;
export interface Inline {
  text: string;
  marks?: string[];
  href?: string;
  targetKey?: string;
  generated?: boolean;
  locationTarget?: string;
}
export interface Block {
  id: string;
  sectionId: string;
  kind: 'paragraph' | 'heading' | 'quote' | 'pre' | 'separator' | 'image' | 'table' | 'list-item';
  inlines: Inline[];
  level?: number;
  /** Explicit source semantics, or an unambiguous numbered heading label. */
  headingKind?: HeadingKind;
  align?: 'left' | 'center' | 'right';
  assetId?: string;
  /** Accessible chapter lettering supplied by an image inside a heading container. */
  imageHeading?: string;
  rows?: Inline[][][];
  source: string;
  note?: boolean;
  captionFor?: string;
  pageLabel?: string;
  anchorKeys?: string[];
  passage?: 'quote' | 'epigraph' | 'letter' | 'poetry' | 'aside';
  publisherFont?: string;
  tocContent?: boolean;
  noteKey?: string;
  originSectionId?: string;
  sourceOrder?: number;
  generated?: boolean;
  destination?: string;
  tocDepth?: number;
  linkedHref?: string;
  linkedTargetKey?: string;
  listMarker?: string;
  listDepth?: number;
  /** User-created content or a user-selected replacement for source artwork. */
  custom?: boolean;
  /** Original source asset retained so an image replacement can be undone. */
  originalAssetId?: string;
}
export interface NavigationEntry {
  title: string;
  targetKey: string;
  depth: number;
  role?: string;
}
export interface PublisherFont {
  id: string;
  path: string;
  family: string;
  weight: string;
  style: string;
  mediaType: string;
}
export interface Asset {
  id: string;
  path: string;
  mediaType: string;
  alt: string;
  custom?: boolean;
}
export interface Section {
  id: string;
  title: string;
  source: string;
  custom?: boolean;
}
export interface Diagnostic {
  code: string;
  message: string;
  source?: string;
}
export interface BookDocument {
  version: 1;
  importRevision?: number;
  contentRevision?: number;
  id: string;
  format: 'txt' | 'markdown' | 'epub';
  originalName: string;
  sourceHash: string;
  sourcePath: string;
  metadata: Metadata;
  sections: Section[];
  blocks: Block[];
  assets: Asset[];
  navigation?: NavigationEntry[];
  pageList?: { label: string; targetKey: string }[];
  publisherFonts?: PublisherFont[];
  diagnostics: Diagnostic[];
  wordCount: number;
  createdAt: string;
  lastRenderId?: string;
  lastRenderIds?: Partial<Record<Mode, string>>;
  legacyId?: string;
  importMs?: number;
  renderStats?: Partial<
    Record<
      Mode,
      {
        settings: RenderSettings;
        metadata: Metadata;
        pages: number;
        sheets: number;
        cells: number;
      }
    >
  >;
}
export interface CellMap {
  positionHeader?: { x: number; y: number; width: number; height: number };
  positionLabel?: string;
  sheetHeader?: { x: number; y: number; width: number; height: number };
  sheetLabel?: string;
  index: number;
  /** Zero-based physical position on the printed 4 × 4 side. */
  slot?: number;
  page: number;
  x: number;
  y: number;
  width: number;
  height: number;
  sectionId?: string;
  blockIds: string[];
  text: string;
  /** Final visible text in this cell, including generated navigation and references. */
  printedText?: string;
  ranges?: { blockId: string; start: number; end: number }[];
  readingStart?: number;
  readingEnd?: number;
  /** A two-cell illustration keeps two physical slots but previews as one region. */
  span?: 2;
  continuationOf?: number;
  blank?: boolean;
}
export function previewRegion(cells: CellMap[], index: number): CellMap | undefined {
  const selected = cells[Math.min(index, cells.length - 1)];
  const first = selected?.continuationOf === undefined ? selected : cells[selected.continuationOf];
  return first && { ...first, width: first.width * (first.span || 1) };
}
export interface SourceLocation {
  cell: number;
  block?: string;
  offset?: number;
  readingOffset?: number;
}
export function sourceLocation(cell?: CellMap, block?: string): SourceLocation {
  const range = cell?.ranges?.find((range) => !block || range.blockId === block);
  return {
    cell: cell?.index || 0,
    block: block || range?.blockId || cell?.blockIds[0],
    offset: block ? 0 : range?.start,
    readingOffset: cell?.readingStart,
  };
}
export function cellAtLocation(cells: CellMap[], location: SourceLocation): number {
  const anchored = location.block
    ? cells.find((cell) =>
        cell.ranges
          ? cell.ranges.some(
              (range) =>
                range.blockId === location.block &&
                range.start <= (location.offset || 0) &&
                (range.end > (location.offset || 0) || range.start === range.end),
            )
          : cell.blockIds.includes(location.block!),
      )
    : undefined;
  const byOffset =
    location.readingOffset === undefined
      ? undefined
      : cells.find(
          (cell) =>
            cell.readingStart !== undefined &&
            cell.readingEnd !== undefined &&
            cell.readingStart <= location.readingOffset! &&
            cell.readingEnd > location.readingOffset!,
        );
  return anchored?.index ?? byOffset?.index ?? Math.min(location.cell, Math.max(0, cells.length - 1));
}
export interface RenderResult {
  destinations?: Record<string, { page: number; x: number; y: number; cell: number }>;
  navigation?: { title: string; blockId: string; depth: number }[];
  sectionRegions?: { sectionId: string; page: number; x: number; y: number; width: number; height: number }[];
  pages: number;
  sheets: number;
  cells: CellMap[];
  imageRegions?: { blockId?: string; page: number; x: number; y: number; width: number; height: number }[];
  wordCount: number;
  fingerprint: Record<string, string>;
  timings: Record<string, number>;
  peakMemoryMb: number;
  measurementCache?: { hits: number; misses: number; entries: number };
  coverage: {
    expectedCharacters: number;
    renderedCharacters: number;
    complete: boolean;
    overflows: number;
  };
  diagnostics: Diagnostic[];
}
export interface RenderJob {
  version: 1;
  id: string;
  documentId: string;
  /** Document content revision used to produce this render. */
  contentRevision?: number;
  settings: RenderSettings;
  metadata: Metadata;
  cacheKey: string;
  status: 'queued' | 'running' | 'completed' | 'failed' | 'cancelled' | 'interrupted';
  phase: string;
  progress?: RenderProgress;
  startedAt?: string;
  createdAt: string;
  updatedAt: string;
  saved: boolean;
  savedLabel?: string;
  savedAt?: string;
  error?: string;
  result?: RenderResult;
  cached?: boolean;
}
export interface RenderProgress {
  completed: number;
  total: number;
  unit: 'percent' | 'blocks';
  sides?: number;
}
export type LibraryRender = Pick<
  RenderJob,
  'id' | 'status' | 'settings' | 'saved' | 'savedLabel' | 'savedAt' | 'createdAt'
> & {
  result?: Pick<RenderResult, 'sheets' | 'pages'>;
};
export type LibraryDocument = Pick<
  BookDocument,
  'id' | 'metadata' | 'format' | 'lastRenderId' | 'lastRenderIds' | 'originalName' | 'createdAt'
> & {
  renders: LibraryRender[];
};
export const geometry = {
  widthPx: 816,
  heightPx: 1056,
  gridHeightRatio: 0.997,
  columns: 4,
  rows: 4,
  cellsPerSide: 16,
  sidesPerSheet: 2,
  pointsPerPixel: 0.75,
} as const;
export const activeJob = (job?: RenderJob | null) => job?.status === 'queued' || job?.status === 'running';
export const blockText = (block: Block) =>
  block.kind === 'table'
    ? (block.rows ?? [])
        .map((row) => row.map((cell) => cell.map((i) => i.text).join('')).join(' '))
        .join('\n')
    : block.inlines.map((i) => i.text).join('');
export const bookBlockText = (block: Block) => block.imageHeading || blockText(block);
export const normalizedText = (text: string) =>
  text
    .normalize('NFC')
    .replace(/\u00ad/g, '')
    .replace(/\s+/g, ' ')
    .trim();
/** Interpret artwork without changing source blocks, IDs, or existing PDF artifacts. */
const detectedHeadings = new WeakMap<BookDocument, Map<string, { text: string; headingKind: HeadingKind }>>();
export function automaticImageHeadings(doc: BookDocument) {
  const cached = detectedHeadings.get(doc);
  if (cached) return cached;
  const found = new Map<string, { text: string; headingKind: HeadingKind }>();
  const titles = new Map(doc.sections.map((s) => [s.id, s.title]));
  const assets = new Map(doc.assets.map((a) => [a.id, a]));
  const started = new Set<string>();
  const comparable = (text: string) =>
    text
      .normalize('NFKC')
      .toLocaleLowerCase('en')
      .replace(/[^\p{L}\p{N}]+/gu, '');
  for (const block of doc.blocks) {
    if (block.kind === 'image') {
      const text =
        block.imageHeading ||
        assets
          .get(block.assetId || '')
          ?.alt?.replace(/\s+/g, ' ')
          .trim() ||
        '';
      const label = headingLabel(text);
      // Unmarked artwork requires all three signals: opening position, a numbered
      // chapter/part label, and agreement with the EPUB navigation title.
      if (
        block.imageHeading ||
        (!started.has(block.sectionId) &&
          label &&
          comparable(text) === comparable(titles.get(block.sectionId) || ''))
      ) {
        found.set(block.id, { text, headingKind: block.headingKind || label?.kind || 'chapter' });
      }
    }
    if (block.kind === 'image' || (!block.pageLabel && blockText(block).trim())) started.add(block.sectionId);
  }
  detectedHeadings.set(doc, found);
  return found;
}
export function imageHeadingTreatment(doc: BookDocument, block: Block, settings?: RenderSettings) {
  const override = settings?.imageTreatments?.[block.id];
  if (override) return override.kind === 'heading' ? override : undefined;
  return automaticImageHeadings(doc).get(block.id);
}
const detectedTextHeadings = new WeakMap<BookDocument, Map<string, HeadingKind>>();
const comparableHeading = (text: string) =>
  normalizedText(text)
    .toLocaleLowerCase('en')
    .replace(/[^\p{L}\p{N}]+/gu, '');
/** Infer only short opening headings; numbering alone in body text is insufficient. */
export function automaticTextHeadings(doc: BookDocument): Map<string, HeadingKind> {
  const cached = detectedTextHeadings.get(doc);
  if (cached) return cached;
  const found = new Map<string, HeadingKind>();
  const titles = new Map(doc.sections.map((s) => [s.id, normalizedText(s.title).toLowerCase()]));
  const started = new Set<string>();
  const numbered: { block: Block; number: number; agrees: boolean }[] = [];
  for (const block of doc.blocks) {
    const text = normalizedText(blockText(block));
    if (block.pageLabel || !text || block.kind === 'image' || block.kind === 'separator') continue;
    const opening = !started.has(block.sectionId);
    started.add(block.sectionId);
    if (!opening || !['heading', 'paragraph'].includes(block.kind) || text.length > 160) continue;
    if (block.headingKind) {
      found.set(block.id, block.headingKind);
      continue;
    }
    const explicit = headingLabel(text);
    const agrees = titles.get(block.sectionId) === text.toLowerCase();
    if (explicit && (block.kind === 'heading' || agrees)) {
      found.set(block.id, explicit.kind);
      continue;
    }
    const numeric = text.match(/^(\d{1,4})(?:\s*[:.–—-]\s*\S.*)?$/u);
    if (numeric && (block.kind === 'heading' || agrees))
      numbered.push({ block, number: Number(numeric[1]), agrees });
  }
  // A contents match supports a numbered heading directly. Otherwise require an
  // increasing sequence across at least three different source sections.
  const sequence =
    numbered.length >= 3 && numbered.every((entry, i) => i === 0 || entry.number > numbered[i - 1].number);
  for (const entry of numbered) if (entry.agrees || sequence) found.set(entry.block.id, 'chapter');
  detectedTextHeadings.set(doc, found);
  return found;
}
/** Full-line, case-insensitive matching. # matches digits; * matches any text. */
export function matchesHeadingPattern(text: string, pattern: string): boolean {
  const tokens = Array.from(normalizedText(pattern).toLocaleLowerCase('en'));
  if (!tokens.length) return false;
  const value = Array.from(normalizedText(text).toLocaleLowerCase('en'));
  let previous = new Array(value.length + 1).fill(false);
  previous[0] = true;
  for (const token of tokens) {
    const next = new Array(value.length + 1).fill(false);
    if (token === '*') next[0] = previous[0];
    for (let j = 1; j <= value.length; j++) {
      next[j] =
        token === '*'
          ? previous[j] || next[j - 1]
          : token === '#'
            ? /[0-9]/.test(value[j - 1]) && (previous[j - 1] || next[j - 1])
            : token === value[j - 1] && previous[j - 1];
    }
    previous = next;
  }
  return previous[value.length];
}
export function customHeadingKind(block: Block, settings: RenderSettings): HeadingKind | undefined {
  if (!['heading', 'paragraph'].includes(block.kind) || block.pageLabel) return;
  const text = blockText(block);
  if (text.length > 500) return;
  return settings.customHeadingRules?.find((r) => matchesHeadingPattern(text, r.pattern))?.headingKind;
}
function canonicalHeadingInlines(inlines: Inline[]): Inline[] {
  let changed = false;
  const canonical = inlines.map((inline) => {
    const marks = inline.marks?.filter((mark) => mark !== 'strong' && mark !== 'em');
    if (marks?.length === inline.marks?.length) return inline;
    changed = true;
    return { ...inline, ...(marks?.length ? { marks } : { marks: undefined }) };
  });
  return changed ? canonical : inlines;
}
/** Join EPUBs that encode an opening heading label and title as separate paragraphs. */
function canonicalHeadingBlocks(doc: BookDocument, blocks: Block[]): Block[] {
  const titles = new Map(doc.sections.map((section) => [section.id, comparableHeading(section.title)]));
  const remove = new Set<number>();
  const replacements = new Map<number, Block>();
  const bySection = new Map<string, number[]>();
  for (const [index, block] of blocks.entries()) {
    if (block.kind === 'separator' || block.pageLabel || !blockText(block).trim()) continue;
    const indexes = bySection.get(block.sectionId) || [];
    indexes.push(index);
    bySection.set(block.sectionId, indexes);
  }
  for (const indexes of bySection.values()) {
    const [firstIndex, titleIndex] = indexes;
    if (firstIndex === undefined || titleIndex === undefined) continue;
    const first = blocks[firstIndex],
      title = blocks[titleIndex],
      firstText = normalizedText(blockText(first)),
      titleText = normalizedText(blockText(title)),
      label = headingLabel(firstText),
      numeric = /^\d{1,4}\s*[:.–—-]?$/u.test(firstText),
      kind = first.headingKind || label?.kind || (numeric ? 'chapter' : undefined);
    if (
      !kind ||
      !['paragraph', 'heading'].includes(first.kind) ||
      !['paragraph', 'heading'].includes(title.kind) ||
      titleText.length > 160 ||
      (label && normalizedText(firstText.slice(label.length))) ||
      comparableHeading(`${firstText} ${titleText}`) !== titles.get(first.sectionId)
    )
      continue;
    const anchorKeys = [...new Set([...(first.anchorKeys || []), ...(title.anchorKeys || [])])];
    replacements.set(firstIndex, {
      ...first,
      kind: 'heading',
      headingKind: kind,
      level: first.level || 2,
      align: undefined,
      publisherFont: first.publisherFont || title.publisherFont,
      anchorKeys: anchorKeys.length ? anchorKeys : undefined,
      inlines: canonicalHeadingInlines([...first.inlines, { text: ' ', generated: true }, ...title.inlines]),
    });
    remove.add(titleIndex);
  }
  return blocks.flatMap((block, index) => {
    if (remove.has(index)) return [];
    const replacement = replacements.get(index);
    if (replacement) return [replacement];
    return block.kind === 'heading' && block.headingKind
      ? [{ ...block, inlines: canonicalHeadingInlines(block.inlines) }]
      : [block];
  });
}
export function selectedDocumentBlocks(doc: BookDocument, settings?: RenderSettings): Block[] {
  // IDs refer to occurrences, not assets: repeated illustrations remain independently selectable.
  // Chapter artwork rendered as text is not an illustration and must retain its heading.
  const interpreted =
    settings?.mode === 'book'
      ? doc.blocks.map((b) => {
          if (b.kind !== 'image') {
            const kind =
              customHeadingKind(b, settings) || b.headingKind || automaticTextHeadings(doc).get(b.id);
            return kind && (b.kind !== 'heading' || b.headingKind !== kind)
              ? { ...b, kind: 'heading' as const, headingKind: kind, level: b.level || 2 }
              : b;
          }
          const heading = imageHeadingTreatment(doc, b, settings);
          if (heading)
            return b.imageHeading === heading.text && b.headingKind === heading.headingKind
              ? b
              : { ...b, imageHeading: heading.text, headingKind: heading.headingKind, level: 2 };
          return b.imageHeading ? { ...b, imageHeading: undefined, headingKind: undefined } : b;
        })
      : doc.blocks;
  const blocks = settings?.mode === 'book' ? canonicalHeadingBlocks(doc, interpreted) : interpreted;
  const excluded = new Set(
    settings?.mode === 'book'
      ? blocks
          .filter((b) => b.kind === 'image' && !b.imageHeading && settings.excludedImageIds.includes(b.id))
          .map((b) => b.id)
      : [],
  );
  const selected = blocks.filter(
    (b) =>
      (!settings?.selectedSections || settings.selectedSections.includes(b.sectionId)) &&
      !excluded.has(b.id) &&
      !(b.captionFor && excluded.has(b.captionFor)),
  );
  const imageIds = new Set(selected.filter((block) => block.kind === 'image').map((block) => block.id));
  const detached = new Set(
    (settings?.sectionOrder || [])
      .filter((id) => id.startsWith(IMAGE_ORDER_PREFIX))
      .map((id) => id.slice(IMAGE_ORDER_PREFIX.length))
      .filter((id) => imageIds.has(id)),
  );
  const detachedCaptions = new Set(
    selected.filter((block) => block.captionFor && detached.has(block.captionFor)).map((block) => block.id),
  );
  const bySection = new Map<string, Block[]>();
  for (const block of selected) {
    if (detached.has(block.id) || detachedCaptions.has(block.id)) continue;
    const group = bySection.get(block.sectionId) || [];
    group.push(block);
    bySection.set(block.sectionId, group);
  }
  const detachedBlocks = new Map(
    [...detached].map((id) => [id, selected.filter((block) => block.id === id || block.captionFor === id)]),
  );
  return orderedContent(doc, settings?.sectionOrder).flatMap((item) =>
    item.kind === 'section' ? bySection.get(item.id) || [] : detachedBlocks.get(item.id) || [],
  );
}
export const IMAGE_ORDER_PREFIX = 'image:';
export type ContentOrderItem =
  { kind: 'section'; id: string } | { kind: 'image'; id: string; sectionId: string };
export const imageOrderToken = (id: string) => `${IMAGE_ORDER_PREFIX}${id}`;
/** Sections stay grouped until an image is explicitly placed between them. */
export function orderedContent(
  doc: Pick<BookDocument, 'sections' | 'blocks'>,
  order: string[] = [],
): ContentOrderItem[] {
  const sectionIds = new Set(doc.sections.map((section) => section.id));
  const images = new Map(
    doc.blocks
      .filter((block) => block.kind === 'image')
      .map((block) => [
        imageOrderToken(block.id),
        { kind: 'image' as const, id: block.id, sectionId: block.sectionId },
      ]),
  );
  const known = new Set<string>();
  const items: ContentOrderItem[] = [];
  for (const token of [...order, ...doc.sections.map((section) => section.id)]) {
    if (known.has(token)) continue;
    if (sectionIds.has(token)) {
      known.add(token);
      items.push({ kind: 'section', id: token });
    } else if (images.has(token)) {
      known.add(token);
      items.push(images.get(token)!);
    }
  }
  return items;
}
/** Stable IDs allow saved drafts to survive imports with added or removed sections. */
export function orderedSections(doc: Pick<BookDocument, 'sections'>, order: string[] = []) {
  const byId = new Map(doc.sections.map((section) => [section.id, section]));
  const ids = [...new Set([...order, ...doc.sections.map((section) => section.id)])];
  return ids.flatMap((id) => (byId.has(id) ? [byId.get(id)!] : []));
}
export const documentText = (doc: BookDocument, settings?: RenderSettings) =>
  selectedDocumentBlocks(doc, settings)
    .map(settings?.mode === 'book' ? bookBlockText : blockText)
    .filter(Boolean)
    .join('\n\n');
export const wordCount = (text: string) => text.trim().split(/\s+/u).filter(Boolean).length;
export function effectiveSettings(input: unknown): RenderSettings {
  const s = settingsSchema.parse(input);
  // Reading order determines which horizontal boundaries interrupt the flow.
  // Keep the legacy field in saved settings, but prevent contradictory combinations.
  const normalized = { ...s, foldGapEveryRow: s.readingOrder === 'rows' };
  return normalized.mode === 'classic'
    ? {
        ...defaultSettings('classic'),
        fontFamily: normalized.fontFamily,
        fontSizePx: normalized.fontSizePx,
        borderStyle: normalized.borderStyle,
        foldGaps: normalized.foldGaps,
        foldGapMm: normalized.foldGapMm,
        foldGapEveryRow: normalized.foldGapEveryRow,
        readingOrder: normalized.readingOrder,
      }
    : normalized;
}

/** Group occurrences by their exact imported asset, never by visual guesses. */
export function matchingImageBlocks(doc: BookDocument, block: Block) {
  if (block.kind !== 'image' || !block.assetId) return [];
  return doc.blocks.filter((b) => b.kind === 'image' && b.assetId === block.assetId);
}
export function repeatedImageGroups(doc: BookDocument) {
  const groups = new Map<string, Block[]>();
  for (const block of doc.blocks) {
    if (block.kind !== 'image' || !block.assetId) continue;
    const group = groups.get(block.assetId) || [];
    group.push(block);
    groups.set(block.assetId, group);
  }
  return [...groups.values()].filter((blocks) => blocks.length >= 3);
}
