const modeLabel = (mode) => ({ classic: 'Basic', book: 'Rich' })[mode] || mode;
import fs from 'node:fs/promises';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
const escape = (value) =>
  String(value).replace(
    /[&<>"']/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c],
  );
export async function report(base, job, doc, directory) {
  await fs.mkdir(directory, { recursive: true });
  await fs.writeFile(path.join(directory, 'render-job.json'), JSON.stringify(job, null, 2));
  await fs.writeFile(path.join(directory, 'document.json'), JSON.stringify(doc, null, 2));
  for (const [route, file] of [
    ['pdf', 'output.pdf'],
    ['thumbnail', 'thumbnail.png'],
  ]) {
    const response = await fetch(`${base}/api/renders/${job.id}/${route}`);
    if (!response.ok) throw Error(`Artifact ${route}: ${response.status}`);
    await fs.writeFile(path.join(directory, file), new Uint8Array(await response.arrayBuffer()));
  }
  const pdf = path.join(directory, 'output.pdf');
  const inkAudit = JSON.parse(
    execFileSync('python3', ['tools/verify-ink.py', pdf, path.join(directory, 'render-job.json')], {
      encoding: 'utf8',
    }),
  );
  const info = execFileSync('pdfinfo', [pdf], { encoding: 'utf8' });
  execFileSync('pdftotext', ['-layout', pdf, path.join(directory, 'extracted.txt')]);
  const text = await fs.readFile(path.join(directory, 'extracted.txt'), 'utf8');
  const contentAudit =
    job.settings.mode === 'book'
      ? JSON.parse(
          execFileSync(
            'python3',
            [
              'tools/verify-content.py',
              '--document',
              path.join(directory, 'document.json'),
              '--pdf',
              pdf,
              '--job',
              path.join(directory, 'render-job.json'),
            ],
            { encoding: 'utf8' },
          ),
        )
      : undefined;
  const pdfPages = Number(info.match(/^Pages:\s+(\d+)/m)?.[1]);
  if (pdfPages !== job.result.pages)
    throw Error(`PDF page count ${pdfPages} differs from renderer ${job.result.pages}`);
  if (!/612 x 792 pts/.test(info)) throw Error('PDF physical geometry is not Letter');
  await fs.writeFile(path.join(directory, 'extracted.txt'), text);
  execFileSync('pdftoppm', ['-png', '-scale-to', '1100', pdf, path.join(directory, 'side')]);
  const result = {
    version: 1,
    document: {
      id: doc.id,
      title: job.metadata.title,
      sourceHash: doc.sourceHash,
      originalName: doc.originalName,
    },
    renderId: job.id,
    settings: job.settings,
    settingsHash: createHash('sha256').update(JSON.stringify(job.settings)).digest('hex'),
    cacheKey: job.cacheKey,
    cached: !!job.cached,
    ...job.result,
    occupiedCells: job.result.cells.filter((cell) => !cell.blank).length,
    rowEndBlankCells: job.result.cells.filter((cell) => cell.blank).length,
    timings: { import: doc.importMs || 0, ...job.result.timings },
    pdfInspection: {
      inkAudit,
      contentAudit,
      pages: pdfPages,
      letter: true,
      extractedCharacters: text.length,
    },
    generatedAt: new Date().toISOString(),
  };
  await fs.writeFile(path.join(directory, 'report.json'), JSON.stringify(result, null, 2));
  const sideImages = (await fs.readdir(directory)).filter((f) => /^side-\d+\.png$/.test(f)).sort();
  await fs.writeFile(
    path.join(directory, 'report.html'),
    `<!doctype html><html lang="en"><meta charset="utf-8"><title>${escape(job.metadata.title)} · MicroBook report</title><style>body{margin:36px auto;padding:0 24px;max-width:1100px;background:#101a2b;color:#dfe9fa;font:14px system-ui}a{color:#a9c7f6}h1{font-size:22px}p{color:#aabbd3}.sides{display:flex;gap:18px;flex-wrap:wrap}.sides img{width:240px;box-shadow:0 3px 15px #0005}pre{background:#09111f;padding:18px;overflow:auto;max-height:420px}summary{cursor:pointer;margin-top:20px}table{border-collapse:collapse}td,th{padding:8px 16px;text-align:left;border-bottom:1px solid #33435c}</style><h1>${escape(job.metadata.title)}</h1><p>${modeLabel(job.settings.mode)} · ${job.settings.fontSizePx} px / ${job.settings.fontSizePx * 0.75} pt · ${result.pages} printed sides · ${result.sheets} duplex sheets · ${result.occupiedCells} occupied cells · ${result.rowEndBlankCells} row-end blanks</p><p><a href="output.pdf">PDF</a> · <a href="report.json">JSON</a> · <a href="extracted.txt">Extracted text</a></p><p>Coverage ${result.coverage.renderedCharacters} / ${result.coverage.expectedCharacters} · ${result.coverage.overflows} overflows · ${result.peakMemoryMb} MB peak memory · ${Math.round(result.timings.total)} ms</p><div class="sides">${sideImages.map((file) => `<a href="${file}"><img src="${file}" alt="${file}"></a>`).join('')}</div><details><summary>Settings and fingerprints</summary><pre>${escape(JSON.stringify({ settings: result.settings, fingerprint: result.fingerprint, timings: result.timings }, null, 2))}</pre></details><details><summary>Source map and diagnostics</summary><pre>${escape(JSON.stringify({ diagnostics: result.diagnostics, cells: result.cells }, null, 2))}</pre></details></html>`,
  );
  return result;
}
export async function comparison(results, directory) {
  const [classic, book] = results;
  const delta = {
    sides: book.pages - classic.pages,
    sheets: book.sheets - classic.sheets,
    cells: book.cells.length - classic.cells.length,
    cellPercent: (book.cells.length / classic.cells.length - 1) * 100,
  };
  const data = { classic, book, delta };
  await fs.writeFile(path.join(directory, 'comparison.json'), JSON.stringify(data, null, 2));
  await fs.writeFile(
    path.join(directory, 'comparison.html'),
    `<!doctype html><meta charset="utf-8"><title>MicroBook comparison</title><style>body{font:15px system-ui;margin:40px;background:#101a2b;color:#dfe9fa}td,th{padding:12px 22px;border-bottom:1px solid #42516a;text-align:left}a{color:#b7d3ff}</style><h1>${escape(book.document.title)}</h1><table><tr><th>Mode</th><th>Printed sides</th><th>Duplex sheets</th><th>Allocated cells</th><th>Render time</th></tr>${results.map((r) => `<tr><td><a href="${r.settings.mode}/report.html">${modeLabel(r.settings.mode)}</a></td><td>${r.pages}</td><td>${r.sheets}</td><td>${r.cells.length}</td><td>${Math.round(r.timings.total)} ms</td></tr>`).join('')}</table><p>Rich adds ${delta.sheets} sheets, ${delta.sides} printed sides and ${delta.cells} cells (${delta.cellPercent.toFixed(1)}%).</p><p>Identical selected source content and body size. Rich preserves structural layout and included images.</p>`,
  );
  return delta;
}
