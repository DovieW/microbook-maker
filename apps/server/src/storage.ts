import fs from 'node:fs/promises';
import path from 'node:path';
import { createHash, randomUUID } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { importDocument, IMPORT_REVISION } from '@microbook/core/import';
import { defaultSettings, type BookDocument, type RenderJob } from '@microbook/core';

const writes = new Map<string, Promise<void>>();
export async function atomicJson(file: string, value: unknown) {
  const snapshot = JSON.stringify(value, null, 2);
  const pending = (writes.get(file) || Promise.resolve())
    .catch(() => {})
    .then(async () => {
      await fs.mkdir(path.dirname(file), { recursive: true });
      const temporary = `${file}.${randomUUID()}.tmp`;
      await fs.writeFile(temporary, snapshot);
      await fs.rename(temporary, file);
    });
  writes.set(file, pending);
  try {
    await pending;
  } finally {
    if (writes.get(file) === pending) writes.delete(file);
  }
}
export const safeId = (id: string) => /^[\w-]{1,100}$/.test(id);
export class Storage {
  documents = new Map<string, BookDocument>();
  jobs = new Map<string, RenderJob>();
  leases = new Map<string, number>();
  readonly uploads: string;
  readonly generated: string;
  constructor(readonly root: string) {
    this.uploads = path.resolve(process.env.UPLOADS_DIR || path.join(root, 'uploads'));
    this.generated = path.resolve(process.env.GENERATED_DIR || path.join(root, 'generated'));
  }
  documentDir(id: string) {
    if (!safeId(id)) throw new Error('Invalid document ID');
    return path.join(this.uploads, 'documents', id);
  }
  renderDir(id: string) {
    if (!safeId(id)) throw new Error('Invalid render ID');
    return path.join(this.generated, 'renders', id);
  }
  async saveDocument(doc: BookDocument) {
    this.documents.set(doc.id, doc);
    await atomicJson(path.join(this.documentDir(doc.id), 'document.json'), doc);
  }
  async saveJob(job: RenderJob) {
    this.jobs.set(job.id, job);
    await atomicJson(path.join(this.renderDir(job.id), 'job.json'), job);
  }
  async init() {
    await fs.mkdir(path.join(this.uploads, 'documents'), { recursive: true });
    await fs.mkdir(path.join(this.generated, 'renders'), { recursive: true });
    for (const id of await fs.readdir(path.join(this.uploads, 'documents'))) {
      if (!safeId(id)) continue;
      try {
        const doc = JSON.parse(await fs.readFile(path.join(this.documentDir(id), 'document.json'), 'utf8'));
        if (doc.version === 1 && doc.id === id) {
          this.documents.set(id, doc);
          if (doc.format === 'epub' && (doc.importRevision || 0) < IMPORT_REVISION)
            await this.refreshImport(doc);
        }
      } catch (error) {
        console.warn(`Cannot read document ${id}:`, (error as Error).message);
      }
    }
    for (const id of await fs.readdir(path.join(this.generated, 'renders'))) {
      if (!safeId(id)) continue;
      try {
        const job: RenderJob = JSON.parse(
          await fs.readFile(path.join(this.renderDir(id), 'job.json'), 'utf8'),
        );
        if (job.version !== 1 || job.id !== id) continue;
        if (job.status === 'running') {
          job.status = 'interrupted';
          job.phase = 'Interrupted';
          job.error = 'The server restarted during rendering. Retry to continue.';
          await this.saveJob(job);
        }
        if (job.status === 'completed') {
          await fs.access(path.join(this.renderDir(id), 'output.pdf'));
          await fs.access(path.join(this.renderDir(id), 'result.json'));
        }
        this.jobs.set(id, job);
      } catch (error) {
        console.warn(`Cannot read render ${id}:`, (error as Error).message);
      }
    }
    await this.readLegacy();
  }
  async refreshImport(previous: BookDocument) {
    // Publish the new model only after all its assets exist. Old exports, original bytes,
    // metadata edits and mode pointers survive; an interrupted refresh leaves the old model usable.
    const directory = this.documentDir(previous.id);
    const staging = await fs.mkdtemp(path.join(directory, '.import-'));
    try {
      const source = await fs.readFile(path.join(directory, previous.sourcePath));
      const imported = await importDocument(source, previous.originalName, previous.id, staging);
      if (imported.sourceHash !== previous.sourceHash) throw new Error('Original source checksum changed');
      const assetDirectory = `assets-v${IMPORT_REVISION}`;
      if (imported.assets.length) {
        await fs.cp(path.join(staging, 'assets'), path.join(directory, assetDirectory), { recursive: true });
        for (const asset of imported.assets) asset.path = `${assetDirectory}/${path.basename(asset.path)}`;
      }
      if (imported.publisherFonts?.length) {
        const fontsDirectory = `fonts-v${IMPORT_REVISION}`;
        await fs.cp(path.join(staging, 'fonts'), path.join(directory, fontsDirectory), { recursive: true });
        for (const font of imported.publisherFonts)
          font.path = fontsDirectory + '/' + path.basename(font.path);
      }
      await this.saveDocument({
        ...previous,
        ...imported,
        sourcePath: previous.sourcePath,
        createdAt: previous.createdAt,
        metadata: previous.metadata,
        lastRenderId: previous.lastRenderId,
        lastRenderIds: previous.lastRenderIds,
        legacyId: previous.legacyId,
        renderStats: previous.renderStats,
      });
    } finally {
      await fs.rm(staging, { recursive: true, force: true });
    }
  }
  // The old flat files stay in place, including the original /history URLs.
  async readLegacy() {
    const files = await fs.readdir(this.generated);
    const uploads = (await fs.readdir(this.uploads, { withFileTypes: true }))
      .filter((f) => f.isFile())
      .map((f) => f.name);
    const ids = new Set(
      files.flatMap((file) =>
        file.startsWith('METADATA_') && file.endsWith('.json')
          ? [file.slice(9, -5)]
          : file.endsWith('.pdf')
            ? [file.slice(0, -4)]
            : [],
      ),
    );
    for (const legacyId of ids) {
      const file = `METADATA_${legacyId}.json`;
      const id = safeId(`legacy-${legacyId}`)
        ? `legacy-${legacyId}`
        : `legacy-${createHash('sha256').update(legacyId).digest('hex').slice(0, 32)}`;
      if (this.documents.has(id)) continue;
      if (
        await fs.access(path.join(this.generated, `REMOVED_${legacyId}.json`)).then(
          () => true,
          () => false,
        )
      )
        continue;
      try {
        const metadata = files.includes(file)
          ? JSON.parse(await fs.readFile(path.join(this.generated, file), 'utf8'))
          : {};
        const candidates = uploads.filter((name) => name.startsWith(legacyId.split('_')[0] + '_'));
        const named = metadata.uploadPath ? path.basename(metadata.uploadPath) : undefined;
        const uploadName =
          named && uploads.includes(named) ? named : candidates.length === 1 ? candidates[0] : undefined;
        const source = uploadName
          ? await fs.readFile(path.join(this.uploads, uploadName))
          : Buffer.from(
              'The original source file is unavailable. The historical PDF is preserved. Open the original book to create a new layout.',
            );
        const doc = await importDocument(
          source,
          uploadName ? metadata.originalFileName || uploadName : 'historical-pdf.txt',
          id,
          this.documentDir(id),
        );
        doc.metadata = {
          title:
            metadata.bookName ||
            legacyId
              .replace(/^\d+_/, '')
              .replace(/_\d+(?:\.\d+)?$/, '')
              .replaceAll('_', ' '),
          author: String(metadata.author || ''),
          year: String(metadata.year || ''),
          series: String(metadata.series || ''),
          language: 'en',
        };
        if (!uploadName)
          doc.diagnostics.push({
            code: 'legacy-source-unavailable',
            message:
              'Original source unavailable. This historical PDF can be viewed, printed, and downloaded. Open the original book to change its layout.',
          });
        doc.originalName = metadata.originalFileName || uploadName || `${legacyId}.pdf`;
        doc.createdAt =
          metadata.createdAt ||
          (
            await fs.stat(path.join(this.generated, files.includes(file) ? file : `${legacyId}.pdf`))
          ).mtime.toISOString();
        doc.legacyId = legacyId;
        const pdf = path.join(this.generated, `${legacyId}.pdf`);
        try {
          await fs.access(pdf);
          const info = execFileSync('pdfinfo', [pdf], { encoding: 'utf8' });
          const pages = Number(info.match(/^Pages:\s+(\d+)/m)?.[1]);
          if (!pages) throw new Error('Cannot determine historical page count');
          const renderId = id;
          const destination = this.renderDir(renderId);
          await fs.mkdir(destination, { recursive: true });
          await fs.copyFile(pdf, path.join(destination, 'output.pdf'));
          const thumb = metadata.screenshots?.firstPage?.fileName || `screenshot_${legacyId}_page1.png`;
          await fs
            .copyFile(
              path.join(this.generated, path.basename(thumb)),
              path.join(destination, 'thumbnail.png'),
            )
            .catch(() => {});
          const occupied = metadata.layout?.populatedBlocks || pages * 16;
          const result = {
            pages,
            sheets: Math.ceil(pages / 2),
            wordCount: doc.wordCount,
            cells: Array.from({ length: occupied }, (_, index) => ({
              index,
              page: Math.floor(index / 16),
              x: (index % 4) * 153,
              y: Math.floor((index % 16) / 4) * 197.406,
              width: 153,
              height: 197.406,
              blockIds: [],
              text: '',
            })),
            fingerprint: { renderer: 'historical' },
            timings: {},
            peakMemoryMb: 0,
            coverage: {
              expectedCharacters: 0,
              renderedCharacters: 0,
              complete: false,
              overflows: 0,
            },
            diagnostics: [
              {
                code: 'historical-export',
                message:
                  'Original export preserved. Content coverage was not recorded by the earlier renderer.',
              },
            ],
          };
          const job: RenderJob = {
            version: 1,
            id: renderId,
            documentId: id,
            settings: {
              ...defaultSettings('classic'),
              fontFamily: metadata.fontFamily || 'arial',
              fontSizePx: Number(metadata.fontSize || 6),
              borderStyle: metadata.borderStyle || 'dashed',
              foldGaps: !!metadata.foldGaps,
            },
            metadata: doc.metadata,
            cacheKey: `historical-${legacyId}`,
            status: 'completed',
            phase: 'Complete',
            createdAt: doc.createdAt,
            updatedAt: doc.createdAt,
            saved: true,
            result,
          };
          await atomicJson(path.join(destination, 'result.json'), result);
          await this.saveJob(job);
          doc.lastRenderId = renderId;
        } catch (error) {
          doc.diagnostics.push({
            code: 'legacy-export',
            message: `Historical export unavailable: ${(error as Error).message}`,
          });
        }
        await this.saveDocument(doc);
      } catch (error) {
        console.warn(`Historical item ${legacyId} needs attention:`, (error as Error).message);
      }
    }
  }
  lease(id: string) {
    this.leases.set(id, Date.now() + 5 * 60_000);
  }
  async prune(documentId: string) {
    const document = this.documents.get(documentId);
    const keep = new Set([document?.lastRenderId]);
    for (const mode of ['classic', 'book'] as const) {
      const completed = [...this.jobs.values()]
        .filter(
          (job) => job.documentId === documentId && job.settings.mode === mode && job.status === 'completed',
        )
        .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
      // Older records have no per-mode pointers. Recover them from completed jobs.
      const latest = completed.find((job) => job.id === document?.lastRenderIds?.[mode]) || completed[0];
      if (latest) keep.add(latest.id);
    }
    for (const job of this.jobs.values()) {
      if (
        job.documentId !== documentId ||
        job.saved ||
        keep.has(job.id) ||
        ['queued', 'running'].includes(job.status) ||
        (this.leases.get(job.id) || 0) > Date.now()
      )
        continue;
      // A recently completed result can still be on its way to a client.
      if (Date.now() - Date.parse(job.updatedAt) < 60_000) continue;
      this.jobs.delete(job.id);
      this.leases.delete(job.id);
      await fs.rm(this.renderDir(job.id), { recursive: true, force: true });
    }
  }
  async remove(id: string) {
    const doc = this.documents.get(id);
    if (!doc) return;
    const jobs = [...this.jobs.values()].filter((j) => j.documentId === id);
    if (jobs.some((j) => ['queued', 'running'].includes(j.status)))
      throw new Error('Cancel the active render before removing this book');
    // A tombstone prevents legacy metadata from reappearing after restart.
    if (doc.legacyId)
      await atomicJson(path.join(this.generated, `REMOVED_${doc.legacyId}.json`), {
        removedAt: new Date().toISOString(),
      });
    if (doc.legacyId) {
      const metadataFile = path.join(this.generated, `METADATA_${doc.legacyId}.json`);
      const metadata = await fs
        .readFile(metadataFile, 'utf8')
        .then(JSON.parse)
        .catch(() => ({}));
      const uploadName = metadata.uploadPath && path.basename(metadata.uploadPath);
      let sharedUpload = false;
      if (uploadName)
        for (const other of this.documents.values()) {
          if (!other.legacyId || other.id === id) continue;
          const record = await fs
            .readFile(path.join(this.generated, `METADATA_${other.legacyId}.json`), 'utf8')
            .then(JSON.parse)
            .catch(() => ({}));
          if (record.uploadPath && path.basename(record.uploadPath) === uploadName) sharedUpload = true;
        }
      if (uploadName && !sharedUpload) await fs.rm(path.join(this.uploads, uploadName), { force: true });
      const files = [
        `${doc.legacyId}.pdf`,
        `METADATA_${doc.legacyId}.json`,
        `PROGRESS_${doc.legacyId}.json`,
        `IN_PROGRESS_${doc.legacyId}.txt`,
        `output_${doc.legacyId}.html`,
        `screenshot_${doc.legacyId}_page1.png`,
      ];
      if (metadata.screenshots?.firstPage?.fileName)
        files.push(path.basename(metadata.screenshots.firstPage.fileName));
      for (const file of files) await fs.rm(path.join(this.generated, file), { force: true });
    }
    this.documents.delete(id);
    for (const job of jobs) {
      this.jobs.delete(job.id);
      await fs.rm(this.renderDir(job.id), { recursive: true, force: true });
    }
    await fs.rm(this.documentDir(id), { recursive: true, force: true });
  }
}
