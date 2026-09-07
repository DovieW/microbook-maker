export const LIFETIME = 24 * 60 * 60 * 1000;
let connection: Promise<IDBDatabase> | undefined;
function database() {
  return (connection ||= new Promise((resolve, reject) => {
    const request = indexedDB.open('microbook-temporary-v1', 1);
    request.onupgradeneeded = () => request.result.createObjectStore('records');
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  }));
}
export async function get<T = any>(key: string): Promise<T | undefined> {
  const db = await database();
  return new Promise((resolve, reject) => {
    const r = db.transaction('records').objectStore('records').get(key);
    r.onsuccess = () => resolve(r.result);
    r.onerror = () => reject(r.error);
  });
}
export async function put(key: string, value: unknown) {
  const db = await database();
  return new Promise<void>((resolve, reject) => {
    const tx = db.transaction('records', 'readwrite');
    tx.objectStore('records').put(value, key);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error);
  });
}
export async function entries(): Promise<[string, any][]> {
  const db = await database();
  return new Promise((resolve, reject) => {
    const rows: [string, any][] = [];
    const r = db.transaction('records').objectStore('records').openCursor();
    r.onsuccess = () => {
      const c = r.result;
      if (c) {
        rows.push([String(c.key), c.value]);
        c.continue();
      } else resolve(rows);
    };
    r.onerror = () => reject(r.error);
  });
}
export async function remove(keys: string[]) {
  const db = await database();
  return new Promise<void>((resolve, reject) => {
    const tx = db.transaction('records', 'readwrite');
    for (const key of keys) tx.objectStore('records').delete(key);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}
// Keep ownership checks and writes atomic with deletion/expiry.
export async function putOwned(key: string, value: { documentId: string; [key: string]: any }) {
  const db = await database();
  return new Promise<void>((resolve, reject) => {
    const tx = db.transaction('records', 'readwrite'),
      records = tx.objectStore('records');
    const request = records.get('doc:' + value.documentId);
    request.onsuccess = () => {
      if (request.result?.expiresAt > Date.now()) records.put(value, key);
    };
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error);
  });
}
export async function removeDocument(id: string) {
  const db = await database();
  return new Promise<void>((resolve, reject) => {
    const tx = db.transaction('records', 'readwrite'),
      request = tx.objectStore('records').openCursor();
    request.onsuccess = () => {
      const cursor = request.result;
      if (cursor) {
        if (cursor.key === 'doc:' + id || cursor.value.documentId === id) cursor.delete();
        cursor.continue();
      }
    };
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error);
  });
}
export async function sweep() {
  const rows = await entries();
  const expired = rows
    .filter(([key, doc]) => key.startsWith('doc:') && doc.expiresAt <= Date.now())
    .map(([, doc]) => doc.id as string);
  for (const id of expired) await removeDocument(id);
  return expired;
}
