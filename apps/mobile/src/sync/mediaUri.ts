import { Platform } from 'react-native';

import { getApiBaseUrl } from '@/src/config/api';
import { getCachedTesterToken } from '@/src/lib/apiFetch';

/**
 * Build the URL for a media file stored on the backend.
 * The token travels as a query parameter because <Image> / audio players
 * cannot set custom headers.
 */
export function remoteMediaUrl(remoteId: string): string {
  const token = getCachedTesterToken();
  const base = getApiBaseUrl();
  const tokenPart = token ? `?token=${encodeURIComponent(token)}` : '';
  return `${base}/api/media/${encodeURIComponent(remoteId)}${tokenPart}`;
}

/**
 * Pick the best URI to display for a piece of media.
 * - Web: prefer the remote copy (local blob:/data: URIs do not survive reloads).
 * - Native: prefer the local file (faster, works offline), fall back to remote.
 */
export function displayMediaUri(localUri?: string, remoteId?: string): string | undefined {
  if (Platform.OS === 'web') {
    if (remoteId) return remoteMediaUrl(remoteId);
    return localUri;
  }
  if (localUri) return localUri;
  if (remoteId) return remoteMediaUrl(remoteId);
  return undefined;
}
