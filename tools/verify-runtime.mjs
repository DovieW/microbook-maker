// Exercise the same image that will be published, with an empty temporary library.
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import { setTimeout as delay } from 'node:timers/promises';

const [image, expectedArch] = process.argv.slice(2);
assert(
  image && ['amd64', 'arm64'].includes(expectedArch),
  'Usage: node tools/verify-runtime.mjs IMAGE amd64|arm64',
);
const docker = (...args) => execFileSync('docker', args, { encoding: 'utf8' }).trim();
assert.equal(
  docker('image', 'inspect', '--format', '{{.Os}}/{{.Architecture}}', image),
  `linux/${expectedArch}`,
);
const container = docker('run', '--detach', '--init', '--publish', '127.0.0.1::7777', image);
try {
  const port = docker('port', container, '7777/tcp');
  const base = `http://${port}`;
  const request = async (path, options) => {
    const response = await fetch(base + path, { signal: AbortSignal.timeout(10_000), ...options });
    if (!response.ok) throw Error(`${path}: ${response.status} ${await response.text()}`);
    return response;
  };
  const poll = async (read, deadline, message) => {
    while (Date.now() < deadline) {
      const result = await read();
      if (result) return result;
      await delay(500);
    }
    throw Error(message);
  };
  const health = await poll(
    async () => {
      const result = await request('/api/health')
        .then((r) => r.json())
        .catch(() => undefined);
      return result?.rendererReady && result;
    },
    Date.now() + 90_000,
    'Chromium renderer did not start',
  );
  console.log(`linux/${expectedArch}: ${health.fingerprint.chromium}`);

  for (const [mode, filename, input, expectedText] of [
    [
      'classic',
      'runtime.txt',
      'Runtime smoke test. An ordinary paragraph for the Basic renderer.',
      'An ordinary paragraph',
    ],
    [
      'book',
      'structured.epub',
      await readFile(new URL('../tests/fixtures/structured.epub', import.meta.url)),
      'END-SENTINEL',
    ],
  ]) {
    const form = new FormData();
    form.set('file', new Blob([input]), filename);
    const doc = await request('/api/documents', { method: 'POST', body: form }).then((r) => r.json());
    const queued = await request(`/api/documents/${doc.id}/renders`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ settings: { mode } }),
    }).then((r) => r.json());
    const renderUrl = `/api/renders/${queued.id}`;
    const job = await poll(
      async () => {
        const result = await request(renderUrl).then((r) => r.json());
        return !['queued', 'running'].includes(result.status) && result;
      },
      Date.now() + 120_000,
      `${mode} render timed out`,
    );
    assert.equal(job.status, 'completed', job.error);
    assert.equal(job.result.coverage.complete, true);
    assert.equal(job.result.coverage.overflows, 0);
    assert(job.result.pages > 0);
    const pdf = Buffer.from(await request(`${renderUrl}/pdf`).then((r) => r.arrayBuffer()));
    assert.equal(pdf.subarray(0, 5).toString(), '%PDF-');
    const text = execFileSync('docker', ['exec', '-i', container, 'pdftotext', '-raw', '-', '-'], {
      input: pdf,
      encoding: 'utf8',
    });
    assert(text.replace(/\s+/g, ' ').includes(expectedText), `${mode} PDF is missing expected text`);
    console.log(`${mode}: generated and verified a printable PDF`);
  }
} catch (error) {
  console.error(docker('logs', container));
  throw error;
} finally {
  docker('rm', '--force', container);
}
