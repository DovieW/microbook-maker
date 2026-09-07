import { version } from '../../../package.json';
import express from 'express';
import { imageTestPrint } from './image-test-print.ts';
import { ImageOutputCache } from './image-output.ts';
import multer from 'multer';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash, randomUUID } from 'node:crypto';
import { fork, type ChildProcess } from 'node:child_process';
import { importDocument, IMPORT_LIMITS } from '@microbook/core/import';
import {
  settingsSchema,
  imageOutputSchema,
  effectiveSettings,
  metadataSchema,
  activeJob,
  modeLabels,
  type RenderJob,
  type LibraryDocument,
} from '@microbook/core';
import { Storage } from './storage.ts';

const root = path.resolve(process.env.MICROBOOK_ROOT || process.cwd());
const store = new Storage(path.resolve(process.env.MICROBOOK_DATA_DIR || path.join(root, 'data')));
await store.init();
const imageCache = new ImageOutputCache(path.join(store.generated, 'image-cache'));
const app = express();
app.disable('x-powered-by');
app.use(express.json({ limit: '100kb' }));
app.use(
  '/api/image-test-print',
  imageTestPrint(
    path.join(store.uploads, 'print-samples'),
    imageCache,
    path.join(root, 'resources/print-samples'),
  ),
);
app.use((_req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Referrer-Policy', 'no-referrer');
  next();
});
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: IMPORT_LIMITS.upload, files: 1, fields: 2 },
});
let worker: ChildProcess | undefined;
let busy = false;
let current: string | undefined;
let rendererFingerprint: Record<string, string> | undefined;
let workerError: string | undefined;
let stopping = false;
let baseUrl = '';
let cancelTimer: ReturnType<typeof setTimeout> | undefined;
const errorMessage = (error: unknown) => (error instanceof Error ? error.message : String(error));
const date = () => new Date().toISOString();
const getDocument = (id: string) => {
  const doc = store.documents.get(id);
  if (!doc) throw Object.assign(new Error('Book not found'), { status: 404 });
  return doc;
};
const getJob = (id: string) => {
  const job = store.jobs.get(id);
  if (!job) throw Object.assign(new Error('Render not found'), { status: 404 });
  return job;
};
async function pump() {
  if (busy || !worker?.connected || !rendererFingerprint || stopping) return;
  const job = [...store.jobs.values()].find((j) => j.status === 'queued');
  if (!job) return;
  busy = true;
  current = job.id;
  job.status = 'running';
  job.phase = 'Starting';
  job.startedAt = date();
  job.updatedAt = date();
  await store.saveJob(job);
  worker.send({
    type: 'render',
    job,
    document: getDocument(job.documentId),
    documentDir: store.documentDir(job.documentId),
    outputDir: store.renderDir(job.id),
    baseUrl,
  });
}
function startWorker() {
  const here = path.dirname(fileURLToPath(import.meta.url));
  const built = import.meta.url.endsWith('.js');
  worker = fork(path.join(here, built ? 'worker.js' : 'worker.ts'), [], {
    execArgv: built ? [] : ['--import', 'tsx'],
    env: { ...process.env, MICROBOOK_ROOT: root },
    stdio: ['ignore', 'inherit', 'inherit', 'ipc'],
  });
  let handling = Promise.resolve();
  worker.on('message', (message: any) => {
    handling = handling.then(async () => {
      try {
        if (message.type === 'ready') {
          rendererFingerprint = message.fingerprint;
          workerError = undefined;
          void pump();
        }
        if (message.type === 'fatal') {
          workerError = message.error;
          console.error('Renderer:', message.error);
        }
        if (message.type === 'idle') {
          clearTimeout(cancelTimer);
          busy = false;
          current = undefined;
          void pump();
        }
        const job = store.jobs.get(message.id);
        if (!job || job.status !== 'running') return;
        if (message.type === 'progress') {
          job.phase = message.phase;
          job.progress = message.progress;
          job.updatedAt = date();
          await store.saveJob(job);
        }
        if (message.type === 'complete') {
          job.status = 'completed';
          job.phase = 'Complete';
          job.progress = undefined;
          job.result = message.result;
          job.updatedAt = date();
          await store.saveJob(job);
          const doc = getDocument(job.documentId);
          doc.lastRenderId = job.id;
          doc.lastRenderIds = { ...doc.lastRenderIds, [job.settings.mode]: job.id };
          doc.renderStats = {
            ...doc.renderStats,
            [job.settings.mode]: {
              settings: job.settings,
              metadata: job.metadata,
              pages: job.result!.pages,
              sheets: job.result!.sheets,
              cells: job.result!.cells.length,
            },
          };
          await store.saveDocument(doc);
          await store.prune(doc.id);
        }
        if (message.type === 'failed') {
          job.status = 'failed';
          job.phase = 'Failed';
          job.error = message.error;
          job.updatedAt = date();
          await store.saveJob(job);
        }
      } catch (error) {
        console.error('Worker message:', error);
      }
    });
  });
  worker.on('exit', async () => {
    clearTimeout(cancelTimer);
    rendererFingerprint = undefined;
    busy = false;
    if (current) {
      const job = store.jobs.get(current);
      if (job?.status === 'running') {
        job.status = 'interrupted';
        job.phase = 'Interrupted';
        job.error = 'The render worker stopped. Retry to continue.';
        job.updatedAt = date();
        await store.saveJob(job);
      }
    }
    current = undefined;
    if (!stopping) setTimeout(startWorker, 2000);
  });
}
app.get('/api/health', (_req, res) =>
  res.json({
    ok: true,
    version,
    rendererReady: !!rendererFingerprint,
    fingerprint: rendererFingerprint,
    error: workerError,
  }),
);
// This is the only outbound metadata request, initiated explicitly from Advanced.
app.get('/api/metadata/lookup', async (req, res) => {
  const title = String(req.query.title || '').trim();
  if (!title || title.length > 500)
    return res.status(400).json({ error: 'Enter a title of up to 500 characters' });
  const url = new URL('https://openlibrary.org/search.json');
  url.search = new URLSearchParams({
    title,
    fields: 'title,author_name,first_publish_year',
    limit: '5',
  }).toString();
  try {
    const response = await fetch(url, {
      signal: AbortSignal.timeout(8000),
      headers: {
        'User-Agent': 'MicroBookMaker/1.0 (self-hosted metadata lookup)',
      },
    });
    if (!response.ok) throw new Error(`Metadata service returned ${response.status}`);
    const data = (await response.json()) as {
      docs?: {
        title?: string;
        author_name?: string[];
        first_publish_year?: number;
      }[];
    };
    res.json(
      (data.docs || []).map((item) => ({
        title: String(item.title || '').slice(0, 500),
        author: (item.author_name || []).join(', ').slice(0, 500),
        year: item.first_publish_year ? String(item.first_publish_year) : '',
      })),
    );
  } catch {
    res.status(502).json({
      error: 'Metadata lookup is unavailable. Your details are unchanged.',
    });
  }
});
app.post('/api/documents', upload.single('file'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'Choose a file' });
  const id = randomUUID();
  const started = performance.now();
  try {
    const doc = await importDocument(req.file.buffer, req.file.originalname, id, store.documentDir(id));
    doc.importMs = performance.now() - started;
    await store.saveDocument(doc);
    res.status(201).json(doc);
  } catch (error) {
    await fs.rm(store.documentDir(id), { recursive: true, force: true });
    throw Object.assign(new Error(errorMessage(error)), { status: 422 });
  }
});
app.get('/api/documents', (_req, res) =>
  res.json(
    [...store.documents.values()]
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .map((doc): LibraryDocument => ({
        id: doc.id,
        metadata: doc.metadata,
        format: doc.format,
        lastRenderId: doc.lastRenderId,
        lastRenderIds: doc.lastRenderIds,
        originalName: doc.originalName,
        createdAt: doc.createdAt,
        renders: [...store.jobs.values()]
          .filter((j) => j.documentId === doc.id)
          .map((j) => ({
            id: j.id,
            status: j.status,
            settings: j.settings,
            saved: j.saved,
            savedLabel: j.savedLabel,
            savedAt: j.savedAt,
            createdAt: j.createdAt,
            result: j.result ? { sheets: j.result.sheets, pages: j.result.pages } : undefined,
          })),
      })),
  ),
);
app.get('/api/documents/:id', (req, res) =>
  res.json({
    ...getDocument(req.params.id),
    rendererFingerprint,
    renders: [...store.jobs.values()].filter((j) => j.documentId === req.params.id),
  }),
);
app.patch('/api/documents/:id', async (req, res) => {
  const doc = getDocument(req.params.id);
  const metadata = metadataSchema.parse(req.body.metadata);
  const updated = { ...doc, metadata };
  await store.saveDocument(updated);
  res.json(updated);
});
app.delete('/api/documents/:id', async (req, res) => {
  getDocument(req.params.id);
  try {
    await store.remove(req.params.id);
  } catch (error) {
    throw Object.assign(new Error(errorMessage(error)), { status: 409 });
  }
  res.status(204).end();
});
app.get('/health', (_req, res) =>
  res.status(rendererFingerprint ? 200 : 503).json({ ok: !!rendererFingerprint }),
);
app.get('/uploads/:file', (req, res) => {
  if (path.basename(req.params.file) !== req.params.file || req.params.file.startsWith('.'))
    return res.sendStatus(404);
  res.download(path.join(store.uploads, req.params.file), req.params.file, { dotfiles: 'allow' });
});
app.get('/api/documents/:id/fonts/:font', (req, res) => {
  const doc = getDocument(req.params.id);
  const font = doc.publisherFonts?.find((f) => f.id === req.params.font);
  if (!font) return res.sendStatus(404);
  res.type(font.mediaType).sendFile(path.join(store.documentDir(doc.id), font.path), { dotfiles: 'allow' });
});
app.get('/api/documents/:id/assets/:asset', async (req, res) => {
  const doc = getDocument(req.params.id);
  const asset = doc.assets.find((a) => a.id === req.params.asset);
  if (!asset) return res.sendStatus(404);
  res.setHeader('Content-Security-Policy', "default-src 'none'; style-src 'unsafe-inline'; sandbox");
  const output = imageOutputSchema.parse({ mode: req.query.output, strength: req.query.strength });
  const rotation = Number(req.query.rotation || 0);
  if (![0, 90, 180, 270].includes(rotation)) return res.status(400).json({ error: 'Invalid image rotation' });
  const file = await imageCache.rotate(
    await imageCache.process(path.join(store.documentDir(doc.id), asset.path), output),
    rotation,
  );
  res.setHeader('Cache-Control', 'private, max-age=3600');
  res
    .type(rotation ? 'image/svg+xml' : output.mode === 'original' ? asset.mediaType : 'image/png')
    .sendFile(file, { dotfiles: 'allow' });
});
app.post('/api/documents/:id/renders', async (req, res) => {
  const doc = getDocument(req.params.id);
  if (doc.diagnostics.some((d) => d.code === 'legacy-source-unavailable'))
    return res
      .status(422)
      .json({
        error:
          'The original source is unavailable. You can still print this PDF; open the original book to create a new layout.',
      });
  const settings = effectiveSettings(settingsSchema.parse(req.body.settings));
  if (
    settings.selectedSections &&
    (!settings.selectedSections.length ||
      settings.selectedSections.some((s) => !doc.sections.some((section) => section.id === s)))
  )
    return res.status(422).json({ error: 'Select at least one valid section' });
  if (!rendererFingerprint)
    return res.status(503).json({
      error: workerError || 'Renderer is starting; try again shortly',
    });
  const metadata = structuredClone(doc.metadata);
  const cacheKey = createHash('sha256')
    .update(
      JSON.stringify({
        source: doc.sourceHash,
        metadata,
        settings,
        rendererFingerprint,
      }),
    )
    .digest('hex');
  const cached = [...store.jobs.values()].find(
    (j) =>
      j.documentId === doc.id &&
      j.cacheKey === cacheKey &&
      ['completed', 'queued', 'running'].includes(j.status),
  );
  if (cached && !req.body.force) {
    store.lease(cached.id);
    if (cached.status === 'completed') {
      doc.lastRenderId = cached.id;
      doc.lastRenderIds = { ...doc.lastRenderIds, [settings.mode]: cached.id };
      await store.saveDocument(doc);
    }
    return res.json({ ...cached, cached: cached.status === 'completed' });
  }
  const job: RenderJob = {
    version: 1,
    id: randomUUID(),
    documentId: doc.id,
    settings,
    metadata,
    cacheKey,
    status: 'queued',
    phase: 'Queued',
    createdAt: date(),
    updatedAt: date(),
    saved: false,
  };
  await store.saveJob(job);
  void pump();
  res.status(202).json(job);
});
app.get('/api/renders/:id', (req, res) => {
  const job = getJob(req.params.id);
  store.lease(job.id);
  res.json(job);
});
app.post('/api/renders/:id/cancel', async (req, res) => {
  const job = getJob(req.params.id);
  if (activeJob(job)) {
    job.status = 'cancelled';
    job.phase = 'Cancelled';
    job.updatedAt = date();
    await store.saveJob(job);
    if (current === job.id) {
      worker?.send({ type: 'cancel' });
      cancelTimer = setTimeout(() => worker?.kill('SIGKILL'), 5000);
    }
  }
  res.json(job);
});
app.post('/api/renders/:id/lease', (req, res) => {
  getJob(req.params.id);
  store.lease(req.params.id);
  res.status(204).end();
});
app.post('/api/renders/:id/release', async (req, res) => {
  const job = store.jobs.get(req.params.id);
  // Let the existing lease expire: another tab may still be using these bytes.
  if (job) await store.prune(job.documentId);
  res.status(204).end();
});
app.get('/api/renders/:id/map', (req, res) => res.json(getJob(req.params.id).result?.cells || []));
app.get('/api/renders/:id/thumbnail', (req, res) => {
  const job = getJob(req.params.id);
  res.sendFile(path.join(store.renderDir(job.id), 'thumbnail.png'), {
    dotfiles: 'allow',
  });
});
app.get('/api/renders/:id/pdf', (req, res) => {
  const job = getJob(req.params.id);
  if (job.status !== 'completed') return res.sendStatus(409);
  store.lease(job.id);
  res.type('application/pdf').sendFile(path.join(store.renderDir(job.id), 'output.pdf'), {
    dotfiles: 'allow',
  });
});
app.patch('/api/renders/:id', async (req, res) => {
  const job = getJob(req.params.id);
  if (job.status !== 'completed') return res.sendStatus(409);
  const { saved, label } = req.body;
  if (
    (saved !== undefined && typeof saved !== 'boolean') ||
    (label !== undefined && (typeof label !== 'string' || !label.trim() || label.length > 200))
  )
    return res.status(422).json({ error: 'Provide a valid kept-version name and retention choice' });
  if (saved !== undefined) job.saved = saved;
  if (job.saved) {
    job.savedAt ||= date();
    job.savedLabel =
      label?.trim() ||
      job.savedLabel ||
      `${modeLabels[job.settings.mode]} · ${job.settings.fontSizePx} px · ${job.createdAt.slice(0, 16).replace('T', ' ')}`;
  }
  await store.saveJob(job);
  store.lease(job.id);
  res.json(job);
});
app.post('/api/renders/:id/export', async (req, res) => {
  const job = getJob(req.params.id);
  if (job.status !== 'completed') return res.sendStatus(409);
  job.saved = true;
  await store.saveJob(job);
  res.json({ url: `/api/renders/${job.id}/download` });
});
app.get('/api/renders/:id/download', (req, res) => {
  const job = getJob(req.params.id);
  if (job.status !== 'completed') return res.sendStatus(409);
  store.lease(job.id);
  res.download(
    path.join(store.renderDir(job.id), 'output.pdf'),
    `${job.metadata.title.replace(/[^\p{L}\p{N} ._-]/gu, '') || 'microbook'}.pdf`,
    { dotfiles: 'allow' },
  );
});
app.get('/api/download', (req, res) => {
  const id = String(req.query.id || '');
  if (!/^[\w-]+$/.test(id)) return res.sendStatus(400);
  res.redirect(`/history/${id}.pdf`);
});
app.use(
  '/history',
  (_req, res, next) => {
    res.setHeader(
      'Content-Security-Policy',
      "sandbox; default-src 'none'; img-src 'self' data:; style-src 'unsafe-inline'",
    );
    next();
  },
  express.static(store.generated, {
    dotfiles: 'deny',
    index: false,
    fallthrough: false,
  }),
);
app.get('/__renderer/classic', (_req, res) =>
  res.sendFile(path.join(root, 'packages/renderer/classic/page.html')),
);
app.get('/__renderer/book', (_req, res) =>
  res.type('html').send('<!doctype html><html><head><meta charset="utf-8"></head><body></body></html>'),
);
app.get('/__renderer/book.js', (_req, res) => res.sendFile(path.join(root, 'dist/book.js')));
app.use('/__pretext/classic', express.static(path.join(root, 'node_modules/pretext-classic/dist')));
app.use('/api', (_req, res) => res.status(404).json({ error: 'Endpoint not found' }));
app.use(express.static(path.join(root, 'apps/web/dist')));
app.get('/{*path}', (_req, res) =>
  res.sendFile(path.join(root, 'apps/web/dist/index.html'), {
    dotfiles: 'allow',
  }),
);
app.use((error: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  if (res.headersSent) return;
  res
    .status(error.status || (error.name === 'ZodError' || error instanceof multer.MulterError ? 400 : 500))
    .json({
      error:
        error.name === 'ZodError'
          ? error.issues.map((issue: any) => issue.message).join('; ')
          : errorMessage(error),
    });
});
const server = app.listen(Number(process.env.PORT || 7777), process.env.HOST || '0.0.0.0', () => {
  const address = server.address();
  baseUrl = `http://127.0.0.1:${typeof address === 'object' && address ? address.port : 7777}`;
  console.log(`MicroBook Maker ${baseUrl}`);
  startWorker();
});
const pruning = setInterval(() => {
  for (const doc of store.documents.values()) void store.prune(doc.id);
}, 60_000).unref();
async function shutdown() {
  if (stopping) return;
  stopping = true;
  clearInterval(pruning);
  clearTimeout(cancelTimer);
  if (current) {
    const job = store.jobs.get(current);
    if (job?.status === 'running') {
      job.status = 'interrupted';
      job.phase = 'Interrupted';
      job.error = 'The server stopped during rendering. Retry to continue.';
      job.updatedAt = date();
      await store.saveJob(job);
    }
  }
  worker?.send({ type: 'shutdown' });
  server.close();
  setTimeout(() => {
    worker?.kill('SIGKILL');
    process.exit(0);
  }, 3000).unref();
}
process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);
