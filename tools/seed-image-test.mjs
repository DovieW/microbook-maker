// Copy explicitly selected, user-owned Library images into independent persistent storage.
// Usage: node tools/seed-image-test.mjs UPLOADS_DIR document-id:asset-id ... (up to three).
// Source assets stay private on the server; never check them into the repository.
import fs from 'node:fs/promises';
import path from 'node:path';
import { createHash } from 'node:crypto';
const [root, ...selections] = process.argv.slice(2);
if (!root || !selections.length || selections.length > 3)
  throw new Error('Supply uploads directory and one to three document-id:asset-id selections');
const directory = path.resolve(root, 'print-samples');
await fs.mkdir(directory, { recursive: true });
try {
  await fs.access(path.join(directory, 'samples.json'));
  throw new Error('Permanent samples already exist; leaving them unchanged');
} catch (e) {
  if (e.code !== 'ENOENT') throw e;
}
const samples = [];
for (const selection of selections) {
  const [documentId, assetId] = selection.split(':');
  if (!/^[a-zA-Z0-9-]+$/.test(documentId) || !/^a\d+$/.test(assetId)) throw new Error('Invalid selection');
  const sourceDir = path.resolve(root, 'documents', documentId);
  const doc = JSON.parse(await fs.readFile(path.join(sourceDir, 'document.json'), 'utf8'));
  const asset = doc.assets.find((a) => a.id === assetId);
  if (!asset) throw new Error(`Missing ${selection}`);
  const bytes = await fs.readFile(path.join(sourceDir, asset.path));
  const file = createHash('sha256').update(bytes).digest('hex') + path.extname(asset.path);
  await fs.writeFile(path.join(directory, file), bytes, { flag: 'wx' }).catch((e) => {
    if (e.code !== 'EEXIST') throw e;
  });
  samples.push({
    file,
    mediaType: asset.mediaType,
    title:
      samples.length === 0
        ? 'Cover · tones and shadows'
        : samples.length === 1
          ? 'Diagram · lettering and lines'
          : 'Chart · color separation',
    source: doc.metadata.title,
    documentId,
    assetId,
  });
}
await fs.writeFile(path.join(directory, 'samples.json'), JSON.stringify(samples, null, 2), { flag: 'wx' });
console.log(`Saved ${samples.length} permanent test images in ${directory}`);
