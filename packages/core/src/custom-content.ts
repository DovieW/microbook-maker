import MarkdownIt from 'markdown-it';
import { z } from 'zod';
import type { Asset, Block, BookDocument, Inline } from './index.ts';

const markdown = new MarkdownIt({ html: false, linkify: false, breaks: false });

export const customTextSchema = z.object({
  title: z.string().trim().min(1, 'Enter a title').max(200),
  markdown: z.string().trim().min(1, 'Enter some text').max(100_000),
  headingStyle: z.enum(['none', 'compact', 'chapter', 'part']).default('none'),
});
export type CustomTextInput = z.input<typeof customTextSchema>;

export interface CustomImageInput {
  id: string;
  assetId: string;
  title: string;
  alt: string;
  path: string;
  mediaType: string;
}

const copy = (doc: BookDocument): BookDocument => structuredClone(doc);
const blockText = (block: Block) => block.inlines.map((inline) => inline.text).join('');
const wordCount = (text: string) => text.trim().split(/\s+/u).filter(Boolean).length;
const nextOrder = (doc: BookDocument) =>
  Math.max(-1, ...doc.blocks.map((block) => block.sourceOrder ?? -1)) + 1;
const refresh = (doc: BookDocument) => {
  doc.contentRevision = (doc.contentRevision || 0) + 1;
  doc.wordCount = wordCount(doc.blocks.map(blockText).join('\n'));
  return doc;
};

function inlineContent(token: any): Inline[] {
  const result: Inline[] = [];
  const marks: string[] = [];
  let href: string | undefined;
  for (const child of token?.children || []) {
    if (child.type === 'strong_open') marks.push('strong');
    else if (child.type === 'strong_close') marks.splice(marks.lastIndexOf('strong'), 1);
    else if (child.type === 'em_open') marks.push('em');
    else if (child.type === 'em_close') marks.splice(marks.lastIndexOf('em'), 1);
    else if (child.type === 's_open') marks.push('s');
    else if (child.type === 's_close') marks.splice(marks.lastIndexOf('s'), 1);
    else if (child.type === 'link_open') href = child.attrGet('href') || undefined;
    else if (child.type === 'link_close') href = undefined;
    else if (child.type === 'code_inline')
      result.push({ text: child.content, marks: [...marks, 'code'], href });
    else if (child.type === 'softbreak' || child.type === 'hardbreak')
      result.push({ text: '\n', marks: [...marks, 'break'], href });
    else if (['text', 'html_inline'].includes(child.type) && child.content)
      result.push({ text: child.content, ...(marks.length ? { marks: [...marks] } : {}), href });
  }
  return result;
}

function markdownBlocks(sectionId: string, source: string, value: string, start: number): Block[] {
  const tokens = markdown.parse(value, {});
  const blocks: Block[] = [];
  const lists: { ordered: boolean; next: number; depth: number }[] = [];
  let listItem: { marker: string; depth: number } | undefined;
  let quoteDepth = 0;
  const add = (block: Omit<Block, 'id' | 'sectionId' | 'source' | 'sourceOrder'>) =>
    blocks.push({
      ...block,
      id: `${sectionId}-b${blocks.length + 1}`,
      sectionId,
      source,
      sourceOrder: start + blocks.length,
      custom: true,
    });
  for (let i = 0; i < tokens.length; i++) {
    const token = tokens[i];
    if (token.type === 'blockquote_open') quoteDepth++;
    else if (token.type === 'blockquote_close') quoteDepth--;
    else if (token.type === 'bullet_list_open') lists.push({ ordered: false, next: 1, depth: lists.length });
    else if (token.type === 'ordered_list_open')
      lists.push({ ordered: true, next: Number(token.attrGet('start') || 1), depth: lists.length });
    else if (token.type === 'bullet_list_close' || token.type === 'ordered_list_close') lists.pop();
    else if (token.type === 'list_item_open') {
      const list = lists.at(-1)!;
      listItem = { marker: list.ordered ? `${list.next++}.` : '•', depth: list.depth };
    } else if (token.type === 'list_item_close') listItem = undefined;
    else if (token.type === 'heading_open') {
      const inline = tokens[i + 1];
      add({ kind: 'heading', level: Number(token.tag.slice(1)) || 2, inlines: inlineContent(inline) });
    } else if (token.type === 'paragraph_open') {
      const inline = tokens[i + 1];
      add({
        kind: listItem ? 'list-item' : quoteDepth ? 'quote' : 'paragraph',
        inlines: inlineContent(inline),
        ...(listItem ? { listMarker: listItem.marker, listDepth: listItem.depth } : {}),
      });
    } else if (token.type === 'fence' || token.type === 'code_block') {
      add({ kind: 'pre', inlines: [{ text: token.content }] });
    } else if (token.type === 'hr') add({ kind: 'separator', inlines: [] });
  }
  return blocks;
}

export function addCustomText(doc: BookDocument, id: string, input: CustomTextInput): BookDocument {
  const value = customTextSchema.parse(input);
  const updated = copy(doc);
  const sectionId = `custom-text-${id}`;
  const source = `custom:text:${id}`;
  updated.sections.push({ id: sectionId, title: value.title, source, custom: true });
  if (value.headingStyle !== 'none')
    updated.blocks.push({
      id: `${sectionId}-title`,
      sectionId,
      kind: 'heading',
      level: value.headingStyle === 'compact' ? 3 : value.headingStyle === 'part' ? 1 : 2,
      ...(value.headingStyle === 'chapter' || value.headingStyle === 'part'
        ? { headingKind: value.headingStyle }
        : {}),
      inlines: [{ text: value.title }],
      source,
      sourceOrder: nextOrder(updated),
      custom: true,
    });
  updated.blocks.push(...markdownBlocks(sectionId, source, value.markdown, nextOrder(updated)));
  return refresh(updated);
}

export function addCustomImage(doc: BookDocument, input: CustomImageInput): BookDocument {
  const updated = copy(doc);
  const title = input.title.trim() || 'Custom image';
  const sectionId = `custom-image-${input.id}`;
  const source = `custom:image:${input.id}`;
  const asset: Asset = {
    id: input.assetId,
    path: input.path,
    mediaType: input.mediaType,
    alt: input.alt.trim() || title,
    custom: true,
  };
  updated.assets.push(asset);
  updated.sections.push({ id: sectionId, title, source, custom: true });
  updated.blocks.push({
    id: `custom-image-block-${input.id}`,
    sectionId,
    kind: 'image',
    inlines: [],
    assetId: asset.id,
    source,
    sourceOrder: nextOrder(updated),
    custom: true,
  });
  return refresh(updated);
}

export function replaceImage(doc: BookDocument, blockId: string, asset: Asset): BookDocument {
  const updated = copy(doc);
  const block = updated.blocks.find((entry) => entry.id === blockId && entry.kind === 'image');
  if (!block?.assetId) throw new Error('Image not found');
  block.originalAssetId ||= block.assetId;
  block.assetId = asset.id;
  updated.assets.push({ ...asset, custom: true });
  return refresh(updated);
}

export function restoreImage(doc: BookDocument, blockId: string): BookDocument {
  const updated = copy(doc);
  const block = updated.blocks.find((entry) => entry.id === blockId && entry.kind === 'image');
  if (!block?.originalAssetId) throw new Error('This image has not been replaced');
  block.assetId = block.originalAssetId;
  delete block.originalAssetId;
  return refresh(updated);
}
