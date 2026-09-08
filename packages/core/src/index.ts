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
    lineHeight: z.number().min(1).max(1.6).default(1),
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
}
export interface Section {
  id: string;
  title: string;
  source: string;
}
export interface Diagnostic {
  code: string;
  message: string;
  source?: string;
}
export interface BookDocument {
  version: 1;
  importRevision?: number;
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
  index: number;
  page: number;
  x: number;
  y: number;
  width: number;
  height: number;
  sectionId?: string;
  blockIds: string[];
  text: string;
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
export function selectedDocumentBlocks(doc: BookDocument, settings?: RenderSettings): Block[] {
  // IDs refer to occurrences, not assets: repeated illustrations remain independently selectable.
  // Chapter artwork rendered as text is not an illustration and must retain its heading.
  const blocks =
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
  const excluded = new Set(
    settings?.mode === 'book'
      ? blocks
          .filter((b) => b.kind === 'image' && !b.imageHeading && settings.excludedImageIds.includes(b.id))
          .map((b) => b.id)
      : [],
  );
  const rank = new Map(
    orderedSections(doc, settings?.sectionOrder).map((section, index) => [section.id, index]),
  );
  return blocks
    .slice()
    .sort((a, b) => (rank.get(a.sectionId) ?? Infinity) - (rank.get(b.sectionId) ?? Infinity))
    .filter(
      (b) =>
        (!settings?.selectedSections || settings.selectedSections.includes(b.sectionId)) &&
        !excluded.has(b.id) &&
        !(b.captionFor && excluded.has(b.captionFor)),
    );
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
  return s.mode === 'classic'
    ? {
        ...defaultSettings('classic'),
        fontFamily: s.fontFamily,
        fontSizePx: s.fontSizePx,
        borderStyle: s.borderStyle,
        foldGaps: s.foldGaps,
      }
    : s;
}

/** Group occurrences by their exact imported asset, never by visual guesses. */
export function matchingImageBlocks(doc: BookDocument, block: Block) {
  if (block.kind !== 'image' || !block.assetId) return [];
  return doc.blocks.filter((b) => b.kind === 'image' && b.assetId === block.assetId);
}
export function repeatedImageGroups(doc: BookDocument) {
  const groups = new Map<string, Block[]>();
  for (const [i, block] of doc.blocks.entries()) {
    if (
      block.kind !== 'image' ||
      !block.assetId ||
      doc.blocks[i - 1]?.kind !== 'paragraph' ||
      doc.blocks[i + 1]?.kind !== 'paragraph'
    )
      continue;
    const group = groups.get(block.assetId) || [];
    group.push(block);
    groups.set(block.assetId, group);
  }
  return [...groups.values()].filter(
    (blocks) => blocks.length >= 3 && matchingImageBlocks(doc, blocks[0]).length === blocks.length,
  );
}
