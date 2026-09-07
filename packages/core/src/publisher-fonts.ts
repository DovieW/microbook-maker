import { createHash } from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
// @ts-expect-error Fontkit's runtime supports all four web/print font formats.
import { create } from 'fontkit';
import type { PublisherFont } from './index.ts';
export async function readPublisherFonts(
  files: Map<string, Buffer>,
  directory: string,
  resolve: (from: string, href: string) => string,
  encryption: Map<string, { algorithm: string; identifier: string }>,
  warn: (code: string, message: string, source?: string) => void,
): Promise<PublisherFont[]> {
  const fonts: PublisherFont[] = [];
  for (const [file, content] of files) {
    if (!/\.(css|xhtml|html)$/i.test(file)) continue;
    for (const face of content.toString('utf8').matchAll(/@font-face\s*\{([^}]+)\}/gi)) {
      const family = face[1]
        .match(/font-family\s*:\s*([^;]+)/i)?.[1]
        ?.trim()
        .replace(/["']/g, '')
        .toLowerCase();
      const src = face[1].match(/url\(\s*["']?([^"')]+)["']?\s*\)/i)?.[1];
      if (!family || !src) continue;
      try {
        const resource = resolve(file, src);
        if (!/\.(ttf|otf|woff2?)$/i.test(resource)) throw Error('Unsupported font format');
        let bytes = files.get(resource);
        if (!bytes || bytes.length > 8 * 1024 * 1024) throw Error('Missing or oversized font');
        bytes = Buffer.from(bytes);
        const encrypted = encryption.get(resource);
        if (encrypted) {
          const id = encrypted.identifier.replace(/\s/g, '');
          const adobe = encrypted.algorithm.includes('adobe');
          const uuid = id.replace(/^urn:uuid:/i, '').replace(/-/g, '');
          if (adobe && !/^[a-f0-9]{32}$/i.test(uuid)) throw Error('Invalid Adobe font identifier');
          const key = adobe ? Buffer.from(uuid, 'hex') : createHash('sha1').update(id).digest();
          for (let i = 0; i < Math.min(bytes.length, adobe ? 1024 : 1040); i++)
            bytes[i] ^= key[i % key.length];
        }
        const font = create(bytes);
        const rights = font['OS/2']?.fsType;
        if (rights?.noEmbedding || rights?.bitmapOnly || rights?.noSubsetting)
          throw Error('Font embedding restrictions require the fallback font');
        const weight = face[1].match(/font-weight\s*:\s*(bold|normal|[1-9]00)/i)?.[1] || 'normal';
        const style = face[1].match(/font-style\s*:\s*(normal|italic|oblique)/i)?.[1] || 'normal';
        if (fonts.some((f) => f.family === family && f.weight === weight && f.style === style)) continue;
        if (fonts.length >= 32) throw Error('Font limit reached');
        const id = 'font-' + createHash('sha256').update(bytes).digest('hex').slice(0, 20);
        const ext = path.extname(resource).toLowerCase();
        await fs.mkdir(path.join(directory, 'fonts'), { recursive: true });
        await fs.writeFile(path.join(directory, 'fonts', id + ext), bytes);
        fonts.push({
          id,
          family,
          weight,
          style,
          path: 'fonts/' + id + ext,
          mediaType: 'font/' + ext.slice(1),
        });
      } catch (error) {
        warn('publisher-font', (error as Error).message, src);
      }
    }
  }
  return fonts;
}
