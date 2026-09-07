import type { BookDocument, RenderJob } from '@microbook/core';
export type DocumentDetail = BookDocument & {
  renders: RenderJob[];
  rendererFingerprint?: Record<string, string>;
};
export async function api<T>(url: string, options?: RequestInit): Promise<T> {
  let response: Response | undefined;
  const read = !options?.method || options.method === 'GET';
  for (let attempt = 0; attempt < (read ? 2 : 1); attempt++) {
    try {
      const timeout = AbortSignal.timeout(read ? 15_000 : 120_000);
      response = await fetch(url, {
        ...options,
        signal: options?.signal ? AbortSignal.any([options.signal, timeout]) : timeout,
        headers: {
          ...(options?.body && !(options.body instanceof FormData)
            ? { 'Content-Type': 'application/json' }
            : {}),
          ...options?.headers,
        },
      });
      break;
    } catch (error) {
      if (options?.signal?.aborted) throw error;
      if (read && attempt === 0) continue;
      throw new Error('Cannot reach the server. Check your connection and try again.');
    }
  }
  if (!response) throw new Error('Cannot reach the server. Try again.');
  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.error || `Request failed (${response.status})`);
  }
  return response.status === 204 ? (undefined as T) : response.json();
}
export const post = <T>(url: string, body: unknown = {}) =>
  api<T>(url, { method: 'POST', body: JSON.stringify(body) });
export async function exportPdf(job: Pick<RenderJob, 'id'>) {
  const { url } = await post<{ url: string }>(`/api/renders/${job.id}/export`);
  const link = document.createElement('a');
  link.href = url;
  link.download = '';
  link.click();
}
