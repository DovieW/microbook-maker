import { expect, it, vi } from 'vitest';
import worker from '../apps/cloudflare/src/worker';

const env = () => ({ RENDER_KEY: 'test-only-key', BROWSER: { quickAction: vi.fn() } });
const request = (body: BodyInit = '<html><body>A prepared sheet</body></html>', headers = {}) =>
  new Request('https://microbook.example/api/render', {
    method: 'POST',
    body,
    headers: { Authorization: 'Bearer test-only-key', 'Content-Type': 'text/html', ...headers },
  });

it('does not expose uploads or spend browser capacity without the preview credential', async () => {
  const bindings = env();
  expect((await worker.fetch(request('', { Authorization: 'Bearer incorrect' }), bindings)).status).toBe(401);
  expect((await worker.fetch(request(), { ...bindings, RENDER_KEY: undefined })).status).toBe(401);
  expect((await worker.fetch(new Request('https://microbook.example/api/documents'), bindings)).status).toBe(
    404,
  );
  expect(bindings.BROWSER.quickAction).not.toHaveBeenCalled();
});

it('bounds streaming uploads as well as announced sizes before starting a cloud browser', async () => {
  const bindings = env();
  expect(
    (await worker.fetch(request('x', { 'Content-Length': String(25 * 1024 * 1024) }), bindings)).status,
  ).toBe(413);
  const stream = new ReadableStream({
    start(controller) {
      controller.enqueue(new Uint8Array(25 * 1024 * 1024));
      controller.close();
    },
  });
  const input = new Request('https://microbook.example/api/render', {
    method: 'POST',
    body: stream,
    duplex: 'half',
    headers: { Authorization: 'Bearer test-only-key', 'Content-Type': 'text/html' },
  } as RequestInit);
  expect((await worker.fetch(input, bindings)).status).toBe(413);
  expect((await worker.fetch(request(''), bindings)).status).toBe(400);
  expect((await worker.fetch(request('{}', { 'Content-Type': 'application/json' }), bindings)).status).toBe(
    415,
  );
  expect(bindings.BROWSER.quickAction).not.toHaveBeenCalled();
});

it('prints the prepared document to Letter and returns exact provider PDF bytes without storage', async () => {
  const bindings = env();
  const pdf = new Uint8Array([37, 80, 68, 70, 45, 49, 46, 55, 10, 0, 255]);
  bindings.BROWSER.quickAction.mockResolvedValue(new Response(pdf));
  const response = await worker.fetch(
    request('<html><script>fetch("https://outside.example")</script><body>Sheet</body></html>'),
    bindings,
  );
  expect(response.status).toBe(200);
  expect(new Uint8Array(await response.arrayBuffer())).toEqual(pdf);
  expect(response.headers.get('Cache-Control')).toBe('no-store');
  expect(response.headers.get('Content-Disposition')).toMatch(/^inline/);
  const [action, options] = bindings.BROWSER.quickAction.mock.calls[0];
  expect(action).toBe('pdf');
  expect(options.pdfOptions).toMatchObject({
    format: 'letter',
    printBackground: true,
    preferCSSPageSize: false,
  });
  expect(options.html.indexOf('Content-Security-Policy')).toBeLessThan(options.html.indexOf('<script>'));
  expect(options.html).toContain("script-src 'none'");
  expect(options.html).toContain("connect-src 'none'");
  expect(options.rejectRequestPattern).toEqual(['/^https?:/']);
});

it('reports the provider limit without retrying or creating another browser', async () => {
  const bindings = env();
  bindings.BROWSER.quickAction.mockResolvedValue(new Response('provider internal message', { status: 429 }));
  const response = await worker.fetch(request(), bindings);
  expect(response.status).toBe(429);
  expect(await response.text()).toContain('free browser capacity');
  expect(bindings.BROWSER.quickAction).toHaveBeenCalledTimes(1);
});

it('does not expose provider internals on failure', async () => {
  for (const failure of [
    new Response('private provider details', { status: 500 }),
    new Error('private provider details'),
  ]) {
    const bindings = env();
    if (failure instanceof Error) bindings.BROWSER.quickAction.mockRejectedValue(failure);
    else bindings.BROWSER.quickAction.mockResolvedValue(failure);
    const response = await worker.fetch(request(), bindings);
    expect(response.status).toBe(502);
    expect(await response.text()).not.toContain('private provider details');
    expect(bindings.BROWSER.quickAction).toHaveBeenCalledTimes(1);
  }
});

it('public mode serves the app but never exposes a shared Library or accepts cross-origin rendering', async () => {
  const bindings = {
    ...env(),
    PUBLIC_MODE: 'true',
    ASSETS: { fetch: vi.fn().mockResolvedValue(new Response('app')) },
  };
  expect(await (await worker.fetch(new Request('https://microbook.example/'), bindings)).text()).toBe('app');
  expect((await worker.fetch(new Request('https://microbook.example/api/documents'), bindings)).status).toBe(
    404,
  );
  const print = (origin: string) =>
    new Request('https://microbook.example/_cloud/print', {
      method: 'POST',
      headers: { Origin: origin, 'Content-Type': 'text/html', 'X-Microbook-Bookmarks': 'true' },
      body: '<h1>Chapter</h1>',
    });
  expect((await worker.fetch(print('https://outside.example'), bindings)).status).toBe(401);
  expect(bindings.BROWSER.quickAction).not.toHaveBeenCalled();
  bindings.BROWSER.quickAction.mockResolvedValue(new Response('%PDF-test'));
  expect((await worker.fetch(print('https://microbook.example'), bindings)).status).toBe(200);
  expect(bindings.BROWSER.quickAction.mock.calls[0][1].pdfOptions.outline).toBe(true);
});
