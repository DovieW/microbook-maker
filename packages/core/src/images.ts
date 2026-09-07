import { DOMParser } from '@xmldom/xmldom';
// Inspect headers before Chromium decodes pixels. Every loop advances within the bounded entry.
export function imageDimensions(data: Buffer, mediaType: string): { width: number; height: number } {
  let width = 0,
    height = 0;
  if (
    mediaType === 'image/png' &&
    data.length >= 24 &&
    data.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))
  ) {
    width = data.readUInt32BE(16);
    height = data.readUInt32BE(20);
  } else if (
    mediaType === 'image/gif' &&
    data.length >= 10 &&
    /^GIF8[79]a/.test(data.toString('ascii', 0, 6))
  ) {
    width = data.readUInt16LE(6);
    height = data.readUInt16LE(8);
  } else if (mediaType === 'image/jpeg' && data[0] === 255 && data[1] === 216) {
    for (let offset = 2; offset + 4 <= data.length;) {
      if (data[offset] !== 255) break;
      const marker = data[offset + 1];
      if (marker === 255) {
        offset++;
        continue;
      }
      if (marker === 217 || marker === 218) break;
      if (marker === 1 || (marker >= 208 && marker <= 215)) {
        offset += 2;
        continue;
      }
      const length = data.readUInt16BE(offset + 2);
      if (length < 2 || offset + 2 + length > data.length) break;
      if ([192, 193, 194, 195, 197, 198, 199, 201, 202, 203, 205, 206, 207].includes(marker) && length >= 7) {
        height = data.readUInt16BE(offset + 5);
        width = data.readUInt16BE(offset + 7);
        break;
      }
      offset += length + 2;
    }
  } else if (
    mediaType === 'image/webp' &&
    data.length >= 30 &&
    data.toString('ascii', 0, 4) === 'RIFF' &&
    data.toString('ascii', 8, 12) === 'WEBP'
  ) {
    const kind = data.toString('ascii', 12, 16);
    if (kind === 'VP8X') {
      width = 1 + data.readUIntLE(24, 3);
      height = 1 + data.readUIntLE(27, 3);
    }
    if (kind === 'VP8 ') {
      width = data.readUInt16LE(26) & 0x3fff;
      height = data.readUInt16LE(28) & 0x3fff;
    }
    if (kind === 'VP8L' && data[20] === 47) {
      const bits = data.readUInt32LE(21);
      width = (bits & 0x3fff) + 1;
      height = ((bits >>> 14) & 0x3fff) + 1;
    }
  } else if (mediaType === 'image/svg+xml') {
    const source = data.toString('utf8');
    if (/<!ENTITY|<script|<foreignObject|(?:href|src)\s*=\s*["'](?:[a-z]+:|\/\/)|url\s*\(/i.test(source))
      throw new Error('Unsafe SVG image');
    const svg = new DOMParser().parseFromString(source, 'image/svg+xml').documentElement;
    if (svg?.localName !== 'svg') throw new Error('Invalid SVG image');
    const box = (svg.getAttribute('viewBox') || '')
      .trim()
      .split(/[\s,]+/)
      .map(Number);
    const dimension = (value: string | null, fallback: number) =>
      value && /^\d+(?:\.\d+)?(?:px)?$/.test(value) ? parseFloat(value) : fallback;
    width = dimension(svg.getAttribute('width'), box[2]);
    height = dimension(svg.getAttribute('height'), box[3]);
  }
  if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0)
    throw new Error('Invalid or unsupported image header');
  if (width * height > 40_000_000 || Math.max(width, height) > 32768)
    throw new Error('Image exceeds dimension limits');
  return { width, height };
}
