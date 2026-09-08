import { renderImageTestPrint } from '../../../../packages/core/src/image-test-print';
import { usePreferences } from '../store';
import { get, put, putOwned, entries, removeDocument, sweep, LIFETIME } from './db';
import { imageBlob } from './images';
import {
  settingsSchema,
  effectiveSettings,
  metadataSchema,
  type BookDocument,
  type RenderJob,
} from '@microbook/core';
const fingerprint = { renderer: 'hosted-browser-2' };
const active = new Map<string, AbortController>();
let queue = Promise.resolve();
const channel = new BroadcastChannel('microbook-render-jobs');
channel.addEventListener('message', (event) => {
  if (event.data.type === 'query') channel.postMessage({ type: 'active', ids: [...active.keys()] });
  if (event.data.type === 'cancel') active.get(event.data.id)?.abort();
  if (event.data.type === 'delete')
    void jobs(event.data.id).then((list) => list.forEach((job) => active.get(job.id)?.abort()));
});
const json = (data: unknown, status = 200) =>
  Response.json(data, { status, headers: { 'Cache-Control': 'no-store' } });
const noContent = () => new Response(null, { status: 204 });
async function documentById(id: string) {
  const doc = await get<BookDocument & { expiresAt: number }>('doc:' + id);
  if (!doc || doc.expiresAt <= Date.now()) {
    if (doc) await removeDocument(id);
    throw Error('This temporary book has expired or was deleted. Open it again to continue.');
  }
  return doc;
}
async function jobs(id: string) {
  return (await entries())
    .filter(([k, v]) => k.startsWith('job:') && v.documentId === id)
    .map(([, v]) => v as RenderJob);
}
async function save(job: RenderJob) {
  job.updatedAt = new Date().toISOString();
  await putOwned('job:' + job.id, job);
}
function importBook(file: File, id: string): Promise<{ doc: BookDocument; files: [string, Uint8Array][] }> {
  return new Promise(async (resolve, reject) => {
    const worker = new Worker('/hosted-import.js');
    const timer = setTimeout(() => {
      worker.terminate();
      reject(Error('Import took too long. Try a smaller book.'));
    }, 120000);
    const finish = () => {
      clearTimeout(timer);
      worker.terminate();
    };
    worker.onmessage = (e) => {
      finish();
      e.data.error ? reject(Error(e.data.error)) : resolve(e.data);
    };
    worker.onerror = (e) => {
      finish();
      reject(Error(e.message));
    };
    try {
      const input = await file.arrayBuffer();
      worker.postMessage({ input, name: file.name, id }, [input]);
    } catch (e) {
      finish();
      reject(e);
    }
  });
}
async function run(job: RenderJob) {
  const controller = active.get(job.id);
  if (!controller || controller.signal.aborted) {
    active.delete(job.id);
    return;
  }
  const frame = document.createElement('iframe');
  frame.setAttribute('aria-hidden', 'true');
  frame.style.cssText =
    'position:fixed;left:-10000px;top:0;width:816px;height:1056px;border:0;pointer-events:none';
  const cancel = () => frame.remove();
  controller.signal.addEventListener('abort', cancel);
  const aborted = new Promise<never>((_, reject) =>
    controller.signal.addEventListener('abort', () => reject(new DOMException('Cancelled', 'AbortError')), {
      once: true,
    }),
  );
  try {
    const doc = await documentById(job.documentId);
    job.status = 'running';
    job.startedAt = new Date().toISOString();
    job.phase = 'Laying out book';
    await save(job);
    await Promise.race([
      aborted,
      new Promise<void>((resolve, reject) => {
        frame.onload = () => resolve();
        frame.onerror = () => reject(Error('Could not load the layout engine'));
        frame.src = `/__renderer/${job.settings.mode === 'classic' ? 'classic' : 'book'}.html`;
        document.body.append(frame);
      }),
    ]);
    if (controller.signal.aborted) return;
    const renderer = (frame.contentWindow as any).HostedRenderer;
    if (!renderer) throw Error('The layout engine could not start. Reload the page.');
    const prepared = await Promise.race([
      aborted,
      renderer.render({ ...doc, metadata: job.metadata }, job.settings, (phase: string, progress: any) => {
        if (!controller.signal.aborted) {
          job.phase = phase;
          job.progress = progress;
          void save(job);
        }
      }),
    ]);
    if (controller.signal.aborted) return;
    job.phase = 'Creating PDF on Cloudflare';
    await save(job);
    const response = await fetch('/_cloud/print', {
      method: 'POST',
      body: prepared.html,
      headers: {
        'Content-Type': 'text/html',
        'X-Microbook-Bookmarks': String(job.settings.mode === 'book' && job.settings.rich.bookmarks),
      },
      signal: controller.signal,
    });
    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw Error(error.error || `Cloudflare could not create the PDF (${response.status})`);
    }
    const pdf = await response.blob();
    if (controller.signal.aborted) return;
    const latest = await documentById(job.documentId);
    await putOwned('binary:/api/renders/' + job.id + '/pdf', { documentId: doc.id, blob: pdf });
    job.result = prepared.result;
    job.status = 'completed';
    job.phase = 'Complete';
    await save(job);
    latest.lastRenderId = job.id;
    latest.lastRenderIds = { ...latest.lastRenderIds, [job.settings.mode]: job.id };
    latest.renderStats = {
      ...latest.renderStats,
      [job.settings.mode]: {
        settings: job.settings,
        metadata: job.metadata,
        pages: prepared.result.pages,
        sheets: prepared.result.sheets,
        cells: prepared.result.cells.length,
      },
    };
    await putOwned('doc:' + doc.id, { ...latest, documentId: doc.id });
    // Thumbnails are local and never use another cloud browser session.
    try {
      const pdfjs = await import('pdfjs-dist');
      pdfjs.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.mjs';
      const loading = pdfjs.getDocument({ data: new Uint8Array(await pdf.arrayBuffer()) });
      const pdfDoc = await loading.promise;
      const page = await pdfDoc.getPage(1),
        viewport = page.getViewport({ scale: 0.25 });
      const canvas = document.createElement('canvas');
      canvas.width = viewport.width;
      canvas.height = viewport.height;
      await page.render({ canvas, canvasContext: canvas.getContext('2d')!, viewport }).promise;
      const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/png'));
      if (blob && !controller.signal.aborted && (await get('doc:' + doc.id)))
        await putOwned('binary:/api/renders/' + job.id + '/thumbnail', { documentId: doc.id, blob });
      canvas.width = canvas.height = 1;
      await loading.destroy();
    } catch {}
  } catch (error) {
    if (!controller.signal.aborted) {
      job.status = 'failed';
      job.phase = 'Failed';
      job.error = error instanceof Error ? error.message : 'Could not render this book';
      await save(job);
    }
  } finally {
    frame.remove();
    active.delete(job.id);
  }
}
async function handle(request: Request): Promise<Response> {
  const url = new URL(request.url),
    parts = url.pathname.split('/').filter(Boolean),
    method = request.method;
  if (url.pathname === '/api/health')
    return json({ ok: true, version: '2.0.0-rc.1', rendererReady: true, fingerprint, hosted: true });
  if (url.pathname === '/api/metadata/lookup') return fetch('/_cloud/metadata' + url.search);
  if (parts[1] === 'image-test-print') {
    const list = await fetch('/hosted-print-samples/samples.json').then((r) => r.json());
    if (parts.length === 2)
      return new Response(renderImageTestPrint(list), { headers: { 'Content-Type': 'text/html' } });
    const sample = list[Number(parts[3])];
    if (parts[2] !== 'assets' || !sample) return json({ error: 'Sample not found' }, 404);
    const blob = await fetch('/hosted-print-samples/' + sample.file).then((r) => r.blob());
    const processed = await imageBlob(
      'sample:' + url.pathname + url.search,
      blob,
      '__samples__',
      url.searchParams,
    );
    return new Response(processed, { headers: { 'Content-Type': processed.type } });
  }
  if (url.pathname === '/api/documents') {
    await expirePreferences();
    if (method === 'GET') {
      const rows = await entries(),
        allJobs = rows.filter(([k]) => k.startsWith('job:')).map(([, v]) => v);
      return json(
        rows
          .filter(([k]) => k.startsWith('doc:'))
          .map(([, doc]) => ({
            ...doc,
            blocks: undefined,
            assets: undefined,
            renders: allJobs.filter((j) => j.documentId === doc.id),
          })),
      );
    }
    if (method === 'POST') {
      const file = (await request.formData()).get('file');
      if (!(file instanceof File) || !file.size || file.size > 50 * 1024 ** 2)
        return json({ error: 'Choose an EPUB, TXT, or Markdown file smaller than 50 MB' }, 422);
      const id = crypto.randomUUID(),
        result = await importBook(file, id);
      const doc = { ...result.doc, expiresAt: Date.now() + LIFETIME };
      try {
        for (const [name, bytes] of result.files)
          await put('file:' + id + '/' + name, { documentId: id, blob: new Blob([bytes as BlobPart]) });
        await put('doc:' + id, doc);
      } catch (error) {
        await removeDocument(id);
        throw error;
      }
      return json(doc, 201);
    }
  }
  if (parts[1] === 'documents' && parts[2]) {
    const doc = await documentById(parts[2]);
    if (parts.length === 3) {
      if (method === 'GET')
        return json({ ...doc, renders: await jobs(doc.id), rendererFingerprint: fingerprint });
      if (method === 'PATCH') {
        const body = await request.json();
        doc.metadata = metadataSchema.parse(body.metadata);
        await putOwned('doc:' + doc.id, { ...doc, documentId: doc.id });
        return json(doc);
      }
      if (method === 'DELETE') {
        channel.postMessage({ type: 'delete', id: doc.id });
        for (const job of await jobs(doc.id)) active.get(job.id)?.abort();
        await removeDocument(doc.id);
        return noContent();
      }
    }
    if (['source', 'assets', 'fonts'].includes(parts[3])) {
      const asset =
        parts[3] === 'assets'
          ? doc.assets.find((a) => a.id === parts[4])
          : parts[3] === 'fonts'
            ? doc.publisherFonts?.find((a) => a.id === parts[4])
            : { path: doc.sourcePath, mediaType: 'text/plain' };
      if (!asset) return json({ error: 'File not found' }, 404);
      const record = await get('file:' + doc.id + '/' + asset.path);
      if (!record) return json({ error: 'File not found' }, 404);
      let blob = new Blob([record.blob], { type: asset.mediaType });
      if (parts[3] === 'assets')
        blob = await imageBlob(
          'image:' + doc.id + '/' + parts[4] + url.search,
          blob,
          doc.id,
          url.searchParams,
        );
      return new Response(blob, {
        headers: {
          'Content-Type': blob.type,
          'Cache-Control': 'no-store',
          'Content-Security-Policy': "default-src 'none'; style-src 'unsafe-inline'; sandbox",
        },
      });
    }
    if (parts[3] === 'renders' && method === 'POST') {
      const body = await request.json(),
        settings = effectiveSettings(settingsSchema.parse(body.settings));
      if (
        settings.selectedSections &&
        (!settings.selectedSections.length ||
          settings.selectedSections.some((id) => !doc.sections.some((s) => s.id === id)))
      )
        return json({ error: 'Select at least one valid section' }, 422);
      const cacheKey = JSON.stringify({ settings, metadata: doc.metadata, fingerprint });
      const cached = (await jobs(doc.id)).find(
        (j) => j.cacheKey === cacheKey && ['completed', 'queued', 'running'].includes(j.status),
      );
      if (cached && !body.force) {
        if (cached.status === 'completed') {
          doc.lastRenderId = cached.id;
          doc.lastRenderIds = { ...doc.lastRenderIds, [settings.mode]: cached.id };
          await putOwned('doc:' + doc.id, { ...doc, documentId: doc.id });
        }
        return json({ ...cached, cached: cached.status === 'completed' });
      }
      const job: RenderJob = {
        version: 1,
        id: crypto.randomUUID(),
        documentId: doc.id,
        settings,
        metadata: structuredClone(doc.metadata),
        cacheKey,
        status: 'queued',
        phase: 'Queued',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        saved: false,
      };
      await save(job);
      active.set(job.id, new AbortController());
      queue = queue.then(() => run(job)).catch(() => {});
      return json(job, 202);
    }
  }
  if (parts[1] === 'renders' && parts[2]) {
    const job = await get<RenderJob>('job:' + parts[2]);
    if (!job) return json({ error: 'Render not found' }, 404);
    await documentById(job.documentId);
    if (parts.length === 3) {
      if (method === 'GET') return json(job);
      if (method === 'PATCH') {
        const body = await request.json();
        if (job.status !== 'completed') return json({ error: 'Wait for the PDF to finish' }, 409);
        if (body.saved !== undefined) job.saved = !!body.saved;
        if (body.label !== undefined) {
          if (typeof body.label !== 'string' || !body.label.trim() || body.label.length > 200)
            return json({ error: 'Enter a version name' }, 422);
          job.savedLabel = body.label.trim();
        }
        if (job.saved) job.savedAt ||= new Date().toISOString();
        await save(job);
        return json(job);
      }
    }
    if (parts[3] === 'cancel' && method === 'POST') {
      channel.postMessage({ type: 'cancel', id: job.id });
      active.get(job.id)?.abort();
      if (['running', 'queued'].includes(job.status)) {
        job.status = 'cancelled';
        job.phase = 'Cancelled';
        await save(job);
      }
      return json(job);
    }
    if (['lease', 'release'].includes(parts[3])) return noContent();
    if (parts[3] === 'map') return json(job.result?.cells || []);
    if (parts[3] === 'export') return json({ url: `/api/renders/${job.id}/download` });
    if (['pdf', 'download', 'thumbnail'].includes(parts[3])) {
      const record = await get(
        'binary:/api/renders/' + job.id + '/' + (parts[3] === 'download' ? 'pdf' : parts[3]),
      );
      if (!record) return json({ error: 'PDF is not ready' }, 404);
      const headers: Record<string, string> = {
        'Content-Type': record.blob.type,
        'Cache-Control': 'no-store',
      };
      if (parts[3] === 'download') headers['Content-Disposition'] = 'attachment; filename="microbook.pdf"';
      return new Response(record.blob, { headers });
    }
  }
  return json({ error: 'Endpoint is not available in this edition' }, 404);
}
export async function startHosted() {
  await expirePreferences();
  const live = new Set<string>();
  const hear = (event: MessageEvent) => {
    if (event.data.type === 'active') for (const id of event.data.ids) live.add(id);
  };
  channel.addEventListener('message', hear);
  channel.postMessage({ type: 'query' });
  await new Promise((resolve) => setTimeout(resolve, 300));
  channel.removeEventListener('message', hear);
  // A closed tab cannot finish an in-browser layout; never leave an orphaned spinner.
  for (const [key, job] of await entries())
    if (key.startsWith('job:') && !live.has(job.id) && ['queued', 'running'].includes(job.status)) {
      job.status = 'failed';
      job.phase = 'Interrupted';
      job.error = 'The tab closed before rendering finished. Apply again to retry.';
      await put(key, job);
    }
  navigator.serviceWorker.addEventListener('message', async (event) => {
    if (event.data?.type !== 'microbook-api' || !event.ports[0]) return;
    let response: Response;
    try {
      const { url, method, headers, body } = event.data;
      response = await handle(new Request(url, { method, headers, body }));
    } catch (error) {
      response = json(
        { error: error instanceof Error ? error.message : 'Could not finish this operation' },
        422,
      );
    }
    const body = response.status === 204 ? null : await response.arrayBuffer();
    event.ports[0].postMessage(
      { status: response.status, headers: [...response.headers], body },
      body ? [body] : [],
    );
  });
  await navigator.serviceWorker.register('/hosted-sw.js', { scope: '/' });
  await navigator.serviceWorker.ready;
  if (!navigator.serviceWorker.controller)
    await new Promise<void>((resolve) =>
      navigator.serviceWorker.addEventListener('controllerchange', () => resolve(), { once: true }),
    );
  setInterval(() => void expirePreferences(true), 60000);
}

async function expirePreferences(reload = false) {
  const expired = await sweep();
  if (!expired?.length) return;
  const state = usePreferences.getState();
  const current = state.lastDocumentId;
  usePreferences.setState({
    documents: Object.fromEntries(Object.entries(state.documents).filter(([id]) => !expired.includes(id))),
    lastDocumentId: current && expired.includes(current) ? undefined : current,
  });
  if (reload && current && expired.includes(current)) location.reload();
}
