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
export async function downloadPdf(job: Pick<RenderJob, 'id' | 'metadata'>) {
  const response = await fetch(`/api/renders/${job.id}/download`, {
    signal: AbortSignal.timeout(120_000),
  });
  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.error || `Could not download the PDF (${response.status})`);
  }
  const blob = await response.blob();
  if (blob.type && blob.type !== 'application/pdf') throw new Error('The completed PDF is unavailable');
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `${job.metadata.title.replace(/[^\p{L}\p{N} ._-]/gu, '') || 'microbook'}.pdf`;
  link.hidden = true;
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}
