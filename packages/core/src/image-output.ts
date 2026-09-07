import { z } from 'zod';
// Bump when the pixel algorithm changes. Shared by previews, renders and the disk cache.
export const IMAGE_OUTPUT_VERSION = 'laser-2';
export const imageOutputSchema = z.object({
  mode: z.enum(['original', 'grayscale', 'laser']).default('original'),
  strength: z.enum(['gentle', 'standard', 'strong']).default('gentle'),
});
export type ImageOutput = z.infer<typeof imageOutputSchema>;
export function imageOutputQuery(output: ImageOutput): string {
  if (output.mode === 'original') return '';
  return `?output=${output.mode}&strength=${output.mode === 'laser' ? output.strength : 'gentle'}&algorithm=${IMAGE_OUTPUT_VERSION}`;
}
