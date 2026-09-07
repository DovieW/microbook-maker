import fs from 'node:fs/promises';
import path from 'node:path';
import { Router } from 'express';
import { imageOutputSchema } from '@microbook/core';
import { renderImageTestPrint } from '../../../packages/core/src/image-test-print.ts';
import type { ImageOutputCache } from './image-output.ts';
export type PrintSample = { file: string; mediaType: string; title: string; source: string };
export function imageTestPrint(directory: string, cache: ImageOutputCache, fallbackDirectory?: string) {
  const router = Router();
  const sampleDirectory = async () => {
    try {
      await fs.access(path.join(directory, 'samples.json'));
      return directory;
    } catch (error: any) {
      if (error.code === 'ENOENT' && fallbackDirectory) return fallbackDirectory;
      throw error;
    }
  };
  const samples = async (): Promise<PrintSample[]> => {
    try {
      return JSON.parse(await fs.readFile(path.join(await sampleDirectory(), 'samples.json'), 'utf8'));
    } catch (error: any) {
      if (error.code === 'ENOENT') return [];
      throw error;
    }
  };
  router.get('/assets/:index', async (req, res) => {
    const list = await samples();
    const sample = /^\d+$/.test(req.params.index) ? list[Number(req.params.index)] : undefined;
    if (!sample || path.basename(sample.file) !== sample.file) return res.sendStatus(404);
    const output = imageOutputSchema.parse({ mode: req.query.output, strength: req.query.strength });
    const file = await cache.process(path.join(await sampleDirectory(), sample.file), output);
    res.setHeader('Content-Security-Policy', "default-src 'none'; sandbox");
    res
      .type(output.mode === 'original' ? sample.mediaType : 'image/png')
      .sendFile(file, { dotfiles: 'allow' });
  });
  router.get('/', async (_req, res) => {
    const list = await samples();
    res.type('html').send(renderImageTestPrint(list));
  });
  return router;
}
