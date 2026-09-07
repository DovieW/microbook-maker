import { Buffer } from 'buffer';
// @ts-expect-error path-browserify implements the POSIX path API used by the importer.
import path from 'path-browserify';
import { sha256 } from '@noble/hashes/sha2.js';
import { sha1 } from '@noble/hashes/legacy.js';
import { Inflate } from 'fflate';
import { IMPORT_LIMITS } from '../../../../packages/core/src/import-limits';
export { path };
export const files = new Map<string, Uint8Array>();
export const fs = {
  mkdir: async (..._args: unknown[]) => {},
  writeFile: async (name: string, value: string | Uint8Array) => {
    files.set(name, Buffer.from(value as any));
  },
};
export function isUtf8(bytes: Uint8Array) {
  try {
    new TextDecoder('utf-8', { fatal: true }).decode(bytes);
    return true;
  } catch {
    return false;
  }
}
export function createHash(algorithm: string) {
  const hash = algorithm === 'sha256' ? sha256.create() : algorithm === 'sha1' ? sha1.create() : undefined;
  if (!hash) throw Error('Unsupported hash');
  const api = {
    update(value: string | Uint8Array) {
      hash.update(typeof value === 'string' ? new TextEncoder().encode(value) : value);
      return api;
    },
    digest(encoding?: string): any {
      const bytes = Buffer.from(hash.digest());
      return encoding === 'hex' ? bytes.toString('hex') : bytes;
    },
  };
  return api;
}
const crcTable = Uint32Array.from({ length: 256 }, (_, n) => {
  for (let j = 0; j < 8; j++) n = n & 1 ? 0xedb88320 ^ (n >>> 1) : n >>> 1;
  return n >>> 0;
});
export async function readArchive(input: Uint8Array) {
  const bytes = Buffer.from(input);
  let end = -1;
  for (let i = bytes.length - 22; i >= Math.max(0, bytes.length - 65557); i--) {
    if (bytes.readUInt32LE(i) === 0x06054b50 && i + 22 + bytes.readUInt16LE(i + 20) === bytes.length) {
      end = i;
      break;
    }
  }
  if (end < 0 || bytes.readUInt16LE(end + 4) || bytes.readUInt16LE(end + 6))
    throw Error('Invalid EPUB archive');
  const count = bytes.readUInt16LE(end + 10);
  if (count > IMPORT_LIMITS.entries || bytes.readUInt16LE(end + 8) !== count)
    throw Error('EPUB exceeds archive limits');
  let pos = bytes.readUInt32LE(end + 16),
    expanded = 0;
  const directoryEnd = pos + bytes.readUInt32LE(end + 12);
  if (directoryEnd > end) throw Error('Invalid EPUB archive directory');
  const result = new Map<string, Buffer>();
  for (let n = 0; n < count; n++) {
    if (pos + 46 > directoryEnd || bytes.readUInt32LE(pos) !== 0x02014b50) throw Error('Invalid EPUB entry');
    const flags = bytes.readUInt16LE(pos + 8),
      method = bytes.readUInt16LE(pos + 10);
    const expectedCrc = bytes.readUInt32LE(pos + 16),
      compressed = bytes.readUInt32LE(pos + 20),
      size = bytes.readUInt32LE(pos + 24);
    const nameLength = bytes.readUInt16LE(pos + 28),
      extraLength = bytes.readUInt16LE(pos + 30),
      commentLength = bytes.readUInt16LE(pos + 32);
    const local = bytes.readUInt32LE(pos + 42);
    if (flags & 1) throw Error('Encrypted EPUBs are unsupported');
    if (size > IMPORT_LIMITS.entry || (expanded += size) > IMPORT_LIMITS.expanded)
      throw Error('EPUB exceeds archive limits');
    if (pos + 46 + nameLength + extraLength + commentLength > directoryEnd) throw Error('Invalid EPUB entry');
    const rawName = bytes.subarray(pos + 46, pos + 46 + nameLength).toString('utf8');
    const name = path.normalize(rawName);
    if (
      rawName.includes('\\') ||
      rawName.includes('\0') ||
      name.startsWith('/') ||
      name === '..' ||
      name.startsWith('../') ||
      /^[a-z]:/i.test(name) ||
      result.has(name)
    )
      throw Error('Invalid or duplicate EPUB entry');
    pos += 46 + nameLength + extraLength + commentLength;
    if (local + 30 > bytes.length || bytes.readUInt32LE(local) !== 0x04034b50)
      throw Error('Invalid EPUB local entry');
    if (bytes.readUInt16LE(local + 6) & 1 || bytes.readUInt16LE(local + 8) !== method)
      throw Error('Invalid or encrypted EPUB entry');
    const start = local + 30 + bytes.readUInt16LE(local + 26) + bytes.readUInt16LE(local + 28);
    if (start + compressed > bytes.length) throw Error('Truncated EPUB entry');
    const chunks: Uint8Array[] = [];
    let actual = 0,
      crc = -1;
    const collect = (chunk: Uint8Array) => {
      actual += chunk.length;
      if (actual > size || actual > IMPORT_LIMITS.entry) throw Error('EPUB entry exceeds declared size');
      for (const byte of chunk) crc = crcTable[(crc ^ byte) & 255] ^ (crc >>> 8);
      chunks.push(chunk);
    };
    if (method === 0) collect(bytes.subarray(start, start + compressed));
    else if (method === 8) {
      const inflate = new Inflate(collect);
      // A bounded compressed chunk prevents a dishonest size header from allocating
      // an entire expanded ZIP bomb before the output-size check can run.
      for (let offset = 0; offset < compressed; offset += 1024)
        inflate.push(
          bytes.subarray(start + offset, start + Math.min(compressed, offset + 1024)),
          offset + 1024 >= compressed,
        );
    } else throw Error('Unsupported EPUB compression');
    if (actual !== size || (crc ^ -1) >>> 0 !== expectedCrc) throw Error('Corrupt EPUB entry');
    if (!rawName.endsWith('/')) result.set(name, Buffer.concat(chunks));
  }
  if (pos !== directoryEnd) throw Error('Invalid EPUB directory size');
  return result;
}
