import { render, fingerprint, cancelRender, stopRenderer } from '@microbook/renderer';
import type { BookDocument, RenderJob } from '@microbook/core';
let busy = false;
const send = (message: unknown) => process.send?.(message);
process.on('message', async (message: any) => {
  if (message.type === 'cancel') {
    await cancelRender();
    return;
  }
  if (message.type === 'shutdown') {
    await stopRenderer();
    process.exit(0);
  }
  if (message.type !== 'render' || busy) return;
  busy = true;
  const job: RenderJob = message.job;
  const document: BookDocument = message.document;
  try {
    const result = await render(
      job,
      document,
      message.documentDir,
      message.outputDir,
      message.baseUrl,
      (phase, progress) => send({ type: 'progress', id: job.id, phase, progress }),
    );
    send({ type: 'complete', id: job.id, result });
  } catch (error) {
    send({ type: 'failed', id: job.id, error: (error as Error).message });
  } finally {
    busy = false;
    send({ type: 'idle' });
  }
});
try {
  send({ type: 'ready', fingerprint: await fingerprint() });
} catch (error) {
  send({ type: 'fatal', error: (error as Error).message });
  process.exit(1);
}
