import { Platform } from 'react-native';

import { logError } from '@/src/lib/logger';
import { saveVideoToIdb } from '@/src/sync/videoIdb';

// Største kant etter nedskalering. 2048 px er rikelig for skadedokumentasjon
// (rapport + AI-analyse) og lander trygt under bytegrensen for foto.
const MAX_DIMENSION = 2048;

/**
 * Mål faktisk bytestørrelse for et bilde valgt på web når velgeren ikke
 * oppgir `fileSize` (data:- og blob:-URI-er). Returnerer null når størrelsen
 * ikke lar seg måle — da får bildet passere uendret, som før.
 */
export async function measurePhotoBytesWeb(uri: string): Promise<number | null> {
  if (Platform.OS !== 'web') return null;
  try {
    const response = await fetch(uri, { signal: AbortSignal.timeout(30_000) });
    if (!response.ok) return null;
    const blob = await response.blob();
    return blob.size;
  } catch {
    return null;
  }
}

/**
 * Persister bildebytene til IndexedDB på web (samme blob-lager som video)
 * og returner en `idb://<key>`-URI. Pilotfunn (aug 2026): blob:/data:-URI-er
 * dør når appen lukkes, og bilder som ikke rakk å bli lastet opp gikk tapt.
 * IDB overlever omstart, så opplastingen kan gjenopptas i neste økt.
 * Returnerer null ved feil — kalleren faller da tilbake til objectURL.
 */
export async function persistPhotoBytesWeb(uri: string, key: string): Promise<string | null> {
  if (Platform.OS !== 'web') return null;
  try {
    const response = await fetch(uri, { signal: AbortSignal.timeout(30_000) });
    if (!response.ok) return null;
    const blob = await response.blob();
    await saveVideoToIdb(key, blob);
    return `idb://${key}`;
  } catch (err) {
    logError(err, 'photo-persist-idb');
    return null;
  }
}

/**
 * Gjør en base64 `data:`-URI om til en kort `blob:`-objectURL på web.
 * Velgeren returnerer data-URI-er der; med flervalg ville mange megabyte
 * base64 havnet i prosjekt-JSON og sprengt lagringskvoten i nettleseren.
 * Holdbarheten er uendret: foto på web lever i sesjonen til opplastingen
 * har gitt dem en varig serverkopi (jf. persistMediaLocally).
 */
export async function dataUrlToObjectUrlWeb(uri: string): Promise<string | null> {
  if (Platform.OS !== 'web') return null;
  try {
    const response = await fetch(uri, { signal: AbortSignal.timeout(30_000) });
    if (!response.ok) return null;
    return URL.createObjectURL(await response.blob());
  } catch {
    return null;
  }
}

/**
 * Skaler ned et for stort bilde på web (canvas → JPEG) til det er under
 * `maxBytes`. Kamera-appens originaler er ofte 8–15 MB; expo-image-picker
 * komprimerer ikke på web, så uten dette avvises de. Returnerer en ny
 * objectURL, eller null hvis nedskaleringen feiler — da avgjør kalleren.
 */
export async function downscalePhotoWeb(uri: string, maxBytes: number): Promise<string | null> {
  if (Platform.OS !== 'web') return null;
  try {
    const response = await fetch(uri, { signal: AbortSignal.timeout(30_000) });
    if (!response.ok) return null;
    const blob = await response.blob();
    // createImageBitmap respekterer EXIF-orientering i moderne nettlesere.
    const bitmap = await createImageBitmap(blob);
    const scale = Math.min(1, MAX_DIMENSION / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(bitmap.width * scale));
    canvas.height = Math.max(1, Math.round(bitmap.height * scale));
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;
    ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    bitmap.close?.();
    for (const quality of [0.8, 0.6, 0.4]) {
      const out = await new Promise<Blob | null>((resolve) =>
        canvas.toBlob(resolve, 'image/jpeg', quality)
      );
      if (out && out.size <= maxBytes) return URL.createObjectURL(out);
    }
    return null;
  } catch (err) {
    logError(err, 'photo-downscale-web');
    return null;
  }
}
