import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { spawn, spawnSync, execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { report, comparison } from './reports.mjs';
import { verifyClassicOutput } from './verify-classic-output.mjs';
import { verifyBookOpening } from './verify-book-opening.mjs';
import { verifyPrintLayout } from './verify-print-layout.mjs';
const [command = 'doctor', ...args] = process.argv.slice(2);
const option = (key, fallback) => {
  const i = args.indexOf(`--${key}`);
  return i < 0 ? fallback : args[i + 1];
};
const modeLabel = (mode) => ({ classic: 'Basic', book: 'Rich', basic: 'Basic', rich: 'Rich' })[mode] || mode;
const out = path.resolve(option('out', '/reports'));
await fs.mkdir(out, { recursive: true });
const run = (bin, argv, env = {}) => {
  const result = spawnSync(bin, argv, {
    stdio: 'inherit',
    env: { ...process.env, ...env },
  });
  if (result.status) throw Error(`${bin} failed (${result.status})`);
};
const storage = await fs.mkdtemp(path.join(os.tmpdir(), 'microbook-test-'));
let server,
  base,
  log = '',
  startupMs = 0;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function start() {
  const began = performance.now();
  log = '';
  server = spawn(process.execPath, ['dist/server.js'], {
    env: {
      ...process.env,
      PORT: '0',
      MICROBOOK_DATA_DIR: storage,
      UPLOADS_DIR: path.join(storage, 'uploads'),
      GENERATED_DIR: path.join(storage, 'generated'),
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  server.stdout.on('data', (chunk) => {
    log += chunk;
  });
  server.stderr.on('data', (chunk) => {
    log += chunk;
  });
  for (let i = 0; i < 300; i++) {
    const match = log.match(/MicroBook Maker (http:\/\/127\.0\.0\.1:\d+)/);
    if (match) {
      base = match[1];
      const health = await fetch(base + '/api/health')
        .then((r) => r.json())
        .catch(() => ({}));
      if (health.rendererReady) {
        startupMs = performance.now() - began;
        return;
      }
    }
    if (server.exitCode !== null) throw Error(`Server stopped: ${log}`);
    await sleep(100);
  }
  throw Error(`Server did not become ready: ${log}`);
}
async function stop() {
  if (!server || server.exitCode !== null) return;
  server.kill('SIGTERM');
  await new Promise((resolve) => {
    const timer = setTimeout(resolve, 5000);
    server.once('exit', () => {
      clearTimeout(timer);
      resolve();
    });
  });
  if (server.exitCode === null) server.kill('SIGKILL');
}
async function json(url, body, method = 'POST') {
  const response = await fetch(
    base + url,
    body === undefined
      ? undefined
      : {
          method,
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify(body),
        },
  );
  if (!response.ok) throw Error(await response.text());
  return response.json();
}
async function importFile(file, title) {
  const form = new FormData();
  form.set('file', new Blob([await fs.readFile(file)]), option('name', path.basename(file)));
  const response = await fetch(base + '/api/documents', {
    method: 'POST',
    body: form,
  });
  if (!response.ok) throw Error(await response.text());
  let doc = await response.json();
  if (title) doc = await json(`/api/documents/${doc.id}`, { metadata: { ...doc.metadata, title } }, 'PATCH');
  return doc;
}
async function render(doc, settings, directory, force = false) {
  const began = performance.now();
  let job = await json(`/api/documents/${doc.id}/renders`, { settings, force });
  const cached = job.cached;
  let previous = '';
  for (let i = 0; ['queued', 'running'].includes(job.status); i++) {
    if (i > 7200) throw Error(`Render timed out: ${job.id}`);
    if (job.phase !== previous) {
      console.log(`${doc.metadata.title} · ${modeLabel(settings.mode)}: ${job.phase}`);
      previous = job.phase;
    }
    await sleep(250);
    job = await json(`/api/renders/${job.id}`);
  }
  if (job.status !== 'completed') throw Error(job.error || `Render ${job.status}`);
  job.cached = !!cached;
  const elapsed = performance.now() - began;
  if (!directory) return { job, elapsed };
  const result = await report(base, job, doc, directory);
  console.log(
    `${modeLabel(settings.mode)}: ${result.pages} sides / ${result.sheets} sheets / ${result.cells.length} cells · ${Math.round(result.timings.total)} ms${cached ? ' (cached)' : ''}`,
  );
  return { job, elapsed, result };
}
async function publicBooks() {
  const corpus = JSON.parse(await fs.readFile('tests/public-books.json', 'utf8'));
  await fs.mkdir('.cache/public-books', { recursive: true });
  for (const book of corpus) {
    book.file = path.resolve(`.cache/public-books/${book.id}.epub`);
    let data = await fs.readFile(book.file).catch(() => null);
    if (!data) {
      const response = await fetch(book.url);
      if (!response.ok) throw Error(`Fixture download failed: ${book.url}`);
      data = Buffer.from(await response.arrayBuffer());
    }
    const hash = createHash('sha256').update(data).digest('hex');
    if (hash !== book.sha256)
      throw Error(
        `Fixture changed upstream: ${book.id}. Expected ${book.sha256}, received ${hash}. Review and pin an exact edition; never silently replace a test fixture.`,
      );
    await fs.writeFile(book.file, data);
  }
  return corpus;
}
async function untilJob(id, predicate) {
  for (let i = 0; i < 160; i++) {
    const job = await json(`/api/renders/${id}`);
    if (predicate(job)) return job;
    await sleep(100);
  }
  throw Error(`Job ${id} did not reach the expected state`);
}
async function reliability() {
  const doc = await importFile('tests/fixtures/classic-duplex.txt');
  let interrupted = await json(`/api/documents/${doc.id}/renders`, {
    settings: { mode: 'classic' },
    force: true,
  });
  await untilJob(interrupted.id, (job) => job.status === 'running');
  let queued = await json(`/api/documents/${doc.id}/renders`, { settings: { mode: 'book' }, force: true });
  const children = execFileSync('ps', ['--ppid', String(server.pid), '-o', 'pid='], { encoding: 'utf8' })
    .trim()
    .split(/\s+/)
    .map(Number);
  if (children.length !== 1 || !Number.isInteger(children[0]) || children[0] <= 1)
    throw Error('Cannot identify the isolated render worker');
  process.kill(children[0], 'SIGKILL');
  await untilJob(interrupted.id, (job) => job.status === 'interrupted');
  await untilJob(queued.id, (job) => job.status === 'completed');
  interrupted = await json(`/api/documents/${doc.id}/renders`, {
    settings: { mode: 'classic' },
    force: true,
  });
  await untilJob(interrupted.id, (job) => job.status === 'running');
  queued = await json(`/api/documents/${doc.id}/renders`, { settings: { mode: 'book' }, force: true });
  await stop();
  await start();
  if ((await json(`/api/renders/${interrupted.id}`)).status !== 'interrupted')
    throw Error('A running job was not marked interrupted after restart');
  await untilJob(queued.id, (job) => job.status === 'completed');
  console.log('Worker failure and queued-job restart recovery passed.');
}
async function boundaryCases() {
  const { zip, syntheticEntries, xhtml } = await import('./fixtures.mjs');
  const fixture = path.join(storage, 'boundaries.epub');
  const body =
    '<h1>Boundary checks</h1><ol start="3"><li><p>Ordered start.</p><p>Continued item.</p></li><li value="7">Ordered seven.</li><li>LONG-BEGIN.' +
    'abcdefghij'.repeat(1200) +
    '.LONG-END</li></ol><table>' +
    Array.from({ length: 90 }, (_, i) => `<tr><td>Row ${i}</td><td>Value ${i}</td></tr>`).join('') +
    '</table><p>BOUNDARY-END.</p>';
  await fs.writeFile(fixture, zip({ ...syntheticEntries, 'OEBPS/text/one.xhtml': xhtml(body) }));
  const doc = await importFile(fixture);
  for (const paragraphStyle of ['lines', 'markers', 'continuous', 'spaced'])
    await render(
      doc,
      { mode: 'book', paragraphStyle, fontSizePx: 6.25, foldGaps: true, marginMm: 2 },
      path.join(out, 'boundaries', paragraphStyle),
    );
  const illustrated = path.join(storage, 'fold-images.epub');
  await fs.writeFile(
    illustrated,
    zip({
      ...syntheticEntries,
      'OEBPS/text/one.xhtml': xhtml(
        Array.from(
          { length: 18 },
          (_, index) =>
            `<figure><img src="../images/landscape.svg" alt="Tall illustration ${index}"/><figcaption>Caption ${index}</figcaption></figure>`,
        ).join(''),
      ),
      'OEBPS/images/landscape.svg':
        '<svg xmlns="http://www.w3.org/2000/svg" width="400" height="1200" viewBox="0 0 400 1200"><rect width="400" height="1200" fill="#345678"/></svg>',
    }),
  );
  await render(
    await importFile(illustrated),
    { mode: 'book', foldGaps: true },
    path.join(out, 'boundaries', 'fold-images'),
  );
  const headed = path.join(storage, 'headed-cells.epub');
  await fs.writeFile(
    headed,
    zip({
      ...syntheticEntries,
      'OEBPS/images/landscape.svg':
        '<svg xmlns="http://www.w3.org/2000/svg" width="400" height="1200"><rect width="400" height="1200" fill="#345678"/></svg>',
      'OEBPS/text/one.xhtml': xhtml(
        Array.from(
          { length: 4 },
          (_, index) =>
            `<img src="../images/landscape.svg" alt="Illustration ${index}"/><h2>Chapter ${index + 1}. A <em>longer title</em> to keep with its first line</h2><p>` +
            '“Next, go lower, and after him!” A paragraph ends here. '.repeat(140) +
            '</p>',
        ).join(''),
      ),
    }),
  );
  await render(await importFile(headed), { mode: 'book' }, path.join(out, 'boundaries', 'headed-cells'));
  console.log('Long-token, table-row, and paragraph-treatment checks passed.');
}
async function smoke() {
  for (const filename of [
    'classic.txt',
    'classic.md',
    ...(option('suite') === 'full' ? ['classic-duplex.txt'] : []),
  ]) {
    const doc = await importFile(`tests/fixtures/${filename}`, filename);
    const directory = path.join(out, filename);
    const { job } = await render(doc, { mode: 'classic', borderStyle: 'dashed', foldGaps: false }, directory);
    const expected = JSON.parse(await fs.readFile(`tests/baseline/${filename}.json`, 'utf8'));
    if (
      job.result.pages !== expected.layout.pageCount ||
      job.result.cells.length !== expected.layout.populatedBlocks
    )
      throw Error(`${filename}: Classic geometry changed`);
    await verifyClassicOutput(
      path.join(storage, 'generated', 'renders', job.id, 'output.html'),
      path.join(directory, 'output.pdf'),
      `tests/baseline/${filename}.pdf`,
      directory,
      job.result.pages,
    );
    for (const cell of job.result.cells) {
      if (
        cell.page !== Math.floor(cell.index / 16) ||
        Math.abs(cell.x - (cell.index % 4) * 153) > 0.02 ||
        Math.abs(cell.y - Math.floor((cell.index % 16) / 4) * 197.40625) > 0.02
      )
        throw Error('Folding geometry changed');
    }
    console.log(`${filename}: Classic golden layout preserved; all cells horizontally justified`);
  }
  const doc = await importFile('tests/fixtures/structured.epub');
  const { job } = await render(doc, { mode: 'book' }, path.join(out, 'structured'));
  const text = execFileSync('pdftotext', ['-raw', path.join(out, 'structured/output.pdf'), '-'], {
    encoding: 'utf8',
  });
  for (const sentinel of [
    'BEGIN-SENTINEL',
    'END-SENTINEL',
    'NOTE-SENTINEL',
    'bridge across the river',
    'Lanterns',
  ])
    if (!text.includes(sentinel)) throw Error(`PDF lost ${sentinel}`);
  if ((text.match(/NOTE-SENTINEL/g) || []).length !== 1) throw Error('Endnote was duplicated');
  if (job.result.coverage.overflows || !job.result.coverage.complete)
    throw Error('Book content verification failed');
  const { job: cached } = await render(doc, { mode: 'book' });
  if (!cached.cached || cached.id !== job.id) throw Error('Identical render was not reused');
  const publisher = await importFile('tests/fixtures/publisher-alternatives.epub');
  const openingDirectory = path.join(out, 'publisher-opening');
  const opening = await render(publisher, { mode: 'book' }, openingDirectory);
  await verifyBookOpening(
    path.join(storage, 'generated', 'renders', opening.job.id, 'output.html'),
    openingDirectory,
  );
  await verifyPrintLayout(
    path.join(storage, 'generated', 'renders', opening.job.id, 'output.html'),
    openingDirectory,
    opening.job,
  );
  const spreadsDoc = await importFile('tests/fixtures/two-cell-images.epub');
  const excludedImage = spreadsDoc.blocks.find((b) => b.kind === 'image' && !b.imageHeading);
  const excluded = await render(
    spreadsDoc,
    { mode: 'book', twoCellImages: true, excludedImageIds: [excludedImage.id] },
    path.join(out, 'image-excluded'),
  );
  if (excluded.job.result.cells.some((cell) => cell.blockIds.includes(excludedImage.id)))
    throw Error('An excluded image remains in the PDF map');
  const excludedText = execFileSync('pdftotext', ['-raw', path.join(out, 'image-excluded/output.pdf'), '-'], {
    encoding: 'utf8',
  });
  if (
    excludedText.includes('CAPTION-0.') ||
    !excludedText.includes('CAPTION-1.') ||
    !excludedText.includes('AFTER-0.')
  )
    throw Error(
      'Image exclusion must remove only its caption and preserve following text/repeated illustrations',
    );

  for (const [name, settings] of [
    ['spreads', { mode: 'book', twoCellImages: true }],
    ...[false, true].map((twoCellImages) => [
      `mixed-images-${twoCellImages ? 'wide' : 'single'}`,
      {
        mode: 'book',
        twoCellImages,
        imageCellSpans: Object.fromEntries(
          spreadsDoc.blocks
            .filter((b) => b.kind === 'image')
            .slice(0, 2)
            .map((b, i) => [b.id, i === 0 ? 2 : 1]),
        ),
      },
    ]),
    [
      'spreads-labels',
      {
        mode: 'book',
        twoCellImages: true,
        sourcePageNumbers: true,
        marginMm: 3,
        foldGaps: false,
        borderStyle: 'dotted',
        fontFamily: 'times-new-roman',
        fontSizePx: 6.5,
      },
    ],
  ]) {
    const directory = path.join(out, name);
    const result = await render(spreadsDoc, settings, directory);
    await verifyPrintLayout(
      path.join(storage, 'generated', 'renders', result.job.id, 'output.html'),
      directory,
      result.job,
    );
  }
  const spacedDirectory = path.join(out, 'publisher-spaced');
  const spaced = await render(publisher, { mode: 'book', paragraphStyle: 'spaced' }, spacedDirectory);
  await verifyPrintLayout(
    path.join(storage, 'generated', 'renders', spaced.job.id, 'output.html'),
    spacedDirectory,
    spaced.job,
  );
  const compactSettings = {
    mode: 'book',
    chapterHeadingScale: 0.95,
    partHeadingScale: 1.2,
    chapterHeadingGapEm: 0,
    partHeadingGapEm: 0.05,
    headingRules: false,
    positionHeaders: false,
  };
  const compactDirectory = path.join(out, 'publisher-compact');
  const compact = await render(publisher, compactSettings, compactDirectory);
  await verifyBookOpening(
    path.join(storage, 'generated', 'renders', compact.job.id, 'output.html'),
    compactDirectory,
    compactSettings,
  );
}
try {
  if (command === 'check') {
    run('npm', ['run', 'typecheck']);
    run('npm', ['test']);
    run('npm', ['run', 'build']);
  }
  await start();
  if (command === 'doctor') {
    console.log(
      JSON.stringify(
        {
          node: process.version,
          dockerEnvironment: await fs.access('/.dockerenv').then(
            () => true,
            () => false,
          ),
          poppler: spawnSync('pdfinfo', ['-v'], { encoding: 'utf8' }).stderr.trim(),
          startupMs,
          ...(await json('/api/health')),
        },
        null,
        2,
      ),
    );
  } else if (['render', 'compare', 'bench'].includes(command)) {
    const file = option('input');
    if (!file) throw Error('--input is required');
    const settings = option('settings') ? JSON.parse(await fs.readFile(option('settings'), 'utf8')) : {};
    let doc = await importFile(file);
    const requestedMode = option('mode', settings.mode || (doc.format === 'epub' ? 'book' : 'classic'));
    const mode = { basic: 'classic', rich: 'book' }[requestedMode] || requestedMode;
    if (command === 'render') await render(doc, { ...settings, mode }, out);
    if (command === 'compare') {
      if (settings.selectedSections) {
        // Both pipelines receive the same selected source. Classic's frozen TXT/MD normalization stays intact.
        const selected = new Set(settings.selectedSections);
        doc = {
          ...doc,
          blocks: doc.blocks.filter((b) => selected.has(b.sectionId)),
        };
        await fs.writeFile(
          path.join(storage, 'uploads/documents', doc.id, 'document.json'),
          JSON.stringify(doc),
        );
        await stop();
        await start();
      }
      const results = [];
      for (const mode of ['classic', 'book'])
        results.push((await render(doc, { ...settings, mode }, path.join(out, mode))).result);
      console.log('Difference:', await comparison(results, out));
    }
    if (command === 'bench') {
      const runs = Number(option('runs', '3'));
      if (!Number.isInteger(runs) || runs < 1 || runs > 20) throw Error('--runs must be 1–20');
      const samples = [];
      for (let i = 0; i < runs; i++) {
        if (i > 0) {
          await stop();
          await start();
        }
        const cold = await render(doc, { ...settings, mode }, path.join(out, `run-${i + 1}`, 'cold'), true);
        const warm = await render(doc, { ...settings, mode }, path.join(out, `run-${i + 1}`, 'warm'), true);
        const cached = await render(doc, { ...settings, mode }, path.join(out, `run-${i + 1}`, 'cached'));
        if (!cached.job.cached) throw Error('Benchmark did not reuse an equivalent cached render');
        samples.push({
          run: i + 1,
          startupMs,
          cold: { elapsedMs: cold.elapsed, endToEndMs: startupMs + cold.elapsed, ...cold.job.result },
          warm: { elapsedMs: warm.elapsed, ...warm.job.result },
          cached: { elapsedMs: cached.elapsed, hit: cached.job.cached },
        });
      }
      await fs.writeFile(path.join(out, 'benchmark.json'), JSON.stringify(samples, null, 2));
      await fs.writeFile(
        path.join(out, 'benchmark.html'),
        `<!doctype html><meta charset="utf-8"><title>MicroBook benchmark</title><style>body{font:15px system-ui;margin:40px;background:#101a2b;color:#dfe9fa}td,th{padding:12px 22px;border-bottom:1px solid #42516a;text-align:left}a{color:#b7d3ff}</style><h1>Render benchmark</h1><p>${modeLabel(mode)} · ${doc.wordCount.toLocaleString()} words · <a href="benchmark.json">JSON</a></p><table><tr><th>Run</th><th>Startup</th><th>Cold render</th><th>Warm render</th><th>Cached result</th></tr>${samples.map((sample) => `<tr><td>${sample.run}</td><td>${Math.round(sample.startupMs)} ms</td>${['cold', 'warm', 'cached'].map((phase) => `<td><a href="run-${sample.run}/${phase}/report.html">${Math.round(sample[phase].elapsedMs)} ms</a></td>`).join('')}</tr>`).join('')}</table><p>Cold starts a new worker and Chromium. Startup is separate from rendering. Warm forces equivalent work in the same browser; cached reuses a completed artifact. Polling adds up to 250 ms. Report generation is outside the measured interval.</p>`,
      );
      console.log(
        samples.map((s) => ({
          run: s.run,
          startup: Math.round(s.startupMs),
          cold: Math.round(s.cold.elapsedMs),
          warm: Math.round(s.warm.elapsedMs),
          cached: Math.round(s.cached.elapsedMs),
        })),
      );
    }
  } else if (command === 'check' || command === 'test') {
    await smoke();
    await reliability();
    await boundaryCases();
    run('npm', ['run', 'test:ui'], { MB_TEST_URL: base, MB_REPORT_DIR: out });
    if (option('suite') === 'full') {
      run('node', ['tools/verify-classic-batching.mjs', base, path.join(out, 'classic-batching')]);
      const corpus = await publicBooks();
      for (const book of corpus) {
        const doc = await importFile(book.file);
        const results = [];
        const auditDir = path.join(out, book.id);
        await fs.mkdir(auditDir, { recursive: true });
        await fs.writeFile(path.join(auditDir, 'document.json'), JSON.stringify(doc));
        const audit = execFileSync(
          'python3',
          [
            'tools/verify-content.py',
            '--source',
            book.file,
            '--document',
            path.join(auditDir, 'document.json'),
          ],
          { encoding: 'utf8' },
        );
        await fs.writeFile(path.join(auditDir, 'source-audit.json'), audit);
        for (const mode of ['classic', 'book'])
          results.push((await render(doc, { mode }, path.join(out, book.id, mode))).result);
        await comparison(results, path.join(out, book.id));
      }
    }
    console.log('Verification passed.');
  }
} catch (error) {
  console.error(error.stack || error);
  console.error(log);
  process.exitCode = 1;
} finally {
  await stop();
  await fs.rm(storage, { recursive: true, force: true });
  const owner = process.env.MB_REPORT_OWNER;
  if (owner && /^\d+:\d+$/.test(owner) && process.getuid?.() === 0) {
    for (const directory of [out, path.resolve('.cache/public-books')]) {
      if (
        await fs.access(directory).then(
          () => true,
          () => false,
        )
      )
        execFileSync('chown', ['-R', owner, directory]);
    }
  }
}
