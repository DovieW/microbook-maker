import fs from 'node:fs/promises';
import path from 'node:path';
import { createHash, randomUUID } from 'node:crypto';
import sharp from 'sharp';
import { IMAGE_OUTPUT_VERSION, type ImageOutput } from '@microbook/core';

// Disk cache survives server restarts. Only image bytes and pixel settings enter the key;
// pagination, metadata, zoom and document IDs deliberately do not.
export class ImageOutputCache {
  private pending = new Map<string, Promise<string>>();
  private running = 0;
  private waiting: Array<() => void> = [];
  constructor(readonly directory: string) {}
  async process(source: string, output: ImageOutput): Promise<string> {
    if (output.mode === 'original') return source;
    const bytes = await fs.readFile(source);
    const key = createHash('sha256')
      .update(bytes)
      .update(
        JSON.stringify([
          IMAGE_OUTPUT_VERSION,
          sharp.versions,
          output.mode,
          output.mode === 'laser' ? output.strength : '',
        ]),
      )
      .digest('hex');
    const target = path.join(this.directory, `${key}.png`);
    try {
      await fs.access(target);
      return target;
    } catch {}
    const existing = this.pending.get(key);
    if (existing) return existing;
    const task = this.generate(bytes, target, output);
    this.pending.set(key, task);
    try {
      return await task;
    } finally {
      this.pending.delete(key);
    }
  }
  private async generate(bytes: Buffer, target: string, output: ImageOutput) {
    if (this.running >= 2) await new Promise<void>((resolve) => this.waiting.push(resolve));
    else this.running++;
    const temporary = `${target}.${randomUUID()}.tmp`;
    try {
      await fs.mkdir(this.directory, { recursive: true });
      const metadata = await sharp(bytes, { limitInputPixels: 40_000_000 }).metadata();
      // Rasterize SVG at print resolution while bounding memory. Raster inputs keep all pixels.
      const density =
        metadata.format === 'svg'
          ? 72 *
            Math.max(
              1,
              Math.min(
                8,
                Math.floor(Math.sqrt(36_000_000 / ((metadata.width || 1) * (metadata.height || 1)))),
              ),
            )
          : 72;
      let image = sharp(bytes, { limitInputPixels: 40_000_000, density })
        .autoOrient()
        .flatten({ background: '#ffffff' })
        .greyscale();
      if (output.mode === 'laser') {
        // Gentle, fixed contrast avoids image-dependent clipping of fine diagram strokes.
        // Keep continuous tones; the printer driver handles halftoning.
        const contrast = { gentle: 1.04, standard: 1.1, strong: 1.18 }[output.strength];
        image = image.linear(contrast, 128 * (1 - contrast));
      }
      await image.png().toFile(temporary);
      await fs.rename(temporary, target);
      return target;
    } finally {
      await fs.rm(temporary, { force: true }).catch(() => {});
      const next = this.waiting.shift();
      if (next) next();
      else this.running--;
    }
  }
}
