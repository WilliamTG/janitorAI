import * as FileSystem from 'expo-file-system/legacy';
import { Platform } from 'react-native';

/**
 * Move a freshly captured media file (photo/recording) out of temp/cache
 * storage into the app's permanent document directory, so the OS cannot
 * silently delete it. Returns the new (or original, on failure/web) URI.
 */
export async function persistMediaLocally(uri: string): Promise<string> {
  if (Platform.OS === 'web') {
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
    return uri;
  }
}
