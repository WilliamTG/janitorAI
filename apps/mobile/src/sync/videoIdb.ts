/**
 * Web-only IndexedDB helpers for persisting video blobs across page refreshes.
 *
 * When a user picks a video on web, expo-image-picker returns a `blob:` URL —
 * a temporary in-memory reference that disappears when the page is refreshed.
 * We immediately write the bytes here so the sync engine can recover them
 * after a reload, even before the upload completes.
 *
 * On native, `indexedDB` is undefined, so all functions are safe no-ops.
 */

const DB_NAME = 'inspection-video-blobs';
const STORE_NAME = 'blobs';
const DB_VERSION = 1;

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      req.result.createObjectStore(STORE_NAME);
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

/**
 * Persist a video Blob under `noteId`. Safe to call multiple times for the
 * same note — overwrites the previous entry.
 *
 * Unlike the read/delete helpers, this function deliberately **propagates**
 * errors: the caller (`persistMediaLocally`) must know when the write failed
 * so it can fall back to the original blob: URI rather than returning an
 * `idb://` URI that points to nothing.
 */
export async function saveVideoToIdb(noteId: string, blob: Blob): Promise<void> {
  if (typeof indexedDB === 'undefined') {
    throw new Error('IndexedDB is not available in this environment');
  }
  const db = await openDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    tx.objectStore(STORE_NAME).put(blob, noteId);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error ?? new Error('IDB transaction aborted'));
  });
}

/**
 * Retrieve the Blob stored for `noteId`, or null if it is not in the store.
 */
export async function loadVideoFromIdb(noteId: string): Promise<Blob | null> {
  if (typeof indexedDB === 'undefined') return null;
  try {
    const db = await openDb();
    return await new Promise<Blob | null>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const req = tx.objectStore(STORE_NAME).get(noteId);
      req.onsuccess = () => resolve((req.result as Blob) ?? null);
      req.onerror = () => reject(req.error);
    });
  } catch (err) {
    console.warn('[videoIdb] loadVideoFromIdb failed', err);
    return null;
  }
}

/**
 * Remove the stored Blob for `noteId` after a successful upload so the store
 * does not grow indefinitely.
 */
export async function deleteVideoFromIdb(noteId: string): Promise<void> {
  if (typeof indexedDB === 'undefined') return;
  try {
    const db = await openDb();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      tx.objectStore(STORE_NAME).delete(noteId);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch (err) {
    console.warn('[videoIdb] deleteVideoFromIdb failed', err);
  }
}

/**
 * Returns true when `uri` is an `idb:` URI managed by this module.
 */
export function isIdbUri(uri: string): boolean {
  return uri.startsWith('idb://');
}

/**
 * Extract the note ID from an `idb://<noteId>` URI.
 */
export function noteIdFromIdbUri(uri: string): string {
  return uri.slice('idb://'.length);
}
