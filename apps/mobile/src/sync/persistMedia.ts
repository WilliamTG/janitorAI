import * as FileSystem from 'expo-file-system/legacy';
import { Platform } from 'react-native';

import { logError } from '@/src/lib/logger';
import { saveVideoToIdb } from './videoIdb';

/**
 * Move a freshly captured media file (photo/recording) out of temp/cache
 * storage into the app's permanent document directory, so the OS cannot
 * silently delete it. Returns the new (or original, on failure/web) URI.
 *
 * On web, when `noteId` is provided and the URI is a `blob:` URL, the video
 * bytes are written to IndexedDB under `noteId` and an `idb://<noteId>` URI
 * is returned. This survives page refreshes, allowing the sync engine to
 * resume the upload after a reload even if the original blob: URL is gone.
 *
 * For non-video media on web (photos recorded by the web camera) the blob:
 * URL is still valid within the same session, so we leave it as-is.
 */
export async function persistMediaLocally(uri: string, noteId?: string): Promise<string> {
  if (Platform.OS === 'web') {
    // Persist video blobs to IndexedDB so they survive a page refresh.
    // We only swap out the blob: URI for an idb:// URI when the write
    // actually commits — if anything goes wrong we keep the original
    // blob: URI so the upload can still proceed within this session.
    if (noteId && uri.startsWith('blob:')) {
      try {
        const response = await fetch(uri, { signal: AbortSignal.timeout(30_000) });
        if (response.ok) {
          const blob = await response.blob();
          // saveVideoToIdb propagates on failure — catch here to fall back.
          await saveVideoToIdb(noteId, blob);
          console.log('[persistMedia] Saved video blob to IndexedDB for note', noteId);
          return `idb://${noteId}`;
        } else {
          console.warn('[persistMedia] Blob fetch returned non-OK status; keeping blob: URI', response.status);
        }
      } catch (err) {
        // IDB unavailable (private mode, quota exceeded, transaction aborted,
        // or the blob: URL was already revoked before we could read it).
        // Fall through and keep the original blob: URI so the upload can still
        // proceed within the current browser session.
        console.warn('[persistMedia] Failed to save video blob to IndexedDB; keeping blob: URI', err);
        logError(err, 'persist-media-idb');
      }
    }
    // Web has no filesystem; durability comes from the backend upload.
    return uri;
  }

  try {
    const baseDir = FileSystem.documentDirectory;
    if (!baseDir) return uri;

    // Already in permanent storage.
    if (uri.startsWith(baseDir)) return uri;

    const mediaDir = `${baseDir}media/`;
    const dirInfo = await FileSystem.getInfoAsync(mediaDir);
    if (!dirInfo.exists) {
      await FileSystem.makeDirectoryAsync(mediaDir, { intermediates: true });
    }

    const extMatch = uri.match(/\.[A-Za-z0-9]+$/);
    const ext = extMatch ? extMatch[0] : '';
    const destination = `${mediaDir}${Date.now()}-${Math.random().toString(36).slice(2, 8)}${ext}`;

    await FileSystem.moveAsync({ from: uri, to: destination });
    return destination;
  } catch (error) {
    console.warn('[persistMedia] Failed to move media to permanent storage', error);
    logError(error, 'persist-media-local');
    return uri;
  }
}
