import { z } from 'zod';
// Bump when the pixel algorithm changes. Shared by previews, renders and the disk cache.
export const IMAGE_OUTPUT_VERSION = 'laser-2';
export const imageOutputSchema = z.object({
  mode: z.enum(['original', 'grayscale', 'laser']).default('original'),
  strength: z.enum(['gentle', 'standard', 'strong']).default('gentle'),
});
export type ImageOutput = z.infer<typeof imageOutputSchema>;
export function imageOutputQuery(output: ImageOutput, rotation = 0): string {
  if (rotation) return (imageOutputQuery(output) || '?output=original') + '&rotation=' + rotation;
  if (output.mode === 'original') return '';
  return `?output=${output.mode}&strength=${output.mode === 'laser' ? output.strength : 'gentle'}&algorithm=${IMAGE_OUTPUT_VERSION}`;
}

// Shared UI and test-sheet copy keeps the comparison columns aligned with the controls.
export const imageOutputModes = [
  {
    value: 'original',
    label: 'Original color',
    description: 'Keeps the original colors. A black-and-white printer converts them when printing.',
  },
  { value: 'grayscale', label: 'Grayscale', description: 'Removes color without increasing contrast.' },
  {
    value: 'laser',
    label: 'Laser optimized',
    description: 'Grayscale with extra contrast to make light and dark areas more distinct.',
  },
] as const;
export const laserContrastLevels = [
  { value: 'gentle', label: 'Gentle', description: 'Small contrast increase. Recommended starting point.' },
  { value: 'standard', label: 'Standard', description: 'More contrast between light and dark areas.' },
  { value: 'strong', label: 'Strong', description: 'Most contrast. May lose pale lines or shadow detail.' },
] as const;
