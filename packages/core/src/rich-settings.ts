import { z } from 'zod';
export const richFeaturesSchema = z.object({
  contents: z.enum(['publisher', 'compact', 'none']).default('publisher'),
  contentsDepth: z.enum(['chapters', 'all']).default('chapters'),
  bookmarks: z.boolean().default(false),
  bookmarkDepth: z.enum(['chapters', 'all']).default('chapters'),
  chapterHeaders: z.boolean().default(false),
  pageReferences: z.enum(['off', 'headers', 'boundaries']).default('off'),
  urls: z.enum(['hidden', 'inline', 'chapter', 'book']).default('hidden'),
  internalReferences: z.boolean().default(false),
  clickableLinks: z.boolean().default(false),
  notes: z.enum(['legacy', 'chapter', 'paragraph', 'book', 'source']).default('legacy'),
  passages: z.boolean().default(false),
  passageTypes: z
    .array(z.enum(['quote', 'epigraph', 'letter', 'poetry', 'aside']))
    .default(['quote', 'epigraph', 'letter', 'poetry', 'aside']),
  passageGapEm: z.number().min(0).max(2).default(0.25),
  passageIndentEm: z.number().min(0).max(3).default(0.5),
  headingFonts: z.enum(['microbook', 'publisher']).default('microbook'),
  vectors: z.enum(['preserve', 'raster']).default('preserve'),
  dropCaps: z.boolean().default(false),
  dropCapLines: z.union([z.literal(2), z.literal(3)]).default(2),
});
export type RichFeatures = z.infer<typeof richFeaturesSchema>;
export const newRichFeatures = (): RichFeatures =>
  richFeaturesSchema.parse({
    contents: 'compact',
    bookmarks: true,
    urls: 'inline',
    internalReferences: true,
    clickableLinks: true,
    notes: 'chapter',
    passages: true,
  });
