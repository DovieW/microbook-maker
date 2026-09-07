import { afterEach, expect, it } from 'vitest';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { Storage, atomicJson } from '../apps/server/src/storage.ts';
import { defaultSettings, type RenderJob } from '@microbook/core';
import { importDocument, IMPORT_REVISION } from '@microbook/core/import';
// @ts-expect-error Fixture writer also runs directly on a fresh Node host.
import { zip, publisherEntries } from '../tools/fixtures.mjs';
const directories: string[] = [];
afterEach(async () => {
  for (const directory of directories.splice(0)) await fs.rm(directory, { recursive: true, force: true });
});
it('refreshes existing EPUB imports from original bytes while preserving edits and saved render pointers', async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'mb-refresh-'));
  directories.push(root);
  const store = new Storage(root);
  await store.init();
  const bytes = zip(publisherEntries);
  const doc = await importDocument(bytes, 'publisher.epub', 'publisher', store.documentDir('publisher'));
  delete doc.importRevision;
  doc.blocks.push({ ...doc.blocks.find((block) => block.imageHeading)!, id: 'old-duplicate' });
  doc.metadata.title = 'My edited title';
  doc.lastRenderId = 'saved-book';
  doc.lastRenderIds = { classic: 'saved-classic', book: 'saved-book' };
  await store.saveDocument(doc);
  const restored = new Storage(root);
  await restored.init();
  const result = restored.documents.get(doc.id)!;
  expect(result.importRevision).toBe(IMPORT_REVISION);
  expect(result.blocks.filter((block) => block.imageHeading)).toHaveLength(1);
  expect(result.metadata).toEqual(doc.metadata);
  expect(result.lastRenderIds).toEqual(doc.lastRenderIds);
  expect(result.lastRenderId).toBe(doc.lastRenderId);
  expect(result.createdAt).toBe(doc.createdAt);
  expect(await fs.readFile(path.join(restored.documentDir(doc.id), result.sourcePath))).toEqual(bytes);
  for (const asset of result.assets)
    await expect(fs.access(path.join(restored.documentDir(doc.id), asset.path))).resolves.toBeUndefined();
  const restarted = new Storage(root);
  await restarted.init();
  expect(restarted.documents.get(doc.id)).toEqual(result);
});
it('recovers queued work, interrupts running work, and ignores partially written artifacts', async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'mb-recovery-'));
  directories.push(root);
  const store = new Storage(root);
  await store.init();
  const job: RenderJob = {
    version: 1,
    id: 'queued',
    documentId: 'doc',
    settings: defaultSettings(),
    metadata: {
      title: 'Fixture',
      author: '',
      series: '',
      year: '',
      language: 'en',
    },
    cacheKey: 'key',
    status: 'queued',
    phase: 'Queued',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    saved: false,
  };
  await store.saveJob(job);
  await store.saveJob({ ...job, id: 'running', status: 'running' });
  await store.saveJob({ ...job, id: 'broken', status: 'completed' });
  const recovered = new Storage(root);
  await recovered.init();
  expect(recovered.jobs.get('queued')?.status).toBe('queued');
  expect(recovered.jobs.get('running')?.status).toBe('interrupted');
  expect(recovered.jobs.has('broken')).toBe(false);
});
it('writes whole JSON records and rejects identifiers that escape storage', async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'mb-atomic-'));
  directories.push(root);
  await atomicJson(path.join(root, 'record.json'), { value: 'first' });
  await atomicJson(path.join(root, 'record.json'), { value: 'second' });
  expect(JSON.parse(await fs.readFile(path.join(root, 'record.json'), 'utf8'))).toEqual({ value: 'second' });
  expect((await fs.readdir(root)).filter((file) => file.endsWith('.tmp'))).toHaveLength(0);
  const store = new Storage(root);
  expect(() => store.documentDir('../../etc')).toThrow();
  expect(() => store.renderDir('/root')).toThrow();
});
it('opens copied historical bytes and metadata, preserving saved exports across restarts', async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'mb-legacy-'));
  directories.push(root);
  const metadata = JSON.parse(await fs.readFile('tests/baseline/classic.txt.json', 'utf8'));
  const store = new Storage(root);
  await fs.mkdir(store.uploads, { recursive: true });
  await fs.mkdir(store.generated, { recursive: true });
  await fs.copyFile('tests/fixtures/classic.txt', path.join(store.uploads, metadata.uploadPath));
  await fs.copyFile('tests/baseline/classic.txt.pdf', path.join(store.generated, `${metadata.id}.pdf`));
  await fs.copyFile(
    'tests/baseline/classic.txt.png',
    path.join(store.generated, metadata.screenshots.firstPage.fileName),
  );
  await atomicJson(path.join(store.generated, `METADATA_${metadata.id}.json`), metadata);
  await store.init();
  const document = [...store.documents.values()][0];
  expect(document.metadata.title).toBe(metadata.bookName);
  expect(document.legacyId).toBe(metadata.id);
  expect(
    (await fs.readFile(path.join(store.documentDir(document.id), document.sourcePath))).equals(
      await fs.readFile('tests/fixtures/classic.txt'),
    ),
  ).toBe(true);
  const job = store.jobs.get(document.lastRenderId!)!;
  expect(job.saved).toBe(true);
  expect(job.result?.sheets).toBe(1);
  expect(
    (await fs.readFile(path.join(store.renderDir(job.id), 'output.pdf'))).equals(
      await fs.readFile('tests/baseline/classic.txt.pdf'),
    ),
  ).toBe(true);
  const restored = new Storage(root);
  await restored.init();
  expect(restored.jobs.get(job.id)?.saved).toBe(true);
  await restored.remove(document.id);
  const removed = new Storage(root);
  await removed.init();
  expect(removed.documents.size).toBe(0);
});
it('retains saved exports and active preview leases when pruning superseded artifacts', async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'mb-prune-'));
  directories.push(root);
  const store = new Storage(root);
  await store.init();
  const job: RenderJob = {
    version: 1,
    id: 'saved',
    documentId: 'doc',
    settings: defaultSettings(),
    metadata: {
      title: 'Fixture',
      author: '',
      series: '',
      year: '',
      language: 'en',
    },
    cacheKey: 'key',
    status: 'completed',
    phase: 'Complete',
    createdAt: '2020-01-01',
    updatedAt: '2020-01-01',
    saved: true,
  };
  await store.saveJob(job);
  await store.saveJob({ ...job, id: 'leased', saved: false });
  await store.saveJob({ ...job, id: 'superseded', saved: false });
  store.lease('leased');
  await store.prune('doc');
  expect([...store.jobs.keys()].sort()).toEqual(['leased', 'saved']);
  store.leases.delete('leased');
  await store.prune('doc');
  expect([...store.jobs.keys()]).toEqual(['saved']);
  await store.saveJob({
    ...job,
    id: 'classic-old',
    saved: false,
    settings: defaultSettings('classic'),
    updatedAt: '2021-01-01',
  });
  await store.saveJob({
    ...job,
    id: 'classic-latest',
    saved: false,
    settings: defaultSettings('classic'),
    updatedAt: '2022-01-01',
  });
  await store.saveJob({
    ...job,
    id: 'book-latest',
    saved: false,
    settings: defaultSettings('book'),
    updatedAt: '2023-01-01',
  });
  await store.prune('doc');
  expect([...store.jobs.keys()].sort()).toEqual(['book-latest', 'classic-latest', 'saved']);
  for (const retained of store.jobs.values()) {
    await fs.copyFile(
      'tests/baseline/classic.txt.pdf',
      path.join(store.renderDir(retained.id), 'output.pdf'),
    );
    await atomicJson(path.join(store.renderDir(retained.id), 'result.json'), {});
  }
  const restarted = new Storage(root);
  await restarted.init();
  await restarted.prune('doc');
  expect([...restarted.jobs.keys()].sort()).toEqual(['book-latest', 'classic-latest', 'saved']);
});
