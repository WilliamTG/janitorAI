// geo.ts – posisjon på bevis (B9). Fangst skal ALDRI blokkeres av geo:
// funksjonen kaster aldri, og gir null ved avslag, timeout eller manglende
// modul (expo-location kan mangle i eldre dev-bygg — derfor require i try/catch).

import { Platform } from 'react-native';

import { GeoPoint } from '@/src/features/projects/types';

const TIMEOUT_MS = 5000;

function webGeo(): Promise<GeoPoint | null> {
  return new Promise((resolve) => {
    // Geolocation krever secure context (https/localhost) — utenfor det finnes
    // ikke navigator.geolocation, og vi svarer null i stedet for å feile.
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      resolve(null);
      return;
    }
    const timer = setTimeout(() => resolve(null), TIMEOUT_MS);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        clearTimeout(timer);
        resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude });
      },
      () => {
        clearTimeout(timer);
        resolve(null);
      },
      { enableHighAccuracy: false, timeout: TIMEOUT_MS, maximumAge: 60000 },
    );
  });
}

async function nativeGeo(): Promise<GeoPoint | null> {
  let Location: any;
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    Location = require('expo-location');
  } catch {
    return null;
  }
  try {
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== 'granted') return null;
    const pos = await Promise.race([
      Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced }),
      new Promise<null>((resolve) => setTimeout(() => resolve(null), TIMEOUT_MS)),
    ]);
    if (!pos || !pos.coords) return null;
    return { lat: pos.coords.latitude, lng: pos.coords.longitude };
  } catch {
    return null;
  }
}

export async function getCurrentGeo(): Promise<GeoPoint | null> {
  try {
    return Platform.OS === 'web' ? await webGeo() : await nativeGeo();
  } catch {
    return null;
  }
}
