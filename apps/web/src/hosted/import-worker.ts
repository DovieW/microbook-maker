import { Buffer } from 'buffer';
import { importDocument } from '../../../../packages/core/src/import';
import { files } from './import-platform';
self.onmessage = async (event: MessageEvent<{ input: ArrayBuffer; name: string; id: string }>) => {
  files.clear();
  try {
    const doc = await importDocument(
      Buffer.from(event.data.input) as any,
      event.data.name,
      event.data.id,
      '/document',
    );
    self.postMessage({
      doc,
      files: [...files].map(([name, bytes]) => [name.replace('/document/', ''), bytes]),
    });
  } catch (error) {
    self.postMessage({ error: error instanceof Error ? error.message : 'Could not import this book' });
  } finally {
    files.clear();
  }
};
