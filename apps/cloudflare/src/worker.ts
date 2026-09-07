// Stateless PDF transport for the hosted edition. No Library, upload bucket, or paid binding.
// Public mode uses browser-local temporary storage; the proof endpoint stays gated.
interface Env {
  BROWSER: {
    quickAction(action: 'pdf', options: Record<string, unknown>): Promise<Response>;
  };
  RENDER_KEY?: string;
  PUBLIC_MODE?: string;
  ASSETS?: { fetch(request: Request): Promise<Response> };
}
const MAX_HTML_BYTES = 24 * 1024 * 1024;
const privateHeaders = { 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' };
const problem = (message: string, status: number) =>
  Response.json({ error: message }, { status, headers: privateHeaders });

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    if (request.method === 'GET' && ['/api/health', '/_cloud/health'].includes(url.pathname)) {
      return Response.json(
        {
          service: 'microbook-cloudflare',
          stage: env.PUBLIC_MODE === 'true' ? 'app' : 'renderer-preview',
          storage: 'none',
        },
        {
          headers: privateHeaders,
        },
      );
    }
    const publicMode = env.PUBLIC_MODE === 'true';
    if (publicMode && request.method === 'GET' && url.pathname === '/_cloud/metadata') {
      const title = (url.searchParams.get('title') || '').trim();
      if (!title || title.length > 500) return problem('Enter a title of up to 500 characters', 400);
      const lookup = new URL('https://openlibrary.org/search.json');
      lookup.search = new URLSearchParams({
        title,
        fields: 'title,author_name,first_publish_year',
        limit: '5',
      }).toString();
      try {
        const response = await fetch(lookup, { signal: AbortSignal.timeout(8000) });
        if (!response.ok) throw Error('Lookup failed');
        const data = (await response.json()) as {
          docs?: { title?: string; author_name?: string[]; first_publish_year?: number }[];
        };
        return Response.json(
          (data.docs || []).map((item) => ({
            title: String(item.title || '').slice(0, 500),
            author: (item.author_name || []).join(', ').slice(0, 500),
            year: item.first_publish_year ? String(item.first_publish_year) : '',
          })),
          { headers: privateHeaders },
        );
      } catch {
        return problem('Metadata lookup is unavailable. Your details are unchanged.', 502);
      }
    }
    if (url.pathname !== (publicMode ? '/_cloud/print' : '/api/render') || request.method !== 'POST') {
      if (
        publicMode &&
        env.ASSETS &&
        !url.pathname.startsWith('/api/') &&
        !url.pathname.startsWith('/_cloud/')
      )
        return env.ASSETS.fetch(request);
      return problem('Not found', 404);
    }
    // This temporary machine credential is never shipped in client JavaScript.
    if (
      publicMode
        ? request.headers.get('Origin') !== url.origin
        : !env.RENDER_KEY || request.headers.get('Authorization') !== `Bearer ${env.RENDER_KEY}`
    )
      return problem('Renderer preview is not open to visitors yet', 401);
    if (request.headers.get('Content-Type')?.split(';')[0].trim() !== 'text/html')
      return problem('Expected a prepared HTML print document', 415);
    if (Number(request.headers.get('Content-Length')) > MAX_HTML_BYTES)
      return problem('Prepared print document is too large', 413);
    const reader = request.body?.getReader();
    if (!reader) return problem('Empty print document', 400);
    const chunks: Uint8Array[] = [];
    let size = 0;
    try {
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        size += value.byteLength;
        if (size > MAX_HTML_BYTES) {
          await reader.cancel();
          return problem('Prepared print document is too large', 413);
        }
        chunks.push(value);
      }
      if (!size) return problem('Empty print document', 400);
      const source = await new Blob(chunks as BlobPart[]).text();
      // The input is a completed layout, not executable publisher markup. This first
      // policy cannot be loosened by another meta tag later in the document.
      const policy =
        "<meta http-equiv=\"Content-Security-Policy\" content=\"default-src 'none'; script-src 'none'; style-src 'unsafe-inline'; img-src data:; font-src data:; connect-src 'none'; frame-src 'none'; object-src 'none'; base-uri 'none'; form-action 'none'\">";
      const result = await env.BROWSER.quickAction('pdf', {
        html: `<!doctype html><head>${policy}</head>${source}`,
        rejectRequestPattern: ['/^https?:/'],
        pdfOptions: {
          format: 'letter',
          printBackground: true,
          outline: request.headers.get('X-Microbook-Bookmarks') === 'true',
          preferCSSPageSize: false,
          displayHeaderFooter: false,
          margin: { top: 0, bottom: 0, left: 0, right: 0 },
        },
      });
      if (!result.ok) {
        await result.body?.cancel();
        return problem(
          result.status === 429
            ? 'Cloudflare’s free browser capacity is unavailable. Please try again later.'
            : 'Cloudflare could not create the PDF. Your current preview has been preserved.',
          result.status === 429 ? 429 : 502,
        );
      }
      return new Response(result.body, {
        headers: {
          ...privateHeaders,
          'Content-Type': 'application/pdf',
          'Content-Disposition': 'inline; filename="microbook.pdf"',
        },
      });
    } catch {
      return problem('Cloudflare could not create the PDF. Please try again.', 502);
    } finally {
      reader.releaseLock();
    }
  },
};
