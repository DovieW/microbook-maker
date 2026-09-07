import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { createHash, randomUUID } from 'node:crypto';
const engine =
  'dovieuu/microbook-maker@sha256:ca89556eff3b41ae67bfd2e1a3f1cf8ad10afe8c7f1d0d3085cd21d673e9c389';
const hash = (value) => createHash('sha256').update(value).digest('hex');
const name = `microbook-baseline-${randomUUID()}`;
const docker = (args) => execFileSync('docker', args, { encoding: 'utf8' }).trim();
const requested = process.argv.slice(2);
if (!requested.length || !requested.every((file) => /^classic(?:-duplex)?\.(txt|md)$/.test(file)))
  throw Error('Pass explicit fixture filenames: classic.txt classic.md classic-duplex.txt');
try {
  docker([
    'run',
    '-d',
    '--rm',
    '--name',
    name,
    '--entrypoint',
    'node',
    '-p',
    '127.0.0.1::3001',
    engine,
    '/app/be/index.js',
  ]);
  const port = docker(['port', name, '3001/tcp']).split(':').at(-1);
  const base = `http://127.0.0.1:${port}`;
  for (let i = 0; i < 100; i++) {
    if (
      await fetch(base + '/api/capabilities')
        .then((r) => r.ok)
        .catch(() => false)
    )
      break;
    await new Promise((r) => setTimeout(r, 100));
  }
  for (const file of requested) {
    const input = await fs.readFile('tests/fixtures/' + file);
    const form = new FormData();
    form.set('file', new Blob([input]), file);
    form.set(
      'params',
      JSON.stringify({
        bookName: file,
        fontFamily: 'arial',
        borderStyle: 'dashed',
        foldGaps: false,
        headerInfo: { fontSize: '6' },
      }),
    );
    const response = await fetch(base + '/api/upload', {
      method: 'POST',
      body: form,
    });
    if (!response.ok) throw Error(await response.text());
    const data = await response.json();
    const id = data.id;
    let metadata;
    for (let i = 0; i < 2400; i++) {
      // A completed legacy PDF is written after its layout and metadata are available.

      const content = docker([
        'exec',
        name,
        'sh',
        '-c',
        `test -f /app/be/generated/${id}.pdf && test -f /app/be/generated/METADATA_${id}.json && cat /app/be/generated/METADATA_${id}.json || true`,
      ]);
      if (content) {
        metadata = JSON.parse(content);
        if (metadata.layout?.pageCount) break;
      }

      await new Promise((r) => setTimeout(r, 250));
    }
    if (!metadata?.layout) throw Error('Baseline render did not complete');
    for (const [remote, extension] of [
      [`${id}.pdf`, 'pdf'],
      [metadata.screenshots.firstPage.fileName, 'png'],
    ])
      docker(['cp', `${name}:/app/be/generated/${remote}`, `tests/baseline/${file}.${extension}`]);
    await fs.writeFile(`tests/baseline/${file}.json`, JSON.stringify(metadata, null, 2));
    console.log(file, metadata.layout.pageCount, 'sides', metadata.layout.populatedBlocks, 'cells');
  }
  const fonts = docker(['exec', name, 'sh', '-c', "fc-list -f '%{file}\\n' | sort -u | xargs sha256sum"])
    .split('\n')
    .map((line) => ({ sha256: line.slice(0, 64), path: line.slice(66) }));
  const references = {};
  for (const file of ['classic.txt', 'classic.md', 'classic-duplex.txt']) {
    if (
      !(await fs.access('tests/fixtures/' + file).then(
        () => true,
        () => false,
      ))
    )
      continue;
    references[file] = {
      inputSha256: hash(await fs.readFile(`tests/fixtures/${file}`)),
      pdfSha256: hash(await fs.readFile(`tests/baseline/${file}.pdf`)),
      settings: {
        mode: 'classic',
        fontSizePx: 6,
        fontFamily: 'arial',
        borderStyle: 'dashed',
        foldGaps: false,
      },
      metadata: { title: file, author: '', year: '', series: '' },
    };
  }
  await fs.writeFile(
    'tests/baseline/manifest.json',
    JSON.stringify(
      {
        sourceCommit: '43f3a28',
        sourceBackendSha256: '61f5012d3d25cceb99e753049a27ac00e010a26aa7741ad01d17b0f5b8f3edfb',
        engineImage: engine,
        chromium: '148.0.7778.178',
        node: '24.16.0',
        pretext: '0.0.6',
        markdownIt: '14.1.0',
        fonts,
        references,
      },
      null,
      2,
    ),
  );
} finally {
  try {
    docker(['stop', name]);
  } catch {}
}
