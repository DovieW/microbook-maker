import { get, put, putOwned } from './db';
const pending = new Map<string, Promise<Blob>>();
let running = 0;
const waiting: (() => void)[] = [];
export async function imageBlob(
  key: string,
  source: Blob,
  documentId: string,
  params: URLSearchParams,
): Promise<Blob> {
  const cached = await get(key);
  if (cached) return cached.blob;
  const mode = params.get('output') || 'original',
    rotation = Number(params.get('rotation') || 0);
  if (!['original', 'grayscale', 'laser'].includes(mode) || ![0, 90, 180, 270].includes(rotation))
    throw Error('Invalid image options');
  if (mode === 'original' && !rotation) return source;
  if (pending.has(key)) return pending.get(key)!;
  const task = (async () => {
    if (running >= 2) await new Promise<void>((r) => waiting.push(r));
    else running++;
    const url = URL.createObjectURL(source);
    try {
      const img = new Image();
      img.src = url;
      await img.decode();
      let w = img.naturalWidth,
        h = img.naturalHeight;
      if (!w || !h || w * h > 40_000_000) throw Error('Image exceeds pixel limits');
      if (source.type === 'image/svg+xml') {
        const scale = Math.max(1, Math.min(8, Math.floor(Math.sqrt(36_000_000 / (w * h)))));
        w *= scale;
        h *= scale;
      }
      const canvas = document.createElement('canvas');
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext('2d', { willReadFrequently: true })!;
      ctx.fillStyle = '#fff';
      ctx.fillRect(0, 0, w, h);
      ctx.drawImage(img, 0, 0, w, h);
      let output = source;
      if (mode !== 'original') {
        const pixels = ctx.getImageData(0, 0, w, h),
          data = pixels.data;
        const strength = params.get('strength') || 'gentle';
        const contrast =
          mode === 'laser' ? { gentle: 1.04, standard: 1.1, strong: 1.18 }[strength] || 1.04 : 1;
        // Match libvips luminance in linear RGB, then encode back into sRGB.
        const linear = Float64Array.from({ length: 256 }, (_, i) => {
          const s = i / 255;
          return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
        });
        for (let i = 0; i < data.length; i += 4) {
          const y = 0.2126 * linear[data[i]] + 0.7152 * linear[data[i + 1]] + 0.0722 * linear[data[i + 2]];
          const gray = 255 * (y <= 0.0031308 ? 12.92 * y : 1.055 * y ** (1 / 2.4) - 0.055);
          const value = Math.max(0, Math.min(255, Math.round(gray * contrast + 128 * (1 - contrast))));
          data[i] = data[i + 1] = data[i + 2] = value;
        }
        ctx.putImageData(pixels, 0, 0);
        output = await new Promise<Blob>((resolve, reject) =>
          canvas.toBlob((b) => (b ? resolve(b) : reject(Error('Could not process image'))), 'image/png'),
        );
      }
      if (rotation) {
        // Keep original SVG/vector data intact when only changing orientation.
        const iw = mode === 'original' ? img.naturalWidth : w,
          ih = mode === 'original' ? img.naturalHeight : h;
        const swapped = rotation === 90 || rotation === 270;
        const bytes = new Uint8Array(await output.arrayBuffer());
        let binary = '';
        for (let i = 0; i < bytes.length; i += 8192)
          binary += String.fromCharCode(...bytes.subarray(i, i + 8192));
        output = new Blob(
          [
            `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="${swapped ? ih : iw}" height="${swapped ? iw : ih}"><g transform="translate(${(swapped ? ih : iw) / 2} ${(swapped ? iw : ih) / 2}) rotate(${rotation})"><image x="${-iw / 2}" y="${-ih / 2}" width="${iw}" height="${ih}" xlink:href="data:${output.type};base64,${btoa(binary)}"/></g></svg>`,
          ],
          { type: 'image/svg+xml' },
        );
      }
      canvas.width = canvas.height = 1;
      await (documentId === '__samples__' ? put : putOwned)(key, { documentId, blob: output });
      return output;
    } finally {
      URL.revokeObjectURL(url);
      const next = waiting.shift();
      if (next) next();
      else running--;
      pending.delete(key);
    }
  })();
  pending.set(key, task);
  return task;
}
