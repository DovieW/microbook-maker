import { createHash } from 'node:crypto';
import { isUtf8 } from 'node:buffer';
import path from 'node:path';
import fs from 'node:fs/promises';
import yauzl from 'yauzl';
import { IMPORT_LIMITS } from './import-limits.ts';
export { createHash, isUtf8, path, fs };
export async function readArchive(input: Buffer): Promise<Map<string, Buffer>> {
  return new Promise((resolve, reject) => {
    yauzl.fromBuffer(
      input,
      { lazyEntries: true, validateEntrySizes: true, strictFileNames: true },
      (err, zip) => {
        if (err || !zip) return reject(err || new Error('Invalid EPUB archive'));
        const files = new Map<string, Buffer>();
        let count = 0;
        let total = 0;
        let failed = false;
        const fail = (error: unknown) => {
          if (!failed) {
            failed = true;
            zip.close();
            reject(error);
          }
        };
        zip.on('error', fail);
        zip.on('end', () => {
          if (!failed) resolve(files);
        });
        zip.on('entry', (entry) => {
          if (
            ++count > IMPORT_LIMITS.entries ||
            entry.uncompressedSize > IMPORT_LIMITS.entry ||
            (total += entry.uncompressedSize) > IMPORT_LIMITS.expanded
          )
            return fail(new Error('EPUB exceeds archive limits'));
          if (entry.generalPurposeBitFlag & 1) return fail(new Error('Encrypted EPUBs are unsupported'));
          if (entry.fileName.endsWith('/')) return zip.readEntry();
          const fileName = path.posix.normalize(entry.fileName);
          if (fileName.startsWith('../') || fileName.startsWith('/') || files.has(fileName))
            return fail(new Error('Invalid or duplicate EPUB entry'));
          zip.openReadStream(entry, (error, stream) => {
            if (error || !stream) return fail(error || new Error('Cannot open EPUB entry'));
            const chunks: Buffer[] = [];
            let size = 0;
            stream.on('data', (chunk) => {
              size += chunk.length;
              if (size > IMPORT_LIMITS.entry || size > entry.uncompressedSize) {
                stream.destroy();
                fail(new Error('EPUB entry exceeds declared size'));
              } else chunks.push(chunk);
            });
            stream.on('error', fail);
            stream.on('end', () => {
              if (!failed) {
                files.set(fileName, Buffer.concat(chunks));
                zip.readEntry();
              }
            });
          });
        });
        zip.readEntry();
      },
    );
  });
}
