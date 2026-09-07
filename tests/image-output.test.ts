import { afterEach, expect, test } from 'vitest';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import sharp from 'sharp';
import express from 'express';
import { ImageOutputCache } from '../apps/server/src/image-output.ts';
import { imageTestPrint } from '../apps/server/src/image-test-print.ts';
import { settingsSchema, imageOutputQuery } from '@microbook/core';
const roots: string[] = [];
afterEach(async () => {
  await Promise.all(roots.splice(0).map((root) => fs.rm(root, { recursive: true, force: true })));
});
async function fixture() {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'mb-image-'));
  roots.push(root);
  const source = path.join(root, 'source.png');
  await sharp(
    Buffer.from([
      255, 0, 0, 255, 0, 255, 0, 255, 0, 0, 255, 255, 0, 0, 0, 0, 180, 180, 180, 255, 30, 30, 30, 255,
    ]),
    { raw: { width: 6, height: 1, channels: 4 } },
  )
    .png()
    .toFile(source);
  return { root, source, cache: new ImageOutputCache(path.join(root, 'cache')) };
}
test('legacy settings preserve original color and overrides are validated', () => {
  expect(settingsSchema.parse({}).imageOutput.mode).toBe('original');
  expect(imageOutputQuery({ mode: 'original', strength: 'strong' })).toBe('');
  expect(settingsSchema.safeParse({ imageOutput: { mode: 'unknown' } }).success).toBe(false);
  const settings = settingsSchema.parse({
    imageOutput: { mode: 'laser' },
    imageOutputOverrides: { b1: { mode: 'original' } },
  });
  expect(settings.imageOutputOverrides.b1.mode).toBe('original');
});
test('original returns exact source; processing keeps dimensions, neutral shades and white transparency', async () => {
  const { source, cache } = await fixture();
  const original = await fs.readFile(source);
  expect(await cache.process(source, { mode: 'original', strength: 'gentle' })).toBe(source);
  const result = await cache.process(source, { mode: 'grayscale', strength: 'gentle' });
  const { data, info } = await sharp(result)
    .removeAlpha()
    .toColourspace('srgb')
    .raw()
    .toBuffer({ resolveWithObject: true });
  expect([info.width, info.height]).toEqual([6, 1]);
  for (let i = 0; i < data.length; i += 3) expect([data[i + 1], data[i + 2]]).toEqual([data[i], data[i]]);
  expect([...data.subarray(9, 12)]).toEqual([255, 255, 255]);
  expect(new Set([data[0], data[3], data[6]]).size).toBe(3);
  expect(await fs.readFile(source)).toEqual(original);
});
test('cache deduplicates concurrent requests, copies and restarts; changing strength changes pixels', async () => {
  const { root, source, cache } = await fixture();
  const gentle = { mode: 'laser', strength: 'gentle' } as const;
  const results = await Promise.all(Array.from({ length: 8 }, () => cache.process(source, gentle)));
  expect(new Set(results).size).toBe(1);
  const first = results[0];
  const time = (await fs.stat(first)).mtimeMs;
  const copy = path.join(root, 'copy.png');
  await fs.copyFile(source, copy);
  expect(await new ImageOutputCache(cache.directory).process(copy, gentle)).toBe(first);
  expect((await fs.stat(first)).mtimeMs).toBe(time);
  const strong = await cache.process(source, { mode: 'laser', strength: 'strong' });
  expect(await fs.readFile(strong)).not.toEqual(await fs.readFile(first));
  expect((await fs.readdir(cache.directory)).length).toBe(2);
});
test('SVG stays vector in original mode; processed SVG keeps aspect ratio and black strokes', async () => {
  const { root, cache } = await fixture();
  const source = path.join(root, 'diagram.svg');
  await fs.writeFile(
    source,
    '<svg xmlns="http://www.w3.org/2000/svg" width="27" height="14"><path d="M1 7H26" stroke="black"/></svg>',
  );
  expect(await cache.process(source, { mode: 'original', strength: 'gentle' })).toBe(source);
  const result = await cache.process(source, { mode: 'laser', strength: 'gentle' });
  const meta = await sharp(result).metadata();
  expect(meta.width! / meta.height!).toBe(27 / 14);
  expect((await sharp(result).stats()).channels[0].min).toBe(0);
});
test('permanent print samples remain independent of documents and use the shared processing cache', async () => {
  const { root, source, cache } = await fixture();
  const directory = path.join(root, 'print-samples');
  await fs.mkdir(directory);
  await fs.copyFile(source, path.join(directory, 'sample.png'));
  await fs.writeFile(
    path.join(directory, 'samples.json'),
    JSON.stringify([{ file: 'sample.png', mediaType: 'image/png', title: '<Diagram>', source: 'Test book' }]),
  );
  await fs.rm(source);
  const app = express();
  app.use('/api/image-test-print', imageTestPrint(directory, cache));
  const server = app.listen(0, '127.0.0.1');
  await new Promise<void>((resolve) => server.once('listening', resolve));
  const base = `http://127.0.0.1:${(server.address() as any).port}/api/image-test-print`;
  try {
    const html = await (await fetch(base)).text();
    expect(html).toContain('&lt;Diagram&gt;');
    expect(html.match(/<figure/g)?.length).toBe(5);
    const response = await fetch(`${base}/assets/0?output=laser&strength=gentle`);
    expect(response.headers.get('content-type')).toContain('image/png');
    expect(response.status).toBe(200);
    expect((await fetch(`${base}/assets/100`)).status).toBe(404);
  } finally {
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }
});

test('processed JPEGs preserve the orientation shown by the browser', async () => {
  const { root, cache } = await fixture();
  const source = path.join(root, 'rotated.jpg');
  await sharp({ create: { width: 20, height: 30, channels: 3, background: '#f00' } })
    .withMetadata({ orientation: 6 })
    .jpeg()
    .toFile(source);
  const result = await cache.process(source, { mode: 'grayscale', strength: 'gentle' });
  const metadata = await sharp(result).metadata();
  expect([metadata.width, metadata.height]).toEqual([30, 20]);
});
test('rotation swaps dimensions, preserves source bytes and reuses cached orientation', async () => {
  const { source, cache } = await fixture();
  const bytes = await fs.readFile(source);
  const rotated = await cache.rotate(source, 90);
  const metadata = await sharp(rotated).metadata();
  expect([metadata.width, metadata.height]).toEqual([1, 6]);
  const pixels = await sharp(rotated).raw().toBuffer();
  expect(pixels.some((value) => value > 0)).toBe(true);
  expect(await cache.rotate(source, 90)).toBe(rotated);
  expect(await cache.rotate(source, 0)).toBe(source);
  expect(await fs.readFile(source)).toEqual(bytes);
  expect(settingsSchema.parse({}).imageRotations).toEqual({});
  expect(settingsSchema.safeParse({ imageRotations: { b1: 45 } }).success).toBe(false);
});
